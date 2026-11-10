# TheOrg Developer Preview — interactive extension connection.
# Run this after loading the unpacked Chrome extension from the installed folder.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$extensionFolder = Join-Path $PSScriptRoot 'chrome-extension'
$exe = Join-Path $PSScriptRoot 'TheOrg.Bridge.exe'
if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) {
  throw 'Local Windows controller was not found'
}
Write-Host ''
Write-Host 'TheOrg Chrome connection — developer preview'
Write-Host '1. In Chrome Stable, open chrome://extensions'
Write-Host '2. Enable Developer mode'
Write-Host "3. Load unpacked: $extensionFolder"
Write-Host '4. Copy the 32-character extension ID displayed by Chrome'
Write-Host ''
$id = (Read-Host 'Paste the TheOrg extension ID').Trim()
if ($id -notmatch '^[a-p]{32}$') {
  throw 'Invalid Chrome extension ID. No registration was changed.'
}
& (Join-Path $PSScriptRoot 'install-native-host.ps1') -ExtensionId $id -ExecutablePath $exe
Write-Host ''
Write-Host 'Chrome Native Messaging registration prepared.'
Write-Host 'Open the TheOrg extension and choose Check connection.'
Write-Host 'This preview is unsigned. It does not automate external AI chats.'
