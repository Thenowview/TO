# Read-only TheOrg developer-preview verifier.
# Validates declared SHA256 hashes and optionally inspects installed bridge and
# user-scoped Chrome Native Messaging registration. No install or write actions.
[CmdletBinding()]
param(
  [string]$PackageDirectory = $PSScriptRoot,
  [switch]$CheckInstalled,
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = [IO.Path]::GetFullPath($PackageDirectory)
$manifest = Join-Path $root 'SHA256SUMS.txt'
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
  throw "Missing SHA256SUMS.txt in $root. Use the unmodified CI artifact ZIP."
}
$lines = @(Get-Content -LiteralPath $manifest)
$expectedFiles = @(
  'TheOrg-DevPreview-Windows-x64-unsigned.exe',
  'START_HERE.md',
  'VERIFY.ps1',
  'BROWSER_SOURCE.txt'
)
foreach ($file in $expectedFiles) {
  $matchesFound = @($lines | Where-Object { $_ -match ('^[a-fA-F0-9]{64}  ' + [regex]::Escape($file) + '$') })
  if ($matchesFound.Count -ne 1) { throw "Missing or ambiguous SHA256 entry for $file" }
  $filePath = Join-Path $root $file
  if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
    throw "Missing package file: $file"
  }
  $expectedHash = $matchesFound[0].Substring(0,64).ToLowerInvariant()
  $actualHash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $expectedHash) { throw "SHA256 mismatch for $file" }
  Write-Host "PASS SHA256 $file"
}
$commitLines = @($lines | Where-Object { $_ -match '^Source commit: [a-fA-F0-9]{40}$' })
if ($commitLines.Count -ne 1) { throw 'Missing or ambiguous source commit provenance' }
Write-Host $commitLines[0]
Write-Host 'The build is unsigned. These hashes establish package consistency, not third-party security certification.'

if ($CheckInstalled) {
  if ([string]::IsNullOrWhiteSpace($ExtensionId)) {
    throw '-CheckInstalled also requires your actual 32-letter -ExtensionId from chrome://extensions'
  }
  $installRoot = Join-Path $env:LOCALAPPDATA 'Programs\TheOrg'
  $exe = Join-Path $installRoot 'TheOrg.Bridge.exe'
  $extensionManifest = Join-Path $installRoot 'chrome-extension\manifest.json'
  $browser = Join-Path $installRoot 'browser\chrome.exe'
  $launcher = Join-Path $installRoot 'TheOrg-Start.ps1'
  if (-not (Test-Path -LiteralPath $browser -PathType Leaf) -or
      -not (Test-Path -LiteralPath $launcher -PathType Leaf)) { throw 'Dedicated TheOrg browser or launcher not installed' }
  $hostManifest = Join-Path $env:LOCALAPPDATA 'TheOrg\NativeMessaging\com.theorg.bridge.json'
  $key = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.theorg.bridge'
  if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'Installed Windows bridge binary not found' }
  if (-not (Test-Path -LiteralPath $extensionManifest -PathType Leaf)) { throw 'Installed Chrome extension manifest not found' }
  $extension = Get-Content -LiteralPath $extensionManifest -Raw | ConvertFrom-Json
  if ($extension.manifest_version -ne 3 -or
      -not (@($extension.permissions) -contains 'nativeMessaging')) {
    throw 'Installed extension does not declare expected Chrome nativeMessaging permission'
  }
  if (-not (Test-Path -LiteralPath $key)) { throw 'Native host registry key not found' }
  if (-not (Test-Path -LiteralPath $hostManifest -PathType Leaf)) { throw 'Native host JSON manifest not found' }
  $registered = (Get-Item -LiteralPath $key).GetValue('')
  if ($registered -ne $hostManifest) { throw 'Native host registry path does not match the expected manifest' }
  $hostData = Get-Content -LiteralPath $hostManifest -Raw | ConvertFrom-Json
  if ($hostData.name -ne 'com.theorg.bridge' -or $hostData.type -ne 'stdio') {
    throw 'Incorrect Native Messaging host name or framing'
  }
  if ([IO.Path]::GetFullPath($hostData.path) -ne [IO.Path]::GetFullPath($exe)) {
    throw 'Native Messaging host points to a different executable'
  }
  $expectedOrigin = "chrome-extension://$ExtensionId/"
  if (@($hostData.allowed_origins).Count -ne 1 -or
      $hostData.allowed_origins[0] -cne $expectedOrigin) {
    throw 'Chrome extension origin is not the single expected ID'
  }
  Write-Host 'PASS installed bridge, MV3 extension, registry, native host manifest and Chrome origin'
  Write-Host 'Next: open Chrome and click TheOrg > Check connection (not tested by this script).'
}
Write-Host 'PASS TheOrg preview package verification'
