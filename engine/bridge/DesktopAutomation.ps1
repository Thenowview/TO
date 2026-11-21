# Fixed, embedded Windows accessibility adapter. Request JSON is data, never PowerShell source.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $children = [System.Windows.Automation.TreeScope]::Children
  $descendants = [System.Windows.Automation.TreeScope]::Descendants
  $all = [System.Windows.Automation.Condition]::TrueCondition
  function Window-Identity($element) {
    $current = $element.Current
    $process = Get-Process -Id $current.ProcessId -ErrorAction Stop
    [pscustomobject]@{
      handle = [long]$current.NativeWindowHandle
      processId = $current.ProcessId
      processStartedUtc = $process.StartTime.ToUniversalTime().ToString('o')
      title = ([string]$current.Name).Substring(0, [Math]::Min(240, ([string]$current.Name).Length))
    }
  }
  # Query supported patterns with TryGetCurrentPattern: unsupported controls must not abort observation.
  function Safe-Snapshot($window) {
    $items = $window.FindAll($descendants, $all)
    $result = @()
    for ($i = 0; $i -lt [Math]::Min($items.Count, 150); $i++) {
      $element = $items.Item($i)
      $c = $element.Current
      if ($c.IsPassword -or $c.IsOffscreen) { continue }
      $name = [string]$c.Name
      $invoke = $null; $value = $null
      $canInvoke = $element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$invoke)
      $canSet = $element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$value)
      $result += [pscustomobject]@{
        runtimeId = @($element.GetRuntimeId())
        name = $name.Substring(0, [Math]::Min(240, $name.Length))
        controlType = $c.ControlType.ProgrammaticName
        automationId = ([string]$c.AutomationId).Substring(0, [Math]::Min(120, ([string]$c.AutomationId).Length))
        enabled = $c.IsEnabled
        canInvoke = $canInvoke
        canSetValue = $canSet -and -not $value.Current.IsReadOnly
      }
    }
    return $result
  }
  if ($request.operation -ceq 'list_windows') {
    $windows = $root.FindAll($children, $all)
    $result = @()
    for ($i = 0; $i -lt [Math]::Min($windows.Count, 60); $i++) {
      try {
        $element = $windows.Item($i)
        if ($element.Current.NativeWindowHandle -eq 0 -or $element.Current.IsOffscreen) { continue }
        $result += Window-Identity $element
      } catch { }
    }
    @{ok = $true; windows = @($result)} | ConvertTo-Json -Depth 8 -Compress
    exit 0
  }
  $window = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr][long]$request.window.handle)
  if ($null -eq $window) { throw 'Window unavailable' }
  $identity = Window-Identity $window
  if ($identity.processId -ne $request.window.processId -or
      $identity.processStartedUtc -cne $request.window.processStartedUtc -or
      $identity.title -cne $request.window.title) { throw 'Window identity changed; observe and review again' }
  if ($request.operation -ceq 'observe') {
    @{ok = $true; window = $identity; controls = @(Safe-Snapshot $window); valuesRead = $false} | ConvertTo-Json -Depth 10 -Compress
    exit 0
  }
  $expectedId = (@($request.target.runtimeId) -join ',')
  $items = $window.FindAll($descendants, $all)
  $target = $null
  for ($i = 0; $i -lt [Math]::Min($items.Count, 1000); $i++) {
    if ((@($items.Item($i).GetRuntimeId()) -join ',') -ceq $expectedId) {
      if ($null -ne $target) { throw 'Ambiguous control identity' }
      $target = $items.Item($i)
    }
  }
  if ($null -eq $target) { throw 'Control no longer exists' }
  $current = $target.Current
  if ($current.IsPassword -or $current.IsOffscreen -or -not $current.IsEnabled -or
      $current.Name -cne $request.target.name -or
      $current.ControlType.ProgrammaticName -cne $request.target.controlType) {
    throw 'Control identity or accessibility changed'
  }
  if ($request.operation -ceq 'set_value') {
    $pattern = $null
    if (-not $target.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern) -or $pattern.Current.IsReadOnly) {
      throw 'Control does not support editable ValuePattern'
    }
    $pattern.SetValue([string]$request.value)
    if ($pattern.Current.Value -cne [string]$request.value) { throw 'Value readback mismatch' }
    @{ok = $true; verified = 'value_readback'; inputStoredInReceipt = $false} | ConvertTo-Json -Compress
    exit 0
  }
  if ($request.operation -ceq 'invoke') {
    $pattern = $null
    if (-not $target.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
      throw 'Control does not support InvokePattern'
    }
    if (@(Safe-Snapshot $window | Where-Object { $_.name -ceq [string]$request.expectedText }).Count -gt 0) {
      throw 'Expected result already existed before the action; review a distinct result expectation'
    }
    $pattern.Invoke()
    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    do {
      $snapshot = @(Safe-Snapshot $window)
      $found = @($snapshot | Where-Object { $_.name -ceq [string]$request.expectedText }).Count -gt 0
      if ($found) { break }
      Start-Sleep -Milliseconds 150
    } while ([DateTime]::UtcNow -lt $deadline)
    if (-not $found) { throw 'Action dispatched but expected visible text was not observed; do not replay' }
    @{ok = $true; verified = 'expected_accessible_text_present'; expectedText = [string]$request.expectedText} | ConvertTo-Json -Depth 10 -Compress
    exit 0
  }
  throw 'Unsupported desktop operation'
} catch {
  @{ok = $false; error = 'desktop_operation_failed'; detail = ([string]$_.Exception.Message).Substring(0, [Math]::Min(500, ([string]$_.Exception.Message).Length))} | ConvertTo-Json -Compress
  exit 1
}
