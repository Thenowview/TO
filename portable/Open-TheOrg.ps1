# Launches the extension inside the user's installed Chrome, NOT Chrome for Testing.
[CmdletBinding()]
param([switch]$ValidateOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$idFile=Join-Path $root 'ExtensionId.txt'
$manifest=Join-Path $root 'chrome-extension\manifest.json'
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
  throw 'Portable extension is missing. Extract the ZIP again.'
}
if ($ValidateOnly) { Write-Host 'PASS portable launcher source and extension'; exit 0 }
if (-not (Test-Path -LiteralPath $idFile -PathType Leaf)) {
  throw 'Not set up yet. Run RUN-SETUP.cmd, load unpacked in Chrome, then enter its extension ID.'
}
$id=(Get-Content -LiteralPath $idFile -Raw).Trim().ToLowerInvariant()
if ($id -cnotmatch '^[a-p]{32}$') { throw 'Saved Chrome extension ID invalid; rerun RUN-SETUP.cmd.' }
$paths=@()
foreach ($folder in @($env:ProgramFiles,[Environment]::GetEnvironmentVariable('ProgramFiles(x86)'),$env:LOCALAPPDATA)) {
  if (-not [string]::IsNullOrWhiteSpace($folder)) {
    $paths+=(Join-Path $folder 'Google\Chrome\Application\chrome.exe')
  }
}
$chrome=$paths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $chrome) {
  $command=Get-Command chrome.exe -ErrorAction SilentlyContinue
  if ($command) { $chrome=$command.Source }
}
if (-not $chrome) { throw 'Google Chrome could not be located.' }
Start-Process -FilePath $chrome -ArgumentList "chrome-extension://$id/home.html"
Write-Host 'Opened TheOrg Supervisor in installed Chrome.'
Write-Host 'If Chrome shows an extension unavailable page, switch to the Chrome profile where you loaded TheOrg.'
