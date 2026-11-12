"""Synthetic checks for source integrity: stale hashes must fail rather than refresh."""
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[2] / "tools" / "adaptive_integrity.py"
spec = importlib.util.spec_from_file_location("adaptive_integrity", SCRIPT)
integrity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(integrity)
SHA = "a" * 40


class AdaptiveIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="adaptive_integrity_")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in integrity.ALLOW:
            file = self.root / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text("approved static test file for " + name, encoding="utf-8")
        self.saved_root = integrity.ROOT
        integrity.ROOT = self.root
        self.addCleanup(setattr, integrity, "ROOT", self.saved_root)

    def _git(self, *args):
        if args[:2] == ("rev-parse", "--show-toplevel"):
            return str(self.root)
        if args[:2] == ("rev-parse", "HEAD"):
            return SHA
        if args[:2] == ("status", "--porcelain"):
            return ""
        raise AssertionError("Unexpected git query: " + repr(args))

    def test_clean_manifest_verifies_exact_files_and_commit(self):
        with patch.object(integrity, "git", side_effect=self._git):
            target = self.root / "out" / "manifest.json"
            created = integrity.create(target)
            self.assertEqual(created["source_sha256_count"], len(integrity.ALLOW))
            verified = integrity.verify(target)
        self.assertTrue(verified["verified"])
        self.assertFalse(verified["runtime_verified"])
        self.assertEqual(json.loads(target.read_text())["reviewed_commit_sha"], SHA)

    def test_modified_source_fails_validation_without_overwriting_hash(self):
        target = self.root / "out" / "manifest.json"
        with patch.object(integrity, "git", side_effect=self._git):
            integrity.create(target)
            before = target.read_bytes()
            file = self.root / integrity.ALLOW[0]
            file.write_text("source changed since verified manifest")
            with self.assertRaisesRegex(ValueError, "Stale or tampered SHA-256"):
                integrity.verify(target)
            self.assertEqual(target.read_bytes(), before)

    def test_wrong_commit_or_missing_file_fails_closed(self):
        target = self.root / "out" / "manifest.json"
        with patch.object(integrity, "git", side_effect=self._git):
            integrity.create(target)
            manifest = json.loads(target.read_text())
            manifest["reviewed_commit_sha"] = "b" * 40
            target.write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, "different commit"):
                integrity.verify(target)

            manifest["reviewed_commit_sha"] = SHA
            target.write_text(json.dumps(manifest))
            (self.root / integrity.ALLOW[0]).unlink()
            with self.assertRaisesRegex(ValueError, "missing"):
                integrity.verify(target)

    def test_static_nested_archive_rejected_without_deleting_original(self):
        nested = self.root / "offline_desktop" / "static" / "duplicate.zip"
        nested.write_bytes(b"do not erase user files")
        with self.assertRaisesRegex(ValueError, "Nested compressed assets"):
            integrity.assert_no_nested_static_zips(self.root)
        self.assertTrue(nested.exists())

    def test_cannot_generate_from_dirty_checkout(self):
        def dirty(*args):
            if args[:2] == ("rev-parse", "--show-toplevel"):
                return str(self.root)
            if args[:2] == ("status", "--porcelain"):
                return " M offline_desktop/engine/core.py"
            return SHA
        with patch.object(integrity, "git", side_effect=dirty):
            with self.assertRaisesRegex(ValueError, "modified tracked source"):
                integrity.create(self.root / "out" / "manifest.json")


if __name__ == "__main__":
    unittest.main()
