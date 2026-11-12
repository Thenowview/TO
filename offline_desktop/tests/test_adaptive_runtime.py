"""Three editions and review-only adaptive knowledge tests. No provider calls."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from engine import core, adaptive_runtime


class AdaptiveRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix="theorg_adaptive_")
        self.addCleanup(self.tmp.cleanup)
        self.old=tuple(getattr(core,k) for k in ("DATA","WORKSPACE","MODELS","DB"))
        self.addCleanup(self.restore)
        base=Path(self.tmp.name)
        core.DATA=base/"data"
        core.WORKSPACE=base/"workspace"
        core.MODELS=base/"models"
        core.DB=core.DATA/"test.sqlite3"
        core.init()
        adaptive_runtime.init_schema()

    def restore(self):
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=self.old

    def test_registry_has_three_distinct_tiers_and_dedicated_2b(self):
        d=adaptive_runtime.registry()
        self.assertEqual([t["id"] for t in d["tiers"]],["nano","lite","advanced"])
        two=next(m for m in d["models"] if m["id"]=="qwen35_2b")
        self.assertEqual(two["tier"],"lite")
        self.assertEqual(two["parameter_class"],"2B")
        self.assertFalse(two["verified_inference"])
        self.assertTrue(all(not t.get("weights_included",False) for t in d["tiers"]))

    def test_ram_policy_falls_back_to_nano(self):
        with patch("engine.device_capabilities.detect",return_value={
            "total_ram_bytes":4*1024**3,
            "available_ram_bytes":512*1024**2,
            "platform":"Windows"
        }):
            info=adaptive_runtime.readiness()
        self.assertEqual(info["selected"],"nano")
        self.assertTrue(info["options"][0]["eligible_by_ram"])
        self.assertFalse(info["options"][1]["eligible_by_ram"])
        self.assertFalse(info["options"][2]["eligible_by_ram"])
        self.assertEqual(info["fallback"],"nano")

    def test_selection_requires_ram_and_never_starts_model(self):
        with patch("engine.device_capabilities.detect",return_value={
            "total_ram_bytes":8*1024**3,"available_ram_bytes":5*1024**3
        }),patch.object(core,"start_local_model") as start:
            selected=adaptive_runtime.select("lite")
            self.assertEqual(selected["selected"],"lite")
            self.assertFalse(selected["inference_verified"])
            self.assertTrue(selected["no_model_started"])
            start.assert_not_called()
            with self.assertRaisesRegex(core.EngineError,"Insufficient measured RAM"):
                adaptive_runtime.select("advanced")
        with self.assertRaisesRegex(core.EngineError,"Choose Nano"):
            adaptive_runtime.select("superadmin")

    def test_unreviewed_knowledge_never_used_as_verified_solution(self):
        p=adaptive_runtime.propose("How to repair a failed CI job?",
            "Read the failed step logs; fix source, rerun source-only tests.",
            origin="external-agent",source_url="https://github.com/example")
        self.assertEqual(p["status"],"candidate")
        self.assertFalse(p["verified"])
        self.assertEqual(adaptive_runtime.recall("repair failed CI job")["matches"],[])
        preview=adaptive_runtime.resolve_preview("repair failed CI job")
        self.assertFalse(preview["external_provider_contacted"])
        self.assertFalse(preview["model_called"])
        self.assertIsNone(preview["solution"])
        with self.assertRaisesRegex(core.EngineError,"verification evidence"):
            adaptive_runtime.review(p["id"],approved=True,evidence="ok")
        reviewed=adaptive_runtime.review(p["id"],approved=True,
            evidence="CI source-only run passed after reviewing exact logs.")
        self.assertEqual(reviewed["status"],"verified")
        match=adaptive_runtime.recall("How to repair a failed CI job?")
        self.assertEqual(match["matches"][0]["id"],p["id"])
        self.assertFalse(match["training_performed"])
        self.assertEqual(adaptive_runtime.resolve_preview("How to repair a failed CI job?")["route"],
                         "reviewed-local-solution")

    def test_corrections_preserve_old_entries_and_require_review(self):
        original=adaptive_runtime.propose("Prepare source verification",
            "Check tests, do not release until verified.",origin="owner")
        adaptive_runtime.review(original["id"],approved=True,
            evidence="Reviewed logs and source-test run for correct branch.")
        correction=adaptive_runtime.propose("Prepare source verification",
            "Check branch SHA and all test jobs, then build unsigned only.",
            origin="owner")
        adaptive_runtime.review(correction["id"],approved=True,
            evidence="New confirmed source-only CI evidence supports the correction.",
            supersedes=original["id"])
        states={row["id"]:row["status"] for row in adaptive_runtime.candidates()}
        self.assertEqual(states[original["id"]],"superseded")
        self.assertEqual(states[correction["id"]],"verified")
        matches=adaptive_runtime.recall("Prepare source verification")["matches"]
        self.assertEqual([r["id"] for r in matches],[correction["id"]])

    def test_completed_task_can_only_enter_review_queue(self):
        ident=core.enqueue("Check release gate evidence","supervisor")
        with self.assertRaisesRegex(core.EngineError,"Only a completed task"):
            adaptive_runtime.propose_completed_task(ident)
        with core.conn() as db:
            db.execute("UPDATE tasks SET status='completed',output=? WHERE id=?",
                       ("Build is blocked until tests pass; inspect the real job logs.",ident))
        candidate=adaptive_runtime.propose_completed_task(ident)
        self.assertEqual(candidate['status'],'candidate')
        self.assertTrue(candidate['requires_independent_owner_review'])
        self.assertEqual(adaptive_runtime.recall("Check release gate evidence")['matches'],[])
        adaptive_runtime.review(candidate['id'],approved=True,
            evidence="Owner checked the real source-job result before approving.")
        self.assertEqual(adaptive_runtime.recall("Check release gate evidence")
                         ['matches'][0]['id'],candidate['id'])

    def test_bad_sources_and_invalid_query_refused(self):
        with self.assertRaises(core.EngineError):
            adaptive_runtime.propose("Some question","Some answer to save",
                                     source_url="http://insecure.example")
        with self.assertRaises(core.EngineError):
            adaptive_runtime.propose("Some question","Some answer to save",origin="untrusted")
        with self.assertRaises(core.EngineError):
            adaptive_runtime.recall("x")
        with self.assertRaises(core.EngineError):
            adaptive_runtime.review("../../../other",approved=True,evidence="evidence")


if __name__=="__main__":
    unittest.main()
