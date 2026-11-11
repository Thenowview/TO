"""Synthetic-only tests for TheOrg's Master safe temp cleanup."""
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import master_compact_clean as clean


class MasterCleanupTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='theorg-master-clean-')
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        (self.root/'data'/'tmp').mkdir(parents=True)
        (self.root/'models').mkdir()
        (self.root/'workspace').mkdir()
        (self.root/'data'/'private.sqlite3').write_text('PERSIST')
        (self.root/'workspace'/'important.tmp').write_text('USER')
        (self.root/'models'/'real.gguf').write_text('MODEL')
        self.partial=self.root/'models'/('.import-'+'a'*24+'.gguf.partial')
        self.stale=self.root/'data'/'tmp'/'stale.tmp'
        self.partial.write_text('ABORTED');self.stale.write_text('OLD')
        old=time.time()-14*86400
        for item in (self.partial,self.stale): os.utime(item,(old,old))

    def test_dry_run_is_read_only_and_apply_is_allowlisted(self):
        view=clean.cleanup(self.root)
        self.assertEqual(view['mode'],'dry-run')
        self.assertEqual(view['count'],2)
        self.assertTrue(self.partial.exists())
        done=clean.cleanup(self.root,apply=True)
        self.assertEqual(len(done['deleted']),2)
        self.assertFalse(self.partial.exists())
        self.assertFalse(self.stale.exists())
        self.assertEqual((self.root/'data'/'private.sqlite3').read_text(),'PERSIST')
        self.assertEqual((self.root/'models'/'real.gguf').read_text(),'MODEL')
        self.assertEqual((self.root/'workspace'/'important.tmp').read_text(),'USER')

    def test_new_and_linked_files_are_not_deleted(self):
        recent=self.root/'data'/'tmp'/'recent.tmp'
        recent.write_text('ACTIVE')
        link=self.root/'data'/'tmp'/'linked.tmp'
        try: link.symlink_to(self.root/'workspace'/'important.tmp')
        except (OSError,NotImplementedError): pass
        result=clean.cleanup(self.root,apply=True)
        self.assertEqual(result['count'],2)
        self.assertTrue(recent.exists())
        self.assertEqual((self.root/'workspace'/'important.tmp').read_text(),'USER')

    def test_invalid_age_rejected(self):
        with self.assertRaises(ValueError):
            clean.cleanup(self.root,apply=True,min_age_days=0)
