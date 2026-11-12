# Source-only verification. No downloads, billing, merges, deployments or source changes.
[CmdletBinding()]
param([switch]$CheckOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ResultDir = Join-Path $Repo 'out\source-verification'
$Checks = @(
  @{Name='Python regression tests'; Program='python'; Args=@('-m','unittest','discover','-s','offline_desktop/tests','-t','offline_desktop','-q')},
  @{Name='Node agent and UI tests'; Program='node'; Args=@('--test','tests/company-agent-directory.test.cjs','tests/provider-capacity.test.cjs','tests/supervisor-starters.test.cjs','tests/ui-contract.test.cjs','tests/company-ui-contract.test.cjs')},
  @{Name='Chrome background syntax'; Program='node'; Args=@('--check','apps/chrome-extension/background.js')},
  @{Name='Provider page syntax'; Program='node'; Args=@('--check','apps/chrome-extension/provider-page-agent.js')},
  @{Name='Provider handoff syntax'; Program='node'; Args=@('--check','apps/chrome-extension/provider-auto-handoff.js')},
  @{Name='Dashboard syntax'; Program='node'; Args=@('--check','offline_desktop/static/app.js')}
)
foreach($program in @('python','node')){
  if(-not (Get-Command $program -ErrorAction SilentlyContinue)){
    throw "Missing ${program}: install on the Windows developer PC; nothing was installed by this script."
  }
}
foreach($check in $Checks){
  foreach($argument in $check.Args){
    if($argument -match '^(tests|apps|offline_desktop)/' -and
      -not (Test-Path -LiteralPath (Join-Path $Repo $argument))){
      throw "Required repository file or directory missing: $argument"
    }
  }
}
if($CheckOnly){ Write-Host 'PASS local source-check preflight; no tests, downloads or external actions.'; return }
$revision = 'unknown'
if(Get-Command git -ErrorAction SilentlyContinue){
  try {
    $candidate = & git -C $Repo rev-parse HEAD 2>$null
    if($LASTEXITCODE -eq 0 -and "$candidate" -match '^[a-fA-F0-9]{40}$'){$revision="$candidate"}
  }catch{}
}
$report = [ordered]@{
  schema='theorg-local-source-check-v1'
  checked_utc=[DateTimeOffset]::UtcNow.ToString('O')
  commit=$revision
  source_only=$true
  windows_executable_verified=$false
  external_ai_provider_verified=$false
  deployment_performed=$false
  passed=$false
  checks=@()
}
$allPassed=$true
Push-Location $Repo
try{
  foreach($check in $Checks){
    $program=[string]$check.Program
    [string[]]$argv=@($check.Args)
    $passed=$false
    Write-Host ("Checking: "+$check.Name)
    try {
      & $program @argv
      $passed=($LASTEXITCODE -eq 0)
    }catch{
      Write-Warning ("Unable to execute: "+$_.Exception.Message)
    }
    $report.checks += [ordered]@{name=[string]$check.Name;passed=$passed}
    if(-not $passed){$allPassed=$false; Write-Warning ("FAILED "+$check.Name)}
  }
}finally{
  Pop-Location
}
$report.passed=$allPassed
New-Item -ItemType Directory -Force -Path $ResultDir | Out-Null
$evidence=Join-Path $ResultDir 'source-results.json'
$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $evidence -Encoding UTF8
Write-Host ("Result: "+$evidence)
if(-not $allPassed){throw 'Local source checks failed; do not merge or release.'}
Write-Host 'PASS source checks only; Windows EXE, model inference and browser E2E remain UNVERIFIED.'
