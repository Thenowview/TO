# First-run registration for the existing Google Chrome browser (no bundled browser).
[CmdletBinding()]
param([switch]$ValidateOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bridge = Join-Path $root 'bridge\TheOrg.Bridge.exe'
$extension = Join-Path $root 'chrome-extension'
$manifestPath = Join-Path $extension 'manifest.json'
$register = Join-Path $root 'register-native-host.ps1'
$idPath = Join-Path $root 'ExtensionId.txt'

function Get-InstalledChrome {
  $paths = @()
  foreach ($value in @($env:ProgramFiles, [Environment]::GetEnvironmentVariable('ProgramFiles(x86)'), $env:LOCALAPPDATA)) {
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      $paths += (Join-Path $value 'Google\Chrome\Application\chrome.exe')
    }
  }
  foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path -PathType Leaf) { return $path }
  }
  $command = Get-Command chrome.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  throw 'Google Chrome is not installed or could not be found. Install regular Google Chrome first.'
}

foreach ($required in @($bridge, $manifestPath, $register, (Join-Path $root 'Open-TheOrg.ps1'))) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
    throw "Portable package is incomplete: $required"
  }
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.manifest_version -ne 3 -or -not (@($manifest.permissions) -contains 'nativeMessaging')) {
  throw 'TheOrg extension manifest is invalid or lacks nativeMessaging permission.'
}
if ($ValidateOnly) {
  Write-Host 'PASS portable package layout, manifest and registration script'
  exit 0
}

$chrome = Get-InstalledChrome
Write-Host ''
Write-Host 'TheOrg portable: use your existing Google Chrome.' -ForegroundColor Cyan
Write-Host 'Step 1: In the Chrome window opening now, turn ON Developer mode.'
Write-Host 'Step 2: Click Load unpacked and select this exact folder:'
Write-Host "  $extension" -ForegroundColor Yellow
Write-Host 'Step 3: Copy the 32-character extension ID shown by Chrome.'
Write-Host 'Step 4: Paste that ID in this console; this permits ONLY that local extension to use the bridge.'
Write-Host ''
Start-Process -FilePath $chrome -ArgumentList 'chrome://extensions'
$id = (Read-Host 'Paste the extension ID (a-p letters only)').Trim().ToLowerInvariant()
if ($id -cnotmatch '^[a-p]{32}$') {
  throw 'Invalid extension ID. No native messaging registration was changed.'
}
Write-Host 'Checking the compiled local controller...'
& $bridge --self-test
if ($LASTEXITCODE -ne 0) { throw 'Local bridge self-tests failed; registration cancelled.' }
& $register -ExtensionId $id -ExecutablePath $bridge
[IO.File]::WriteAllText($idPath, "$id" + [Environment]::NewLine, [Text.Encoding]::ASCII)

$desktop = [Environment]::GetFolderPath('Desktop')
$linkFile = Join-Path $desktop 'TheOrg - Chrome.lnk'
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($linkFile)
$link.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$link.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $root 'Open-TheOrg.ps1') + '"'
$link.WorkingDirectory = $root
$link.IconLocation = "$chrome,0"
$link.Description = 'Open the TheOrg Supervisor in your existing Google Chrome profile'
$link.Save()

New-Item -ItemType Directory -Path (Join-Path $root 'Local-Files') -Force | Out-Null
Write-Host ''
Write-Host 'PASS TheOrg native host registered and desktop shortcut created.' -ForegroundColor Green
Write-Host "Shortcut: $linkFile"
Write-Host 'Keep this extracted folder in place; moving it breaks the native host path.'
Write-Host 'Opening TheOrg Supervisor...'
& (Join-Path $root 'Open-TheOrg.ps1')
