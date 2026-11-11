"""Release cannot pass with an MZ stub, missing receipt or mismatched hash."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from scripts.check_release import REQUIRED, validate_release

class WindowsReleaseGateTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dist=Path(self.temp.name)
        self.exe=self.dist/'TheOrg.exe'
        data=bytearray(1_000_002)
        data[0:2]=b'MZ'
        data[0x3c:0x40]=(0x80).to_bytes(4,'little')
        data[0x80:0x84]=b'PE\x00\x00'
        data[0x84:0x86]=(0x8664).to_bytes(2,'little')
        data[0x98:0x9a]=(0x20b).to_bytes(2,'little')
        self.exe.write_bytes(data)
        self.sha=hashlib.sha256(data).hexdigest()
        (self.dist/'SHA256SUMS.txt').write_text(f'{self.sha}  TheOrg.exe\n')
        (self.dist/'UPSTREAM-DIGESTS.txt').write_text(
            'llama.cpp b12248 '+'a'*64+'\nMinGit v2.52.0.windows.1 '+'b'*64+'\n')
        self.receipt={'version':'0.10.0','exe_sha256':self.sha,
                      'checks':{key:True for key in REQUIRED}}
        self.write_receipt()
    def write_receipt(self):
        (self.dist/'WINDOWS-SMOKE.json').write_text(json.dumps(self.receipt))
    def test_complete_evidence_is_accepted(self):
        self.assertEqual(validate_release(self.dist)['status'],'passed')
    def test_missing_runtime_receipt_fails_closed(self):
        (self.dist/'WINDOWS-SMOKE.json').unlink()
        self.assertEqual(validate_release(self.dist)['status'],'failed')
    def test_checksum_mismatch_fails_closed(self):
        (self.dist/'SHA256SUMS.txt').write_text('a'*64+'  TheOrg.exe\n')
        self.assertIn('Checksum mismatch',validate_release(self.dist)['problems'])
    def test_smoke_check_must_be_true(self):
        self.receipt['checks']['local_git_project']=False
        self.write_receipt()
        self.assertEqual(validate_release(self.dist)['status'],'failed')
    def test_smoke_receipt_bound_to_executable(self):
        self.receipt['exe_sha256']='0'*64
        self.write_receipt()
        self.assertEqual(validate_release(self.dist)['status'],'failed')
    def test_mz_stub_does_not_count_as_exe(self):
        self.exe.write_bytes(b'MZ'+b'0'*1_000_000)
        self.assertEqual(validate_release(self.dist)['checks'].get('pe_header'),None)
    def test_wrong_architecture_fails(self):
        data=bytearray(self.exe.read_bytes())
        data[0x84:0x86]=(0x014c).to_bytes(2,'little')
        self.exe.write_bytes(data)
        self.assertEqual(validate_release(self.dist)['status'],'failed')
    def test_wrong_pe_magic_fails(self):
        data=bytearray(self.exe.read_bytes())
        data[0x98:0x9a]=(0x10b).to_bytes(2,'little')
        self.exe.write_bytes(data)
        self.assertEqual(validate_release(self.dist)['status'],'failed')

if __name__=='__main__':
    unittest.main()
