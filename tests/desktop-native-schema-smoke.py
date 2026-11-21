"""Actual-executable native framing/approval tests. Never dispatches a desktop action."""
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parent))
from windows_smoke_paths import bridge_workspace

exe = Path(sys.argv[1]).resolve()
company = "desktop_ci_" + uuid.uuid4().hex[:12]

def native(payload):
    data = json.dumps(payload).encode("utf-8")
    proc = subprocess.run([str(exe)], input=struct.pack("<I", len(data)) + data,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30, check=True)
    size = struct.unpack("<I", proc.stdout[:4])[0]
    assert len(proc.stdout) == size + 4
    return json.loads(proc.stdout[4:])

root = bridge_workspace() / "companies" / company
try:
    order = native({"command": "submit_order", "companyId": company,
                    "instruction": "Synthetic desktop proposal only; do not execute UI actions"})
    assert order["ok"], order
    scope = {"companyId": company, "orderId": order["order"]["orderId"]}
    action = {"operation": "set_value", "window": {"handle": 123, "processId": 456,
              "processStartedUtc": "2026-11-21T00:00:00.0000000Z", "title": "Synthetic fixture"},
              "target": {"runtimeId": [42, 1], "name": "Fixture input", "controlType": "ControlType.Edit"},
              "value": "Synthetic input"}
    preview = native({"command": "desktop_preview", **scope, "action": action})
    assert preview["ok"] and preview["status"] == "awaiting_approval", preview
    assert len(preview["fingerprint"]) == 64
    for approval in ({"approved": False, "fingerprint": preview["fingerprint"]},
                     {"approved": True, "fingerprint": "wrong"}, {}):
        denied = native({"command": "desktop_execute", **scope, "actionId": preview["actionId"], **approval})
        assert not denied["ok"], denied
    pending = native({"command": "desktop_receipt", **scope, "actionId": preview["actionId"]})
    assert pending["ok"] and pending["status"] == "awaiting_approval", pending
    foreign = native({"command": "desktop_receipt", **scope, "companyId": "other", "actionId": preview["actionId"]})
    assert not foreign["ok"], foreign
    for operation in ("shell", "click_coordinates", "send_keys"):
        invalid = native({"command": "desktop_preview", **scope, "action": {**action, "operation": operation}})
        assert not invalid["ok"], invalid
    history = native({"command": "desktop_history", **scope})
    assert history["ok"] and len(history["actions"]) == 1, history
    assert history["actions"][0]["status"] == "awaiting_approval", history
    assert not (root / "orders" / scope["orderId"] / "desktop_actions" / preview["actionId"] / "claimed").exists()
    print("PASS native desktop proposal, persisted history, denied approval, command schema and company isolation; NO UI action executed")
finally:
    if root.is_dir():
        shutil.rmtree(root)
