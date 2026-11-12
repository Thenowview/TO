# TheOrg — Windows release builder: one clickable application folder.
# BUILD host: Windows x64, Python 3.12 + PyInstaller, Node, .NET 8 SDK.
# TARGET host: no Python/.NET SDK required. Optional Chrome and model included by request.
[CmdletBinding()]
param(
  [string]$ChromeArchive = '',
  [string]$ChromeSha256 = '',
  [string]$OpenCodeArchive = '',
  [string]$OpenCodeSha256 = '',
  [string]$ModelArchive = '',
  [switch]$ConfirmModelRights,
  [string]$PrebuiltEngineExe = '',
  [string]$OutputDirectory = '',
  [switch]$SkipTests
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if($env:OS -ne 'Windows_NT' -or -not [Environment]::Is64BitOperatingSystem){
  throw 'Build on 64-bit Windows; this script does not pretend to cross-compile'
}
$Repo = Split-Path -Parent $PSScriptRoot
$Output = if($OutputDirectory){[IO.Path]::GetFullPath($OutputDirectory)}else{Join-Path $Repo 'out\full-oneapp'}
$Stage = Join-Path $Output 'TheOrg'
function AssertFile([string]$p){
  if(-not (Test-Path -LiteralPath $p -PathType Leaf)){throw "Required file missing: $p"}
}
function Hash([string]$p){return (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
function CheckExit([string]$what){if($LASTEXITCODE -ne 0){throw "$what failed ($LASTEXITCODE)"}}
New-Item -ItemType Directory -Force -Path $Output | Out-Null
if(Test-Path -LiteralPath $Stage){Remove-Item -LiteralPath $Stage -Force -Recurse}
New-Item -ItemType Directory -Force -Path $Stage | Out-Null

if(-not $SkipTests){
  node --test (Join-Path $Repo 'tests\company-agent-directory.test.cjs') (Join-Path $Repo 'tests\provider-capacity.test.cjs')
  CheckExit 'Company-agent and four-agent tests'
  Push-Location (Join-Path $Repo 'offline_desktop')
  try{python -m unittest discover -s tests -q;CheckExit 'Local AI engine tests'}
  finally{Pop-Location}
}
$Exe=Join-Path $Stage 'TheOrg.exe'
if($PrebuiltEngineExe){
  AssertFile $PrebuiltEngineExe
  Copy-Item -LiteralPath $PrebuiltEngineExe -Destination $Exe
}else{
  Push-Location (Join-Path $Repo 'offline_desktop')
  try{& .\Build-TheOrg-Portable-Windows.ps1 -SkipTests;AssertFile (Join-Path $Repo 'offline_desktop\dist\TheOrg.exe')}
  finally{Pop-Location}
  Copy-Item -LiteralPath (Join-Path $Repo 'offline_desktop\dist\TheOrg.exe') -Destination $Exe
}
# Engine self-test creates SQLite and an access token. Isolate and remove those
# artifacts OUTSIDE the package; never ship a build-machine token/database.
$SmokeRoot=Join-Path $Output '.engine-selftest'
if(Test-Path -LiteralPath $SmokeRoot){Remove-Item -LiteralPath $SmokeRoot -Recurse -Force}
$envNames=@('THEORG_DATA_DIR','THEORG_WORKSPACE','THEORG_MODELS','THEORG_SKIP_SHORTCUT')
$oldEnvironment=@{}
foreach($name in $envNames){$oldEnvironment[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
try {
  [Environment]::SetEnvironmentVariable('THEORG_DATA_DIR',(Join-Path $SmokeRoot 'data'),'Process')
  [Environment]::SetEnvironmentVariable('THEORG_WORKSPACE',(Join-Path $SmokeRoot 'workspace'),'Process')
  [Environment]::SetEnvironmentVariable('THEORG_MODELS',(Join-Path $SmokeRoot 'models'),'Process')
  [Environment]::SetEnvironmentVariable('THEORG_SKIP_SHORTCUT','1','Process')
  $engineTest = Start-Process -FilePath $Exe -ArgumentList '--self-test' -WindowStyle Hidden -Wait -PassThru
  if($engineTest.ExitCode -ne 0){throw ('Real packaged engine self-test failed: '+$engineTest.ExitCode)}
} finally {
  foreach($name in $envNames){[Environment]::SetEnvironmentVariable($name,$oldEnvironment[$name],'Process')}
  if(Test-Path -LiteralPath $SmokeRoot){Remove-Item -LiteralPath $SmokeRoot -Recurse -Force}
}


$BridgeOut=Join-Path $Output '.bridge-publish'
if(Test-Path $BridgeOut){Remove-Item $BridgeOut -Recurse -Force}
dotnet publish (Join-Path $Repo 'engine\bridge\TheOrg.Bridge.csproj') -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:PublishTrimmed=false -o $BridgeOut
CheckExit 'Native Messaging bridge compilation'
$Bridge=Join-Path $Stage 'TheOrg.Bridge.exe'
Copy-Item -LiteralPath (Join-Path $BridgeOut 'TheOrg.Bridge.exe') -Destination $Bridge
& $Bridge --self-test;CheckExit 'Compiled Native Messaging bridge self-test'

$Extension=Join-Path $Stage 'chrome-extension'
node (Join-Path $Repo 'tools\prepare-onefile-extension.cjs') (Join-Path $Repo 'apps\chrome-extension') $Extension (Join-Path $Repo 'tools\onefile-extension-public-key.txt') (Join-Path $Repo 'tools\onefile-extension-id.txt')
CheckExit 'Chrome extension fixed-ID build'
Copy-Item -LiteralPath (Join-Path $Repo 'tools\install-native-host.ps1') -Destination (Join-Path $Stage 'install-native-host.ps1')
Copy-Item -LiteralPath (Join-Path $Repo 'tools\Start-TheOrg-Full.ps1') -Destination (Join-Path $Stage 'Start-TheOrg-Full.ps1')
@(
  '@echo off',
  'cd /d "%~dp0"',
  'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-TheOrg-Full.ps1"',
  'if errorlevel 1 pause'
) | Set-Content -LiteralPath (Join-Path $Stage 'START THEORG.cmd') -Encoding ascii
$Icon=Join-Path $Repo 'offline_desktop\static\TheOrg.ico'
if(Test-Path $Icon){Copy-Item -LiteralPath $Icon -Destination (Join-Path $Stage 'TheOrg.ico')}

$BundledBrowser=$false
if($ChromeArchive){
  AssertFile $ChromeArchive
  if($ChromeArchive -notlike '*.zip' -or $ChromeSha256 -notmatch '^[0-9a-fA-F]{64}$' -or
      (Hash $ChromeArchive) -ne $ChromeSha256.ToLowerInvariant()){
    throw 'Chrome archive must have a matching externally verified 64-char SHA-256'
  }
  $BrowserExtract=Join-Path $Output '.browser-extracted'
  if(Test-Path $BrowserExtract){Remove-Item $BrowserExtract -Force -Recurse}
  Expand-Archive -LiteralPath $ChromeArchive -DestinationPath $BrowserExtract -Force
  $Matches=@(Get-ChildItem -LiteralPath $BrowserExtract -Recurse -Filter chrome.exe -File)
  if($Matches.Count -ne 1){throw 'Chrome archive must contain exactly one chrome.exe'}
  Copy-Item -LiteralPath $Matches[0].DirectoryName -Destination (Join-Path $Stage 'browser') -Recurse
  AssertFile (Join-Path $Stage 'browser\chrome.exe')
  $BundledBrowser=$true
}
$BundledOpenCode=$false
$BundledOpenCodeVersion=''
if($OpenCodeArchive){
  AssertFile $OpenCodeArchive
  if($OpenCodeArchive -notlike '*.zip' -or $OpenCodeSha256 -notmatch '^[0-9a-fA-F]{64}$' -or
      (Hash $OpenCodeArchive) -ne $OpenCodeSha256.ToLowerInvariant()){
    throw 'OpenCode archive requires an independently verified SHA-256 and ZIP format.'
  }
  $CliExtract=Join-Path $Output '.opencode-extracted'
  if(Test-Path $CliExtract){Remove-Item -LiteralPath $CliExtract -Recurse -Force}
  Expand-Archive -LiteralPath $OpenCodeArchive -DestinationPath $CliExtract -Force
  $ExeMatches=@(Get-ChildItem -LiteralPath $CliExtract -Recurse -File | Where-Object {
    $_.Name -in @('opencode2.exe','opencode.exe')
  })
  if($ExeMatches.Count -ne 1){throw 'OpenCode CLI ZIP must contain exactly one OpenCode V2 executable'}
  $BundledOpenCodeVersion=((& $ExeMatches[0].FullName --version) | Out-String).Trim()
  CheckExit 'Bundled OpenCode CLI version preflight'
  if($BundledOpenCodeVersion -notmatch '(?<![0-9.])v?2\.[0-9]+\.[0-9]+'){
    throw 'TheOrg requires a verified OpenCode V2 CLI with ordered permissions'
  }
  Copy-Item -LiteralPath $ExeMatches[0].DirectoryName -Destination (Join-Path $Stage 'opencode') -Recurse
  AssertFile (Join-Path (Join-Path $Stage 'opencode') $ExeMatches[0].Name)
  $OpenCodeLicense=Join-Path $Repo 'third_party\opencode\LICENSE'
  AssertFile $OpenCodeLicense
  Copy-Item -LiteralPath $OpenCodeLicense -Destination (Join-Path $Stage 'opencode\LICENSE')
  $BundledOpenCode=$true
}
$BundledModel=$false
if($ModelArchive){
  if(-not $ConfirmModelRights){throw 'Model redistribution/use rights need explicit confirmation'}
  AssertFile $ModelArchive
  if($ModelArchive -notlike '*.zip'){throw 'Provide a GGUF model archive ZIP'}
  $ModelFolder=Join-Path $Stage 'model'
  New-Item -ItemType Directory -Path $ModelFolder | Out-Null
  Copy-Item -LiteralPath $ModelArchive -Destination (Join-Path $ModelFolder 'MODEL.zip')
  $BundledModel=$true
}
$Help=@'
THEORG — FULL ONEAPP WINDOWS DEVELOPMENT CANDIDATE
Double-click START THEORG.cmd to open the AI engine and Chrome Supervisor.
OpenCode CLI is optional: to use company coding agents, install OpenCode
separately or build with an independently verified OpenCode Windows CLI ZIP.
Bundled OpenCode still needs explicitly selected model and provider access.
No Python or .NET SDK installation is needed on the target Windows machine.
A supplied MODEL.zip is NOT activated without explicit import via the Models UI.
The official/compatible GGUF model must be license-checked and real inference tested.
No production deployment or unapproved account changes.
This is not a signed Windows release until full QA is completed.
'@
[IO.File]::WriteAllText((Join-Path $Stage 'README-FIRST.txt'),$Help)
# A distributed package must not contain build-machine secrets or state.
$unexpected=@(Get-ChildItem -LiteralPath $Stage -Recurse -File | Where-Object {
  $_.Name -in @('access-token.txt','theorg.sqlite3') -or
  $_.FullName -match '[\\/]\.theorg[\\/]'
})
if($unexpected.Count -gt 0){throw 'Build generated private runtime state in release payload; refusing to package'}
$Receipt=@{
  schema='theorg-self-contained-windows-v1'
  executable='TheOrg.exe'
  engine_exe_sha256=(Hash $Exe)
  bridge_exe_sha256=(Hash $Bridge)
  python_embedded_in_engine=$true
  bridge_self_contained=$true
  bundled_browser=$BundledBrowser
  bundled_opencode_cli=$BundledOpenCode
  bundled_opencode_cli_version=$BundledOpenCodeVersion
  bundled_model_archive=$BundledModel
  four_agent_source_tests=(!$SkipTests)
  real_model_inference_tested=$false
  live_chatgpt_claude_tested=$false
  windows_clean_install_tested=$false
  created_utc=[DateTimeOffset]::UtcNow.ToString('O')
}
$Receipt|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $Stage 'BUILD-RECEIPT.json')
$Hashes=Get-ChildItem -LiteralPath $Stage -Recurse -File | Where-Object Name -ne 'SHA256SUMS.txt' |
  Sort-Object FullName | ForEach-Object { (Hash $_.FullName)+'  '+$_.FullName.Substring($Stage.Length+1).Replace('\','/') }
$Hashes|Set-Content -LiteralPath (Join-Path $Stage 'SHA256SUMS.txt') -Encoding ascii
Write-Host "TheOrg standalone candidate prepared at $Stage"
Write-Host 'Not yet independently production certified.'
