#!/usr/bin/env python3
"""Non-destructive source, Windows and Android release readiness report.

Checks existence and high-confidence structural evidence only.  Does not run,
install or download models, app binaries, agents or third-party integrations.
Does not read task content, access tokens, SQLite user data or environment secrets.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent


def inspect(source=ROOT, windows_dist=None, android_apk=None):
    source = Path(source).resolve()
    repo = source.parent
    static = source / "static"
    python_source = all((source / name).is_file() for name in (
        "app.py", "engine/core.py", "engine/adaptive_runtime.py",
        "engine/operating_desk.py", "engine/reviewed_knowledge.py"))
    pages = all((static / name).is_file() for name in (
        "index.html", "app.js", "chat_renderer.js", "style.css", "sw.js"))
    reg = (source / "config/adaptive-model-registry.json")
    if not reg.is_file():
        reg = repo / "config/adaptive-model-registry.json"
    registry = False
    if reg.is_file():
        try:
            data = json.loads(reg.read_text(encoding="utf-8"))
            registry = [x.get("id") for x in data.get("tiers", ())] == ["nano", "lite", "advanced"]
        except (OSError, ValueError, TypeError, AttributeError):
            registry = False
    android_project = source / "android-nano"
    android_source = all((android_project / name).is_file() for name in (
        "app/src/main/AndroidManifest.xml",
        "app/src/main/java/com/theorg/adaptive1/MainActivity.java",
        "app/build.gradle"))
    windows_exe = Path(windows_dist) / "TheOrg.exe" if windows_dist else None
    # File presence alone is never equivalent to a successful Windows install.
    windows_present = bool(windows_exe and windows_exe.is_file())
    android_candidate = Path(android_apk) if android_apk else None
    android_present = bool(android_candidate and android_candidate.is_file())
    result = {
        "schema": "theorg-release-readiness-v1", "kind": "inspection_only",
        "source": {"engine_files_present": python_source,
                   "web_ui_files_present": pages,
                   "adaptive_1_2_3_registry_present": registry,
                   "android_nano_source_present": android_source},
        "windows": {"candidate_exe_present": windows_present,
                    "smoke_test_verified": False, "installer_verified": False},
        "android": {"candidate_apk_present": android_present,
                    "installed_on_device": False, "hardware_verified": False},
        "models": {"gguf_inference_verified": False,
                   "cpu_memory_benchmark_verified": False,
                   "model_downloads_performed": False},
        "agents": {"real_os_actions_tested": False,
                   "permission_boundary_hardware_tested": False},
        "website": {"local_web_ui_source_present": pages,
                    "public_website_deployment_verified": False,
                    "third_party_integrations_connected": False},
        "production_go": False,
        "unverified": ["Windows EXE smoke receipt", "Android APK physical-device test",
                       "real compatible GGUF generation", "cross-device agent approvals",
                       "public web domain/hosting if desired"],
        "note": "Source presence is not release acceptance; no external operations were performed."
    }
    return result


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", type=Path, default=ROOT)
    ap.add_argument("--windows-dist", type=Path)
    ap.add_argument("--android-apk", type=Path)
    ap.add_argument("--report", type=Path)
    args = ap.parse_args(argv)
    result = inspect(args.source, args.windows_dist, args.android_apk)
    raw = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(raw, encoding="utf-8")
    print(raw, end="")
    # Not a release pass: enforce a nonzero status if used as a release gate.
    return 2 if not result["production_go"] else 0


if __name__ == "__main__":
    sys.exit(main())
