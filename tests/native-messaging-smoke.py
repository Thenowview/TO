"""Integration regression: launch the actual published Windows native host and
exchange length-prefixed Chrome Native Messaging frames over stdio.

Uses only Python's standard library and synthetic, company-scoped files.
No external AI provider, Chrome account, or production file is touched.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import uuid

EXE = Path(sys.argv[1]).resolve()
assert EXE.is_file(), f"Native host not found: {EXE}"

company = "ci_" + uuid.uuid4().hex[:14]
instruction = "Produce a synthetic test file and verify an agent handoff."

def write_message(payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return struct.pack("<I", len(data)) + data

def decode_responses(data):
    results = []
    offset = 0
    while offset < len(data):
        if offset + 4 > len(data):
            raise AssertionError("Native host returned a truncated length header")
        size = struct.unpack("<I", data[offset:offset+4])[0]
        offset += 4
        if size < 1 or size > 1024 * 1024 or offset + size > len(data):
            raise AssertionError("Native host returned an invalid frame size")
        results.append(json.loads(data[offset:offset+size].decode("utf-8")))
        offset += size
    return results

def native(*messages):
    proc = subprocess.run(
        [str(EXE)],
        input=b"".join(map(write_message, messages)),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=45,
        check=False
    )
    if proc.returncode != 0:
        raise AssertionError(f"Native host exit {proc.returncode}: {proc.stderr.decode(errors='replace')}")
    result = decode_responses(proc.stdout)
    if len(result) != len(messages):
        raise AssertionError(f"Response count {len(result)} does not match request count {len(messages)}")
    return result

root = Path(os.environ["LOCALAPPDATA"]) / "TheOrg" / "workspace" / "companies" / company
try:
    results = native(
        {"command": "ping"},
        {"command": "capabilities"},
        {"command": "submit_order", "companyId": company, "instruction": instruction},
    )
    assert all(r.get("ok") for r in results), results
    assert results[0]["protocolVersion"] == 1
    order_id = results[2]["order"]["orderId"]
    assert len(order_id) == 32

    sample = b"# Real framed Native Messaging test\nSynthetic bytes only.\n"
    digest = hashlib.sha256(sample).hexdigest().upper()
    result = native({
        "command": "import_artifact", "companyId": company, "orderId": order_id,
        "agentId": "research1", "fileName": "test-report.md",
        "dataBase64": base64.b64encode(sample).decode(),
        "sourceProvider": "ci_synthetic", "sourceReference": "stdio-smoke"
    })[0]
    assert result["ok"], result
    artifact_id = result["artifact"]["artifactId"]

    verified, listed, denied = native(
        {"command":"verify_artifact","companyId":company,"orderId":order_id,"artifactId":artifact_id},
        {"command":"list_artifacts","companyId":company,"orderId":order_id},
        {"command":"read_artifact","companyId":"other","orderId":order_id,"artifactId":artifact_id}
    )
    assert verified["ok"] and verified["artifact"]["integrityValid"], verified
    assert verified["artifact"]["sha256"] == digest
    assert verified["artifact"]["formatValid"]
    assert verified["artifact"]["intakeStatus"] == "structure_verified_content_qa_pending"
    assert len(listed["artifacts"]) == 1
    assert not denied["ok"], "Cross-company read unexpectedly succeeded"

    content = native({
        "command":"read_artifact_chunk","companyId":company,"orderId":order_id,
        "artifactId":artifact_id,"offset":0,"chunkBytes":1000
    })[0]
    assert content["ok"], content
    assert base64.b64decode(content["result"]["dataBase64"]) == sample
    assert content["result"]["done"]

    # AO/agent integration over the actual native stdio host (new process per call).
    # Synthetic plans are not real AI inference and must never auto-approve.
    created = native({
        "command": "agent_create", "companyId": company, "orderId": order_id,
        "instruction": "Create a synthetic local note and list generated notes.",
        "mode": "demo", "model": "qwen3:4b", "approvedHosts": ""
    })[0]
    assert created["ok"] and created["status"] == "awaiting_approval", created
    job_id = created["jobId"]
    assert not native({
        "command": "agent_run_safe_batch", "companyId": company, "jobId": job_id
    })[0]["ok"], "Unapproved local agent ran a batch"
    assert not native({
        "command": "agent_approve", "companyId": company, "jobId": job_id,
        "approved": False
    })[0]["ok"], "Agent accepted a missing owner approval"
    assert not native({
        "command": "agent_get", "companyId": "other", "jobId": job_id
    })[0]["ok"], "Another company read agent state"
    approved = native({
        "command": "agent_approve", "companyId": company, "jobId": job_id,
        "approved": True
    })[0]
    assert approved["ok"] and approved["status"] == "queued", approved
    running = native({
        "command": "agent_run_safe_batch", "companyId": company, "jobId": job_id
    })[0]
    assert running["ok"] and running["status"] == "completed_pending_review", running
    assert running["executedSteps"] == 2, running
    persisted = native({
        "command": "agent_get", "companyId": company, "jobId": job_id
    })[0]
    assert persisted["ok"] and persisted["status"] == "completed_pending_review", persisted
    assert len(persisted["events"]) >= 3, persisted
    audit = native({
        "command": "agent_review", "companyId": company, "jobId": job_id
    })[0]
    assert audit["ok"] and audit["qa"]["verdict"] == "human_review_required", audit
    assert audit["qa"]["semanticQualityApproved"] is False, audit
    assert not native({
        "command": "agent_run_safe_batch", "companyId": company, "jobId": job_id
    })[0]["ok"], "Reviewed agent execution was replayed"
    browser = native({
        "command": "agent_create", "companyId": company, "orderId": order_id,
        "instruction": "Open synthetic approved HTTPS test site without accessing page contents.",
        "mode": "demo-browser", "model": "qwen3:4b", "approvedHosts": "example.com"
    })[0]
    assert browser["ok"] and browser["requiresApproval"], browser
    assert not native({
        "command": "agent_run_next", "companyId": company, "jobId": browser["jobId"]
    })[0]["ok"], "Browser navigation bypassed approval"
    stopped = native({
        "command": "agent_cancel", "companyId": company, "jobId": browser["jobId"]
    })[0]
    assert stopped["ok"] and stopped["status"] == "cancelled", stopped
    assert not native({
        "command": "agent_run_next", "companyId": company, "jobId": browser["jobId"]
    })[0]["ok"], "Cancelled browser job executed"

    bad = native({"command": "ping", "unexpected": "<script>"})[0]
    assert bad["ok"], bad

    print("PASS: framed Windows native host, persisted order, artifact QA, tenant isolation, AO approval, safe batch, restart, browser and cancellation gates")
finally:
    # The integration test never touches other companies or user files.
    if root.exists():
        shutil.rmtree(root)
