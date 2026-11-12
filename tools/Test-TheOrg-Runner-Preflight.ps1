# TheOrg free self-hosted Windows runner preflight.
# No registration, token access, downloads, billing changes, merges, or deployments.
[CmdletBinding()]
param(
  [switch]$RequireBuildTools,
  [switch]$RequireRunnerRegistration,
  [string]$RunnerDirectory = 'C:\actions-runner'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$failures = New-Object 'System.Collections.Generic.List[string]'
$warnings = New-Object 'System.Collections.Generic.List[string]'
function Issue([string]$message) {
  $failures.Add($message)
  Write-Warning $message
}
function Tool([string]$name) {
  $entry=Get-Command $name -ErrorAction SilentlyContinue
  if(-not $entry){Issue ("Missing required tool: "+$name);return $null}
  return $entry
}
if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or -not [Environment]::Is64BitOperatingSystem) {
  Issue 'Use a dedicated 64-bit Windows machine for native TheOrg Windows builds.'
}
try {
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
  $principal=New-Object Security.Principal.WindowsPrincipal($identity)
  if($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
    $warnings.Add('Avoid running the persistent GitHub Actions runner elevated. Use a restricted dedicated account or isolated VM.')
  }
}catch{$warnings.Add('Could not determine process elevation. Avoid administrator privileges.')}
$python=Tool 'python'
if($python){
  try{
    $version=(& python -c "import sys,struct;print(str(sys.version_info.major)+'.'+str(sys.version_info.minor)+'|'+str(struct.calcsize('P')*8))").Trim()
    if($LASTEXITCODE -ne 0 -or $version -notmatch '^3\.(1[2-9]|[2-9][0-9])\|64$'){
      Issue ("Python 3.12+ x64 required; detected: "+$version)
    }else{Write-Host ("PASS Python "+$version)}
  }catch{Issue ("Python inspection failed: "+$_.Exception.Message)}
}
$node=Tool 'node'
if($node){
  try{
    $version=(& node -p "process.versions.node").Trim()
    if($LASTEXITCODE -ne 0 -or $version -notmatch '^\d+\.\d+\.\d+' -or [int]$version.Split('.')[0] -lt 20){
      Issue ("Node.js 20+ required; detected: "+$version)
    }else{Write-Host ("PASS Node.js "+$version)}
  }catch{Issue ("Node inspection failed: "+$_.Exception.Message)}
}
$git=Tool 'git'
if($git){
  try{
    $gitVersion=& git --version
    if($LASTEXITCODE -ne 0){Issue 'git --version failed.'}
    else{Write-Host ("PASS "+$gitVersion)}
  }catch{Issue ("Git inspection failed: "+$_.Exception.Message)}
}
if($RequireBuildTools){
  $dotnet=Tool 'dotnet'
  if($dotnet){
    try{
      $sdks=@(& dotnet --list-sdks)
      if($LASTEXITCODE -ne 0 -or -not @($sdks | Where-Object {$_ -match '^8\.'}).Count){
        Issue '.NET 8 SDK is needed for the Windows bridge build (runtime alone is insufficient).'
      }else{Write-Host 'PASS .NET 8 SDK'}
    }catch{Issue ("Dotnet SDK inspection failed: "+$_.Exception.Message)}
  }
  $nsisRoot=[Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
  if(-not $nsisRoot){$nsisRoot=$env:ProgramFiles}
  $nsis=Join-Path $nsisRoot 'NSIS\makensis.exe'
  if(-not (Test-Path -LiteralPath $nsis -PathType Leaf)){
    $warnings.Add('NSIS compiler not found: required only for optional legacy installer workflows, not the default OneApp source check.')
  }else{Write-Host 'PASS NSIS compiler available'}
}
if($RequireRunnerRegistration){
  if(-not (Test-Path -LiteralPath $RunnerDirectory -PathType Container)){
    Issue ("Runner folder not found: "+$RunnerDirectory)
  }else{
    foreach($item in @('run.cmd','config.cmd','.runner')){
      if(-not (Test-Path -LiteralPath (Join-Path $RunnerDirectory $item) -PathType Leaf)){
        Issue ("Official runner has not been fully installed/registered: missing "+$item)
      }
    }
  }
}
foreach($message in $warnings){Write-Warning $message}
if($failures.Count){throw ("Runner preflight failed: "+$failures.Count+" item(s). No runner was started.")}
Write-Host 'PASS TheOrg Windows runner prerequisites. This does NOT prove GitHub runner registration, online status, source tests or Windows builds.'
