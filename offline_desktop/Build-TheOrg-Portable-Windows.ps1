# Run on a BUILD machine with Python 3.12+ and internet access.
# End users need only the TheOrg.exe for workspace and local inference; Autopilot also needs Docker with local image.
# Downloads pinned upstream releases and verifies SHA-256 digests.
param([switch]$SkipTests)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$Root=Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
$Bin=Join-Path $Root 'bin'
$Cache=Join-Path $Root '.build-cache'
New-Item -ItemType Directory -Force $Bin,$Cache | Out-Null
if(-not $SkipTests){ python -m unittest discover -s tests -v; if($LASTEXITCODE -ne 0){throw 'Tests failed: no binary will be released.'} }

# Official llama.cpp release CPU runtime; tag is intentionally fixed.
$LlamaTag='b12248'
$Release=Invoke-RestMethod "https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/$LlamaTag" -Headers @{ 'User-Agent'='TheOrg-Portable-Build' }
$AssetName="llama-$LlamaTag-bin-win-cpu-x64.zip"
$Asset=@($Release.assets | Where-Object { $_.name -eq $AssetName }) | Select-Object -First 1
if(-not $Asset){throw "Missing official llama.cpp release asset $AssetName"}
if(-not $Asset.digest -or -not $Asset.digest.StartsWith('sha256:')){throw 'Official llama.cpp asset has no verifiable sha256 digest.'}
$LlamaZip=Join-Path $Cache $AssetName
Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $LlamaZip
$Actual=(Get-FileHash $LlamaZip -Algorithm SHA256).Hash.ToLowerInvariant()
$Expected=$Asset.digest.Substring(7).ToLowerInvariant()
if($Expected -ne 'bb306bfd390f8782c0acaba490505d12f07392791b48f1dd039387a5bacf1181'){throw 'Pinned llama.cpp release digest unexpectedly changed'}
if($Actual -ne $Expected){throw "llama.cpp binary hash mismatch: $Actual"}
$LlamaExtract=Join-Path $Cache 'llama-extracted'
Expand-Archive -Path $LlamaZip -DestinationPath $LlamaExtract -Force
$LlamaExe=Get-ChildItem $LlamaExtract -Recurse -Filter 'llama-server.exe' -File | Select-Object -First 1
if(-not $LlamaExe){throw 'Official release did not include llama-server.exe'}
Copy-Item $LlamaExe.FullName (Join-Path $Bin 'llama-server.exe') -Force
$Dlls=@(Get-ChildItem $LlamaExe.DirectoryName -Filter '*.dll' -File)
if($Dlls.Count -eq 0){throw 'Missing llama.cpp runtime libraries'}
foreach($Dll in $Dlls){Copy-Item $Dll.FullName $Bin -Force}

# Portable Git, so Code Studio does not depend on a system-wide Git install.
$GitTag='v2.52.0.windows.1'
$GitZip=Join-Path $Cache 'MinGit-2.52.0-64-bit.zip'
Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/$GitTag/MinGit-2.52.0-64-bit.zip" -OutFile $GitZip
$GitSha='f42a561840627747ad48e6ece05a14093292d31f3393a401a7f7c780ee7695c2'
if((Get-FileHash $GitZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $GitSha){throw 'MinGit SHA256 mismatch'}
$GitRoot=Join-Path $Bin 'git'
Expand-Archive -Path $GitZip -DestinationPath $GitRoot -Force
if(-not (Test-Path (Join-Path $GitRoot 'cmd\git.exe'))){throw 'MinGit extraction incomplete'}

# Pinned PyInstaller is a BUILD dependency only, not needed on the target PC.
python -m pip install 'pyinstaller==6.16.0'
if($LASTEXITCODE -ne 0){throw 'PyInstaller installation failed'}
$Arguments=@('--noconfirm','--clean','--onefile','--windowed','--name','TheOrg',
  '--add-data',"$Root\static;static", '--add-binary',"$Bin\llama-server.exe;bin",'--add-data',"$GitRoot;bin\git")
foreach($Dll in $Dlls){$Arguments+=@('--add-binary',"$Bin\$($Dll.Name);bin")}
$Arguments+=@('app.py')
python -m PyInstaller @Arguments
if($LASTEXITCODE -ne 0){throw 'Windows binary compilation failed'}
$Exe=Join-Path $Root 'dist\TheOrg.exe'
if(-not (Test-Path $Exe)){throw 'TheOrg.exe not produced'}
# Run the EXE itself, not just source-code tests.
& $Exe --self-test
if($LASTEXITCODE -ne 0){throw 'Packaged executable self-test failed'}
# Portable smoke test, localhost only. Verify shortcut on ephemeral Windows CI user.
$env:THEORG_SKIP_SHORTCUT='0'
$env:THEORG_PORT='18765'
$Proc=Start-Process -FilePath $Exe -ArgumentList '--no-browser' -PassThru
try {
  $Ready=$false
  for($i=0;$i -lt 45;$i++){
    Start-Sleep -Seconds 1
    try {$Response=Invoke-WebRequest -Uri 'http://127.0.0.1:18765/' -UseBasicParsing -TimeoutSec 2
      if($Response.StatusCode -eq 200 -and $Response.Content.Contains('THEORG')){$Ready=$true;break}
    }catch {}
    if($Proc.HasExited){throw 'Portable EXE terminated during local smoke test'}
  }
  if(-not $Ready){throw 'Portable EXE localhost dashboard smoke test failed'}
  $TokenFile=Join-Path (Split-Path -Parent $Exe) '.theorg\data\access-token.txt'
  if(!(Test-Path $TokenFile)){throw 'Portable EXE did not create local access token'}
  $Token=(Get-Content -LiteralPath $TokenFile -Raw).Trim()
  $Headers=@{Authorization="Bearer $Token"}
  $Status=Invoke-RestMethod 'http://127.0.0.1:18765/api/status' -Headers $Headers -TimeoutSec 5
  if($Status.version -ne '0.10.0' -or !$Status.coding_git_available -or !$Status.llama_binary){throw 'Packaged API, MinGit, or llama runtime failed readiness check'}
  $Project=Invoke-RestMethod 'http://127.0.0.1:18765/api/code/projects' -Method Post -Headers $Headers -ContentType 'application/json' -Body '{"confirmed":true,"slug":"ci_build_smoke"}' -TimeoutSec 10
  if(!$Project.project.git_head){throw 'Packaged local Git failed to initialize a project'}
  $Shortcut=Join-Path ([Environment]::GetFolderPath('Desktop')) 'TheOrg.lnk'
  if(!(Test-Path $Shortcut)){throw 'Portable EXE did not create a desktop shortcut'}
  $Shell=New-Object -ComObject WScript.Shell
  $Target=$Shell.CreateShortcut($Shortcut).TargetPath
  if($Target -ne $Exe){throw 'Desktop shortcut points to a different application'}
  Remove-Item -LiteralPath $Shortcut -Force -ErrorAction SilentlyContinue
  Write-Output 'PASS Windows onefile launch, authenticated API, bundled Git, llama-server binary and shortcut'
}finally {
  if(-not $Proc.HasExited){Stop-Process -Id $Proc.Id -Force -ErrorAction SilentlyContinue}
  Remove-Item Env:\THEORG_PORT -ErrorAction SilentlyContinue
}
$Hash=(Get-FileHash $Exe -Algorithm SHA256).Hash.ToLowerInvariant()
"$Hash  TheOrg.exe" | Set-Content -Encoding ascii (Join-Path $Root 'dist\SHA256SUMS.txt')
"llama.cpp $LlamaTag $Expected`nMinGit $GitTag $GitSha" | Set-Content -Encoding utf8 (Join-Path $Root 'dist\UPSTREAM-DIGESTS.txt')
Write-Output "Built and smoke-tested: $Exe, sha256=$Hash"
