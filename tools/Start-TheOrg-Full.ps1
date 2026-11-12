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
  if($CheckOnly){Write-Host 'PASS self-contained payload present and fixed extension ID verified';return}
  New-Item -ItemType Directory -Force -Path $UserRoot,$Profile|Out-Null
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
  $TokenFile=Join-Path $Root '.theorg\data\access-token.txt'
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
  if($Chrome){
    $args=@(
      ('--user-data-dir="'+$Profile+'"'),
      '--profile-directory=Default','--no-first-run',
      '--no-default-browser-check',
      ('--disable-extensions-except="'+$Extension+'"'),
      ('--load-extension="'+$Extension+'"'),
      '--new-window',
      $url
    )
    if(-not $SkipSupervisor){$args+=('chrome-extension://'+$Id+'/home.html')}
    Start-Process -FilePath $Chrome -ArgumentList $args|Out-Null
    Write-Host 'PASS TheOrg local AI engine launched; dedicated Chrome window opened.'
  }else{
    Start-Process $url
    Write-Host 'PASS TheOrg engine started; Supervisor skipped.'
  }
  Write-Host ('Files are saved under '+(Join-Path $UserRoot 'workspace'))
}catch{
  [Console]::Error.WriteLine('TheOrg launch error: '+$_.Exception.Message)
  exit 1
}
