$ErrorActionPreference = 'Stop'
$global:GizeNsisTestState = @{ attempts = 0; delays = @(); available = $false; mode = '' }
function Test-Path { param($LiteralPath, $PathType) return $global:GizeNsisTestState.available }
function Start-Sleep { param($Seconds) $global:GizeNsisTestState.delays += $Seconds }
function choco {
    $global:GizeNsisTestState.attempts++
    $global:LASTEXITCODE = 0
    if ($global:GizeNsisTestState.mode -eq 'recover' -and $global:GizeNsisTestState.attempts -eq 2) { $global:GizeNsisTestState.available = $true }
}
$installer = Join-Path $PSScriptRoot '../tools/Install-NsisCompiler.ps1'
foreach ($mode in @('missing', 'recover', 'cached')) {
    $global:GizeNsisTestState.mode = $mode
    $global:GizeNsisTestState.attempts = 0
    $global:GizeNsisTestState.delays = @()
    $global:GizeNsisTestState.available = $mode -eq 'cached'
    $rejected = $false
    try { & $installer } catch {
        if ($_.Exception.Message -notlike 'NSIS acquisition failed*') { throw }
        $rejected = $true
    }
    if ($mode -eq 'missing' -and (!$rejected -or $global:GizeNsisTestState.attempts -ne 3 -or ($global:GizeNsisTestState.delays -join ',') -ne '5,10')) { throw 'Zero exit without compiler must fail after bounded retry' }
    if ($mode -eq 'recover' -and ($rejected -or $global:GizeNsisTestState.attempts -ne 2 -or ($global:GizeNsisTestState.delays -join ',') -ne '5')) { throw 'Transient acquisition did not recover' }
    if ($mode -eq 'cached' -and ($rejected -or $global:GizeNsisTestState.attempts -ne 0 -or $global:GizeNsisTestState.delays.Count -ne 0)) { throw 'Existing compiler must avoid acquisition' }
    Write-Host "PASS NSIS $mode"
}
