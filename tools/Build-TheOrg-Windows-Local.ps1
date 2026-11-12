# TheOrg full Windows build — local fallback when GitHub-hosted Actions cannot start.
# Run from a trusted clone of the review-only branch on Windows 10/11 x64.
# This script never merges branches, deploys anything or installs dependencies silently.
[CmdletBinding()]
param(
  [string]$ChromeArchive = '',
  [string]$ChromeSha256 = '',
  [string]$OpenCodeArchive = '',
  [string]$OpenCodeSha256 = '',
  [string]$ModelArchive = '',
  [switch]$ConfirmModelRights,
  [switch]$CheckOnly,
  [switch]$SkipSourceTests
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Repo = Split-Path -Parent $PSScriptRoot
$Output = Join-Path $Repo 'out\full-oneapp'
$Stage = Join-Path $Output 'TheOrg'
$Log = Join-Path $Repo 'out\full-oneapp-local-build.log'
function CheckTool([string]$name, [string]$help) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "$name is missing. $help" }
  return $cmd
}
function FailIfExit([string]$step) {
  if ($LASTEXITCODE -ne 0) { throw "$step failed with exit code $LASTEXITCODE" }
}
function AssertFile([string]$file) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required file missing: $file" }
}
function VerifyStagedPayload {
  AssertFile (Join-Path $Stage 'TheOrg.exe')
  AssertFile (Join-Path $Stage 'TheOrg.Bridge.exe')
  AssertFile (Join-Path $Stage 'Start-TheOrg-Full.ps1')
  AssertFile (Join-Path $Stage 'chrome-extension\manifest.json')
  AssertFile (Join-Path $Stage 'BUILD-RECEIPT.json')
  AssertFile (Join-Path $Stage 'SHA256SUMS.txt')
  & (Join-Path $Stage 'Start-TheOrg-Full.ps1') -CheckOnly
  FailIfExit 'Portable payload integrity check'
  # Never create an access token or SQLite database in the candidate folder.
  $testRoot=Join-Path $Output '.local-verify'
  $names=@('THEORG_DATA_DIR','THEORG_WORKSPACE','THEORG_MODELS','THEORG_SKIP_SHORTCUT')
  $saved=@{}
  foreach($name in $names){$saved[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
  try {
    [Environment]::SetEnvironmentVariable('THEORG_DATA_DIR',(Join-Path $testRoot 'data'),'Process')
    [Environment]::SetEnvironmentVariable('THEORG_WORKSPACE',(Join-Path $testRoot 'workspace'),'Process')
    [Environment]::SetEnvironmentVariable('THEORG_MODELS',(Join-Path $testRoot 'models'),'Process')
    [Environment]::SetEnvironmentVariable('THEORG_SKIP_SHORTCUT','1','Process')
    & (Join-Path $Stage 'TheOrg.exe') --self-test
    FailIfExit 'TheOrg executable self-test'
  } finally {
    foreach($name in $names){[Environment]::SetEnvironmentVariable($name,$saved[$name],'Process')}
    if(Test-Path -LiteralPath $testRoot){Remove-Item -LiteralPath $testRoot -Recurse -Force}
  }
  & (Join-Path $Stage 'TheOrg.Bridge.exe') --self-test
  FailIfExit 'Windows Native Messaging bridge self-test'
  if(Test-Path -LiteralPath (Join-Path $Stage '.theorg')){throw 'Private engine data found inside distributable folder'}
}
if ($env:OS -ne 'Windows_NT' -or -not [Environment]::Is64BitOperatingSystem) {
  throw 'This builder must run on Windows x64. It cannot compile a Windows executable on Linux or macOS.'
}
if ($ChromeArchive -and ($ChromeSha256 -notmatch '^[0-9A-Fa-f]{64}$')) {
  throw 'Supply -ChromeSha256 obtained from a separately verified Chrome archive before bundling it.'
}
if ($OpenCodeArchive -and ($OpenCodeSha256 -notmatch '^[0-9A-Fa-f]{64}$')) {
  throw 'Supply -OpenCodeSha256 from a separately verified OpenCode CLI ZIP before bundling it.'
}
if ($ModelArchive -and -not $ConfirmModelRights) {
  throw 'Confirm model license and redistribution rights explicitly with -ConfirmModelRights.'
}
if ($ModelArchive -and -not (Test-Path -LiteralPath $ModelArchive -PathType Leaf)) {
  throw 'The GGUF model archive is missing. Keep this argument empty for the first smoke test.'
}
if ($CheckOnly) {
  VerifyStagedPayload
  Write-Host "PASS local OneApp payload in $Stage"
  return
}
if ($SkipSourceTests) {
  Write-Warning 'Source tests skipped: any resulting archive MUST NOT be labeled release-verified.'
}
# Python embeddable distribution is a TARGET runtime, not a working PyInstaller build Python.
CheckTool 'python' 'Install Python 3.12 x64 (full installer with pip), then reopen PowerShell.' | Out-Null
$ver = (& python -c "import platform,sys; print('%s|%s|%s'%(*sys.version_info[:2],platform.architecture()[0]))")
FailIfExit 'Python version query'
if ($ver -notmatch '^(3)\|(1[2-9]|[2-9][0-9])\|64bit$') {
  throw "Expected Python 3.12+ x64 with pip; found '$ver'. The portable embeddable ZIP alone cannot build PyInstaller."
}
& python -m pip --version | Out-Null
FailIfExit 'Python pip check'
CheckTool 'node' 'Install Node.js 22 LTS on the BUILD computer.' | Out-Null
& node --version
FailIfExit 'Node version'
CheckTool 'dotnet' 'Install the .NET 8 SDK on the BUILD computer (not on customer PCs).' | Out-Null
$sdk = @(& dotnet --list-sdks)
FailIfExit '.NET SDK inventory'
if (-not @($sdk | Where-Object { $_ -match '^8\.' }).Count) {
  throw 'The .NET 8 SDK is missing. A .NET runtime alone cannot compile the Windows bridge.'
}
AssertFile (Join-Path $Repo 'tools\Build-TheOrg-Full-OneApp.ps1')
AssertFile (Join-Path $Repo 'offline_desktop\Build-TheOrg-Portable-Windows.ps1')
New-Item -ItemType Directory -Path (Join-Path $Repo 'out') -Force | Out-Null
$transcript = $false
try {
  Start-Transcript -LiteralPath $Log -Force | Out-Null
  $transcript = $true
  Write-Host "Building TheOrg from local repository: $Repo"
  Write-Host 'This build may fetch pinned llama.cpp, MinGit and PyInstaller on the BUILD machine.'
  $args = @{
    ChromeArchive = $ChromeArchive
    ChromeSha256 = $ChromeSha256
    OpenCodeArchive = $OpenCodeArchive
    OpenCodeSha256 = $OpenCodeSha256
    ModelArchive = $ModelArchive
    ConfirmModelRights = [bool]$ConfirmModelRights
    OutputDirectory = $Output
    SkipTests = [bool]$SkipSourceTests
  }
  & (Join-Path $Repo 'tools\Build-TheOrg-Full-OneApp.ps1') @args
  FailIfExit 'Full OneApp compilation'
  VerifyStagedPayload
  # Compress-Archive does not support an individual file greater than 2 GiB.
  # Keep a large rights-cleared model next to the candidate for the local test.
  $oversize = @(Get-ChildItem -LiteralPath $Stage -Recurse -File |
    Where-Object { $_.Length -ge 2000000000 })
  if ($oversize.Count -gt 0) {
    Write-Warning 'The staging folder contains a file >=2 GB. The Windows folder is ready for testing; no ZIP was created.'
    Write-Host "Launch: $Stage\START THEORG.cmd"
  } else {
    $archive = Join-Path $Output 'TheOrg-Full-OneApp-Windows-UNSIGNED.zip'
    if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
    Compress-Archive -LiteralPath $Stage -DestinationPath $archive -CompressionLevel Optimal
    AssertFile $archive
    $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $([IO.Path]::GetFileName($archive))" | Set-Content -LiteralPath (Join-Path $Output 'SHA256SUMS.txt') -Encoding ascii
    Write-Host "CANDIDATE ZIP: $archive"
    Write-Host "ZIP SHA-256: $hash"
  }
  Write-Warning 'Source tests and executable self-tests do not prove live browser automation or a clean-device installation.'
  Write-Host 'No GitHub merge, production deployment, account change, or model inference was performed.'
} catch {
  Write-Error ('TheOrg local build failed: ' + $_.Exception.Message)
  throw
} finally {
  if ($transcript) { Stop-Transcript | Out-Null }
  Write-Host "Build transcript: $Log"
}
