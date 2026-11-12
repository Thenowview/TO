"""Synthetic Windows runner console controls: never start an actual process."""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from engine import core, capabilities, runner_control


class RunnerControlTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="theorg_runner_")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for name in ("config.cmd", "run.cmd"):
            (self.root / name).write_text("@echo off", encoding="utf-8")
        (self.root / "bin").mkdir()
        (self.root / "externals").mkdir()
        self.old = (core.DATA, core.WORKSPACE, core.MODELS, core.DB)
        self.addCleanup(self.restore)
        core.DATA = self.root / "data"
        core.WORKSPACE = self.root / "workspace"
        core.MODELS = self.root / "models"
        core.DB = core.DATA / "db.sqlite3"
        core.init()
        capabilities.init_schema()

    def restore(self):
        core.DATA, core.WORKSPACE, core.MODELS, core.DB = self.old

    def test_registration_never_reads_or_accepts_github_tokens(self):
        with patch.object(runner_control, "_root", return_value=self.root):
            with patch.object(runner_control, "_spawn_console", return_value=123) as spawn:
                result = runner_control.registration_prompt("user_downloads")
            self.assertTrue(result["console_process_started"])
            self.assertFalse(result["registration_confirmed"])
            self.assertIsNone(result["runner_online"])
            self.assertEqual(spawn.call_args.args[1], "config.cmd")
            self.assertEqual(spawn.call_args.args[2], [
                "--url", runner_control.REPO_URL, "--labels", runner_control.LABEL])
            self.assertNotIn("--token", str(spawn.call_args.args))
        (self.root / ".runner").write_text("registered marker", encoding="utf-8")
        with patch.object(runner_control, "_root", return_value=self.root):
            with patch.object(runner_control, "_spawn_console") as spawn:
                with self.assertRaisesRegex(core.EngineError, "register twice"):
                    runner_control.registration_prompt("user_downloads")
                spawn.assert_not_called()

    def test_runner_start_requires_local_registration_and_remote_online_check(self):
        with patch.object(runner_control, "_root", return_value=self.root):
            with self.assertRaisesRegex(core.EngineError, "not been confirmed"):
                runner_control.start_registered("user_downloads")
            (self.root / ".runner").write_text("registered marker", encoding="utf-8")
            with patch.object(runner_control, "_spawn_console", return_value=321) as spawn:
                result = runner_control.start_registered("user_downloads")
            self.assertTrue(result["console_process_started"])
            self.assertIsNone(result["runner_online"])
            spawn.assert_called_once_with(self.root, "run.cmd", [])

    def test_only_two_fixed_locations_and_known_runner_scripts(self):
        with patch.dict(os.environ, {"THEORG_ENABLE_RUNNER_CONTROL": "1"}):
            for name in ("desktop.runner.registration_prompt", "desktop.runner.start"):
                self.assertEqual(capabilities.normalize(
                    name, {"location": "user_downloads"}),
                    {"location": "user_downloads"})
                for args in ({}, {"location": "../secrets"},
                             {"location": "system_root", "token": "LEAK"}):
                    with self.subTest(name=name, args=args), self.assertRaises(core.EngineError):
                        capabilities.normalize(name, args)
        with self.assertRaises(core.EngineError):
            runner_control._spawn_console(self.root, "untrusted.cmd", [])

    def test_tools_are_disabled_until_operator_opts_in(self):
        with patch.dict(os.environ, {"THEORG_ENABLE_RUNNER_CONTROL": "0"}):
            for name in ("desktop.runner.registration_prompt", "desktop.runner.start"):
                with self.assertRaisesRegex(core.EngineError, "disabled"):
                    capabilities.prepare(name, {"location": "user_downloads"})

    def test_approval_and_ambiguous_process_start_prevent_replay(self):
        with patch.dict(os.environ, {"THEORG_ENABLE_RUNNER_CONTROL": "1"}):
            item = capabilities.prepare("desktop.runner.start", {"location": "user_downloads"})
            with self.assertRaisesRegex(core.EngineError, "approval"):
                capabilities.approve_and_execute(item["id"], item["digest"], False)
            with patch.object(capabilities, "_execute", side_effect=core.EngineError("spawn outcome unknown")):
                outcome = capabilities.approve_and_execute(item["id"], item["digest"], True)
            self.assertEqual(outcome["status"], "needs_review")
            self.assertEqual(outcome["execution_outcome"], "unverified")
            with self.assertRaises(core.EngineError):
                capabilities.approve_and_execute(item["id"], item["digest"], True)


if __name__ == "__main__":
    unittest.main()
