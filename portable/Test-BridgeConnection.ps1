# Installation health probe, not a substitute for the CI security regression suite.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$ExecutablePath,
  [ValidateRange(1,60)][int]$TimeoutSeconds = 30
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$exe = [IO.Path]::GetFullPath($ExecutablePath)
if (-not (Test-Path -LiteralPath $exe -PathType Leaf) -or
    [IO.Path]::GetExtension($exe) -ine '.exe') {
  throw 'Bridge health check requires an existing Windows executable.'
}
$process = New-Object System.Diagnostics.Process
$process.StartInfo.FileName = $exe
$process.StartInfo.WorkingDirectory = Split-Path -Parent $exe
$process.StartInfo.UseShellExecute = $false
$process.StartInfo.RedirectStandardInput = $true
$process.StartInfo.RedirectStandardOutput = $true
$process.StartInfo.CreateNoWindow = $true
$clock = [Diagnostics.Stopwatch]::StartNew()
$started = $false
function Get-RemainingMilliseconds {
  $remaining = $TimeoutSeconds * 1000 - [int]$clock.ElapsedMilliseconds
  if ($remaining -le 0) { throw 'Native host health check timed out.' }
  return $remaining
}
function Read-ExactBytes([IO.Stream]$Stream, [byte[]]$Buffer) {
  $offset = 0
  while ($offset -lt $Buffer.Length) {
    $read = $Stream.ReadAsync($Buffer, $offset, $Buffer.Length - $offset)
    if (-not $read.Wait((Get-RemainingMilliseconds))) {
      throw 'Native host health check timed out.'
    }
    $count = $read.Result
    if ($count -eq 0) { throw 'Native host returned a truncated response.' }
    $offset += $count
  }
}
try {
  # .NET Framework's Process uses Console.InputEncoding and can emit a BOM
  # before binary stdin. Core supports a per-process encoding override instead.
  $noBom = New-Object Text.UTF8Encoding($false)
  $encodingProperty = $process.StartInfo.PSObject.Properties['StandardInputEncoding']
  $consoleEncoding = [Console]::InputEncoding
  try {
    if ($null -ne $encodingProperty) {
      $process.StartInfo.StandardInputEncoding = $noBom
    } else {
      [Console]::InputEncoding = $noBom
    }
    $started = $process.Start()
  } finally {
    if ($null -eq $encodingProperty) { [Console]::InputEncoding = $consoleEncoding }
  }
  if (-not $started) { throw 'Could not start the native host.' }
  $request = [Text.Encoding]::UTF8.GetBytes('{"command":"ping"}')
  $length = [BitConverter]::GetBytes([int]$request.Length)
  $process.StandardInput.BaseStream.Write($length,0,$length.Length)
  $process.StandardInput.BaseStream.Write($request,0,$request.Length)
  $process.StandardInput.Close()
  $header = New-Object byte[] 4
  Read-ExactBytes $process.StandardOutput.BaseStream $header
  $size = [BitConverter]::ToInt32($header,0)
  if ($size -lt 1 -or $size -gt 1048576) { throw 'Invalid native response frame size.' }
  $payload = New-Object byte[] $size
  Read-ExactBytes $process.StandardOutput.BaseStream $payload
  if (-not $process.WaitForExit((Get-RemainingMilliseconds))) {
    throw 'Native host health check timed out.'
  }
  if ($process.ExitCode -ne 0) { throw 'Native host exited unsuccessfully.' }
  if ($process.StandardOutput.BaseStream.ReadByte() -ne -1) {
    throw 'Native host returned unexpected trailing output.'
  }
  $utf8 = New-Object Text.UTF8Encoding($false,$true)
  $reply = $utf8.GetString($payload) | ConvertFrom-Json
  if ($null -eq $reply -or $reply -is [Array] -or
      $reply.ok -isnot [bool] -or -not $reply.ok -or
      $reply.engine -cne 'TheOrg.Bridge' -or
      ($reply.protocolVersion -isnot [int] -and $reply.protocolVersion -isnot [long]) -or
      $reply.protocolVersion -ne 1) {
    throw 'Unexpected bridge identity or native protocol version.'
  }
  Write-Host 'PASS native host framed ping, identity, protocol and clean exit.'
} finally {
  if ($started -and -not $process.HasExited) {
    $process.Kill()
    [void]$process.WaitForExit(5000)
  }
  $process.Dispose()
  $clock.Stop()
}
