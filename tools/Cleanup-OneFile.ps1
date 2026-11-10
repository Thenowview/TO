# Remove only registration/shortcut belonging to this installer; preserve all user workspaces.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$InstallRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try {
  $root=[IO.Path]::GetFullPath($InstallRoot)
  $exe=[IO.Path]::GetFullPath((Join-Path $root 'bridge\TheOrg.Bridge.exe'))
  $reg='HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.theorg.bridge'
  $path=Join-Path $env:LOCALAPPDATA 'TheOrg\NativeMessaging\com.theorg.bridge.json'
  if (Test-Path -LiteralPath $reg) {
    $registered=(Get-Item -LiteralPath $reg).GetValue('')
    if ($registered -eq $path -and (Test-Path -LiteralPath $path -PathType Leaf)) {
      $hostData=Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
      if ([IO.Path]::GetFullPath([string]$hostData.path) -ieq $exe) {
        Remove-Item -LiteralPath $reg -Force
        Remove-Item -LiteralPath $path -Force
      }
    }
  }
  $link = Join-Path ([Environment]::GetFolderPath('Desktop')) 'TheOrg - Chrome.lnk'
  if (Test-Path -LiteralPath $link) {
    $shortcut=(New-Object -ComObject WScript.Shell).CreateShortcut($link)
    if ([string]$shortcut.Arguments -like ('*'+(Join-Path $root 'Open-TheOrg.ps1')+'*')) {
      Remove-Item -LiteralPath $link -Force
    }
  }
  Write-Host 'TheOrg registration cleaned; original local workspace preserved.'
} catch {
  [Console]::Error.WriteLine('Cleanup warning: '+$_.Exception.Message)
  exit 1
}
