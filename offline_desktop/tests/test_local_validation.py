"""Contract tests for fixed, trusted checkout verification (no actual tests executed)."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from engine import core, local_validation, capabilities, operator_tools


class LocalVerificationTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory(prefix="theorg_verify_")
        self.addCleanup(self.dir.cleanup)
        self.root = Path(self.dir.name)
        (self.root / ".git").mkdir()
        (self.root / "tools").mkdir()
        (self.root / "tools" / "Test-TheOrg-Source-Local.ps1").write_text(
            "# fixed trusted test script", encoding="utf-8"
        )
        original = (core.DATA, core.WORKSPACE, core.MODELS, core.DB)
        self.addCleanup(lambda: self._restore(original))
        core.DATA = self.root / "data"
        core.WORKSPACE = self.root / "workspace"
        core.MODELS = self.root / "models"
        core.DB = core.DATA / "db.sqlite3"
        core.init()
        capabilities.init_schema()
        self.sha = "f" * 40

    @staticmethod
    def _restore(original):
        core.DATA, core.WORKSPACE, core.MODELS, core.DB = original

    def test_trusted_checkout_must_be_explicit_and_git_based(self):
        with patch.dict(os.environ, {"THEORG_TRUSTED_REPO_DIR": ""}):
            with self.assertRaisesRegex(core.EngineError, "THEORG_TRUSTED_REPO_DIR"):
                local_validation._trusted_root()
        with patch.dict(os.environ, {"THEORG_TRUSTED_REPO_DIR": str(self.root)}):
            self.assertEqual(local_validation._trusted_root(), self.root.resolve())
            (self.root / ".git").rmdir()
            with self.assertRaisesRegex(core.EngineError, "Git metadata"):
                local_validation._trusted_root()

    def test_checkout_sha_and_clean_state_prevent_execution(self):
        with patch.object(local_validation, "_git", side_effect=[
            str(self.root), "e" * 40
        ]):
            with self.assertRaisesRegex(core.EngineError, "differs"):
                local_validation._checked_checkout(self.root, self.sha)
        with patch.object(local_validation, "_git", side_effect=[
            str(self.root), self.sha, " M tools/Test-TheOrg-Source-Local.ps1"
        ]):
            with self.assertRaisesRegex(core.EngineError, "modified or untracked"):
                local_validation._checked_checkout(self.root, self.sha)
        with patch.object(local_validation, "_git", side_effect=[
            str(self.root), self.sha, ""
        ]) as check:
            local_validation._checked_checkout(self.root, self.sha)
        self.assertEqual(check.call_count, 3)
        with patch.object(local_validation, "_git", side_effect=[
            str(self.root), self.sha, "?? offline_desktop/tests/rogue.py"
        ]):
            with self.assertRaisesRegex(core.EngineError, "untracked source"):
                local_validation._checked_checkout(self.root, self.sha)
        with patch.object(local_validation, "_git", side_effect=[
            str(self.root), self.sha, "?? out/source-verification/source-results.json"
        ]):
            local_validation._checked_checkout(self.root, self.sha)

    def test_fixed_tool_rejects_arbitrary_commands_and_missing_sha(self):
        with patch.dict(os.environ, {"THEORG_ENABLE_LOCAL_SOURCE_TESTS": "1"}):
            self.assertEqual(
                capabilities.normalize("windows.source.verify", {"expected_sha": self.sha}),
                {"expected_sha": self.sha}
            )
            for bad in ({}, {"expected_sha": "main"},
                        {"expected_sha": self.sha, "command": "rm -rf ."},
                        {"expected_sha": "f" * 39}):
                with self.subTest(bad=bad), self.assertRaises(core.EngineError):
                    capabilities.normalize("windows.source.verify", bad)

    def test_disabled_without_operator_opt_in(self):
        with patch.dict(os.environ, {"THEORG_ENABLE_LOCAL_SOURCE_TESTS": "0"}):
            with self.assertRaisesRegex(core.EngineError, "disabled"):
                capabilities.prepare("windows.source.verify", {"expected_sha": self.sha})

    def test_report_not_accepted_without_actual_execution(self):
        if os.name != "nt":
            with self.assertRaisesRegex(core.EngineError, "Windows"):
                local_validation.verify(self.sha)
        with self.assertRaisesRegex(core.EngineError, "40 lowercase"):
            # Validates format only after Windows platform preflight.
            with patch.object(local_validation.os, "name", "nt"):
                local_validation.verify("main")

    def test_evidence_requires_fresh_pinned_passed_source_only_results(self):
        report_path = self.root / "out" / "source-verification" / "source-results.json"
        report_path.parent.mkdir(parents=True)
        valid = {
            "commit": self.sha,
            "source_only": True, "passed": True,
            "deployment_performed": False, "windows_executable_verified": False,
            "checks": [{"name": "Python regressions", "passed": True},
                       {"name": "Node regressions", "passed": True}]
        }
        report_path.write_text(json.dumps(valid), encoding="utf-8")
        self.assertEqual(len(local_validation._validated_report(
            report_path, self.sha, None)), 2)
        old = report_path.stat().st_mtime_ns
        with self.assertRaisesRegex(core.EngineError, "stale"):
            local_validation._validated_report(report_path, self.sha, old)

        tampered = {**valid, "commit": "e"*40}
        report_path.write_text(json.dumps(tampered), encoding="utf-8")
        with self.assertRaisesRegex(core.EngineError, "pinned PASS"):
            local_validation._validated_report(report_path, self.sha, None)

        skipped = {**valid, "checks": [
            {"name": "Python regressions", "passed": True},
            {"name": "Node regressions", "passed": False}]}
        report_path.write_text(json.dumps(skipped), encoding="utf-8")
        with self.assertRaisesRegex(core.EngineError, "pinned PASS"):
            local_validation._validated_report(report_path, self.sha, None)

        report_path.write_text("{invalid", encoding="utf-8")
        with self.assertRaisesRegex(core.EngineError, "valid UTF-8 JSON"):
            local_validation._validated_report(report_path, self.sha, None)

    def test_invalid_or_oversized_evidence_fails_closed(self):
        path = self.root / "report.json"
        path.write_text("x" * (local_validation._MAX_REPORT_BYTES + 1),
                        encoding="utf-8")
        with self.assertRaisesRegex(core.EngineError, "accepted size"):
            local_validation._validated_report(path, self.sha, None)

    def test_no_approval_no_execution_and_uncertain_results_not_retried(self):
        with patch.dict(os.environ, {"THEORG_ENABLE_LOCAL_SOURCE_TESTS": "1"}):
            request = capabilities.prepare("windows.source.verify",
                                           {"expected_sha": self.sha})
            with patch.object(operator_tools, "execute") as execute:
                with self.assertRaisesRegex(core.EngineError, "approval"):
                    capabilities.approve_and_execute(request["id"],
                        request["digest"], confirmed=False)
                execute.assert_not_called()
            with patch.object(operator_tools, "execute",
                              side_effect=core.EngineError("deadline exceeded")) as execute:
                result = capabilities.approve_and_execute(
                    request["id"], request["digest"], confirmed=True
                )
            self.assertEqual(result["status"], "needs_review")
            self.assertEqual(result["execution_outcome"], "unverified")
            execute.assert_called_once()
            with self.assertRaises(core.EngineError):
                capabilities.approve_and_execute(
                    request["id"], request["digest"], confirmed=True
                )


if __name__ == "__main__":
    unittest.main()
