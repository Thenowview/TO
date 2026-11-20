# Pure synthetic manifest checks: no real registry, process, profile or data changes.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '..\tools\uninstall-native-host.ps1'
$tokens = $null; $parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  (Resolve-Path -LiteralPath $source).Path,[ref]$tokens,[ref]$parseErrors)
if ($parseErrors.Count -gt 0) { throw 'Unregister script syntax invalid' }
$definition = $ast.Find({param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
  $node.Name -eq 'Test-TheOrgNativeHostOwnership'
},$true)
if ($null -eq $definition) { throw 'Ownership check missing' }
. ([scriptblock]::Create($definition.Extent.Text))
$exe = Join-Path ([IO.Path]::GetTempPath()) 'ot-synthetic-install\TheOrg.Bridge.exe'
$owned = @{name='com.theorg.bridge';type='stdio';path=$exe} | ConvertTo-Json
if (-not (Test-TheOrgNativeHostOwnership $owned $exe)) { throw 'Matching executable not recognized' }
$foreign = Join-Path ([IO.Path]::GetTempPath()) 'ot-other-install\TheOrg.Bridge.exe'
if (Test-TheOrgNativeHostOwnership $owned $foreign) { throw 'Foreign uninstall accepted' }
foreach ($candidate in @('{broken','{}','null','[]',
    (@{name='other';type='stdio';path=$exe} | ConvertTo-Json),
    (@{name='com.theorg.bridge';type='http';path=$exe} | ConvertTo-Json),
    (@{name='com.theorg.bridge';type='stdio';path='relative.exe'} | ConvertTo-Json),
    (@{name='com.theorg.bridge';type='stdio';path=$null} | ConvertTo-Json))) {
  if (Test-TheOrgNativeHostOwnership $candidate $exe) { throw 'Untrusted manifest accepted' }
}
if (Test-TheOrgNativeHostOwnership $owned 'relative.exe') { throw 'Relative owner accepted' }
Write-Output 'PASS: native host removal requires exact installed-executable ownership'
