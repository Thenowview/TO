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

    def test_available_ram_cannot_exceed_physical_total(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        with patch.dict(sys.modules, {"engine.core":SimpleNamespace(available_physical_memory_bytes=lambda:None)}):
            inconsistent=device_capabilities.detect(total_bytes=4*GIB, available_bytes=8*GIB, cores=4)
            self.assertFalse(inconsistent["optional_local_llm"])
            self.assertIsNone(inconsistent["available_ram_bytes"])
            self.assertEqual(inconsistent["total_ram_bytes"],4*GIB)
            equal=device_capabilities.detect(total_bytes=4*GIB, available_bytes=4*GIB, cores=4)
            self.assertTrue(equal["optional_local_llm"])
            self.assertEqual(equal["available_ram_bytes"],4*GIB)

    def test_launch_resamples_ram_inside_lock_before_starting_process(self):
        import ast, tempfile, threading, os
        from types import SimpleNamespace
        from unittest.mock import Mock, patch
        source = ast.parse((ROOT / "engine" / "core.py").read_text(encoding="utf-8"))
        fn = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == "start_local_model")
        with tempfile.TemporaryDirectory() as folder:
            model = Path(folder) / "synthetic.gguf"
            model.write_bytes(b"GGUF" + b"x"*4092)
            lock = threading.Lock()
            def measured(value):
                self.assertTrue(lock.locked())
                return value
            for fresh in (None, 128*MIB, False, -1, 2*GIB):
                with self.subTest(fresh=fresh):
                    process = Mock(return_value=SimpleNamespace(pid=123))
                    ram = Mock(side_effect=lambda: measured(fresh))
                    context = Mock(wraps=device_capabilities.adaptive_context_window)
                    scope = dict(_model_process=None, _model_lock=lock, EngineError=RuntimeError,
                        local_models=lambda:[dict(name=model.name, path=str(model), bytes=4096)],
                        model_start_preflight=lambda name:dict(ram_check_passed=True,
                            available_ram_bytes=8*GIB, estimated_min_available_ram_bytes=1*GIB),
                        llama_binary=lambda:"synthetic-server",
                        available_backends=lambda:dict(llamacpp=False),
                        available_physical_memory_bytes=ram, os=os, DATA=Path(folder),
                        device_capabilities=SimpleNamespace(model_allowed=device_capabilities.model_allowed,
                            adaptive_context_window=context),
                        subprocess=SimpleNamespace(Popen=process, STDOUT=-2, DEVNULL=-3),
                        set_setting=Mock(), audit=Mock())
                    exec(compile(ast.Module(body=[fn], type_ignores=[]), "<actual-model-launch>", "exec"), scope)
                    with patch.dict(os.environ, {"GIZE_MODEL_CONTEXT":"8192"}):
                        if fresh == 2*GIB:
                            scope["set_setting"].side_effect = lambda *args: scope.update(_model_process=None)
                            receipt = scope["start_local_model"](model.name)
                            self.assertTrue(receipt["started"])
                            self.assertEqual(receipt["pid"], 123)
                            scope["audit"].assert_called_once_with("model.start", {"name": model.name, "pid": 123})
                            process.assert_called_once()
                            context.assert_called_once_with(8192, 1*GIB, fresh)
                            args=process.call_args.args[0]
                            self.assertEqual(args[args.index("-c")+1], "2048")
                            # A failed OS spawn must close its log without reporting launch.
                            process.reset_mock()
                            process.side_effect = OSError("synthetic spawn failure")
                            scope["set_setting"].reset_mock()
                            scope["audit"].reset_mock()
                            with self.assertRaisesRegex(OSError, "synthetic spawn failure"):
                                scope["start_local_model"](model.name)
                            self.assertIsNone(scope["_model_process"])
                            self.assertTrue(process.call_args.kwargs["stdout"].closed)
                            scope["set_setting"].assert_not_called()
                            scope["audit"].assert_not_called()
                            self.assertFalse(lock.locked())
                            # A later independent retry may recover after the failed spawn.
                            process.side_effect = None
                            process.reset_mock()
                            recovered = scope["start_local_model"](model.name)
                            self.assertTrue(recovered["started"])
                            self.assertEqual(recovered["pid"], 123)
                            process.assert_called_once()
                            scope["set_setting"].assert_called_once_with("backend", "llamacpp")
                            scope["audit"].assert_called_once_with("model.start", {"name": model.name, "pid": 123})
                            self.assertTrue(process.call_args.kwargs["stdout"].closed)
                            self.assertFalse(lock.locked())

                        else:
                            with self.assertRaisesRegex(RuntimeError, "fresh RAM check"):
                                scope["start_local_model"](model.name)
                            process.assert_not_called()
                            scope["set_setting"].assert_not_called()
                            scope["audit"].assert_not_called()
                    self.assertEqual(ram.call_count, 3 if fresh == 2*GIB else 1)

    def test_shutdown_timeout_escalates_and_failed_kill_retains_handle(self):
        import ast, threading, subprocess
        from unittest.mock import Mock
        source = ast.parse((ROOT / "engine" / "core.py").read_text(encoding="utf-8"))
        fn = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == "stop_local_model")
        for failure in ('none', 'kill', 'wait'):
            with self.subTest(failure=failure):
                proc=Mock()
                proc.poll.return_value=None
                proc.wait.side_effect=[subprocess.TimeoutExpired("synthetic", 10), 0]
                if failure == 'wait':
                    proc.wait.side_effect=[subprocess.TimeoutExpired('synthetic', 10), subprocess.TimeoutExpired('synthetic', 5)]
                if failure == 'kill':
                    proc.kill.side_effect=OSError("synthetic kill failure")
                audit=Mock()
                scope=dict(_model_process=proc, _model_lock=threading.Lock(),
                           subprocess=subprocess, audit=audit)
                exec(compile(ast.Module(body=[fn], type_ignores=[]), "<actual-model-stop>", "exec"), scope)
                if failure != "none":
                    expected=OSError if failure == "kill" else subprocess.TimeoutExpired
                    with self.assertRaises(expected):
                        scope["stop_local_model"]()
                    self.assertIs(scope["_model_process"], proc)
                    audit.assert_not_called()
                else:
                    self.assertTrue(scope["stop_local_model"]()["stopped"])
                    self.assertIsNone(scope["_model_process"])
                    self.assertEqual(proc.wait.call_args_list[1].kwargs, dict(timeout=5))
                    audit.assert_called_once_with("model.stop", {})
                proc.terminate.assert_called_once_with()
                proc.kill.assert_called_once_with()
                self.assertFalse(scope["_model_lock"].locked())

    def test_retained_active_process_denies_relaunch_before_spawn(self):
        import ast, tempfile, threading
        from types import SimpleNamespace
        from unittest.mock import Mock
        source=ast.parse((ROOT / "engine" / "core.py").read_text(encoding="utf-8"))
        fn=next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name=="start_local_model")
        with tempfile.TemporaryDirectory() as folder:
            model=Path(folder)/"synthetic.gguf"
            model.write_bytes(b"GGUF"+b"x"*4092)
            retained=Mock()
            retained.poll.return_value=None
            spawn=Mock()
            audit=Mock()
            settings=Mock()
            lock=threading.Lock()
            scope=dict(_model_process=retained, _model_lock=lock, EngineError=RuntimeError,
                local_models=lambda:[dict(name=model.name,path=str(model),bytes=4096)],
                model_start_preflight=lambda name:dict(ram_check_passed=True),
                llama_binary=lambda:"synthetic-server", subprocess=SimpleNamespace(Popen=spawn),
                audit=audit, set_setting=settings)
            exec(compile(ast.Module(body=[fn],type_ignores=[]),"<actual-model-relaunch>","exec"),scope)
            with self.assertRaisesRegex(RuntimeError,"already active"):
                scope["start_local_model"](model.name)
            self.assertIs(scope["_model_process"],retained)
            spawn.assert_not_called()
            audit.assert_not_called()
            settings.assert_not_called()
            self.assertFalse(lock.locked())


    def test_terminate_failure_retains_process_and_releases_lock(self):
        import ast, threading, subprocess
        from unittest.mock import Mock
        source = ast.parse((ROOT / "engine" / "core.py").read_text(encoding="utf-8"))
        fn = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == "stop_local_model")
        proc = Mock()
        proc.poll.return_value = None
        proc.terminate.side_effect = OSError("synthetic terminate failure")
        lock, audit = threading.Lock(), Mock()
        scope = dict(_model_process=proc, _model_lock=lock, subprocess=subprocess, audit=audit)
        exec(compile(ast.Module(body=[fn], type_ignores=[]), "<actual-model-stop>", "exec"), scope)
        with self.assertRaisesRegex(OSError, "synthetic terminate failure"):
            scope["stop_local_model"]()
        self.assertIs(scope["_model_process"], proc)
        proc.wait.assert_not_called()
        proc.kill.assert_not_called()
        audit.assert_not_called()
        self.assertFalse(lock.locked())


    def test_already_exited_process_releases_handle_without_false_stop(self):
        import ast, threading, subprocess
        from unittest.mock import Mock
        source = ast.parse((ROOT / "engine" / "core.py").read_text(encoding="utf-8"))
        fn = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == "stop_local_model")
        for exit_code in (0, 1, -9):
            with self.subTest(exit_code=exit_code):
                proc, audit = Mock(), Mock()
                proc.poll.return_value = exit_code
                lock = threading.Lock()
                scope = dict(_model_process=proc, _model_lock=lock, subprocess=subprocess, audit=audit)
                exec(compile(ast.Module(body=[fn], type_ignores=[]), "<actual-model-stop>", "exec"), scope)
                self.assertFalse(scope["stop_local_model"]()["stopped"])
                self.assertIsNone(scope["_model_process"])
                proc.terminate.assert_not_called()
                proc.kill.assert_not_called()
                proc.wait.assert_not_called()
                audit.assert_not_called()
                self.assertFalse(lock.locked())


    def test_poll_failure_does_not_discard_unknown_process(self):
        import ast, threading, subprocess
        from unittest.mock import Mock
        source = ast.parse((ROOT / "engine" / "core.py").read_text(encoding="utf-8"))
        fn = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == "stop_local_model")
        proc, audit = Mock(), Mock()
        proc.poll.side_effect = OSError("synthetic poll failure")
        lock = threading.Lock()
        scope = dict(_model_process=proc, _model_lock=lock, subprocess=subprocess, audit=audit)
        exec(compile(ast.Module(body=[fn], type_ignores=[]), "<actual-model-stop>", "exec"), scope)
        with self.assertRaisesRegex(OSError, "synthetic poll failure"):
            scope["stop_local_model"]()
        self.assertIs(scope["_model_process"], proc)
        proc.terminate.assert_not_called()
        proc.kill.assert_not_called()
        proc.wait.assert_not_called()
        audit.assert_not_called()
        self.assertFalse(lock.locked())


    def test_model_import_does_not_overwrite_concurrent_destination(self):
        import ast, tempfile, shutil, secrets, os
        from unittest.mock import Mock, patch
        source = ast.parse((ROOT / "engine" / "core.py").read_text(encoding="utf-8"))
        fn = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == "import_model_stream")
        with tempfile.TemporaryDirectory() as folder:
            models = Path(folder)
            target = models / "synthetic.gguf"
            audit = Mock()
            scope = dict(MODELS=models, MAX_MODEL_BYTES=32*GIB, EngineError=RuntimeError,
                         shutil=shutil, secrets=secrets, os=os, audit=audit)
            exec(compile(ast.Module(body=[fn], type_ignores=[]), "<actual-import-function>", "exec"), scope)
            class Concurrent:
                def read(self, count):
                    target.write_bytes(b"preserve-concurrent-model")
                    return b"GGUF" + b"x"*4092
            with patch.object(shutil, "disk_usage", return_value=type("Disk", (), {"free":10*GIB})()):
                with self.assertRaisesRegex(RuntimeError, "already exists"):
                    scope["import_model_stream"](target.name, Concurrent(), 4096)
            self.assertEqual(target.read_bytes(), b"preserve-concurrent-model")
            self.assertEqual(list(models.iterdir()), [target])
            audit.assert_not_called()


    def test_zip_publication_race_preserves_competing_model(self):
        import ast, tempfile, shutil, secrets, os, re, io, zipfile
        from unittest.mock import Mock, patch
        source = ast.parse((ROOT / "engine" / "core.py").read_text(encoding="utf-8"))
        fn = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == "import_model_zip_stream")
        payload = io.BytesIO()
        with zipfile.ZipFile(payload, "w", compression=zipfile.ZIP_STORED) as zf:
            zf.writestr("synthetic.gguf", b"GGUF" + b"x"*4092)
        data = payload.getvalue()
        with tempfile.TemporaryDirectory() as folder:
            models, audit = Path(folder), Mock()
            target = models / "synthetic.gguf"
            scope = dict(MODELS=models, MAX_MODEL_BYTES=32*GIB, EngineError=RuntimeError,
                         shutil=shutil, secrets=secrets, os=os, re=re, audit=audit)
            exec(compile(ast.Module(body=[fn], type_ignores=[]), "<actual-zip-import>", "exec"), scope)
            real_link = os.link
            def competing_link(src, dst):
                target.write_bytes(b"preserve-concurrent-model")
                return real_link(src, dst)
            with patch.object(shutil, "disk_usage", return_value=type("Disk", (), {"free":10*GIB})()), patch.object(os, "link", side_effect=competing_link):
                with self.assertRaises(RuntimeError):
                    scope["import_model_zip_stream"]("synthetic.zip", io.BytesIO(data), len(data))
            self.assertEqual(target.read_bytes(), b"preserve-concurrent-model")
            self.assertEqual(list(models.iterdir()), [target])
            audit.assert_not_called()


    def test_publication_failure_cleans_direct_and_zip_imports(self):
        import ast, tempfile, shutil, secrets, os, re, io, zipfile
        from unittest.mock import Mock, patch
        tree = ast.parse((ROOT / "engine" / "core.py").read_text(encoding="utf-8"))
        model = b"GGUF" + b"x"*4092
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_STORED) as zf:
            zf.writestr("synthetic.gguf", model)
        for kind, data in (("stream", model), ("zip_stream", archive.getvalue())):
            for failure in (PermissionError, OSError):
                with self.subTest(kind=kind, failure=failure), tempfile.TemporaryDirectory() as folder:
                    models, audit = Path(folder), Mock()
                    fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "import_model_" + kind)
                    scope = dict(MODELS=models, MAX_MODEL_BYTES=32*GIB, EngineError=RuntimeError,
                                 shutil=shutil, secrets=secrets, os=os, re=re, audit=audit)
                    exec(compile(ast.Module(body=[fn], type_ignores=[]), "<actual-import>", "exec"), scope)
                    with patch.object(shutil, "disk_usage", return_value=type("Disk", (), {"free":10*GIB})()), patch.object(os, "link", side_effect=failure("synthetic publication failure")):
                        with self.assertRaises((RuntimeError, OSError)):
                            scope[fn.name]("synthetic.zip" if kind == "zip_stream" else "synthetic.gguf", io.BytesIO(data), len(data))
                    self.assertEqual(list(models.iterdir()), [])
                    audit.assert_not_called()
                    # Publication failure must not poison a fresh import of the same name.
                    with patch.object(shutil, "disk_usage", return_value=type("Disk", (), {"free":10*GIB})()):
                        receipt = scope[fn.name]("synthetic.zip" if kind == "zip_stream" else "synthetic.gguf", io.BytesIO(data), len(data))
                    target = models / "synthetic.gguf"
                    self.assertEqual(target.read_bytes(), model)
                    self.assertEqual(list(models.iterdir()), [target])
                    self.assertEqual(receipt["name"], target.name)
                    self.assertEqual(receipt["bytes"], len(model))
                    audit.assert_called_once()
                    self.assertEqual(audit.call_args.args[0], "model.import_zip" if kind == "zip_stream" else "model.import")

    def test_offline_model_reports_gize_identity(self):
        prompt = model_behavior.system_prompt("developer")
        self.assertIn("You are GIZE", prompt)
        self.assertIn("UNTRUSTED DATA", prompt)
        self.assertIn("approval", prompt.lower())
        self.assertNotIn("You are TheOrg", prompt)


if __name__ == "__main__":
    unittest.main()
