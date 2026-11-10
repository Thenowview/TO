# TheOrg desktop entry point — a dedicated, isolated Chrome for Testing workspace.
# Chrome for Testing is the original upstream binary; it is NOT renamed or modified.
# Requires the browser to be bundled by the verified Windows CI build.
[CmdletBinding()]
param([switch]$ValidateOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$browser = Join-Path $PSScriptRoot 'browser\chrome.exe'
$extensionFolder = Join-Path $PSScriptRoot 'chrome-extension'
$manifestPath = Join-Path $extensionFolder 'manifest.json'
$bridge = Join-Path $PSScriptRoot 'TheOrg.Bridge.exe'
$register = Join-Path $PSScriptRoot 'install-native-host.ps1'
$profile = Join-Path $env:LOCALAPPDATA 'TheOrg\BrowserProfile'
$preferences = Join-Path $profile 'Default\Preferences'

function Assert-Package {
  foreach ($path in @($browser, $manifestPath, $bridge, $register)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      throw "TheOrg installation incomplete: $path. Reinstall the latest full Windows preview."
    }
  }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.manifest_version -ne 3 -or
      -not (@($manifest.permissions) -contains 'nativeMessaging')) {
    throw 'TheOrg extension package is invalid.'
  }
  Write-Host 'PASS TheOrg browser, extension, native host and registration tool are installed.'
}

function Find-InstalledExtensionId {
  if (-not (Test-Path -LiteralPath $preferences -PathType Leaf)) { return $null }
  $data = Get-Content -LiteralPath $preferences -Raw | ConvertFrom-Json
  if (-not $data.extensions -or -not $data.extensions.settings) { return $null }
  $expectedPath = [IO.Path]::GetFullPath($extensionFolder).TrimEnd('\')
  foreach ($entry in $data.extensions.settings.PSObject.Properties) {
    $candidate = $entry.Value
    if (-not $candidate -or -not $candidate.path -or -not $candidate.manifest) { continue }
    if ($candidate.manifest.name -cne 'TheOrg — Supervisor Workspace') { continue }
    try {
      $foundPath = [IO.Path]::GetFullPath([string]$candidate.path).TrimEnd('\')
    } catch { continue }
    if ($foundPath -ine $expectedPath) { continue }
    if ($entry.Name -cmatch '^[a-p]{32}$') { return $entry.Name }
  }
  return $null
}

try {
  Assert-Package
  if ($ValidateOnly) { return }

  # This is a new, private TheOrg profile, never the user's everyday Chrome profile.
  New-Item -ItemType Directory -Path $profile -Force | Out-Null
  $arguments = @(
    '--user-data-dir="' + $profile + '"'
    '--profile-directory=Default'
    '--no-first-run'
    '--no-default-browser-check'
    '--disable-extensions-except="' + $extensionFolder + '"'
    '--load-extension="' + $extensionFolder + '"'
    '--new-window'
    'about:blank'
  )
  Start-Process -FilePath $browser -ArgumentList $arguments | Out-Null

  # Derive the actual extension ID from the browser's own local installation
  # record, matching BOTH its manifest name and its on-disk path. Never guess IDs.
  $id = $null
  for ($attempt = 0; $attempt -lt 40 -and -not $id; $attempt++) {
    Start-Sleep -Milliseconds 500
    try { $id = Find-InstalledExtensionId } catch { }
  }
  if (-not $id) {
    throw 'TheOrg extension did not register in the dedicated browser. Open its chrome://extensions page and check whether the extension loaded.'
  }

  # Explicitly bind the local Windows host to only this extension identity.
  & $register -ExtensionId $id -ExecutablePath $bridge | Out-Null
  $home = 'chrome-extension://' + $id + '/home.html'
  Start-Process -FilePath $browser -ArgumentList @(
    '--user-data-dir="' + $profile + '"',
    '--profile-directory=Default',
    '--new-window',
    $home
  ) | Out-Null
  Write-Host 'PASS TheOrg Supervisor launched.'
} catch {
  if ($ValidateOnly) { throw }
  $message = 'TheOrg could not start automatically.' + [Environment]::NewLine +
             [Environment]::NewLine + $_.Exception.Message +
             [Environment]::NewLine + [Environment]::NewLine +
             'The browser profile and company data were not deleted.'
  try {
    Add-Type -AssemblyName PresentationFramework
    [void][System.Windows.MessageBox]::Show($message,'TheOrg setup','OK','Error')
  } catch { Write-Error $message }
  exit 1
}
