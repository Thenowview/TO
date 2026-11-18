#!/usr/bin/env python3
"""Read-only GIZE OT source readiness check; no network, secrets or production actions."""
import argparse
import json
from pathlib import Path

REQUIRED = {
    "desktop_runtime": ["offline_desktop/app.py", "offline_desktop/engine/core.py"],
    "desktop_tests": ["offline_desktop/tests/test_api.py", "offline_desktop/tests/test_i18n_assets.py"],
    "offline_web": ["offline_desktop/static/sw.js", "offline_desktop/static/i18n.js"],
    "encrypted_artifacts": ["gaiz/v2.mjs", "gaiz/fixtures/fixed-fixture.test.mjs"],
    "governance": ["docs/CURRENT_IMPLEMENTATION_BASELINE.md", "config/release-gates.json"],
    "native_bridge": ["engine/bridge/Program.cs", "engine/bridge/TheOrg.Bridge.csproj"],
}

def check(root):
    root = Path(root).resolve()
    checks = []
    for category, paths in REQUIRED.items():
        missing = [path for path in paths if not (root / path).is_file()]
        checks.append({"category": category, "status": "present" if not missing else "missing",
                       "missing": missing})
    # Presence alone is never counted as functional or security certification.
    return {"project": "GIZE OT", "scope": "source-presence-only",
            "checks": checks, "source_complete": all(x["status"] == "present" for x in checks),
            "release_approved": False,
            "unverified": ["Windows install and upgrade", "offline key custody/decryption",
                           ".gize output and legacy .gaiz compatibility",
                           "TEBE/TEFE authenticated integration", "all supported language coverage",
                           "desktop task permissions and recovery", "CI and live deployment"]}

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    args = parser.parse_args(argv)
    report = check(args.root)
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for item in report["checks"]:
            print(f'{item["status"].upper():7} {item["category"]}' +
                  (": " + ", ".join(item["missing"]) if item["missing"] else ""))
        print("Release approval: NOT VERIFIED")
    return 0 if report["source_complete"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
