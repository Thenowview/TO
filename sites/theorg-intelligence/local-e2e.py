"""End-to-end synthetic local task -> approval -> bounded calculation -> QA -> reports.
Run only in a test environment:
  python3 sites/theorg-intelligence/local-e2e.py

Uses a temporary SQLite database and independent synthetic identities; no tokens,
Ollama, network, Cloudflare, OS automation or production records.
"""
import importlib.util
import json
import subprocess
import tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("theorg_runtime",ROOT/"local-task-runtime.py")
runtime=importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

def ident(role,actor):
    return {"role":role,"actor":actor,"tenant":"exampletenant","company":"examplecompany"}

def main():
    with tempfile.TemporaryDirectory(prefix="theorg-e2e-") as temp:
        root=Path(temp)
        db=runtime.connect(root/"local.sqlite3")
        try:
            owner=ident("analyst","analystA")
            ceo=ident("executive","ceoB")
            worker=ident("runtime","workerC")
            qa=ident("reviewer","reviewerD")
            created=runtime.create(db,owner,{
                "title":"Review synthetic milestone performance",
                "tool":"kpi-variance",
                "inputs":{"rows":[{"name":"Milestone delivery","actual":83,"target":90}]}
            })
            task=created["id"]
            assert created["status"]=="draft"
            assert runtime.move(db,ceo,task,"approve")["status"]=="approved"
            assert runtime.move(db,worker,task,"run")["status"]=="awaiting-qa"
            assert runtime.dashboard(db,owner)["accepted"]==0
            assert runtime.move(db,qa,task,"accept")["status"]=="accepted"
            bundle=runtime.export_bundle(db,owner)
            assert len(bundle["tasks"])==1 and len(bundle["events"])==4
            assert bundle["tasks"][0]["metric_summary"]["mean_variance"] == -7
            assert bundle["tasks"][0]["metric_summary"]["source_provenance_verified"] is False
            assert bundle["source_provenance_verified"] is False
            output=root/"reports"
            result=subprocess.run(["node",str(ROOT/"local-report-cli.mjs"),str(output)],
                input=json.dumps(bundle),capture_output=True,text=True,timeout=30,check=True)
            created_files=json.loads(result.stdout)["reports"]
            assert len(created_files)==8
            report=json.loads((output/"theorg-ai-workforce-report.json").read_text(encoding="utf-8"))
            assert report["status"]=="caller-supplied"
            assert report["metrics"]["claimed_local_acceptances"]==1
            assert report["metrics"]["verified_business_sources"]==0
            assert report["metrics"]["measured_local_analyses"]==1
            assert report["metrics"]["mean_supplied_kpi_variance"]==-7
            assert report["tasks"][0]["verified"] is False
            assert "Not verified" in (output/"theorg-ai-workforce-report.html").read_text(encoding="utf-8")
            print("PASS: bounded execution + independently authorized local QA + durable audit + 8 unverified report exports")
        finally:
            db.close()

if __name__=="__main__":
    main()
