"""Source regression tests for TheOrg's company execution and QA boundaries.

These tests use synthetic local projects and mock the external agent CLI;
they do NOT establish a real Windows/OpenCode/GGUF end-to-end pass.
"""
from __future__ import annotations

import hashlib
import json
import sys
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
               job["id"]/"a"*16)
        stage.mkdir(parents=True)
        (stage/"main.py").write_text("new\n",encoding="utf-8")
        result=adapter.manifest(stage)
        digest=hashlib.sha256(json.dumps(result,sort_keys=True).encode()).hexdigest()
        report={"engine":"opencode","exit_code":0,"status":"submitted_for_qa",
                "changed_files":[{"path":"main.py","before":before,"after":after}],
                "changed_count":1,"unexpected_files":[],
                "final_manifest_sha256":digest,"summary":"Wrote a new synthetic main.py"}
        with core.conn() as db:
            db.execute("UPDATE company_jobs SET status='submitted_for_qa',"
                       "report_json=?,staging_path=? WHERE id=?",
                       (json.dumps(report),str(stage),job["id"]))
        return job["id"],stage

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
