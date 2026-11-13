#!/usr/bin/env python3
"""TheOrg no-network source test runner. Not a compiled Windows/APK release test.

This script runs source tests and checks only; it does not install software,
download models, launch agents, sign an APK or publish anything.
"""
from __future__ import annotations
import argparse, json, re, shutil, subprocess, sys
from pathlib import Path

SOURCE=Path(__file__).resolve().parents[1]
REPO=SOURCE.parent
if str(SOURCE) not in sys.path: sys.path.insert(0,str(SOURCE))


def run(command,cwd,timeout=180):
    try:
        p=subprocess.run(command,cwd=cwd,text=True,capture_output=True,timeout=timeout,check=False)
    except (OSError,subprocess.TimeoutExpired) as e:
        return {"passed":False,"error":type(e).__name__,"exit_code":None}
    output=p.stdout+"\n"+p.stderr
    info={"passed":p.returncode==0,"exit_code":p.returncode}
    match=re.search(r'Ran\s+(\d+)\s+tests?\s+in',output)
    if match: info['python_tests']=int(match.group(1))
    match=re.search(r'# pass (\d+)',output)
    if match: info['node_tests_passed']=int(match.group(1))
    if p.returncode: info['error_tail']=output[-900:]
    return info


def inspect(allow_tests=True):
    from scripts import android_source_contract, release_readiness
    results={"schema":"theorg-bulk-source-check-v1","only_source_checks":True,
             "no_network_downloads":True,"installation_or_release_performed":False,
             "windows_exe_accepted":False,"android_device_accepted":False,
             "real_gguf_inference_accepted":False,"production_go":False,
             "readiness":release_readiness.inspect(),
             "android_source_contract":android_source_contract.verify()}
    if allow_tests:
        results['python']=run([sys.executable,'-m','unittest','discover','-s','tests','-q'],SOURCE)
        node=shutil.which('node')
        test_files=sorted(str(x.relative_to(REPO)) for x in (REPO/'tests').glob('*.test.cjs'))
        results['javascript']=run([node,'--test',*test_files],REPO) if node and test_files else {"passed":False,"error":"Node.js or tests missing"}
        results['js_syntax']=run([node,'--check','static/app.js'],SOURCE) if node else {"passed":False,"error":"Node.js missing"}
        results['self_test']=run([sys.executable,'app.py','--self-test'],SOURCE)
    results['source_checks_passed']=bool(results['android_source_contract']['passed'] and
        results['readiness']['source']['engine_files_present'] and
        results['readiness']['source']['adaptive_1_2_3_registry_present'] and
        all(v.get('passed') for k,v in results.items() if k in ('python','javascript','js_syntax','self_test')))
    return results


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--no-tests',action='store_true',help='Inspect source without running any tests')
    p.add_argument('--report',type=Path,help='Optional JSON receipt in a user-chosen location')
    args=p.parse_args(argv)
    result=inspect(not args.no_tests)
    contents=json.dumps(result,indent=2,sort_keys=True)+'\n'
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(contents,encoding='utf-8')
    print(contents)
    return 0 if result['source_checks_passed'] else 1

if __name__=='__main__':raise SystemExit(main())
