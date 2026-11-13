"""TheOrg portable local acceptance suite (no GitHub-hosted runner required).

Use on a trusted developer machine with Python 3.11+ and Node 22+:
    python sites/theorg-intelligence/run-local-checks.py

Runs source, task, report, SQLite and synthetic e2e checks without any production
account connections. Produces a JSON report inside the local dist/ directory.
Never deploys, merges, downloads dependencies or starts a server.
"""
from __future__ import annotations
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parent.parent
COMMANDS=[
 ("source-contract",["node",str(ROOT/"verify.mjs")]),
 ("enterprise-contract",["node","--test",str(ROOT/"enterprise.test.mjs")]),
 ("tool-registry",["node","--test",str(ROOT/"tool-platform.test.mjs")]),
 ("task-engine",["node","--test",str(ROOT/"task-engine.test.mjs")]),
 ("operations-and-reports",["node","--test",str(ROOT/"operations-suite.test.mjs")]),
 ("local-model-boundary",["node","--test",str(ROOT/"local-ai-cli.test.mjs")]),
 ("python-sqlite", [sys.executable,"-m","unittest","discover","-s",str(ROOT),"-p","test_local_*.py","-v"]),
 ("local-reporting",["node","--test",str(ROOT/"local-report-cli.test.mjs")]),
 ("synthetic-local-e2e",[sys.executable,str(ROOT/"local-e2e.py")]),
 ("browser-module-contract",["node",str(ROOT/"operations-ui.verify.mjs")]),
 ("worker-build",["node",str(ROOT/"build-worker.mjs")]),
 ("worker-routes",["node",str(ROOT/"verify-worker.mjs")]),
]
def main():
    if not shutil.which("node"):
        raise SystemExit("Node is unavailable; install Node 22+ on your local development machine")
    # Guard against leaking local API credentials into child processes.
    clean_env={k:v for k,v in os.environ.items()
        if not k.startswith(("THEORG_LOCAL_IDENTITIES","THEORG_ENABLE_OLLAMA","CLOUDFLARE_API","CF_API_TOKEN"))}
    outcomes=[]
    for name,args in COMMANDS:
        try:
            job=subprocess.run(args,cwd=PROJECT,env=clean_env,timeout=90,
                capture_output=True,text=True,encoding="utf-8",errors="replace",check=False)
            result={"name":name,"status":"passed" if job.returncode==0 else "failed",
                    "exit_code":job.returncode,
                    "output_tail":(job.stdout+"\n"+job.stderr)[-2800:]}
        except (OSError,subprocess.TimeoutExpired) as error:
            result={"name":name,"status":"failed","exit_code":None,
                    "output_tail":type(error).__name__}
        outcomes.append(result)
        print(("PASS" if result["status"]=="passed" else "FAIL")+" "+name,flush=True)
    report={"schema_version":"theorg-ci-local-1","generated_at":datetime.now(timezone.utc).isoformat(),
            "mode":"synthetic-local-no-production-actions",
            "passed":sum(x["status"]=="passed" for x in outcomes),
            "total":len(outcomes),"checks":outcomes}
    dest=ROOT/"dist"/"local-acceptance-report.json"
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(report,indent=2),encoding="utf-8")
    print("Report:",dest)
    if report["passed"]!=report["total"]:
        raise SystemExit("One or more local acceptance checks failed")
if __name__=="__main__":main()
