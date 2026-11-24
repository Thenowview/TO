"""GIZE low-memory guard regressions; no model download or runtime required."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from engine import device_capabilities, model_behavior

MIB = 1024 ** 2
GIB = 1024 ** 3


class ModelGuardTests(unittest.TestCase):
    def test_missing_ram_is_not_treated_as_available(self):
        allowed, reason = device_capabilities.model_allowed(512 * MIB, None)
        self.assertFalse(allowed)
        self.assertIn("could not be determined", reason)

    def test_invalid_and_negative_inputs_fail_closed(self):
        bad_inputs = (
            (-1, 8 * GIB, 384 * MIB),
            (0, 8 * GIB, 384 * MIB),
            (512 * MIB, -1, 384 * MIB),
            (512 * MIB, 8 * GIB, -1),
            (512.5 * MIB, 8 * GIB, 384 * MIB),
            (True, 8 * GIB, 384 * MIB),
            (512 * MIB, False, 384 * MIB),
            (512 * MIB, 8 * GIB, None),
            ("512", 8 * GIB, 384 * MIB),
        )
        for values in bad_inputs:
            with self.subTest(values=values):
                allowed, reason = device_capabilities.model_allowed(*values)
                self.assertFalse(allowed)
                self.assertIn("Invalid", reason)

    def test_caller_cannot_remove_system_reserve(self):
        allowed, reason = device_capabilities.model_allowed(1 * GIB, 1 * GIB, 0)
        self.assertFalse(allowed)
        self.assertIn("reserve", reason)

    def test_genuine_available_memory_still_allows_small_model(self):
        allowed, reason = device_capabilities.model_allowed(512 * MIB, 2 * GIB)
        self.assertTrue(allowed)
        self.assertIn("may still fail", reason)

    def test_adaptive_context_never_exceeds_requested_or_safe_headroom(self):
        required = 1 * GIB
        reserve = 384 * MIB
        adjust = device_capabilities.adaptive_context_window
        self.assertEqual(adjust(8192, required, required + reserve), 1024)
        self.assertEqual(adjust(8192, required, required + reserve + 300*MIB), 2048)
        self.assertEqual(adjust(8192, required, required + reserve + 800*MIB), 4096)
        self.assertEqual(adjust(8192, required, required + reserve + 2*GIB), 8192)
        self.assertEqual(adjust(2048, required, required + reserve + 2*GIB), 2048)
        self.assertEqual(adjust(-1, required, required + reserve + 2*GIB), 1024)

    def test_small_requested_context_is_never_increased(self):
        adjust = device_capabilities.adaptive_context_window
        for requested in (1, 128, 256, 512, 1023):
            for available in (1408*MIB, 8*GIB):
                with self.subTest(requested=requested, available=available):
                    self.assertEqual(adjust(requested, 1*GIB, available), requested)

    def test_model_import_rejects_oversized_stream_and_removes_partial(self):
        import ast, tempfile, shutil, secrets, os
        from unittest.mock import patch
        source = ast.parse((ROOT / "engine" / "core.py").read_text(encoding="utf-8"))
        fn = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == "import_model_stream")
        with tempfile.TemporaryDirectory() as folder:
            models = Path(folder)
            scope = dict(MODELS=models, MAX_MODEL_BYTES=32*GIB, EngineError=RuntimeError,
                         shutil=shutil, secrets=secrets, os=os, audit=lambda *a: None)
            exec(compile(ast.Module(body=[fn], type_ignores=[]), "<actual-import-function>", "exec"), scope)
            class Oversized:
                def read(self, count):
                    return b"GGUF" + b"x"*count
            with patch.object(shutil, "disk_usage", return_value=type("Disk", (), {"free":10*GIB})()):
                with self.assertRaisesRegex(RuntimeError, "declared"):
                    scope["import_model_stream"]("synthetic.gguf", Oversized(), 4096)
            self.assertEqual(list(models.iterdir()), [])

    def test_zip_import_rejects_oversized_stream_and_cleans_archive(self):
        import ast, tempfile, shutil, secrets, os, re
        from unittest.mock import patch
        source = ast.parse((ROOT / "engine" / "core.py").read_text(encoding="utf-8"))
        fn = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == "import_model_zip_stream")
        with tempfile.TemporaryDirectory() as folder:
            models = Path(folder)
            scope = dict(MODELS=models, MAX_MODEL_BYTES=32*GIB, EngineError=RuntimeError,
                         shutil=shutil, secrets=secrets, os=os, re=re, audit=lambda *a: None)
            exec(compile(ast.Module(body=[fn], type_ignores=[]), "<actual-zip-import>", "exec"), scope)
            class Oversized:
                def read(self, count):
                    return b"x"*(count+1)
            with patch.object(shutil, "disk_usage", return_value=type("Disk", (), {"free":10*GIB})()):
                with self.assertRaisesRegex(RuntimeError, "declared"):
                    scope["import_model_zip_stream"]("synthetic.zip", Oversized(), 100)
            self.assertEqual(list(models.iterdir()), [])

    def test_device_detection_rejects_malformed_telemetry(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        with patch.dict(sys.modules, {"engine.core":SimpleNamespace(available_physical_memory_bytes=lambda:None)}):
            for value in ("invalid", True, -1, float("nan")):
                with self.subTest(value=value):
                    result=device_capabilities.detect(total_bytes=value, available_bytes=value, cores=value)
                    self.assertFalse(result["optional_local_llm"])
                    self.assertIsNone(result["total_ram_bytes"])
                    self.assertIsNone(result["available_ram_bytes"])
                    self.assertEqual(result["cpu_cores"],1)

    def test_valid_device_telemetry_keeps_optional_model_policy(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        with patch.dict(sys.modules, {"engine.core":SimpleNamespace(available_physical_memory_bytes=lambda:None)}):
            healthy=device_capabilities.detect(total_bytes=8*GIB, available_bytes=2*GIB, cores=4)
            self.assertTrue(healthy["optional_local_llm"])
            self.assertEqual(healthy["tier"],"enhanced")
            self.assertEqual(healthy["cpu_cores"],4)
            self.assertIn("preflight",healthy["model_policy"])
            low=device_capabilities.detect(total_bytes=8*GIB, available_bytes=128*MIB, cores=4)
            self.assertFalse(low["optional_local_llm"])
            missing=device_capabilities.detect(total_bytes=8*GIB, available_bytes=None, cores=4)
            self.assertFalse(missing["optional_local_llm"])
            self.assertIn("could not be measured",missing["inference_block_reason"])

    def test_offline_model_reports_gize_identity(self):
        prompt = model_behavior.system_prompt("developer")
        self.assertIn("You are GIZE", prompt)
        self.assertIn("UNTRUSTED DATA", prompt)
        self.assertIn("approval", prompt.lower())
        self.assertNotIn("You are TheOrg", prompt)


if __name__ == "__main__":
    unittest.main()
