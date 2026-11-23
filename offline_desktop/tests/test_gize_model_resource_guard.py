"""GIZE low-memory guard regressions; no model download or runtime required."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from engine import device_capabilities, model_behavior

MIB = 1024 ** 2
GIB = 1024 ** 3


class ModelGuardTests(unittest.TestCase):
    def test_missing_ram_is_not_treated_as_available(self):
        allowed, reason = device_capabilities.model_allowed(512 * MIB, None)
        self.assertFalse(allowed)
        self.assertIn("could not be determined", reason)

    def test_invalid_and_negative_inputs_fail_closed(self):
        bad_inputs = (
            (-1, 8 * GIB, 384 * MIB),
            (0, 8 * GIB, 384 * MIB),
            (512 * MIB, -1, 384 * MIB),
            (512 * MIB, 8 * GIB, -1),
            (512.5 * MIB, 8 * GIB, 384 * MIB),
            (True, 8 * GIB, 384 * MIB),
            (512 * MIB, False, 384 * MIB),
            (512 * MIB, 8 * GIB, None),
            ("512", 8 * GIB, 384 * MIB),
        )
        for values in bad_inputs:
            with self.subTest(values=values):
                allowed, reason = device_capabilities.model_allowed(*values)
                self.assertFalse(allowed)
                self.assertIn("Invalid", reason)

    def test_caller_cannot_remove_system_reserve(self):
        allowed, reason = device_capabilities.model_allowed(1 * GIB, 1 * GIB, 0)
        self.assertFalse(allowed)
        self.assertIn("reserve", reason)

    def test_genuine_available_memory_still_allows_small_model(self):
        allowed, reason = device_capabilities.model_allowed(512 * MIB, 2 * GIB)
        self.assertTrue(allowed)
        self.assertIn("may still fail", reason)

    def test_offline_model_reports_gize_identity(self):
        prompt = model_behavior.system_prompt("developer")
        self.assertIn("You are GIZE", prompt)
        self.assertIn("UNTRUSTED DATA", prompt)
        self.assertIn("approval", prompt.lower())
        self.assertNotIn("You are TheOrg", prompt)


if __name__ == "__main__":
    unittest.main()
