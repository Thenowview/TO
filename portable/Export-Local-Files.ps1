# Copy generated local agent outputs into the portable folder.
# Never alters or deletes originals. Does not copy potentially live SQLite databases.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$workspace=Join-Path $env:LOCALAPPDATA 'TheOrg\workspace'
$export=Join-Path $root 'Local-Files'
New-Item -ItemType Directory -Path $export -Force | Out-Null
if (-not (Test-Path -LiteralPath $workspace -PathType Container)) {
  Write-Host 'No local workspace exists yet. Run an approved synthetic task in TheOrg first.'
  exit 0
}
$count=0
$files=@(Get-ChildItem -LiteralPath $workspace -File -Recurse -ErrorAction Stop |
  Where-Object { $_.FullName -match '[\\/]+agent_outputs[\\/]+' })
foreach ($file in $files) {
  $relative=$file.FullName.Substring($workspace.Length).TrimStart([char[]]@('\','/'))
  $target=Join-Path $export $relative
  $targetDir=Split-Path -Parent $target
  New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $target -Force
  $count++
}
Write-Host "Copied $count generated files into: $export"
Write-Host 'Original files remain in the TheOrg workspace. This is not a full database backup.'
Start-Process -FilePath 'explorer.exe' -ArgumentList ('"' + $export + '"')
