"""Model memory guards on CPU-only inference, no actual model weights."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from engine import core

class ModelCapacityTests(unittest.TestCase):
    def setUp(self):
        self.t=tempfile.TemporaryDirectory(prefix='theorg_ram_');self.addCleanup(self.t.cleanup)
        self.old=(core.MODELS,core.DATA,core.DB,core.WORKSPACE)
        self.addCleanup(self.restore)
        r=Path(self.t.name)
        core.MODELS=r/'models';core.DATA=r/'data';core.DB=core.DATA/'db.sqlite3';core.WORKSPACE=r/'workspace'
        core.init()
        (core.MODELS/'tiny.gguf').write_bytes(b'GGUF'+b'\0'*8192)
    def restore(self):core.MODELS,core.DATA,core.DB,core.WORKSPACE=self.old
    def test_small_model_preflight_under_plenty_of_ram(self):
        with patch.object(core,'available_physical_memory_bytes',return_value=6*1024**3):
            r=core.model_start_preflight('tiny.gguf')
        self.assertTrue(r['ram_check_passed'])
        self.assertGreater(r['estimated_min_available_ram_bytes'],1024**3)
    def test_fails_closed_on_low_ram_before_executable_launch(self):
        with patch.object(core,'available_physical_memory_bytes',return_value=512*1024**2):
            r=core.model_start_preflight('tiny.gguf')
            self.assertFalse(r['ram_check_passed'])
            with self.assertRaisesRegex(core.EngineError,'Insufficient available RAM'):
                core.start_local_model('tiny.gguf')
    def test_unknown_model_rejected(self):
        with self.assertRaisesRegex(core.EngineError,'not found'):
            core.model_start_preflight('missing.gguf')
    def test_api_js_has_preflight(self):
        root=Path(__file__).resolve().parents[1]
        self.assertIn("'/api/models/preflight'",(root/'app.py').read_text())
        self.assertIn("'models/preflight'",(root/'static/app.js').read_text())
