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

    def test_tampered_download_rejected_by_actual_powershell_before_extraction(self):
        import os, shutil, subprocess, tempfile
        shell=shutil.which("pwsh") or shutil.which("powershell")
        if not shell:
            if os.name=="nt":
                self.fail("Windows hash rejection test requires PowerShell")
            self.skipTest("PowerShell unavailable; Windows CI must execute this test")
        script=(Path(__file__).resolve().parents[1]/"Build-TheOrg-Portable-Windows.ps1").read_text()
        section=script.split("# Official llama.cpp",1)[1].split("# Portable Git",1)[0]
        with tempfile.TemporaryDirectory() as folder:
            harness=Path(folder)/"tampered.ps1"
            harness.write_text("""
$ErrorActionPreference='Stop'
$Cache=$PSScriptRoot
$Bin=$PSScriptRoot
$script:Expanded=$false
function Invoke-WebRequest { param($Uri,$OutFile)
    [IO.File]::WriteAllBytes($OutFile,[byte[]](1,2,3,4))
}
function Expand-Archive { $script:Expanded=$true; throw 'UNSAFE extraction reached' }
try {
""" + section + """
    throw 'UNSAFE tampered download accepted'
} catch {
    if ($_.Exception.Message -notlike 'llama.cpp binary hash mismatch:*') { throw }
    if ($script:Expanded) { throw 'UNSAFE extraction occurred' }
    Write-Output 'PASS tampered download rejected before extraction'
}
""",encoding="utf-8")
            result=subprocess.run([shell,"-NoProfile","-NonInteractive","-File",str(harness)],
                                  capture_output=True,text=True,timeout=30)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            self.assertIn("PASS tampered download rejected before extraction",result.stdout)
