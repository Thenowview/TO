# TheOrg full edition launcher. Does not run if the verified binary payload is absent.
[CmdletBinding()]
param([switch]$CheckOnly,[switch]$SkipSupervisor)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$Root=$PSScriptRoot
$Exe=Join-Path $Root 'TheOrg.exe'
$Bridge=Join-Path $Root 'TheOrg.Bridge.exe'
$Extension=Join-Path $Root 'chrome-extension'
$HostInstaller=Join-Path $Root 'install-native-host.ps1'
$UserRoot=Join-Path $env:LOCALAPPDATA 'TheOrg'
$Profile=Join-Path $UserRoot 'ChromeProfile'
$Id='odfnjlkfakmfiiaeoinpcpmomfeejnij'
$Icon=Join-Path $Root 'TheOrg.ico'
function Check([string]$f){if(-not(Test-Path -LiteralPath $f -PathType Leaf)){throw "Incomplete TheOrg package: $f"}}
function VerifyHashes([switch]$AllFiles) {
  $receiptPath=Join-Path $Root 'BUILD-RECEIPT.json'
  Check $receiptPath
  $receipt=Get-Content -LiteralPath $receiptPath -Raw -Encoding UTF8|ConvertFrom-Json
  if($receipt.schema -ne 'theorg-self-contained-windows-v1'){throw 'Unexpected release receipt schema'}
  foreach($entry in @(
    @($Exe,[string]$receipt.engine_exe_sha256),
    @($Bridge,[string]$receipt.bridge_exe_sha256)
  )) {
    if($entry[1] -notmatch '^[0-9a-fA-F]{64}$'){throw 'Invalid executable checksum in build receipt'}
    $actual=(Get-FileHash -LiteralPath $entry[0] -Algorithm SHA256).Hash
    if($actual -ine $entry[1]){throw "Executable checksum mismatch: $($entry[0])"}
  }
  if(-not $AllFiles){return}
  $sums=Join-Path $Root 'SHA256SUMS.txt'
  Check $sums
  $seen=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $prefix=[IO.Path]::GetFullPath($Root).TrimEnd('\')+'\'
  $count=0
  foreach($line in (Get-Content -LiteralPath $sums -Encoding UTF8)){
    if($line -notmatch '^(?<sum>[0-9a-fA-F]{64})  (?<relative>.+)$'){
      throw 'Invalid checksum-manifest line'
    }
    $expected=$Matches.sum
    $relative=$Matches.relative.Replace('/','\')
    if($relative.StartsWith('\') -or $relative.Contains(':') -or
       @($relative.Split('\')|Where-Object {$_ -eq '..'}).Count -gt 0){
      throw "Unsafe checksum path: $relative"
    }
    if(-not $seen.Add($relative)){throw "Duplicate checksum path: $relative"}
    $file=[IO.Path]::GetFullPath((Join-Path $Root $relative))
    if(-not $file.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){
      throw "Checksum path escaped package: $relative"
    }
    Check $file
    if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ine $expected){
      throw "Checksum mismatch: $relative"
    }
    $count++
  }
  if($count -lt 6){throw 'Incomplete checksum manifest'}
  Write-Host "PASS verified $count packaged-file SHA-256 checksums"
}
function Find-Chrome {
  $bundled=Join-Path $Root 'browser\chrome.exe'
  if(Test-Path $bundled){return $bundled}
  foreach($parent in @($env:ProgramFiles,[Environment]::GetEnvironmentVariable('ProgramFiles(x86)'),$env:LOCALAPPDATA)){
    if($parent){
      $test=Join-Path $parent 'Google\Chrome\Application\chrome.exe'
      if(Test-Path $test){return $test}
    }
  }
  $found=Get-Command chrome.exe -ErrorAction SilentlyContinue
  if($found){return $found.Source}
  return $null
}
try{
  Check $Exe
  Check $Bridge
  Check (Join-Path $Extension 'manifest.json')
  Check $HostInstaller
  $m=Get-Content -LiteralPath (Join-Path $Extension 'manifest.json') -Raw|ConvertFrom-Json
  if($m.manifest_version -ne 3 -or -not @($m.permissions).Contains('nativeMessaging') -or
      [string]::IsNullOrEmpty($m.key)){throw 'Invalid keyed Chrome extension'}
  $der=[Convert]::FromBase64String([string]$m.key)
  $sha=[Security.Cryptography.SHA256]::Create()
  try{$digest=$sha.ComputeHash($der)}finally{$sha.Dispose()}
  $alphabet='abcdefghijklmnop'
  $derived=-join ($digest[0..15]|ForEach-Object {
      [string]$alphabet[[int]($_ -shr 4)]+[string]$alphabet[[int]($_ -band 15)]
  })
  if($derived -cne $Id){throw 'Extension key mismatch; native host registration blocked'}
  VerifyHashes -AllFiles:$CheckOnly
  if($CheckOnly){Write-Host 'PASS self-contained payload present, checksums and fixed extension ID verified';return}
  New-Item -ItemType Directory -Force -Path $UserRoot,$Profile|Out-Null
  # Keep access tokens, SQLite and models in the user's profile, never inside
  # a redistributable application directory (including Program Files).
  $env:THEORG_DATA_DIR=Join-Path $UserRoot 'EngineData'
  $env:THEORG_WORKSPACE=Join-Path $UserRoot 'workspace'
  $env:THEORG_MODELS=Join-Path $UserRoot 'models'
  $env:THEORG_SKIP_SHORTCUT='1'
  if($Icon -and (Test-Path -LiteralPath $Icon)){
    try{
      $desktop=Join-Path ([Environment]::GetFolderPath('Desktop')) 'TheOrg.lnk'
      $shell=New-Object -ComObject WScript.Shell
      if(-not(Test-Path $desktop)){
        $s=$shell.CreateShortcut($desktop)
        $s.TargetPath=Join-Path $Root 'START THEORG.cmd'
        $s.WorkingDirectory=$Root
        $s.Description='TheOrg self-contained AI Supervisor'
        $s.IconLocation=$Icon+',0'
        $s.Save()
      }
    }catch{Write-Warning ('Desktop shortcut not created: '+$_.Exception.Message)}
  }
  # Self-test is part of startup acceptance; no imaginary success if it fails.
  & $Exe --self-test *> $null
  if($LASTEXITCODE -ne 0){throw 'TheOrg.exe self-test failed'}
  & $Bridge --self-test *> $null
  if($LASTEXITCODE -ne 0){throw 'Native Messaging bridge self-test failed'}

  # Always use this application's own Native Messaging scope only.
  if(-not $SkipSupervisor){
    & $HostInstaller -ExtensionId $Id -ExecutablePath $Bridge
    if($LASTEXITCODE -ne 0){throw 'Native Messaging registration failed'}
  }
  $Chrome=Find-Chrome
  if(-not $Chrome -and -not $SkipSupervisor){
    throw 'No compatible Chrome browser in package or installed on Windows. Supervisor cannot launch.'
  }
  $Port=8765
  $Listening=Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
  if($Listening){throw 'TheOrg port 8765 is already occupied; refusing to connect to an unknown local service.'}
  $Process=Start-Process -FilePath $Exe -ArgumentList '--no-browser' -WorkingDirectory $Root -PassThru
  $TokenFile=Join-Path $env:THEORG_DATA_DIR 'access-token.txt'
  $Ready=$false
  for($i=0;$i -lt 50;$i++){
    Start-Sleep -Milliseconds 250
    if($Process.HasExited){throw 'TheOrg engine terminated before the UI was ready.'}
    if(Test-Path -LiteralPath $TokenFile){
      try{
        $response=Invoke-WebRequest 'http://127.0.0.1:8765/' -UseBasicParsing -TimeoutSec 2
        if($response.StatusCode -eq 200){$Ready=$true;break}
      }catch{}
    }
  }
  if(-not $Ready){throw 'TheOrg engine local dashboard did not become ready.'}
  $token=(Get-Content -LiteralPath $TokenFile -Raw).Trim()
  if($token -notmatch '^[A-Za-z0-9_-]{20,100}$'){throw 'Missing/invalid TheOrg access token'}
  $url='http://127.0.0.1:8765/#theorg-token='+[Uri]::EscapeDataString($token)
  if($SkipSupervisor){
    Start-Process $url
    Write-Host 'PASS TheOrg local AI dashboard launched without Chrome Supervisor.'
  } elseif($Chrome) {
    $args=@(
      ('--user-data-dir="'+$Profile+'"'),
      '--profile-directory=Default','--no-first-run',
      '--no-default-browser-check',
      ('--disable-extensions-except="'+$Extension+'"'),
      ('--load-extension="'+$Extension+'"'),
      '--new-window',
      $url,
      ('chrome-extension://'+$Id+'/home.html')
    )
    Start-Process -FilePath $Chrome -ArgumentList $args|Out-Null
    Write-Host 'PASS TheOrg local AI engine launched; dedicated Chrome window opened.'
  }else{
    throw 'Chrome Supervisor requested but no Chrome installation was available.'
  }
  Write-Host ('Files are saved under '+(Join-Path $UserRoot 'workspace'))
}catch{
  [Console]::Error.WriteLine('TheOrg launch error: '+$_.Exception.Message)
  exit 1
}
