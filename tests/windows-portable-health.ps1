# Synthetic native-host protocol fixtures; no browser, registry or privilege changes.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ExecutablePath)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$probe = Join-Path $PSScriptRoot '..\portable\Test-BridgeConnection.ps1'
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('TheOrgHealth-' + [guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $fixtureRoot)
$fixtureSource = Join-Path $fixtureRoot 'Fixture.cs'
$fixtureExe = Join-Path $fixtureRoot 'Fixture.exe'
$oldMode = [Environment]::GetEnvironmentVariable('OT_HEALTH_FIXTURE_MODE','Process')
$originalEncoding = [Console]::InputEncoding
try {
  # Regression: Framework Process must not prepend the console UTF-8 BOM to frames.
  [Console]::InputEncoding = New-Object Text.UTF8Encoding($true)
  & $probe -ExecutablePath $ExecutablePath
  if ([Console]::InputEncoding.GetPreamble().Length -ne 3) {
    throw 'Health probe did not restore the caller console input encoding.'
  }
@'
using System;
using System.IO;
using System.Text;
using System.Threading;
class Fixture {
  static int Main() {
    Console.OpenStandardInput().CopyTo(Stream.Null);
    string mode = Environment.GetEnvironmentVariable("OT_HEALTH_FIXTURE_MODE");
    if (mode == "timeout") { Thread.Sleep(10000); return 0; }
    Stream output = Console.OpenStandardOutput();
    if (mode == "truncated") {
      byte[] header=BitConverter.GetBytes(10);
      output.Write(header,0,4); output.WriteByte(123); return 0;
    }
    if (mode == "oversize") {
      byte[] header=BitConverter.GetBytes(1048577);
      output.Write(header,0,4); return 0;
    }
    string payload="{\"ok\":true,\"engine\":\"TheOrg.Bridge\",\"protocolVersion\":1}";
    if (mode=="version") payload=payload.Replace(":1}",":2}");
    if (mode=="engine") payload=payload.Replace("TheOrg.Bridge","Other");
    if (mode=="boolean") payload=payload.Replace("true","\"true\"");
    if (mode=="json") payload="{";
    byte[] bytes=mode=="utf8"?new byte[]{255}:Encoding.UTF8.GetBytes(payload);
    byte[] size=BitConverter.GetBytes(bytes.Length);
    output.Write(size,0,4); output.Write(bytes,0,bytes.Length);
    if (mode=="trailing") output.WriteByte(0);
    output.Flush();
    return mode=="nonzero"?3:0;
  }
}
'@ | Set-Content -LiteralPath $fixtureSource -Encoding utf8
  $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
  & $compiler /nologo "/out:$fixtureExe" $fixtureSource
  if ($LASTEXITCODE -ne 0) { throw 'Could not compile synthetic health fixture.' }
  $env:OT_HEALTH_FIXTURE_MODE = 'valid'
  & $probe -ExecutablePath $fixtureExe
  foreach ($mode in @('version','engine','boolean','truncated','oversize','trailing','nonzero','json','utf8','timeout')) {
    $env:OT_HEALTH_FIXTURE_MODE = $mode
    $rejected = $false
    try { & $probe -ExecutablePath $fixtureExe -TimeoutSeconds 1 } catch { $rejected = $true }
    if (-not $rejected) { throw "Health probe accepted invalid fixture: $mode" }
    Write-Host "PASS rejected synthetic native host: $mode"
  }
  $rejected = $false
  try { & $probe -ExecutablePath (Join-Path $fixtureRoot 'missing.exe') } catch { $rejected = $true }
  if (-not $rejected) { throw 'Health probe accepted missing executable.' }
  Write-Host 'PASS Windows portable installation health regression checks.'
} finally {
  [Console]::InputEncoding = $originalEncoding
  [Environment]::SetEnvironmentVariable('OT_HEALTH_FIXTURE_MODE',$oldMode,'Process')
  # Only the two fixture files this test created; no recursive user-data deletion.
  foreach ($file in @($fixtureExe,$fixtureSource)) {
    if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
  }
  Remove-Item -LiteralPath $fixtureRoot
}
