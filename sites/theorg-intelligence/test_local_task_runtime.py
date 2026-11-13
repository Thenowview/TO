"""Run: python -m unittest discover -s sites/theorg-intelligence -p 'test_local_task_runtime.py' -v
No network server is started and no production DB or credentials are read.
"""
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("local-task-runtime.py")
spec = importlib.util.spec_from_file_location("theorg_local_task_runtime", MODULE_PATH)
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

def identity(role, actor, tenant="tenantA", company="companyA"):
    return {"role": role, "actor": actor, "tenant": tenant, "company": company}

class LocalTaskRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.db = runtime.connect(Path(self.folder.name) / "tasks.db")
        self.owner = identity("analyst", "alice")
        self.executive = identity("executive", "ceo")
        self.worker = identity("runtime", "worker")
        self.reviewer = identity("reviewer", "qa")
        self.input = {"title":"Analyze example KPI variance","tool":"kpi-variance",
                      "inputs":{"rows":[{"name":"Delivery", "actual":83,"target":90}]}}
    def tearDown(self):
        self.db.close()
        self.folder.cleanup()
    def new_task(self):
        return runtime.create(self.db,self.owner,self.input)["id"]
    def test_draft_persists_and_is_scoped(self):
        task_id = self.new_task()
        self.assertEqual(runtime.get(self.db,self.owner,task_id)["status"],"draft")
        with self.assertRaises(KeyError):
            runtime.get(self.db,identity("viewer","eve","otherTenant"),task_id)
    def test_approve_run_independent_review_and_dashboard(self):
        task_id = self.new_task()
        with self.assertRaises(PermissionError):
            runtime.move(self.db,self.worker,task_id,"run")
        runtime.move(self.db,self.executive,task_id,"approve")
        result = runtime.move(self.db,self.worker,task_id,"run")
        self.assertEqual(result["status"],"awaiting-qa")
        self.assertEqual(runtime.dashboard(self.db,self.owner)["accepted"],0)
        runtime.move(self.db,self.reviewer,task_id,"accept")
        self.assertEqual(runtime.dashboard(self.db,self.owner)["accepted"],1)
        self.assertEqual(runtime.dashboard(self.db,self.owner)["locally_accepted"],1)
        self.assertEqual(runtime.dashboard(self.db,self.owner)["business_verified"],0)
        self.assertEqual(runtime.dashboard(self.db,self.owner)["not_verified"],1)
        events = self.db.execute("SELECT action FROM events WHERE task_id=? ORDER BY at,id",(task_id,)).fetchall()
        self.assertEqual(len(events),4)
    def test_owner_cannot_review_own_job_even_if_role_claimed(self):
        task_id=self.new_task()
        runtime.move(self.db,self.executive,task_id,"approve")
        runtime.move(self.db,self.worker,task_id,"run")
        with self.assertRaises(PermissionError):
            runtime.move(self.db,identity("reviewer","alice"),task_id,"accept")
    def test_tampered_digest_blocks_acceptance(self):
        task_id=self.new_task()
        runtime.move(self.db,self.executive,task_id,"approve")
        runtime.move(self.db,self.worker,task_id,"run")
        with self.db:
            self.db.execute("UPDATE tasks SET digest=? WHERE id=?",("sha256:"+"0"*64,task_id))
        with self.assertRaises(ValueError):
            runtime.move(self.db,self.reviewer,task_id,"accept")
    def test_audit_rows_are_immutable(self):
        task_id=self.new_task()
        with self.assertRaises(Exception):
            with self.db:self.db.execute("UPDATE events SET action='forged' WHERE task_id=?",(task_id,))
        with self.assertRaises(Exception):
            with self.db:self.db.execute("DELETE FROM events WHERE task_id=?",(task_id,))
    def test_nonfinite_and_invalid_rows_are_denied(self):
        for value in [float("nan"),float("inf"),-1,101,True]:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    runtime.validate_rows({"rows":[{"name":"Score","actual":value,"target":90}]})
    def test_unapproved_tools_rejected(self):
        with self.assertRaises(ValueError):
            runtime.create(self.db,self.owner,{**self.input,"tool":"shell"})
    def test_invalid_task_payload_rejected(self):
        with self.assertRaises(ValueError):
            runtime.create(self.db,self.owner,["not-a-task"])
    def test_boundaries_survive_database_restart(self):
        task_id=self.new_task()
        self.db.close()
        self.db=runtime.connect(Path(self.folder.name)/"tasks.db")
        self.assertEqual(runtime.get(self.db,self.owner,task_id)["status"],"draft")
        self.assertEqual(len(self.db.execute("SELECT * FROM events").fetchall()),1)
    def test_export_bundle_company_isolation_and_event_membership(self):
        own_id=self.new_task()
        other=identity("analyst","bob","differentTenant","companyA")
        runtime.create(self.db,other,self.input)
        bundle=runtime.export_bundle(self.db,self.owner)
        self.assertEqual(bundle["schema_version"],"theorg-local-bundle-1")
        self.assertEqual(bundle["company"],"companyA")
        self.assertEqual(len(bundle["tasks"]),1)
        self.assertEqual(bundle["tasks"][0]["id"],own_id)
        self.assertEqual(len(bundle["events"]),1)
        self.assertEqual(bundle["events"][0]["task_id"],own_id)
        self.assertFalse(bundle["source_provenance_verified"])
        self.assertFalse(bundle["cloud_sync"])
    def test_empty_company_export(self):
        bundle=runtime.export_bundle(self.db,identity("analyst","reader"))
        self.assertEqual(bundle["tasks"],[])
        self.assertEqual(bundle["events"],[])
    def test_runtime_and_viewer_cannot_export_company_audit(self):
        self.new_task()
        for who in (self.worker, identity("viewer","reader")):
            with self.subTest(role=who["role"]):
                with self.assertRaises(PermissionError):
                    runtime.export_bundle(self.db,who)
        self.assertEqual(len(runtime.export_bundle(self.db,self.executive)["tasks"]),1)
    def test_review_evidence_endpoint_scopes_and_integrity(self):
        task_id=self.new_task()
        runtime.move(self.db,self.executive,task_id,"approve")
        runtime.move(self.db,self.worker,task_id,"run")
        evidence=runtime.evidence_for_review(self.db,self.reviewer,task_id)
        self.assertEqual(evidence["task_id"],task_id)
        self.assertTrue(evidence["integrity_matches"])
        self.assertFalse(evidence["source_provenance_verified"])
        self.assertIn("mean_variance",evidence["result"])
        with self.assertRaises(PermissionError):
            runtime.evidence_for_review(self.db,self.owner,task_id)
        with self.assertRaises(KeyError):
            runtime.evidence_for_review(self.db,identity("reviewer","qa2","otherTenant"),task_id)
    def test_evidence_read_detects_tampering(self):
        task_id=self.new_task()
        runtime.move(self.db,self.executive,task_id,"approve")
        runtime.move(self.db,self.worker,task_id,"run")
        with self.db:
            self.db.execute("UPDATE tasks SET digest=? WHERE id=?",("sha256:"+"0"*64,task_id))
        evidence=runtime.evidence_for_review(self.db,self.reviewer,task_id)
        self.assertFalse(evidence["integrity_matches"])
    def test_export_contains_bounded_task_metrics_but_no_source_rows(self):
        task_id=self.new_task()
        runtime.move(self.db,self.executive,task_id,"approve")
        runtime.move(self.db,self.worker,task_id,"run")
        bundle=runtime.export_bundle(self.db,self.owner)
        summary=bundle["tasks"][0]["metric_summary"]
        self.assertEqual(summary["mean_variance"],-7)
        self.assertEqual(summary["metrics_count"],1)
        self.assertFalse(summary["source_provenance_verified"])
        self.assertNotIn("rows",str(summary))
        self.assertFalse(bundle["source_provenance_verified"])
    def test_corrupt_metric_digest_excluded_from_local_export(self):
        task_id=self.new_task()
        runtime.move(self.db,self.executive,task_id,"approve")
        runtime.move(self.db,self.worker,task_id,"run")
        before=runtime.export_bundle(self.db,self.owner)
        self.assertEqual(before["tasks"][0]["metric_summary"]["mean_variance"],-7)
        self.assertTrue(before["tasks"][0]["metric_summary"]["integrity_matches"])
        with self.db:
            self.db.execute("UPDATE tasks SET digest=? WHERE id=?",("sha256:"+"f"*64,task_id))
        after=runtime.export_bundle(self.db,self.owner)
        self.assertIsNone(after["tasks"][0]["metric_summary"])
        self.assertEqual(runtime.dashboard(self.db,self.owner)["business_verified"],0)
    def test_unaccepted_tasks_never_count_as_business_verified(self):
        task_id=self.new_task()
        self.assertEqual(runtime.dashboard(self.db,self.owner)["not_verified"],1)
        self.assertEqual(runtime.dashboard(self.db,self.owner)["business_verified"],0)
    def test_model_advice_disabled_by_default(self):
        original=os.environ.pop("THEORG_ENABLE_OLLAMA",None)
        try:
            with self.assertRaises(PermissionError):
                runtime.model_advisory("Describe","qwen3")
        finally:
            if original is not None:os.environ["THEORG_ENABLE_OLLAMA"]=original

if __name__=="__main__":
    unittest.main()
