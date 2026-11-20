# Validate installed TheOrg Native Messaging registration using a synthetic
# Chrome extension identity. No browser account or production data is used.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$InstallRoot
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$extensionId = 'abcdefghijklmnopabcdefghijklmnop'
$install = [IO.Path]::GetFullPath($InstallRoot)
$exe = Join-Path $install 'TheOrg.Bridge.exe'
$register = Join-Path $install 'install-native-host.ps1'
$unregister = Join-Path $install 'uninstall-native-host.ps1'
$registryKey = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.theorg.bridge'
$manifestPath = Join-Path $env:LOCALAPPDATA 'TheOrg\NativeMessaging\com.theorg.bridge.json'
if (!(Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'Installed host executable missing' }
if (!(Test-Path -LiteralPath $register -PathType Leaf)) { throw 'Installed registration script missing' }
if (!(Test-Path -LiteralPath $unregister -PathType Leaf)) { throw 'Installed unregister script missing' }
if (Test-Path -LiteralPath $registryKey) { throw 'Native host unexpectedly registered before explicit user setup' }
try {
  & $register -ExtensionId $extensionId -ExecutablePath $exe
  if (!(Test-Path -LiteralPath $registryKey)) { throw 'Native host registry key not created' }
  $registeredPath = (Get-Item -LiteralPath $registryKey).GetValue('')
  if ($registeredPath -ne $manifestPath) { throw 'Registry manifest path incorrect' }
  if (!(Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'Native host manifest missing' }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.name -ne 'com.theorg.bridge') { throw 'Native host name incorrect' }
  if ($manifest.type -ne 'stdio') { throw 'Native host type incorrect' }
  if ([IO.Path]::GetFullPath($manifest.path) -ne $exe) { throw 'Manifest executable path incorrect' }
  if (@($manifest.allowed_origins).Count -ne 1 -or
      $manifest.allowed_origins[0] -cne "chrome-extension://$extensionId/") {
    throw 'Native host allowed origins must match only the authorized extension'
  }
  Write-Host 'PASS: explicit registration, registry, manifest, executable, and one authorized Chrome origin'
  # Uninstalling a different copy must preserve the active native-host binding.
  $before = Get-Content -LiteralPath $manifestPath -Raw
  & $unregister -ExecutablePath (Join-Path $install 'different-install\TheOrg.Bridge.exe')
  if (!(Test-Path -LiteralPath $registryKey)) { throw 'Foreign uninstall removed the active native host' }
  if ((Get-Item -LiteralPath $registryKey).GetValue('') -cne $registeredPath -or
      (Get-Content -LiteralPath $manifestPath -Raw) -cne $before) {
    throw 'Foreign uninstall changed the registered manifest'
  }
  & $unregister -ExecutablePath $exe
  if (Test-Path -LiteralPath $registryKey) { throw 'Owned native host registration was not removed' }
  Write-Host 'PASS: foreign executable retained; matching executable explicitly unregistered'
} finally {
  # Test cleanup only: the full installer uninstall is tested separately.
  if (Test-Path -LiteralPath $registryKey) { Remove-Item -LiteralPath $registryKey -Force }
  if (Test-Path -LiteralPath $manifestPath) { Remove-Item -LiteralPath $manifestPath -Force }
}

