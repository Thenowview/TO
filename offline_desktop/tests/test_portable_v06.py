"""Portable mode security checks; no real model weights required."""
from __future__ import annotations
import io, os, sys, tempfile, unittest, urllib.error, urllib.request, json
from pathlib import Path
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from engine import core
import app

class PortableTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='theorg_portable_')
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name)
        self.original = core.DATA, core.WORKSPACE, core.MODELS, core.DB
        core.DATA, core.WORKSPACE, core.MODELS, core.DB = (base/'data', base/'workspace', base/'models', base/'data'/'test.sqlite3')
        self.addCleanup(self.restore)
        core.init()
    def restore(self):
        core.DATA, core.WORKSPACE, core.MODELS, core.DB = self.original
    def test_safely_imports_local_gguf_stream(self):
        payload = b'GGUF' + b'\0'*8192
        result = core.import_model_stream('tiny-test.gguf', io.BytesIO(payload), len(payload))
        self.assertEqual(result['bytes'], len(payload))
        self.assertEqual(core.local_models()[0]['name'], 'tiny-test.gguf')
        self.assertEqual((core.MODELS/'tiny-test.gguf').read_bytes(), payload)
    def test_rejects_invalid_model_and_cleans_partial(self):
        with self.assertRaisesRegex(core.EngineError, 'not GGUF'):
            core.import_model_stream('bad.gguf', io.BytesIO(b'BAD!' + b'\0'*4096), 4100)
        self.assertEqual(core.local_models(),[])
        self.assertEqual(list(core.MODELS.glob('*.partial')),[])
    def test_rejects_traversal_and_interrupted_import(self):
        for name in ('../escape.gguf','bad\\name.gguf','x.zip','C:/model.gguf'):
            with self.subTest(name=name), self.assertRaises(core.EngineError):
                core.import_model_stream(name, io.BytesIO(b'GGUF'+b'\0'*5000), 5004)
        with self.assertRaisesRegex(core.EngineError,'interrupted'):
            core.import_model_stream('partial.gguf', io.BytesIO(b'GGUF'+b'\0'*6000), 8000)
        self.assertFalse((core.MODELS/'partial.gguf').exists())
    def test_rejects_duplicate_import(self):
        data=b'GGUF'+b'\0'*6000
        core.import_model_stream('existing.gguf',io.BytesIO(data),len(data))
        with self.assertRaisesRegex(core.EngineError,'already exists'):
            core.import_model_stream('existing.gguf',io.BytesIO(data),len(data))
    def test_stop_without_running_model(self):
        with patch.object(core,'_model_process',None):
            self.assertFalse(core.stop_local_model()['stopped'])
    def test_assets_have_browser_ai_and_import_controls(self):
        html=(ROOT/'static'/'index.html').read_text()
        js=(ROOT/'static'/'app.js').read_text()
        for tag in ('modelUpload','importModel','stopModel','chromeAIRun','chromeAIStatus','chromeAIOutput'):
            self.assertIn('id="'+tag+'"',html)
        self.assertIn('LanguageModel.create()',js)
        self.assertIn("'/api/models/import'",js)

if __name__ == '__main__': unittest.main()
