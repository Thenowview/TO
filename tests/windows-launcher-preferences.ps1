# Synthetic Chrome preference records only. Does not launch Chrome or register a host.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '..\tools\TheOrg-Start.ps1'
$tokens = $null; $parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  (Resolve-Path -LiteralPath $source).Path, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) { throw 'Launcher syntax is invalid' }
$definition = $ast.Find({ param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
  $node.Name -eq 'Find-InstalledExtensionId'
}, $true)
if ($null -eq $definition) { throw 'Preference discovery function missing' }
. ([scriptblock]::Create($definition.Extent.Text))
$root = Join-Path ([IO.Path]::GetTempPath()) ('ot-launcher-prefs-' + [guid]::NewGuid().ToString('N'))
try {
  $profile = Join-Path $root 'Profile'
  $extensionFolder = Join-Path $root 'extension'
  $manifestPath = Join-Path $extensionFolder 'manifest.json'
  New-Item -ItemType Directory -Path (Join-Path $profile 'Default'), $extensionFolder -Force | Out-Null
  @{name='GIZE AI synthetic acceptance'} | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8
  $ordinary = Join-Path $profile 'Default\Preferences'
  $secure = Join-Path $profile 'Default\Secure Preferences'
  $id = 'a' * 32
  $settings = @{}
  $settings[$id] = @{path=$extensionFolder; manifest=@{name='GIZE AI synthetic acceptance'}}
  @{extensions=@{settings=$settings}} | ConvertTo-Json -Depth 6 |
    Set-Content -LiteralPath $secure -Encoding UTF8
  foreach ($ordinaryText in @('{}', '{"profile":{"name":"Synthetic"}}',
      '{"extensions":null}', '{"extensions":{}}', '{"extensions":{"settings":null}}', '{broken')) {
    Set-Content -LiteralPath $ordinary -Value $ordinaryText -Encoding UTF8
    if ((Find-InstalledExtensionId) -cne $id) { throw 'Secure Preferences fallback failed' }
  }
  # A malformed candidate must not hide a later, exact matching record.
  $settings = [ordered]@{}
  $settings['b' * 32] = @{path=$extensionFolder}
  $settings[$id] = @{path=$extensionFolder; manifest=@{name='GIZE AI synthetic acceptance'}}
  @{extensions=@{settings=$settings}} | ConvertTo-Json -Depth 6 |
    Set-Content -LiteralPath $secure -Encoding UTF8
  if ((Find-InstalledExtensionId) -cne $id) { throw 'Malformed entry blocked valid candidate' }
  foreach ($candidate in @(
      @{path=(Join-Path $root 'other'); manifest=@{name='GIZE AI synthetic acceptance'}},
      @{path=$extensionFolder; manifest=@{name='Different extension'}},
      @{path=$extensionFolder; manifest=@{}},
      @{path=$null; manifest=@{name='GIZE AI synthetic acceptance'}})) {
    $settings = @{}; $settings[$id] = $candidate
    @{extensions=@{settings=$settings}} | ConvertTo-Json -Depth 6 |
      Set-Content -LiteralPath $secure -Encoding UTF8
    if ($null -ne (Find-InstalledExtensionId)) { throw 'Nonmatching record selected' }
  }
  $settings = @{}; $settings['invalid-extension-id'] = @{
    path=$extensionFolder; manifest=@{name='GIZE AI synthetic acceptance'}}
  @{extensions=@{settings=$settings}} | ConvertTo-Json -Depth 6 |
    Set-Content -LiteralPath $secure -Encoding UTF8
  if ($null -ne (Find-InstalledExtensionId)) { throw 'Malformed identity selected' }
  Remove-Item -LiteralPath $secure
  if ($null -ne (Find-InstalledExtensionId)) { throw 'Missing installation was guessed' }
  Write-Output 'PASS: strict-mode Chrome Preferences/Secure Preferences fallback and exact identity/path binding'
} finally {
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  $cleanupRoot = [IO.Path]::GetFullPath($root)
  if (-not $cleanupRoot.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing cleanup outside the synthetic temporary directory'
  }
  if (Test-Path -LiteralPath $cleanupRoot) { Remove-Item -LiteralPath $cleanupRoot -Recurse -Force }
}
