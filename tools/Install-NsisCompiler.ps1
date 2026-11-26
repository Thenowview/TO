# CI-only dependency acquisition. No alternate feed or verification bypass.
$ErrorActionPreference = 'Stop'
$compiler = Join-Path (${env:ProgramFiles(x86)}) 'NSIS\makensis.exe'
for ($attempt = 1; $attempt -le 3; $attempt++) {
    if (Test-Path -LiteralPath $compiler -PathType Leaf) { return }
    choco install nsis --yes --no-progress --limit-output
    $installExit = $LASTEXITCODE
    if ($installExit -eq 0 -and (Test-Path -LiteralPath $compiler -PathType Leaf)) { return }
    if ($attempt -lt 3) { Start-Sleep -Seconds (5 * $attempt) }
}
throw 'NSIS acquisition failed after three attempts; installer build blocked'
