[CmdletBinding()]
param([string]$ExecutablePath = (Join-Path $PSScriptRoot 'TheOrg.Bridge.exe'))
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ExecutablePath = [IO.Path]::GetFullPath($ExecutablePath)

function Test-TheOrgNativeHostOwnership {
  param([string]$ManifestText, [string]$ExpectedExecutablePath)
  try {
    $manifest = $ManifestText | ConvertFrom-Json
    if ($null -eq $manifest) { return $false }
    $name = $manifest.PSObject.Properties['name']
    $type = $manifest.PSObject.Properties['type']
    $path = $manifest.PSObject.Properties['path']
    if ($null -eq $name -or $name.Value -cne 'com.theorg.bridge' -or
        $null -eq $type -or $type.Value -cne 'stdio' -or
        $null -eq $path -or $path.Value -isnot [string] -or
        -not [IO.Path]::IsPathRooted($path.Value) -or
        -not [IO.Path]::IsPathRooted($ExpectedExecutablePath)) { return $false }
    return [string]::Equals([IO.Path]::GetFullPath($path.Value),
      [IO.Path]::GetFullPath($ExpectedExecutablePath), [StringComparison]::OrdinalIgnoreCase)
  } catch { return $false }
}

$regKey = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.theorg.bridge'
if (Test-Path -LiteralPath $regKey) {
  $manifestPath = (Get-Item -LiteralPath $regKey).GetValue('')
  $owned = $false
  try {
    if ($manifestPath -is [string] -and [IO.Path]::IsPathRooted($manifestPath) -and
        (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
      $text = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8
      $owned = Test-TheOrgNativeHostOwnership -ManifestText $text -ExpectedExecutablePath $ExecutablePath
    }
  } catch { $owned = $false }
  # A different install, unreadable record or changed registry value must survive.
  if ($owned -and (Get-Item -LiteralPath $regKey).GetValue('') -ceq $manifestPath) {
    Remove-Item -LiteralPath $regKey -Force
    Write-Host 'TheOrg Chrome native messaging registration removed for this executable.'
  } else {
    Write-Host 'Native messaging registration retained: ownership was not confirmed for this executable.'
  }
} else {
  Write-Host 'TheOrg native messaging registration was not present.'
}
Write-Host 'TheOrg local company files and account settings were NOT deleted.'

