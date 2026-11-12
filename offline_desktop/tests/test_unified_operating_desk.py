"""Offline operating desk and knowledge trust-boundary regressions."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from engine import core, adaptive_runtime, operating_desk, reviewed_knowledge, chat_sessions

G = 1024**3

class UnifiedOperatingDeskTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix="theorg_unified_qa_")
        self.addCleanup(self.tmp.cleanup)
        self.old=tuple(getattr(core,k) for k in ("DATA","WORKSPACE","MODELS","DB"))
        self.addCleanup(self.restore)
        root=Path(self.tmp.name)
        core.DATA=root/"data";core.WORKSPACE=root/"workspace"
        core.MODELS=root/"models";core.DB=core.DATA/"test.sqlite3"
        core.init();adaptive_runtime.init_schema();chat_sessions.init_schema()
    def restore(self):
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=self.old

    def test_read_only_desk_reports_counts_and_no_private_content(self):
        ident=core.enqueue("SECRET-NEVER-RETURN-THIS-TASK", "planner")
        core.add_memory("private", "SECRET-NEVER-RETURN-THIS-MEMORY")
        with patch("engine.device_capabilities.detect",return_value={"total_ram_bytes":8*G,"available_ram_bytes":int(2.2*G)}),patch.object(core,"llama_binary",return_value=None):
            desk=operating_desk.overview()
        self.assertEqual(desk["workspaces"]["personal_tasks"]["queued"],1)
        self.assertEqual(desk["workspaces"]["memories"],1)
        self.assertEqual(desk["adaptive"]["selected"],"nano")
        self.assertFalse(desk["no_external_contact"] is False)
        self.assertTrue(desk["permissions"]["tool_approval_required"])
        self.assertNotIn("SECRET-NEVER-RETURN",json.dumps(desk))
        self.assertEqual(core.tasks()[0]["id"],ident)

    def test_route_preview_never_calls_workers_or_trains(self):
        with patch.object(core,"enqueue") as enqueue,patch.object(core,"infer") as infer,\
             patch.object(core,"start_local_model") as start,patch.object(core,"llama_binary",return_value=None):
            outcome=operating_desk.route_preview("Review project risks",role="qa")
        self.assertEqual(outcome["role"],"qa")
        self.assertFalse(outcome["task_enqueued"])
        self.assertFalse(outcome["external_provider_contacted"])
        self.assertFalse(outcome["model_called"])
        enqueue.assert_not_called();infer.assert_not_called();start.assert_not_called()
        with self.assertRaises(core.EngineError):operating_desk.route_preview("hi")
        with self.assertRaises(core.EngineError):operating_desk.route_preview("Review project risks",role="nonexistent")

    def test_reviewed_solution_used_in_preview_without_execution(self):
        a=adaptive_runtime.propose("Prepare validated release notes","Review real tests before publishing.")
        adaptive_runtime.review(a["id"],approved=True,evidence="Owner checked actual source verification report.")
        result=operating_desk.route_preview("Prepare validated release notes")
        self.assertEqual(result["route"],"reviewed-local-solution")
        self.assertEqual(result["reviewed_solution"]["id"],a["id"])
        self.assertFalse(result["permission_granted"])

    def _sample_export(self):
        a=adaptive_runtime.propose("Fix supervised workload state","Use verified interruption and manual retry only.")
        adaptive_runtime.review(a["id"],approved=True,evidence="Owner inspected the interrupted-job lifecycle test.")
        return reviewed_knowledge.export_verified(confirmed=True)

    def test_export_requires_explicit_consent_and_excludes_memory_and_tokens(self):
        core.add_memory("password","Do not export this private memory note.")
        with self.assertRaisesRegex(core.EngineError,"Explicit consent"):
            reviewed_knowledge.export_verified()
        out=self._sample_export()
        self.assertEqual(out["bundle"]["schema"],reviewed_knowledge.SCHEMA)
        self.assertEqual(len(out["bundle"]["entries"]),1)
        self.assertNotIn("Do not export",json.dumps(out))
        self.assertFalse(out["bundle"]["includes_token_files"])
        self.assertTrue(out["bundle"]["manual_content_review_required"])
        self.assertNotIn("access-token",json.dumps(out))
        self.assertRegex(out["sha256"],r"^[0-9a-f]{64}$")
        self.assertTrue(reviewed_knowledge.validate_bundle(out["bundle"],out["sha256"])["valid"])

    def test_imported_verified_solution_is_candidate_until_owner_reviews(self):
        out=self._sample_export()
        with self.assertRaisesRegex(core.EngineError,"Explicit permission"):
            reviewed_knowledge.import_as_candidates(out["bundle"],out["sha256"])
        imported=reviewed_knowledge.import_as_candidates(out["bundle"],out["sha256"],confirmed=True)
        self.assertEqual(imported["created_candidates"],1)
        self.assertFalse(imported["trusted_as_verified"])
        result=reviewed_knowledge.import_as_candidates(out["bundle"],out["sha256"],confirmed=True)
        self.assertEqual(result["created_candidates"],0)
        self.assertEqual(result["duplicates_skipped"],1)
        candidates=adaptive_runtime.candidates()
        self.assertEqual(len([r for r in candidates if r["status"]=="candidate"]),1)
        self.assertEqual(len([r for r in candidates if r["status"]=="verified"]),1)
        cand=next(r for r in candidates if r["status"]=="candidate")
        with core.conn() as db:
            row=db.execute("SELECT evidence FROM adaptive_solutions WHERE id=?",(cand["id"],)).fetchone()
        self.assertEqual(row["evidence"],"")
        adaptive_runtime.review(cand["id"],approved=True,
            evidence="Local owner independently checked the imported answer.")
        self.assertEqual(len([r for r in adaptive_runtime.candidates() if r["status"]=="verified"]),2)

    def test_tampering_and_bogus_source_rejected_without_db_changes(self):
        out=self._sample_export();doc=out["bundle"];digest=out["sha256"]
        changed=json.loads(json.dumps(doc));changed["entries"][0]["answer"]="Malicious changed answer"
        with self.assertRaisesRegex(core.EngineError,"digest"):
            reviewed_knowledge.validate_bundle(changed,digest)
        changed["entries"][0]["source_url"]="file:///etc/passwd"
        dig=reviewed_knowledge._digest(changed)
        with self.assertRaisesRegex(core.EngineError,"Invalid or oversized"):
            reviewed_knowledge.import_as_candidates(changed,dig,confirmed=True)
        self.assertEqual(len(adaptive_runtime.candidates()),1)

    def test_import_duplicate_ids_and_excess_size_rejected(self):
        out=self._sample_export();doc=json.loads(json.dumps(out["bundle"]))
        doc["entries"].append(dict(doc["entries"][0]))
        with self.assertRaisesRegex(core.EngineError,"duplicate"):
            reviewed_knowledge.validate_bundle(doc,reviewed_knowledge._digest(doc))
        out["bundle"]["junk"]="a"*120000
        with self.assertRaisesRegex(core.EngineError,"120 KB"):
            reviewed_knowledge.validate_bundle(out["bundle"],reviewed_knowledge._digest(out["bundle"]))

    def test_no_private_tables_autogenerated_or_modified_by_overview(self):
        prior=core.records("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        with patch.object(core,"llama_binary",return_value=None):operating_desk.overview()
        after=core.records("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        self.assertEqual(prior,after)

if __name__=="__main__":unittest.main()
