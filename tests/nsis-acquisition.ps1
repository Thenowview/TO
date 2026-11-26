$ErrorActionPreference = 'Stop'
$script:attempts = 0
$script:delays = @()
$script:available = $false
function Test-Path { param($LiteralPath, $PathType) return $script:available }
function Start-Sleep { param($Seconds) $script:delays += $Seconds }
function choco {
    $script:attempts++
    $global:LASTEXITCODE = 0
    if ($script:mode -eq 'recover' -and $script:attempts -eq 2) { $script:available = $true }
    if ($script:mode -eq 'nonzero') { $script:available = $true; $global:LASTEXITCODE = 1 }
}
$installer = Join-Path $PSScriptRoot '../tools/Install-NsisCompiler.ps1'
foreach ($mode in @('missing', 'recover', 'cached')) {
    $script:mode = $mode
    $script:attempts = 0
    $script:delays = @()
    $script:available = $mode -eq 'cached'
    $rejected = $false
    try { & $installer } catch {
        if ($_.Exception.Message -notlike 'NSIS acquisition failed*') { throw }
        $rejected = $true
    }
    if ($mode -eq 'missing' -and (!$rejected -or $script:attempts -ne 3 -or ($script:delays -join ',') -ne '5,10')) { throw 'Zero exit without compiler must fail after bounded retry' }
    if ($mode -eq 'recover' -and ($rejected -or $script:attempts -ne 2 -or ($script:delays -join ',') -ne '5')) { throw 'Transient acquisition did not recover' }
    if ($mode -eq 'cached' -and ($rejected -or $script:attempts -ne 0 -or $script:delays.Count -ne 0)) { throw 'Existing compiler must avoid acquisition' }
    Write-Host "PASS NSIS $mode"
}
