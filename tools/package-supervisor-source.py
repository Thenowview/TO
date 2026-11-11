#!/usr/bin/env python3
"""Reproducible TheOrg source-only preview. No credentials, GGUF weights or live data."""
from __future__ import annotations
import hashlib,json,sys,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"out"/"source-preview"
ALLOWED_DIRS=("apps/chrome-extension","engine/bridge","config","docs","tools","tests","offline_desktop")
ALLOWED_FILES=("README.md","THEORGS_MASTER.md")
SUFFIXES={".js",".cjs",".mjs",".json",".html",".css",".svg",".md",".cs",".csproj",".sln",
          ".ps1",".nsi",".py",".yml",".yaml",".txt",".cmd",".sh",".webmanifest",".ico"}
BANNED={".git","node_modules","dist","build","out","__pycache__","workspace","data",
        "models",".venv","bin","obj",".next"}
MAX_SIZE=2*1024*1024

def enumerate_sources():
    paths=set()
    for rootname in ALLOWED_DIRS:
        folder=ROOT/rootname
        if not folder.is_dir():continue
        for file in folder.rglob("*"):
            if not file.is_file() or file.is_symlink():continue
            relative=file.relative_to(ROOT)
            if set(relative.parts)&BANNED or file.suffix.lower() not in SUFFIXES:continue
            if file.stat().st_size>MAX_SIZE:raise RuntimeError("Unexpected oversized source file: "+str(relative))
            paths.add(relative)
    for filename in ALLOWED_FILES:
        if (ROOT/filename).is_file():paths.add(Path(filename))
    return sorted(paths,key=lambda x:x.as_posix())

def create():
    DEST.mkdir(parents=True,exist_ok=True)
    files=enumerate_sources()
    manifest={
       "schema":"theorg-supervisor-source-only-v1",
       "source_only":True,
       "production_ready":False,
       "local_model_bundled":False,
       "windows_executable_bundled":False,
       "provider_dom_automation_real_site_tested":False,
       "max_provider_agents":4,
       "provider_results_require_independent_qa":True,
       "files":{p.as_posix():hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in files}
    }
    archive=DEST/"TheOrg-Supervisor-CompanyAgents-SourceOnly.zip"
    with zipfile.ZipFile(archive,"w",zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for relative in files:
            info=zipfile.ZipInfo("TheOrg/"+relative.as_posix(),(2026,1,1,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            z.writestr(info,(ROOT/relative).read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
        info=zipfile.ZipInfo("TheOrg/SOURCE-MANIFEST.json",(2026,1,1,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,json.dumps(manifest,indent=2,sort_keys=True)+"\n",compress_type=zipfile.ZIP_DEFLATED)
    with zipfile.ZipFile(archive) as z:
        for p,h in manifest["files"].items():
            assert hashlib.sha256(z.read("TheOrg/"+p)).hexdigest()==h,p
    sha=hashlib.sha256(archive.read_bytes()).hexdigest()
    report={"archive":archive.name,"sha256":sha,"source_files":len(files),
            "source_only":True,"windows_exe":"not_tested","real_gguf":"not_tested",
            "provider_chatgpt_claude_live":"not_tested"}
    (DEST/"SOURCE-RECEIPT.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    (DEST/"SHA256SUMS.txt").write_text(f"{sha}  {archive.name}\n")
    print(json.dumps(report,indent=2))
if __name__=="__main__":
    create()
