# Register the user-scoped Chromium Native Messaging host for TheOrg.
# Only a 32-character Chromium extension ID may invoke the host.
# This script does not create a Chrome extension or install arbitrary browser profiles.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[a-p]{32}$')]
  [string]$ExtensionId,
  [Parameter(Mandatory=$true)]
  [string]$ExecutablePath
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$hostName = 'com.theorg.bridge'
$exe = [IO.Path]::GetFullPath($ExecutablePath)
if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) {
  throw "Windows bridge executable not found: $exe"
}
if ([IO.Path]::GetExtension($exe) -ine '.exe') {
  throw 'Native host must be a compiled Windows .exe file'
}

$manifestDir = Join-Path $env:LOCALAPPDATA 'TheOrg\NativeMessaging'
New-Item -ItemType Directory -Force -Path $manifestDir | Out-Null
$manifestPath = Join-Path $manifestDir "$hostName.json"
$manifest = @{
  name = $hostName
  description = 'TheOrg local Windows supervisor bridge'
  path = $exe
  type = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
}
$json = ConvertTo-Json -InputObject $manifest -Depth 4
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($manifestPath, $json, $utf8)

$regKey = "HKCU:\Software\Chromium\NativeMessagingHosts\$hostName"
New-Item -Force -Path $regKey | Out-Null
Set-Item -Path $regKey -Value $manifestPath
Write-Host "TheOrg native host registered for extension ID $ExtensionId"
Write-Host "Host manifest: $manifestPath"
Write-Host 'Close and reopen the extension page to reconnect.'
