#!/usr/bin/env python3
"""Read-only Android Nano source security contracts. NOT an APK/device test."""
from __future__ import annotations
import argparse
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]/"android-nano"


def verify(project=ROOT):
    project=Path(project)
    manifest=project/"app/src/main/AndroidManifest.xml"
    java=project/"app/src/main/java/com/theorg/adaptive1/MainActivity.java"
    gradle=project/"app/build.gradle"
    results={}
    try:
        m=manifest.read_text(encoding="utf-8")
        j=java.read_text(encoding="utf-8")
        g=gradle.read_text(encoding="utf-8")
    except OSError:
        return {"passed":False, "source_only":True, "checks":{"files_present":False}}
    # The commented word INTERNET must not be mistaken for a permission grant.
    results["no_network_permission"] = '<uses-permission' not in m and 'android.permission.INTERNET' not in m.replace('<!-- No INTERNET permission: Adaptive 1 is fully offline. -->','')
    results["backup_disabled"] = 'android:allowBackup="false"' in m
    results["cleartext_disabled"] = 'android:usesCleartextTraffic="false"' in m
    results["file_access_disabled"] = 'setAllowFileAccess(false)' in j and 'setAllowContentAccess(false)' in j
    results["navigation_blocked"] = 'shouldOverrideUrlLoading' in j and 'return true; // all navigation blocked' in j
    results["requests_blocked"] = 'shouldInterceptRequest' in j and '"Blocked"' in j
    results["bundled_static_only"] = 'getAssets().open("nano.html")' in j and 'loadDataWithBaseURL' in j
    results["native_sqlite"] = 'SQLiteOpenHelper' in j and 'getWritableDatabase()' in j
    results["gradle_project"] = 'com.android.application' in g
    return {"passed":all(results.values()), "source_only":True, "checks":results,
            "apk_built":False, "device_verified":False}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--project",type=Path,default=ROOT)
    args=p.parse_args()
    result=verify(args.project)
    print(json.dumps(result,indent=2,sort_keys=True))
    return 0 if result["passed"] else 1

if __name__ == "__main__":raise SystemExit(main())
