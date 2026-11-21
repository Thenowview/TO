"""Real Windows UI Automation against a disposable synthetic WinForms app only.

No installed user app, account, browser or production data is automated.
"""
import base64
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import time
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parent))
from windows_smoke_paths import bridge_workspace

exe = Path(sys.argv[1]).resolve()
company = "uia_ci_" + uuid.uuid4().hex[:12]
title = "GIZE synthetic accessibility " + uuid.uuid4().hex
script = r"""
Add-Type -AssemblyName PresentationFramework
[xml]$markup = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
 xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Title="__TITLE__" Width="520" Height="260">
 <StackPanel Margin="20">
  <TextBox x:Name="FixtureInput" AutomationProperties.Name="Fixture input" Margin="0,0,0,12"/>
  <PasswordBox x:Name="PrivateInput" AutomationProperties.Name="Private fixture" Margin="0,0,0,12"/>
  <Button x:Name="ApplyButton" Content="Apply synthetic value" AutomationProperties.Name="Apply synthetic value" Margin="0,0,0,12"/>
  <TextBlock x:Name="StatusText" Text="Awaiting synthetic input"/>
 </StackPanel>
</Window>
'@
$xmlReader = New-Object System.Xml.XmlNodeReader($markup)
$form = [Windows.Markup.XamlReader]::Load($xmlReader)
$edit = $form.FindName('FixtureInput')
$button = $form.FindName('ApplyButton')
$status = $form.FindName('StatusText')
$button.Add_Click({
  if ($edit.Text -ceq 'Synthetic input verified') { $status.Text = 'Synthetic saved' }
  else { $status.Text = 'Unexpected synthetic input' }
})
$form.Topmost = $true
[void]$form.ShowDialog()
""".replace("__TITLE__", title)

def native(payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    proc = subprocess.run([str(exe)], input=struct.pack("<I", len(data)) + data,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=40, check=True)
    assert len(proc.stdout) >= 4, proc.stderr.decode(errors="replace")
    size = struct.unpack("<I", proc.stdout[:4])[0]
    assert len(proc.stdout) == size + 4
    return json.loads(proc.stdout[4:])

powershell = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
fixture = subprocess.Popen([str(powershell), "-NoLogo", "-NoProfile", "-STA", "-EncodedCommand",
                            base64.b64encode(script.encode("utf-16-le")).decode("ascii")],
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                           creationflags=subprocess.CREATE_NO_WINDOW)
root = bridge_workspace() / "companies" / company
try:
    order = native({"command": "submit_order", "companyId": company,
                    "instruction": "Verify synthetic accessibility text input and action outcome"})
    assert order["ok"], order
    scope = {"companyId": company, "orderId": order["order"]["orderId"]}
    selected = None
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if fixture.poll() is not None:
            raise AssertionError("Synthetic fixture exited: " + fixture.stderr.read().decode(errors="replace"))
        windows = native({"command": "desktop_windows", **scope})
        assert windows["ok"], windows
        selected = next((w for w in windows["windows"] if w["title"] == title and w["processId"] == fixture.pid), None)
        if selected:
            break
        time.sleep(0.2)
    assert selected, "Synthetic fixture was not observable on this Windows runner's desktop"
    observed = native({"command": "desktop_observe", **scope, "window": selected})
    assert observed["ok"] and observed["valuesRead"] is False, observed
    assert not any(c["name"] == "Private fixture" for c in observed["controls"]), "Password control leaked into observation"
    edit = next((c for c in observed["controls"] if c["canSetValue"] and
                 (c["name"] == "Fixture input" or c["automationId"] == "FixtureInput")), None)
    assert edit, "Synthetic editable control unavailable: " + json.dumps(observed, ensure_ascii=False)

    def target(control):
        return {key: control[key] for key in ("runtimeId", "name", "controlType")}

    def execute(action):
        preview = native({"command": "desktop_preview", **scope, "action": action})
        assert preview["ok"], preview
        result = native({"command": "desktop_execute", **scope, "actionId": preview["actionId"],
                         "fingerprint": preview["fingerprint"], "approved": True})
        assert result["ok"] and result["receipt"]["status"] == "action_assertion_passed", result
        replay = native({"command": "desktop_execute", **scope, "actionId": preview["actionId"],
                         "fingerprint": preview["fingerprint"], "approved": True})
        assert not replay["ok"], "Executed accessibility action was replayed"
        receipt = native({"command": "desktop_receipt", **scope, "actionId": preview["actionId"]})
        assert receipt["ok"] and receipt["receipt"]["status"] == "action_assertion_passed", receipt
        return result

    filled = execute({"operation": "set_value", "window": selected, "target": target(edit),
                      "value": "Synthetic input verified"})
    assert filled["receipt"]["result"]["verified"] == "value_readback", filled
    observed = native({"command": "desktop_observe", **scope, "window": selected})
    button = next(c for c in observed["controls"] if c["name"] == "Apply synthetic value" and c["canInvoke"])
    invoked = execute({"operation": "invoke", "window": selected, "target": target(button),
                       "expectedText": "Synthetic saved"})
    assert invoked["receipt"]["result"]["verified"] == "expected_accessible_text_present", invoked
    observed = native({"command": "desktop_observe", **scope, "window": selected})
    assert any(c["name"] == "Synthetic saved" for c in observed["controls"]), observed
    wrong_window = native({"command": "desktop_observe", **scope,
                           "window": {**selected, "processStartedUtc": "2000-01-01T00:00:00.0000000Z"}})
    assert not wrong_window["ok"], "Recycled process identity was accepted"
    print("PASS actual Windows accessibility: observe, password exclusion, text readback, invoke/result, fresh-process receipts, replay rejection and process identity")
finally:
    fixture.terminate()
    try:
        fixture.wait(timeout=5)
    except subprocess.TimeoutExpired:
        fixture.kill()
        fixture.wait(timeout=5)
    if root.is_dir():
        shutil.rmtree(root)
