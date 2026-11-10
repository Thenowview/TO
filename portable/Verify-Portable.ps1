# Read-only SHA-256 verification for the unpacked portable package.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$manifest=Join-Path $root 'PACKAGE-SHA256.txt'
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
  throw 'PACKAGE-SHA256.txt is missing. Extract the official CI ZIP again.'
}
$lines=@(Get-Content -LiteralPath $manifest)
if ($lines.Count -lt 10) { throw 'Portable package checksum manifest is incomplete.' }
$count=0
foreach ($line in $lines) {
  if ($line -notmatch '^([A-Fa-f0-9]{64})  (.+)$') {
    throw "Unexpected checksum manifest entry: $line"
  }
  $expected=$Matches[1].ToLowerInvariant()
  $relative=$Matches[2]
  if ($relative -match '(^|[\\/])\.\.([\\/]|$)' -or [IO.Path]::IsPathRooted($relative)) {
    throw 'Unsafe relative path in checksum manifest.'
  }
  $file=Join-Path $root $relative
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw "Missing packaged file: $relative"
  }
  $actual=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw "SHA256 mismatch for $relative" }
  $count++
}
Write-Host "PASS portable TheOrg SHA256 verification: $count packaged files." -ForegroundColor Green
Write-Host 'Integrity does not establish independent malware or security certification.'
