"""Structured inference benchmark tests use mock responses; not claimed real GGUF tests."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from engine import core

class StructuredModelBenchTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='theorg_benchmark_')
        self.addCleanup(self.tmp.cleanup)
        self.old=(core.DB,core.DATA,core.WORKSPACE,core.MODELS)
        self.addCleanup(self.restore)
        root=Path(self.tmp.name);core.DATA=root/'data';core.DB=core.DATA/'db.sqlite3';core.WORKSPACE=root/'workspace';core.MODELS=root/'models'
        core.init()
    def restore(self):core.DB,core.DATA,core.WORKSPACE,core.MODELS=self.old
    def test_matching_response_passes_one_schema_challenge(self):
        with patch.object(core,'active_backend',return_value=('llamacpp','test')),patch.object(core,'infer',return_value=json.dumps({'product':'TheOrg','result':42,'flags':[True,False]})) as call:
            result=core.benchmark_local_model()
        self.assertTrue(result['structured_output_pass'])
        self.assertEqual(result['quality_claim'][:4],'none')
        self.assertEqual(call.call_args.kwargs['max_tokens'],180)
    def test_mismatched_or_invalid_response_fails(self):
        with patch.object(core,'active_backend',return_value=('llamacpp','test')):
            for response in ('not json',json.dumps({'product':'TheOrg','result':'42','flags':[True,False]})):
                with self.subTest(response=response),patch.object(core,'infer',return_value=response):
                    self.assertFalse(core.benchmark_local_model()['structured_output_pass'])
    def test_no_model_rejected(self):
        with patch.object(core,'active_backend',return_value=(None,None)):
            with self.assertRaisesRegex(core.EngineError,'Start a compatible local model'):
                core.benchmark_local_model()
    def test_dashboard_has_benchmark_button(self):
        root=Path(__file__).resolve().parents[1]
        self.assertIn('id="modelBenchmark"',(root/'static/index.html').read_text())
        self.assertIn('models/benchmark',(root/'static/app.js').read_text())
