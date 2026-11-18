"""Contract tests for read-only readiness reporting."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "gize_ot_readiness.py"
spec = importlib.util.spec_from_file_location("gize_ot_readiness", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class GizeOtReadinessTests(unittest.TestCase):
    def test_empty_repository_is_not_ready(self):
        with tempfile.TemporaryDirectory() as folder:
            result = module.check(folder)
            self.assertFalse(result["source_complete"])
            self.assertFalse(result["release_approved"])
            self.assertTrue(all(entry["missing"] for entry in result["checks"]))

    def test_required_source_presence_does_not_approve_release(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for paths in module.REQUIRED.values():
                for relative in paths:
                    target = root / relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_text("fixture", encoding="utf-8")
            report = module.check(root)
            self.assertTrue(report["source_complete"])
            self.assertFalse(report["release_approved"])
            self.assertIn("offline key custody/decryption", report["unverified"])

if __name__ == "__main__":
    unittest.main()
