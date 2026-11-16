"""Release gate may report source presence; never fabricate a compiled binary."""
import json
import tempfile
import unittest
from pathlib import Path
from scripts import release_readiness, android_source_contract

class ReleaseReadinessSourceTests(unittest.TestCase):
    def test_inspection_is_fail_closed_without_windows_or_android_receipts(self):
        result=release_readiness.inspect()
        self.assertTrue(result['source']['web_ui_files_present'])
        self.assertTrue(result['source']['engine_files_present'])
        self.assertTrue(result['source']['adaptive_1_2_3_registry_present'])
        self.assertFalse(result['windows']['smoke_test_verified'])
        self.assertFalse(result['android']['installed_on_device'])
        self.assertFalse(result['models']['gguf_inference_verified'])
        self.assertFalse(result['production_go'])
    def test_presence_of_fake_artifacts_does_not_pass_acceptance(self):
        with tempfile.TemporaryDirectory() as t:
            base=Path(t)
            (base/'TheOrg.exe').write_bytes(b'MZ')
            apk=base/'nano.apk';apk.write_bytes(b'not an apk')
            result=release_readiness.inspect(windows_dist=base,android_apk=apk)
        self.assertTrue(result['windows']['candidate_exe_present'])
        self.assertTrue(result['android']['candidate_apk_present'])
        self.assertFalse(result['production_go'])
        self.assertFalse(result['windows']['installer_verified'])
    def test_android_source_contract_is_not_an_apk_build(self):
        result=android_source_contract.verify()
        self.assertTrue(result['passed'],result)
        self.assertFalse(result['apk_built'])
        self.assertFalse(result['device_verified'])
    def test_release_readiness_cli_never_returns_release_success(self):
        self.assertEqual(release_readiness.main(['--source',str(release_readiness.ROOT)]),2)
