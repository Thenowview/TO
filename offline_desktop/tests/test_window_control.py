"""Synthetic Win32 visibility/focus tests, without touching the real desktop."""
from __future__ import annotations

import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from engine import core, capabilities, operator_tools, window_control


class WindowsWindowControlTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="theorg_ui_")
        self.addCleanup(self.temp.cleanup)
        self.original = (core.DATA, core.WORKSPACE, core.MODELS, core.DB)
        self.addCleanup(self.restore)
        base = Path(self.temp.name)
        core.DATA = base / "data"
        core.WORKSPACE = base / "workspace"
        core.MODELS = base / "models"
        core.DB = base / "data" / "test.sqlite3"
        core.init()
        capabilities.init_schema()
        self.window = {
            "hwnd": 431, "pid": 1111, "title": "Test Editor",
            "title_sha256": hashlib.sha256(b"Test Editor").hexdigest()
        }

    def restore(self):
        core.DATA, core.WORKSPACE, core.MODELS, core.DB = self.original

    def test_strict_identity_validation(self):
        a = {k: self.window[k] for k in ("hwnd", "pid", "title_sha256")}
        self.assertEqual(window_control.normalize_focus(a), a)
        for change in (
            {"hwnd": 0},
            {"hwnd": True},
            {"pid": -5},
            {"pid": "1111"},
            {"title_sha256": "X" * 64},
            {"extra": "unexpected"}
        ):
            malformed = dict(a, **change)
            with self.subTest(change=change), self.assertRaises(core.EngineError):
                window_control.normalize_focus(malformed)

    def test_inventory_is_explicitly_local_and_never_focuses(self):
        with patch.object(window_control, "_enumerate", return_value=[self.window]):
            result = window_control.inspect()
        self.assertEqual(result["count"], 1)
        self.assertFalse(result["focus_performed"])
        self.assertFalse(result["input_sent"])
        self.assertEqual(result["windows"][0]["title"], "Test Editor")

    def test_focus_requires_same_visible_window_identity(self):
        args = {k: self.window[k] for k in ("hwnd", "pid", "title_sha256")}
        with patch.object(window_control.os, "name", "nt"):
            with patch.object(window_control, "_enumerate",
                              return_value=[{**self.window, "pid": 2222}]), patch.object(
                    window_control, "_focus_native") as native:
                with self.assertRaisesRegex(core.EngineError, "Window changed"):
                    window_control.focus(args)
                native.assert_not_called()
            with patch.object(window_control, "_enumerate", return_value=[self.window]), patch.object(
                    window_control, "_focus_native", return_value=(False, 0)):
                result = window_control.focus(args)
                self.assertFalse(result["focus_confirmed"])
                self.assertFalse(result["input_sent"])
            with patch.object(window_control, "_enumerate", return_value=[self.window]), patch.object(
                    window_control, "_focus_native", return_value=(True, args["hwnd"])):
                result = window_control.focus(args)
                self.assertTrue(result["focus_confirmed"])

    def test_both_tools_off_by_default(self):
        with patch.dict(os.environ, {
            "THEORG_ENABLE_WINDOW_INSPECTION": "0",
            "THEORG_ENABLE_WINDOW_FOCUS": "0",
        }):
            with self.assertRaisesRegex(core.EngineError, "disabled"):
                capabilities.prepare("windows.window.list", {})
            with self.assertRaisesRegex(core.EngineError, "disabled"):
                capabilities.prepare("windows.window.focus",
                                     {k: self.window[k] for k in ("hwnd", "pid", "title_sha256")})

    def test_manual_digest_approval_required_to_focus(self):
        identity = {k: self.window[k] for k in ("hwnd", "pid", "title_sha256")}
        with patch.dict(os.environ, {"THEORG_ENABLE_WINDOW_FOCUS": "1"}):
            request = capabilities.prepare("windows.window.focus", identity)
            with patch.object(operator_tools, "execute") as executor:
                with self.assertRaisesRegex(core.EngineError, "approval"):
                    capabilities.approve_and_execute(
                        request["id"], request["digest"], confirmed=False)
                executor.assert_not_called()
            with patch.object(operator_tools, "execute",
                              return_value={"focus_confirmed": False, "input_sent": False}):
                outcome = capabilities.approve_and_execute(
                    request["id"], request["digest"], confirmed=True)
            self.assertEqual(outcome["status"], "completed")
            self.assertFalse(outcome["result"]["focus_confirmed"])
            with self.assertRaises(core.EngineError):
                capabilities.approve_and_execute(
                    request["id"], request["digest"], confirmed=True)


if __name__ == "__main__":
    unittest.main()
