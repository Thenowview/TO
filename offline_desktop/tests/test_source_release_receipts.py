"""A Windows release receipt can only be produced after actual smoke assertions."""
import unittest
from pathlib import Path
from scripts import run_bulk_source_checks

class ReleaseReceiptSourceTests(unittest.TestCase):
    def test_builder_requires_live_smoke_before_writing_receipt(self):
        script=Path(__file__).resolve().parents[1]/'Build-TheOrg-Portable-Windows.ps1'
        s=script.read_text(encoding='utf-8')
        self.assertIn('WINDOWS-SMOKE.json',s)
        self.assertIn('scripts/check_release.py dist',s)
        self.assertLess(s.index('Portable EXE localhost dashboard smoke test failed'),s.index('WINDOWS-SMOKE.json'))
        self.assertLess(s.index('Unauthenticated local API was not rejected'),s.index('WINDOWS-SMOKE.json'))
        self.assertLess(s.index("$Hash=(Get-FileHash $Exe"),s.index('WINDOWS-SMOKE.json'))
    def test_bulk_runner_inspection_has_explicit_release_no_go(self):
        r=run_bulk_source_checks.inspect(allow_tests=False)
        self.assertTrue(r['only_source_checks'])
        self.assertFalse(r['production_go'])
        self.assertFalse(r['windows_exe_accepted'])
        self.assertFalse(r['android_device_accepted'])
        self.assertTrue(r['inspection_passed'])
        self.assertFalse(r['source_checks_passed'])
        self.assertFalse(r['tests_executed'])
