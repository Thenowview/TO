[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$workspace=Join-Path $env:LOCALAPPDATA 'TheOrg\workspace'
New-Item -ItemType Directory -Path $workspace -Force | Out-Null
Write-Host "TheOrg original local workspace: $workspace"
Start-Process -FilePath 'explorer.exe' -ArgumentList ('"' + $workspace + '"')
