#!/usr/bin/env python3
"""Fail-closed integrity manifest for the reviewed Adaptive source distribution.

Usage:
    python tools/adaptive_integrity.py create --output out/adaptive/manifest.json
    python tools/adaptive_integrity.py verify --manifest out/adaptive/manifest.json

Creation requires a clean Git checkout, and verification does not refresh hashes.
Never includes real GGUF weights, private user data or nested ZIP files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
ALLOW=(
    "config/adaptive-model-registry.json",
    "offline_desktop/engine/adaptive_runtime.py",
    "offline_desktop/engine/device_capabilities.py",
    "offline_desktop/engine/core.py",
    "offline_desktop/static/index.html",
    "offline_desktop/static/app.js",
    "offline_desktop/static/style.css",
    "offline_desktop/static/chat_experience.css",
    "offline_desktop/static/design_polish.css",
    "offline_desktop/static/chat_renderer.js",
)
SCHEMA="theorg-adaptive-integrity-v1"


def git(*args):
    result=subprocess.run(["git", "-C", str(ROOT), *args],
             stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,
             timeout=15,check=False)
    if result.returncode:
        raise ValueError("Git checkout integrity inspection failed.")
    return result.stdout.strip()


def tracked_clean():
    if Path(git("rev-parse","--show-toplevel")).resolve() != ROOT.resolve():
        raise ValueError("Adaptive integrity must run at the actual Git checkout root.")
    if git("status","--porcelain","--untracked-files=no"):
        raise ValueError("Refuse manifest creation with modified tracked source.")
    return git("rev-parse","HEAD")


def safe_path(root,path):
    if type(path) is not str or path not in ALLOW:
        raise ValueError("Path is not in the approved, fixed Adaptive manifest allowlist.")
    candidate=root/path
    if candidate.is_symlink() or not candidate.is_file():
        raise ValueError("Expected source file missing, unreadable or symlinked: "+path)
    if candidate.resolve().parent != (root/Path(path).parent).resolve():
        raise ValueError("Source path escaped the checkout: "+path)
    if candidate.stat().st_size > 2*1024*1024:
        raise ValueError("Source file exceeds size limit: "+path)
    return candidate


def checksum(path):
    digest=hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            data=handle.read(1024*256)
            if not data:break
            digest.update(data)
    return digest.hexdigest()


def assert_no_nested_static_zips(root):
    static=root/"offline_desktop"/"static"
    if static.is_dir():
        archived=[str(p.relative_to(root)) for p in static.rglob("*")
                  if p.is_file() and p.suffix.lower() in (".zip",".7z",".rar")]
        if archived:
            raise ValueError("Nested compressed assets duplicate unpacked static source: "+", ".join(archived[:5]))


def create(output):
    commit=tracked_clean()
    assert_no_nested_static_zips(ROOT)
    files={name:checksum(safe_path(ROOT,name)) for name in ALLOW}
    data={
        "schema":SCHEMA,
        "reviewed_commit_sha":commit,
        "source_only":True,"model_weights_bundled":False,
        "runtime_inference_verified":False,
        "installer_verified":False,
        "static_duplicate_archive_detected":False,
        "files":files
    }
    target=Path(output).resolve()
    if ROOT not in target.parents or target == ROOT:
        raise ValueError("Manifest output must remain inside the checkout.")
    if target.exists() and target.is_symlink():
        raise ValueError("Manifest destination is a symlink.")
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(data,sort_keys=True,indent=2)+"\n",encoding="utf-8")
    verify(target)
    return {"manifest":str(target.relative_to(ROOT)),"source_sha256_count":len(files),
            "reviewed_commit_sha":commit,"runtime_verified":False}


def verify(manifest):
    target=Path(manifest).resolve()
    if not target.is_file() or target.stat().st_size>100*1024:
        raise ValueError("Manifest absent or unexpectedly large.")
    try:
        data=json.loads(target.read_text(encoding="utf-8"))
    except (ValueError,UnicodeError) as exc:
        raise ValueError("Manifest is not valid UTF-8 JSON.") from exc
    if not isinstance(data,dict) or data.get("schema")!=SCHEMA:
        raise ValueError("Unrecognized manifest schema.")
    sha=data.get("reviewed_commit_sha")
    if type(sha) is not str or len(sha)!=40 or any(c not in "0123456789abcdef" for c in sha):
        raise ValueError("Manifest commit is not a reviewed Git SHA.")
    if git("rev-parse","HEAD")!=sha:
        raise ValueError("Manifest was generated for a different commit; refuse stale integrity claims.")
    if data.get("model_weights_bundled") is not False or data.get("source_only") is not True:
        raise ValueError("Manifest claims a distribution outside the approved source-only scope.")
    files=data.get("files")
    if not isinstance(files,dict) or set(files)!=set(ALLOW):
        raise ValueError("Manifest file entries differ from the approved source list.")
    assert_no_nested_static_zips(ROOT)
    for name in ALLOW:
        if files[name]!=checksum(safe_path(ROOT,name)):
            raise ValueError("Stale or tampered SHA-256: "+name)
    return {"verified":True,"file_count":len(files),"commit":sha,
            "runtime_verified":False,"signed_installer_verified":False}


def main(argv=None):
    parser=argparse.ArgumentParser(description="Verify source-only Adaptive integrity.")
    parser.add_argument("mode",choices=("create","verify"))
    parser.add_argument("--output",default="out/adaptive/manifest.json")
    parser.add_argument("--manifest",default="out/adaptive/manifest.json")
    args=parser.parse_args(argv)
    try:
        result=create(args.output) if args.mode=="create" else verify(args.manifest)
    except (ValueError,OSError,subprocess.TimeoutExpired) as error:
        print(json.dumps({"ok":False,"error":str(error)}),file=sys.stderr)
        return 1
    print(json.dumps({"ok":True,**result},sort_keys=True))
    return 0


if __name__=="__main__":
    raise SystemExit(main())
