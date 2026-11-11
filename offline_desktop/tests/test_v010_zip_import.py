"""Real ZIP IO checks; no model weights or LLM services needed."""
import io
import os
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
from engine import core


def archive(entries, compression=zipfile.ZIP_DEFLATED):
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w',compression=compression) as z:
        for name,body in entries:
            z.writestr(name,body)
    return out.getvalue()

class ModelArchiveImportTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='theorg_v010_')
        self.addCleanup(self.temp.cleanup)
        self.old=(core.DATA,core.MODELS,core.WORKSPACE,core.DB)
        self.addCleanup(self.restore)
        root=Path(self.temp.name)
        core.DATA=root/'data'; core.MODELS=root/'models';core.WORKSPACE=root/'workspace';core.DB=core.DATA/'test.sqlite3'
        core.init()
    def restore(self):
        core.DATA,core.MODELS,core.WORKSPACE,core.DB=self.old
    def test_stream_real_zip_into_model_store(self):
        payload=b'GGUF'+os.urandom(12000)
        blob=archive([('nested/main-model.gguf',payload),('README.txt',b'test')])
        result=core.import_model_zip_stream('download.zip',io.BytesIO(blob),len(blob))
        self.assertEqual(result['name'],'main-model.gguf')
        self.assertEqual(result['bytes'],len(payload))
        self.assertEqual((core.MODELS/'main-model.gguf').read_bytes(),payload)
        self.assertEqual(len(result['sha256']),64)
        self.assertEqual(list(core.MODELS.glob('*.partial')),[])
        self.assertEqual(len(core.local_models()),1)
    def test_rejects_traversal_in_unused_member(self):
        blob=archive([('model.gguf',b'GGUF'+os.urandom(8000)),('../bad.txt',b'no')])
        with self.assertRaisesRegex(core.EngineError,'unsafe paths'):
            core.import_model_zip_stream('unsafe.zip',io.BytesIO(blob),len(blob))
        self.assertEqual(list(core.MODELS.iterdir()),[])
    def test_rejects_multiple_models(self):
        blob=archive([('first.gguf',b'GGUF'+os.urandom(6000)),('second.gguf',b'GGUF'+os.urandom(6000))])
        with self.assertRaisesRegex(core.EngineError,'exactly one'):
            core.import_model_zip_stream('two.zip',io.BytesIO(blob),len(blob))
    def test_rejects_zip_bomb_ratio(self):
        blob=archive([('huge.gguf',b'GGUF'+b'\0'*400000)])
        with self.assertRaisesRegex(core.EngineError,'compression ratio'):
            core.import_model_zip_stream('ratio.zip',io.BytesIO(blob),len(blob))
    def test_rejects_invalid_magic_crc_and_truncated_upload(self):
        blob=archive([('model.gguf',b'BAD!'+os.urandom(8000))])
        with self.assertRaisesRegex(core.EngineError,'GGUF magic'):
            core.import_model_zip_stream('bad.zip',io.BytesIO(blob),len(blob))
        good=archive([('model.gguf',b'GGUF'+os.urandom(8000))])
        with self.assertRaisesRegex(core.EngineError,'interrupted'):
            core.import_model_zip_stream('partial.zip',io.BytesIO(good[:100]),len(good))
        with self.assertRaisesRegex(core.EngineError,'damaged ZIP'):
            core.import_model_zip_stream('broken.zip',io.BytesIO(b'X'*500),500)
        self.assertEqual(list(core.MODELS.iterdir()),[])
    def test_existing_model_not_overwritten(self):
        blob=archive([('model.gguf',b'GGUF'+os.urandom(8000))])
        core.import_model_zip_stream('first.zip',io.BytesIO(blob),len(blob))
        with self.assertRaisesRegex(core.EngineError,'already exists'):
            core.import_model_zip_stream('second.zip',io.BytesIO(blob),len(blob))
    def test_rejects_zip_symlinks(self):
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w') as z:
            z.writestr('model.gguf',b'GGUF'+os.urandom(8000))
            symlink=zipfile.ZipInfo('link')
            symlink.create_system=3
            symlink.external_attr=(0o120777<<16)
            z.writestr(symlink,b'/etc/passwd')
        blob=out.getvalue()
        with self.assertRaisesRegex(core.EngineError,'symlink'):
            core.import_model_zip_stream('symlink.zip',io.BytesIO(blob),len(blob))
    def test_ui_exposes_zip_picker(self):
        root=Path(__file__).resolve().parents[1]
        self.assertIn('accept=".gguf,.zip"',(root/'static/index.html').read_text())
        js=(root/'static/app.js').read_text()
        self.assertIn("'/api/models/import-zip'",js)

if __name__=='__main__': unittest.main()
