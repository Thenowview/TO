"""Safe compact cleanup tests with synthetic data only."""
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import master_compact_clean as cleaner


class CompactCleanTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'data' / 'tmp').mkdir(parents=True)
        (self.root / 'models').mkdir()
        (self.root / 'workspace').mkdir()
        (self.root / 'data' / 'state.sqlite3').write_text('SAVE ME')
        (self.root / 'workspace' / 'draft.tmp').write_text('USER DATA')
        (self.root / 'models' / 'real.gguf').write_text('MODEL')
        self.expected = self.root / 'data' / 'tmp' / 'stale.tmp'
        self.expected.write_text('CACHE')
        self.import_fragment = self.root / 'models' / ('.import-'+'a'*24+'.gguf.partial')
        self.import_fragment.write_text('BROKEN IMPORT')
        self.raw_import = self.root / 'models' / ('.import-'+'b'*24+'.partial')
        self.raw_import.write_text('BROKEN RAW IMPORT')
        old = time.time() - 15*86400
        for x in (self.expected, self.import_fragment, self.raw_import):
            os.utime(x, (old, old))

    def test_dry_run_and_apply_only_delete_known_temp(self):
        report = cleaner.cleanup(self.root)
        self.assertEqual(report['mode'], 'dry-run')
        self.assertEqual(report['count'], 3)
        self.assertTrue(self.expected.exists())
        report = cleaner.cleanup(self.root, apply=True)
        self.assertEqual(len(report['deleted']), 3)
        self.assertFalse(self.expected.exists())
        self.assertFalse(self.import_fragment.exists())
        self.assertFalse(self.raw_import.exists())
        self.assertEqual((self.root / 'data' / 'state.sqlite3').read_text(), 'SAVE ME')
        self.assertEqual((self.root / 'models' / 'real.gguf').read_text(), 'MODEL')
        self.assertEqual((self.root / 'workspace' / 'draft.tmp').read_text(), 'USER DATA')

    def test_recent_file_never_cleaned(self):
        recent = self.root / 'data' / 'tmp' / 'recent.tmp'
        recent.write_text('ACTIVE')
        self.assertEqual(cleaner.cleanup(self.root, apply=True)['count'], 3)
        self.assertTrue(recent.exists())

    def test_symlink_never_followed(self):
        target = self.root / 'workspace' / 'draft.tmp'
        link = self.root / 'data' / 'tmp' / 'something.tmp'
        try:
            link.symlink_to(target)
        except (OSError, NotImplementedError):
            self.skipTest('Symlinks not supported')
        self.assertEqual(cleaner.cleanup(self.root, apply=True)['count'], 3)
        self.assertTrue(target.exists())
