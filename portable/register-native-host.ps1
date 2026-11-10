# Explicit current-user Chrome Native Messaging registration. No admin privileges.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-p]{32}$')][string]$ExtensionId,
  [Parameter(Mandatory=$true)][string]$ExecutablePath
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$exe = [IO.Path]::GetFullPath($ExecutablePath)
if (-not (Test-Path -LiteralPath $exe -PathType Leaf) -or
    [IO.Path]::GetExtension($exe) -ine '.exe') {
  throw 'Native host must point to an existing compiled Windows .exe'
}
$name='com.theorg.bridge'
$dir=Join-Path $env:LOCALAPPDATA 'TheOrg\NativeMessaging'
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$manifestPath=Join-Path $dir "$name.json"
$json=@{
  name=$name
  description='TheOrg portable local agent controller'
  type='stdio'
  path=$exe
  allowed_origins=@("chrome-extension://$ExtensionId/")
} | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText($manifestPath,$json,(New-Object Text.UTF8Encoding($false)))
$registryPath="HKCU:\Software\Google\Chrome\NativeMessagingHosts\$name"
New-Item -Path $registryPath -Force | Out-Null
Set-Item -Path $registryPath -Value $manifestPath
Write-Host "PASS Native Messaging registered for only $ExtensionId"
