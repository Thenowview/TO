[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$regKey = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.theorg.bridge'
if (Test-Path -LiteralPath $regKey) {
  Remove-Item -LiteralPath $regKey -Force
  Write-Host 'TheOrg Chrome native messaging registration removed.'
} else {
  Write-Host 'TheOrg native messaging registration was not present.'
}
Write-Host 'TheOrg local company files and account settings were NOT deleted.'
