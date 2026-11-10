# Called by the ONE Windows EXE; pre-registers a fixed developer extension ID.
# Only current-user registration. Does not install a second browser, a Chrome policy, or Ollama.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$InstallRoot,
  [switch]$ValidateOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try {
  $root = [IO.Path]::GetFullPath($InstallRoot)
  $bridge = Join-Path $root 'bridge\TheOrg.Bridge.exe'
  $extensionPath = Join-Path $root 'chrome-extension'
  $extensionManifest = Join-Path $extensionPath 'manifest.json'
  $extensionId = 'odfnjlkfakmfiiaeoinpcpmomfeejnij'
  foreach ($file in @($bridge, $extensionManifest, (Join-Path $root 'Open-TheOrg.ps1'),
                    (Join-Path $root 'TheOrg-OneFile-START.html'))) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
      throw "Installation is incomplete: $file"
    }
  }
  $extension = Get-Content -LiteralPath $extensionManifest -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($extension.manifest_version -ne 3 -or
      -not (@($extension.permissions) -contains 'nativeMessaging') -or
      [string]::IsNullOrWhiteSpace($extension.key)) {
    throw 'Invalid extension, Chrome Native Messaging permission, or fixed extension identity'
  }
  $keyBytes = [Convert]::FromBase64String([string]$extension.key)
  $hash = [Security.Cryptography.SHA256]::Create()
  try { $digest = $hash.ComputeHash($keyBytes) } finally { $hash.Dispose() }
  $alphabet = 'abcdefghijklmnop'
  $computed = -join ($digest[0..15] | ForEach-Object {
    ([string]$alphabet[[int]($_ -shr 4)]) + ([string]$alphabet[[int]($_ -band 15)])
  })
  if ($computed -cne $extensionId) { throw "Extension ID mismatch: $computed" }
  if ($ValidateOnly) { Write-Host 'PASS TheOrg one-file installer layout and extension identity'; exit 0 }

  & $bridge --self-test *> $null
  if ($LASTEXITCODE -ne 0) { throw "Local controller self-test failed ($LASTEXITCODE)" }

  $hostName = 'com.theorg.bridge'
  $hostDir = Join-Path $env:LOCALAPPDATA 'TheOrg\NativeMessaging'
  New-Item -Path $hostDir -ItemType Directory -Force | Out-Null
  $hostPath = Join-Path $hostDir "$hostName.json"
  $hostJson = @{
    name = $hostName
    description = 'TheOrg local Windows controller, existing Chrome edition'
    path = $bridge
    type = 'stdio'
    allowed_origins = @("chrome-extension://$extensionId/")
  } | ConvertTo-Json -Depth 5
  [IO.File]::WriteAllText($hostPath, $hostJson, (New-Object Text.UTF8Encoding($false)))
  $registry = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName"
  New-Item -Path $registry -Force | Out-Null
  Set-Item -Path $registry -Value $hostPath
  $readback = (Get-Item -LiteralPath $registry).GetValue('')
  if ($readback -ne $hostPath) { throw 'Native host registry verification failed' }

  $idFile = Join-Path $root 'ExtensionId.txt'
  [IO.File]::WriteAllText($idFile, "$extensionId" + [Environment]::NewLine, [Text.Encoding]::ASCII)
  New-Item -ItemType Directory -Path (Join-Path $root 'Local-Files') -Force | Out-Null

  $template = Get-Content -LiteralPath (Join-Path $root 'TheOrg-OneFile-START.html') -Raw -Encoding UTF8
  $guide = $template.Replace('__EXT_PATH__', [Net.WebUtility]::HtmlEncode($extensionPath))
  $guide = $guide.Replace('__EXT_ID__', $extensionId)
  $guide = $guide.Replace('__WORKSPACE_PATH__', [Net.WebUtility]::HtmlEncode((Join-Path $env:LOCALAPPDATA 'TheOrg\workspace')))
  [IO.File]::WriteAllText((Join-Path $root 'START-HERE.html'), $guide, (New-Object Text.UTF8Encoding($false)))
  Write-Host 'PASS TheOrg one-file installation and exact Chrome Native Messaging host registration'
} catch {
  [Console]::Error.WriteLine('TheOrg setup error: ' + $_.Exception.Message)
  exit 1
}
