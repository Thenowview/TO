"""Pinned Windows runtime download contract; PowerShell execution remains a CI gate."""
import unittest
from pathlib import Path

class PinnedDownloadTests(unittest.TestCase):
    def test_download_has_no_metadata_or_credentials_and_verifies_before_extract(self):
        script=(Path(__file__).resolve().parents[1]/"Build-TheOrg-Portable-Windows.ps1").read_text()
        section=script.split("# Official llama.cpp",1)[1].split("# Portable Git",1)[0]
        self.assertNotIn("api.github.com",section)
        self.assertNotIn("Invoke-RestMethod",section)
        self.assertNotIn("Authorization",section)
        self.assertNotIn("GITHUB_TOKEN",section)
        self.assertIn("releases/download/$LlamaTag/$AssetName",section)
        self.assertIn("$LlamaTag='b12248'",section)
        self.assertIn("$Expected='bb306bfd390f8782c0acaba490505d12f07392791b48f1dd039387a5bacf1181'",section)
        rejection="if($Actual -ne $Expected){throw"
        self.assertIn(rejection,section)
        self.assertLess(section.index(rejection),section.index("Expand-Archive"))
