[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$paths = @()
foreach ($folder in @($env:ProgramFiles,[Environment]::GetEnvironmentVariable('ProgramFiles(x86)'),$env:LOCALAPPDATA)) {
  if (-not [string]::IsNullOrWhiteSpace($folder)) {
    $paths += (Join-Path $folder 'Google\Chrome\Application\chrome.exe')
  }
}
$chrome = $paths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $chrome) {
  $app = Get-Command chrome.exe -ErrorAction SilentlyContinue
  if ($app) { $chrome = $app.Source }
}
$guide = Join-Path $root 'START-HERE.html'
if (Test-Path -LiteralPath $guide -PathType Leaf) { Start-Process -FilePath $guide }
if (-not $chrome) {
  Write-Warning 'Existing Google Chrome not found. Install Chrome or use the installed browser once available.'
  exit 0
}
Start-Process -FilePath $chrome -ArgumentList 'chrome://extensions'
Start-Process -FilePath 'explorer.exe' -ArgumentList ('"' + (Join-Path $root 'chrome-extension') + '"')
Write-Host 'Choose Load unpacked and select the chrome-extension folder displayed by Windows Explorer.'
