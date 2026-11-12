"""Source regression tests for TheOrg's company execution and QA boundaries.

These tests use synthetic local projects and mock the external agent CLI;
they do NOT establish a real Windows/OpenCode/GGUF end-to-end pass.
"""
from __future__ import annotations

import hashlib
import json
import sys
import threading
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from engine import core, coding, company_execution as company, opencode_adapter as adapter


class CompanyExecutionTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix="theorg_company_test_")
        self.addCleanup(self.tmp.cleanup)
        self.before=(core.DATA,core.WORKSPACE,core.MODELS,core.DB)
        self.addCleanup(self._restore)
        base=Path(self.tmp.name)
        core.DATA=base/"data"
        core.WORKSPACE=base/"workspace"
        core.MODELS=base/"models"
        core.DB=core.DATA/"company_test.sqlite3"
        core.init()
        company.init_schema()
        self.project_id="b"*16
        self.project=core.WORKSPACE/"projects"/"demo"
        self.project.mkdir(parents=True)
        (self.project/"main.py").write_text("old\n",encoding="utf-8")
        self.project_patch=patch.object(coding,"_project",lambda project_id:
            self.project if project_id==self.project_id else
            (_ for _ in ()).throw(core.EngineError("Unknown project")))
        self.project_patch.start()
        self.addCleanup(self.project_patch.stop)

    def _restore(self):
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=self.before
        company._THREADS.clear()
        company._CANCEL_EVENTS.clear()

    def _create(self, tasks=None):
        if tasks is None:
            tasks=[{"role":"developer","instruction":"Edit main.py in the copied source safely.",
                    "mode":"isolated_edit"},
                   {"role":"qa_auditor","instruction":"Independently inspect outputs and missing tests.",
                    "mode":"read_only","depends_on":[0]}]
        return company.create_order("demo",self.project_id,"Improve demo project safely",
                                    tasks,confirmed=True)

    def _complete_job(self, order):
        job=order["jobs"][0]
        before=hashlib.sha256(b"old\n").hexdigest()
        after=hashlib.sha256(b"new\n").hexdigest()
        stage=(core.WORKSPACE/"theorg_agent_runs"/"demo"/order["id"]/
               job["id"]/("a"*16))
        stage.mkdir(parents=True)
        (stage/"main.py").write_text("new\n",encoding="utf-8")
        result=adapter.manifest(stage)
        digest=hashlib.sha256(json.dumps(result,sort_keys=True).encode()).hexdigest()
        root_digest=hashlib.sha256(json.dumps(adapter.manifest(self.project),sort_keys=True).encode()).hexdigest()
        report={"project_baseline_manifest_sha256":root_digest,
                "engine":"opencode","exit_code":0,"status":"submitted_for_qa",
                "changed_files":[{"path":"main.py","before":before,"after":after}],
                "changed_count":1,"unexpected_files":[],
                "final_manifest_sha256":digest,"summary":"Wrote a new synthetic main.py"}
        with core.conn() as db:
            db.execute("UPDATE company_jobs SET status='submitted_for_qa',"
                       "report_json=?,staging_path=? WHERE id=?",
                       (json.dumps(report),str(stage),job["id"]))
        return job["id"],stage

    def test_bounded_audit_json_is_valid_or_refused_without_truncation(self):
        payload={"status":"submitted_for_qa","summary":"Reviewed ✓ with source lineage"}
        encoded=json.dumps(payload,ensure_ascii=False,sort_keys=True)
        exact=len(encoded.encode("utf-8"))
        saved=company._bounded_json(payload,exact,"Agent report")
        self.assertEqual(json.loads(saved),payload)
        with self.assertRaisesRegex(core.EngineError,"safe audit size limit"):
            company._bounded_json(payload,exact-1,"Agent report")
        # Do not silently corrupt Unicode JSON or store non-serializable objects.
        with self.assertRaisesRegex(core.EngineError,"valid UTF-8 JSON"):
            company._bounded_json({"unserializable":object()},30000,"Agent report")
        with self.assertRaisesRegex(core.EngineError,"valid UTF-8 JSON"):
            company._bounded_json({"invalid_unicode":chr(0xD800)},30000,"Agent report")

    def test_corrupt_agent_report_is_not_accepted_for_qa(self):
        order=self._create()
        job_id=order["jobs"][0]["id"]
        with core.conn() as db:
            db.execute("UPDATE company_jobs SET report_json=? WHERE id=?",
                       ('{"partial":',job_id))
        with self.assertRaisesRegex(core.EngineError,"invalid JSON"):
            company._read_job(job_id)
        with self.assertRaisesRegex(core.EngineError,"invalid JSON"):
            company.structural_qa(job_id)
        # A bad persisted dependency graph must also fail closed.
        with core.conn() as db:
            db.execute("UPDATE company_jobs SET report_json=?,depends_on=? WHERE id=?",
                       ('{}','["not-a-valid-job-id"]',job_id))
        with self.assertRaisesRegex(core.EngineError,"invalid structure"):
            company._read_job(job_id)

    def test_company_profile_editor_is_scoped_and_immutable(self):
        names=company.company_profiles("demo")
        self.assertEqual(len(names),12)
        self.assertTrue(any(x["id"]=="qa_auditor" for x in names))
        updated=company.save_company_profile("demo","developer",
              {"display_name":"Code Specialist","expertise":["Python"],"enabled":True},
              confirmed=True)
        self.assertEqual(updated["display_name"],"Code Specialist")
        self.assertNotEqual(
            next(x for x in company.company_profiles("other") if x["id"]=="developer")["display_name"],
            "Code Specialist")
        with self.assertRaises(core.EngineError):
            company.save_company_profile("demo","developer",{"id":"qa_auditor"},confirmed=True)
        with self.assertRaises(core.EngineError):
            company.save_company_profile("demo","qa_auditor",{"enabled":False},confirmed=True)

    def test_dependencies_and_company_binding(self):
        order=self._create()
        with self.assertRaisesRegex(core.EngineError,"bound"):
            company.create_order("other",self.project_id,"Another company",
                                 [{"role":"planner","instruction":"Inspect local project"}],
                                 confirmed=True)
        self.assertEqual(order["jobs"][1]["depends_on"],[order["jobs"][0]["id"]])
        with self.assertRaises(core.EngineError):
            company.create_order("demo",self.project_id,"Invalid",
                [{"role":"planner","instruction":"Make an inspection", "depends_on":[0]}],
                confirmed=True)
        with self.assertRaises(core.EngineError):
            company.create_order("demo",self.project_id,"Missing approval",
                [{"role":"planner","instruction":"Make an inspection"}],confirmed=False)

    def test_structural_review_handoff_and_code_studio_draft(self):
        order=self._create()
        ident,stage=self._complete_job(order)
        self.assertTrue(company.structural_qa(ident)["structural_pass"])
        with self.assertRaises(core.EngineError):
            company.review(ident,"accept","Fake no-review claim",reviewer_role="developer",
                           confirmed=True)
        accepted=company.review(
            ident,"accept",
            "Independently opened the changed file and compared exact SHA-256 against output.",
            reviewer_role="qa_auditor",confirmed=True)
        self.assertEqual(accepted["state"],"accepted")
        handoffs=company.read_messages(order["id"],for_job=order["jobs"][1]["id"])
        self.assertEqual(len(handoffs),1)
        self.assertEqual(handoffs[0]["trust"],"untrusted")
        with patch.object(coding,"propose",return_value={"id":"draft-123","status":"draft"}) as propose:
            result=company.create_code_plan(ident,confirmed=True)
            self.assertEqual(result["status"],"draft")
            self.assertEqual(propose.call_args.args[0],self.project_id)
            self.assertEqual(propose.call_args.args[2][0]["content"],"new\n")
        exported=company.export_accepted(ident,confirmed=True)
        self.assertEqual(len(exported["files"]),2)
        self.assertTrue((Path(exported["folder"])/(ident+"-summary.md")).exists())
        with self.assertRaises(core.EngineError):
            company.export_accepted(ident,confirmed=True)
        (stage/"main.py").write_text("tampered\n",encoding="utf-8")
        self.assertFalse(company.structural_qa(ident)["structural_pass"])

    def test_four_slot_local_limit_and_requeue_requires_consent(self):
        jobs=[{"role":"planner","instruction":"Inspect another part of source."} for _ in range(5)]
        order=self._create(jobs)
        class FakeThread:
            def __init__(self,*args,**kwargs): pass
            def start(self): pass
        with patch.object(company.threading,"Thread",FakeThread):
            for task in order["jobs"][:4]:
                result=company.dispatch(task["id"],"ollama/my-model",
                      confirmed=True,data_transfer_confirmed=True,
                      isolated_edit_confirmed=False)
                self.assertEqual(result["status"],"running")
            with self.assertRaisesRegex(core.EngineError,"Four"):
                company.dispatch(order["jobs"][4]["id"],"ollama/my-model",
                    confirmed=True,data_transfer_confirmed=True,
                    isolated_edit_confirmed=False)
        company.init_schema()
        job=company._read_job(order["jobs"][0]["id"])
        self.assertEqual(job["status"],"interrupted")
        with self.assertRaises(core.EngineError):
            company.requeue(job["id"],confirmed=False)
        self.assertEqual(company.requeue(job["id"],confirmed=True)["status"],"queued")
        self.assertEqual(company.cancel_queued(job["id"],confirmed=True)["status"],"cancelled")

    def test_running_cancel_requires_owner_and_does_not_fake_completion(self):
        order=self._create([{"role":"planner","instruction":"Read the bounded local project."}])
        class FakeThread:
            def __init__(self,*args,**kwargs):pass
            def start(self):pass
        with patch.object(company.threading,"Thread",FakeThread):
            company.dispatch(order["jobs"][0]["id"],"ollama/demo",confirmed=True,
                             data_transfer_confirmed=True,isolated_edit_confirmed=False)
        job_id=order["jobs"][0]["id"]
        with self.assertRaises(core.EngineError):
            company.cancel_queued(job_id,confirmed=False)
        self.assertFalse(company._CANCEL_EVENTS[job_id].is_set())
        response=company.cancel_queued(job_id,confirmed=True)
        self.assertEqual(response["status"],"cancellation_requested")
        self.assertFalse(response["external_process_stopped"])
        self.assertTrue(company._CANCEL_EVENTS[job_id].is_set())
        self.assertEqual(company._read_job(job_id)["status"],"running")
        self.assertTrue(company._read_job(job_id)["cancellation_requested"])

    def test_prelaunch_cancel_prevents_running_external_cli(self):
        stage=core.WORKSPACE/"temp"/"cancelled"
        adapter.make_copy(self.project,stage)
        event=threading.Event()
        event.set()
        with patch.object(adapter,"_binary") as executable:
            with self.assertRaisesRegex(core.EngineError,"cancelled before launch"):
                adapter.run(stage,"Read this local synthetic project and summarize it.",
                            edit=False,model="ollama/demo",allow_provider_transfer=True,
                            cancel_event=event)
        executable.assert_not_called()

    def test_incompatible_opencode_version_is_rejected_before_execution(self):
        class StubVersion:
            returncode=0
            stdout="opencode 1.18.10"
            stderr=""
        with patch.object(adapter.subprocess,"run",return_value=StubVersion()):
            with self.assertRaisesRegex(core.EngineError,"requires OpenCode V2"):
                adapter._require_v2("/mock/opencode")
        StubVersion.stdout="opencode 2.2.5"
        with patch.object(adapter.subprocess,"run",return_value=StubVersion()):
            self.assertEqual(adapter._require_v2("/mock/opencode"),"opencode 2.2.5")

    def test_qa_rejects_outside_or_missing_attempt_workspace(self):
        order=self._create()
        ident,stage=self._complete_job(order)
        self.assertTrue(company.structural_qa(ident)["structural_pass"])
        company.review(ident,"accept",
                       "Independently inspected the source copy and verified its exact file digest.",
                       reviewer_role="qa_auditor",confirmed=True)
        with core.conn() as db:
            db.execute("UPDATE company_jobs SET staging_path=? WHERE id=?",
                       (str(self.project),ident))
        check=company.structural_qa(ident)
        self.assertFalse(check["structural_pass"])
        self.assertTrue(any("staging" in x.lower() for x in check["findings"]))
        with self.assertRaises(core.EngineError):
            company.export_accepted(ident,confirmed=True)
        with core.conn() as db:
            db.execute("UPDATE company_jobs SET staging_path='' WHERE id=?",(ident,))
        self.assertFalse(company.structural_qa(ident)["structural_pass"])

    def test_read_only_agent_changes_fail_even_with_zero_exit(self):
        stage=core.WORKSPACE/"temp"/"readonly"
        adapter.make_copy(self.project,stage)

        class FakeProcess:
            def __init__(self,*args,**kwargs):
                Path(kwargs["cwd"]).joinpath("main.py").write_text("mutated\n",encoding="utf-8")
                kwargs["stdout"].write(b'{"type":"text","part":{"type":"text","text":"done"}}\n')
            def wait(self,timeout):return 0

        with patch.object(adapter,"_binary",return_value="/mock/opencode"), \
             patch.object(adapter,"_require_v2",return_value="2.2.5"), \
             patch.object(adapter.subprocess,"Popen",FakeProcess):
            report=adapter.run(stage,"Inspect this synthetic source without modifying files.",
                               edit=False,model="ollama/demo",allow_provider_transfer=True)
        self.assertEqual(report["exit_code"],0)
        self.assertEqual(report["status"],"failed")
        self.assertEqual(report["changed_count"],1)
        self.assertTrue(report["safety_findings"])

    def test_structured_agent_errors_fail_even_with_zero_exit(self):
        stage=core.WORKSPACE/"temp"/"errors"
        adapter.make_copy(self.project,stage)

        class FakeProcess:
            def __init__(self,*args,**kwargs):
                kwargs["stdout"].write(b'{"type":"error","error":{"name":"ProviderError"}}\n')
            def wait(self,timeout):return 0

        with patch.object(adapter,"_binary",return_value="/mock/opencode"), \
             patch.object(adapter,"_require_v2",return_value="2.2.5"), \
             patch.object(adapter.subprocess,"Popen",FakeProcess):
            report=adapter.run(stage,"Read synthetic code and identify potential concerns.",
                               edit=False,model="ollama/demo",allow_provider_transfer=True)
        self.assertEqual(report["status"],"failed")
        self.assertEqual(report["provider_error_event_count"],1)

    def test_plain_language_preview_is_editable_and_never_authorizes_execution(self):
        plan=company.preview_instruction_plan("demo",self.project_id,
            "Build a simple synthetic dashboard to summarize local tasks.")
        self.assertTrue(plan["draft_only"])
        self.assertTrue(plan["source_edit_proposed"])
        self.assertFalse(plan["external_actions_authorized"])
        self.assertFalse(plan["model_called"])
        self.assertEqual([t["role"] for t in plan["tasks"]],
                         ["planner","developer","qa_auditor","security_officer"])
        self.assertEqual(plan["tasks"][2]["depends_on"],[1])
        guarded=company.preview_instruction_plan("demo",self.project_id,
            "Build and deploy to production now.")
        self.assertTrue(guarded["needs_manual_scoping"])
        self.assertFalse(guarded["source_edit_proposed"])
        self.assertTrue(all(t["mode"]=="read_only" for t in guarded["tasks"]))

    def test_stale_ai_qa_review_slot_recovered_on_restart(self):
        order=self._create()
        job_id=order["jobs"][0]["id"]
        with core.conn() as db:
            db.execute("""INSERT INTO company_qa VALUES(?,?,?,?,?,?,?)""",
                       ("c"*24,job_id,"ai_qa","running","",
                        json.dumps({"model":"ollama/demo"}),core.utcnow()))
        company.init_schema()
        rows=company.qa_history(job_id)
        self.assertEqual(rows[0]["verdict"],"interrupted")
        active=core.records("SELECT count(*) AS n FROM company_qa WHERE verdict='running'")
        self.assertEqual(active[0]["n"],0)

    def test_accepted_dependency_inherits_actual_reviewed_source(self):
        order=self._create()
        parent_id,stage=self._complete_job(order)
        company.review(parent_id,"accept",
            "Inspected the synthetic output and checked the exact local file SHA256 digest.",
            reviewer_role="qa_auditor",confirmed=True)
        child=company._read_job(order["jobs"][1]["id"])
        inherited,source_job=company._approved_execution_source(child,self.project)
        self.assertEqual(source_job,parent_id)
        self.assertEqual(inherited,stage)
        self.assertEqual((inherited/"main.py").read_text(encoding="utf-8"),"new\n")

    def test_stale_original_project_blocks_cumulative_code_plan(self):
        order=self._create()
        job_id,_=self._complete_job(order)
        company.review(job_id,"accept",
            "Reviewed the staged content and its complete SHA-256 integrity evidence.",
            reviewer_role="qa_auditor",confirmed=True)
        (self.project/"main.py").write_text("someone else changed source",encoding="utf-8")
        with patch.object(coding,"propose") as proposed:
            with self.assertRaisesRegex(core.EngineError,"Original project has changed"):
                company.create_code_plan(job_id,confirmed=True)
        proposed.assert_not_called()

    def test_unreviewed_dependency_source_is_never_inherited(self):
        order=self._create()
        parent_id,_=self._complete_job(order)
        child=company._read_job(order["jobs"][1]["id"])
        with self.assertRaisesRegex(core.EngineError,"QA-accepted"):
            company._approved_execution_source(child,self.project)

    def test_adapter_policy_and_bounded_source_copy(self):
        protected=adapter._policy(False)["permissions"]
        self.assertTrue(any(x["action"]=="shell" and x["effect"]=="deny" for x in protected))
        self.assertFalse(any(x["action"]=="edit" and x["effect"]=="allow" for x in protected))
        self.assertTrue(any(x["action"]=="edit" and x["effect"]=="allow"
                            for x in adapter._policy(True)["permissions"]))
        (self.project/".env").write_text("private=something\n",encoding="utf-8")
        (self.project/"credentials.json").write_text('{"password":"secret"}',encoding="utf-8")
        (self.project/"node_modules").mkdir()
        (self.project/"node_modules"/"big.js").write_text("ignore",encoding="utf-8")
        stage=core.WORKSPACE/"temp"/"source_copy"
        manifest=adapter.make_copy(self.project,stage)
        self.assertIn("main.py",manifest)
        self.assertFalse((stage/".env").exists())
        self.assertFalse((stage/"credentials.json").exists())
        self.assertFalse((stage/"node_modules").exists())


if __name__=="__main__":
    unittest.main()
