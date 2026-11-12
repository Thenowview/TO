# Start an already-installed official GitHub Actions runner for TheOrg.
# This does not create registration tokens, download binaries, change budgets or configure secrets.
[CmdletBinding()]
param(
  [string]$RunnerDirectory = 'C:\actions-runner',
  [switch]$ConfirmStart
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if(-not $ConfirmStart){
  throw 'Explicit -ConfirmStart required: this enables GitHub jobs to execute on your Windows PC. Review the trusted branch and isolate the machine first.'
}
$preflight=Join-Path $PSScriptRoot 'Test-TheOrg-Runner-Preflight.ps1'
if(-not(Test-Path -LiteralPath $preflight -PathType Leaf)){throw 'TheOrg runner preflight script not found.'}
& $preflight -RequireRunnerRegistration -RunnerDirectory $RunnerDirectory
if(-not $?){throw 'Self-hosted runner prerequisites were not verified.'}
$runner=Join-Path $RunnerDirectory 'run.cmd'
if(-not(Test-Path -LiteralPath $runner -PathType Leaf)){throw 'Official GitHub runner run.cmd missing; first complete GitHub runner registration.'}
Write-Host 'TheOrg runner will now receive only jobs that GitHub assigns to its labels.'
Write-Host 'Expected labels: self-hosted, Windows, X64 and theorg-win. Verify labels in GitHub Settings -> Actions -> Runners.'
Write-Host 'Keep this window open until source verification completes. Ctrl+C stops the foreground process.'
Push-Location $RunnerDirectory
try{
  & $runner
  if($LASTEXITCODE -ne 0){throw ("Official GitHub runner exited with code "+$LASTEXITCODE)}
}finally{Pop-Location}
