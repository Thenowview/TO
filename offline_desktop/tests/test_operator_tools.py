"""Synthetic operator-tool regression tests. Never use a live GitHub account."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from engine import core, capabilities, operator_tools

SHA = "a" * 40
FLAGS = {
    "THEORG_ENABLE_GITHUB_READONLY": "0",
    "THEORG_ENABLE_GITHUB_ACTIONS": "0",
    "THEORG_ENABLE_WINDOWS_INSPECTION": "0",
    "THEORG_ENABLE_RUNNER_DIAGNOSTICS": "0",
}


class OperatorToolTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="theorg_operator_")
        self.addCleanup(self.temp.cleanup)
        original = (core.DATA, core.WORKSPACE, core.MODELS, core.DB)
        self.addCleanup(lambda: self._restore(original))
        base = Path(self.temp.name)
        core.DATA = base / "data"
        core.WORKSPACE = base / "workspace"
        core.MODELS = base / "models"
        core.DB = core.DATA / "operators.sqlite3"
        core.init()
        capabilities.init_schema()

    @staticmethod
    def _restore(old):
        core.DATA, core.WORKSPACE, core.MODELS, core.DB = old

    def test_plan_is_not_execution_or_authorization(self):
        with patch.dict(os.environ, FLAGS):
            with patch.object(operator_tools, "_gh") as gh, patch.object(
                operator_tools, "_powershell"
            ) as powershell:
                preview = operator_tools.plan(
                    "Install GitHub runner and run tests on my Windows PC"
                )
                self.assertTrue(preview["draft_only"])
                self.assertFalse(preview["actions_executed"])
                self.assertFalse(preview["external_actions_authorized"])
                self.assertIn("github.workflow.source_dispatch",
                              [x["tool"] for x in preview["tasks"]])
                gh.assert_not_called()
                powershell.assert_not_called()
                other = operator_tools.plan("Erase private directories")
                self.assertEqual(other["tasks"][0]["effect"], "manual_scoping_required")

    def test_disabled_by_default_and_bounded_arguments(self):
        with patch.dict(os.environ, FLAGS):
            for action, args in (
                ("github.runner.status", {}),
                ("github.workflow.status", {}),
                ("github.workflow.source_dispatch", {"expected_sha": SHA}),
                ("windows.powershell.inspect", {"check": "toolchain"}),
            ):
                with self.subTest(action=action), self.assertRaisesRegex(
                    core.EngineError, "disabled"
                ):
                    capabilities.prepare(action, args)
        with patch.dict(os.environ, {
            "THEORG_ENABLE_WINDOWS_INSPECTION": "1",
            "THEORG_ENABLE_GITHUB_READONLY": "1",
            "THEORG_ENABLE_GITHUB_ACTIONS": "1",
        }):
            self.assertEqual(capabilities.normalize(
                "windows.powershell.inspect", {"check": "toolchain"}
            ), {"check": "toolchain"})
            for args in (
                {"check": "Get-ChildItem C:\\Secrets"},
                {"check": "toolchain", "command": "del C:\\"},
                {},
            ):
                with self.subTest(args=args), self.assertRaises(core.EngineError):
                    capabilities.normalize("windows.powershell.inspect", args)
            with self.assertRaises(core.EngineError):
                capabilities.normalize("github.runner.status",
                                       {"repository": "untrusted/repository"})
            for args in ({}, {"expected_sha": "main"},
                         {"expected_sha": SHA, "build": True}):
                with self.subTest(args=args), self.assertRaises(core.EngineError):
                    capabilities.normalize("github.workflow.source_dispatch", args)

    def test_provider_status_read_only_and_bounded(self):
        with patch.object(operator_tools, "_github_json", return_value={
            "runners": [{"name": "TheOrg-Windows", "status": "online", "busy": False,
                         "labels": [{"name": "self-hosted"}, {"name": "Windows"},
                                    {"name": "X64"}, {"name": "theorg-win"}]}]
        }) as read:
            result = operator_tools._runner_status()
        self.assertEqual(result["runners"][0]["status"], "online")
        self.assertIn("theorg-win", result["runners"][0]["labels"])
        self.assertTrue(result["provider_confirmed"])
        read.assert_called_once()
        with patch.object(operator_tools, "_github_json", return_value={
            "workflow_runs": [{"id": 10, "status": "completed",
                               "conclusion": "failure", "head_sha": SHA,
                               "html_url": "https://github.com/test/run"}]
        }):
            result = operator_tools._workflow_status()
        self.assertEqual(result["runs"][0]["conclusion"], "failure")
        with patch.object(operator_tools, "_github_json", return_value={}):
            with self.assertRaises(core.EngineError):
                operator_tools._runner_status()

    def test_workflow_result_requires_exact_sha_and_real_passed_steps(self):
        run = {"head_sha": SHA, "head_branch": operator_tools.REVIEW_BRANCH,
               "path": ".github/workflows/bridge-ci.yml", "event": "workflow_dispatch",
               "status": "completed", "conclusion": "success"}
        job = {"jobs": [{"name": "self-hosted-windows-source",
                         "status": "completed", "conclusion": "success",
                         "steps": [
                            {"name": "Check preinstalled Windows runner tools (no downloads)",
                             "conclusion": "success"},
                            {"name": "Verify source on local Windows runner",
                             "conclusion": "success"}]}]}
        with patch.object(operator_tools, "_github_json", side_effect=[run, job]) as api:
            result = operator_tools._workflow_result(43233299196, SHA)
        self.assertTrue(result["source_tests_verified"])
        self.assertFalse(result["windows_executable_verified"])
        self.assertEqual(api.call_count, 2)

        skipped_job = json.loads(json.dumps(job))
        skipped_job["jobs"][0]["steps"][1]["conclusion"] = "skipped"
        with patch.object(operator_tools, "_github_json",
                          side_effect=[run, skipped_job]):
            result = operator_tools._workflow_result(43233299196, SHA)
        self.assertFalse(result["source_tests_verified"])

        with patch.object(operator_tools, "_github_json",
                          return_value={**run, "head_sha": "b" * 40}):
            with self.assertRaisesRegex(core.EngineError, "approved commit"):
                operator_tools._workflow_result(43233299196, SHA)

        with patch.object(operator_tools, "_github_json",
                          return_value={**run, "event": "pull_request"}):
            with self.assertRaisesRegex(core.EngineError, "manually dispatched"):
                operator_tools._workflow_result(43233299196, SHA)

        with patch.dict(os.environ, {"THEORG_ENABLE_GITHUB_READONLY": "1"}):
            self.assertEqual(capabilities.normalize(
                "github.workflow.result", {"run_id": 43233299196, "expected_sha": SHA}),
                {"run_id": 43233299196, "expected_sha": SHA})
            for invalid in ({"run_id": True, "expected_sha": SHA},
                            {"run_id": 0, "expected_sha": SHA},
                            {"run_id": 42, "expected_sha": "main"}):
                with self.assertRaises(core.EngineError):
                    capabilities.normalize("github.workflow.result", invalid)

    def test_dispatch_refuses_stale_branch_and_is_source_only(self):
        with patch.object(operator_tools, "_github_json", return_value={
            "object": {"sha": "b" * 40}
        }), patch.object(operator_tools, "_gh") as gh:
            with self.assertRaisesRegex(core.EngineError, "changed"):
                operator_tools._dispatch_source_only(SHA)
            gh.assert_not_called()
        with patch.object(operator_tools, "_github_json", return_value={
            "object": {"sha": SHA}
        }), patch.object(operator_tools, "_gh", return_value="") as gh:
            result = operator_tools._dispatch_source_only(SHA)
        self.assertTrue(result["dispatch_requested"])
        self.assertFalse(result["execution_confirmed"])
        self.assertFalse(result["unsigned_build_requested"])
        args = gh.call_args.args[0]
        self.assertIn("confirm_self_hosted=true", args)
        self.assertIn("build_unsigned_windows_candidate=false", args)
        self.assertNotIn("production", " ".join(args).lower())

    def test_manual_consent_single_use_and_digest_integrity(self):
        with patch.dict(os.environ, {**FLAGS,
                "THEORG_ENABLE_GITHUB_READONLY": "1"}):
            prepared = capabilities.prepare("github.runner.status", {})
            with self.assertRaisesRegex(core.EngineError, "approval"):
                capabilities.approve_and_execute(prepared["id"],
                                                  prepared["digest"], False)
            with patch.object(operator_tools, "execute", return_value={
                    "provider_confirmed": True, "runners": []}) as execute:
                result = capabilities.approve_and_execute(prepared["id"],
                                                         prepared["digest"], True)
            self.assertEqual(result["status"], "completed")
            execute.assert_called_once()
            with self.assertRaises(core.EngineError):
                capabilities.approve_and_execute(prepared["id"],
                                                 prepared["digest"], True)

    def test_execution_arguments_rechecked_after_approval(self):
        with patch.dict(os.environ, {**FLAGS,
                "THEORG_ENABLE_WINDOWS_INSPECTION": "1"}):
            prepared = capabilities.prepare("windows.powershell.inspect",
                                            {"check": "toolchain"})
            with core.conn() as db:
                db.execute("UPDATE capability_requests SET args_json=? WHERE id=?",
                           (json.dumps({"check": "powershell_version"}),
                            prepared["id"]))
            with patch.object(operator_tools, "execute") as execute:
                rejected = capabilities.approve_and_execute(
                    prepared["id"], prepared["digest"], True)
            self.assertEqual(rejected["status"], "failed")
            execute.assert_not_called()

    def test_uncertain_workflow_result_is_never_retried(self):
        with patch.dict(os.environ, {**FLAGS,
                "THEORG_ENABLE_GITHUB_ACTIONS": "1"}):
            prepared = capabilities.prepare(
                "github.workflow.source_dispatch", {"expected_sha": SHA})
            with patch.object(operator_tools, "execute",
                              side_effect=core.EngineError("response lost")) as execute:
                result = capabilities.approve_and_execute(
                    prepared["id"], prepared["digest"], True)
            self.assertEqual(result["status"], "needs_review")
            self.assertEqual(result["execution_outcome"], "unverified")
            execute.assert_called_once()
            with self.assertRaises(core.EngineError):
                capabilities.approve_and_execute(
                    prepared["id"], prepared["digest"], True)

    def test_interrupted_execution_recovers_as_needs_review(self):
        with patch.dict(os.environ, {**FLAGS,
                "THEORG_ENABLE_GITHUB_ACTIONS": "1"}):
            item = capabilities.prepare(
                "github.workflow.source_dispatch", {"expected_sha": SHA})
            with core.conn() as db:
                db.execute("UPDATE capability_requests SET status='running' WHERE id=?",
                           (item["id"],))
            capabilities.init_schema()
            rows = capabilities.history()
            self.assertEqual(rows[0]["status"], "needs_review")
            self.assertEqual(json.loads(rows[0]["result_json"])[
                             "execution_outcome"], "unverified")


if __name__ == "__main__":
    unittest.main()
