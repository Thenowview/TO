"""Bounded local Windows and GitHub operator tools.

An instruction is never an executable command. The deterministic preview chooses
only fixed tool IDs; execution still requires capability prepare + single-use
approval. The GitHub dispatch tool runs only source checks on the reviewed branch.
No token registration, arbitrary PowerShell, repository writes, merges or deploys.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import shutil
import subprocess

from engine import core

REPOSITORY = "faisalwrokksa-hub/TO"
REVIEW_BRANCH = "feat/agent-execution-handoffs-independent-qa"
WORKFLOW = "bridge-ci.yml"
_COMMIT = re.compile(r"^[0-9a-f]{40}$")
_CHECKS = {
    "powershell_version": (
        "$ErrorActionPreference='Stop';"
        "[pscustomobject]@{powershell=$PSVersionTable.PSVersion.ToString();"
        "platform=[Environment]::OSVersion.Platform.ToString();"
        "is_64bit=[Environment]::Is64BitOperatingSystem}"
        "|ConvertTo-Json -Compress"
    ),
    "toolchain": (
        "$ErrorActionPreference='Stop';"
        "$wanted=@('python.exe','node.exe','git.exe','dotnet.exe');"
        "$result=@{};"
        "foreach($n in $wanted){"
        "$item=Get-Command $n -ErrorAction SilentlyContinue;"
        "$result[$n]=($null -ne $item)};"
        "$result|ConvertTo-Json -Compress"
    ),
}


def plan(instruction: str) -> dict:
    """Rule-based tool preview only, not a model decision or an authorization."""
    if not isinstance(instruction, str) or not 5 <= len(instruction.strip()) <= 1200:
        raise core.EngineError("Operator instruction must contain 5–1200 characters.")
    words = instruction.lower()
    tasks: list[dict] = []
    if any(word in words for word in ("runner", "github", "workflow", "action", "ci")):
        tasks.append({"tool": "desktop.runner.inspect",
                      "arguments": {"location": "user_downloads"},
                      "effect": "local_read_only"})
        tasks.append({"tool": "windows.powershell.inspect",
                      "arguments": {"check": "toolchain"},
                      "effect": "local_read_only"})
        tasks.append({"tool": "github.runner.status", "arguments": {},
                      "effect": "authenticated_remote_read"})
        tasks.append({"tool": "github.workflow.status", "arguments": {},
                      "effect": "authenticated_remote_read"})
    if any(word in words for word in ("run tests", "run ci", "dispatch", "trigger workflow")):
        tasks.append({"tool": "windows.source.verify",
                      "arguments": {"expected_sha": "<reviewed-commit-sha>"},
                      "effect": "approved_local_code_execution"})
        tasks.append({"tool": "github.workflow.source_dispatch",
                      "arguments": {"expected_sha": "<reviewed-commit-sha>"},
                      "effect": "remote_job_execution"})
    if not tasks:
        tasks.append({"tool": None, "arguments": {},
                      "effect": "manual_scoping_required"})
    return {
        "tasks": tasks,
        "draft_only": True,
        "model_called": False,
        "actions_executed": False,
        "shell_instructions_executed": False,
        "external_actions_authorized": False,
        "requires_explicit_digest_approval_per_action": True,
        "warning": ("A rule-based preview is not permission to run commands. "
                    "Authenticate privately and review the branch/commit first."),
    }


def normalize(name: str, args: dict) -> dict:
    if type(args) is not dict:
        raise core.EngineError("Operator tool arguments must be an object.")
    if name == "windows.powershell.inspect":
        if set(args) != {"check"} or args["check"] not in _CHECKS:
            raise core.EngineError("Choose an allowlisted read-only PowerShell inspection.")
        return {"check": args["check"]}
    if name in ("github.runner.status", "github.workflow.status"):
        if args:
            raise core.EngineError("Fixed GitHub read-only inspections take no arguments.")
        return {}
    if name in ("github.workflow.source_dispatch", "windows.source.verify"):
        if set(args) != {"expected_sha"} or not isinstance(args["expected_sha"], str):
            raise core.EngineError("Source execution requires the exact reviewed commit SHA.")
        sha = args["expected_sha"].lower()
        if not _COMMIT.fullmatch(sha):
            raise core.EngineError("Expected commit must be a 40-character SHA-1.")
        return {"expected_sha": sha}
    raise core.EngineError("Unknown operator tool; arbitrary commands are prohibited.")


def _powershell(check: str) -> dict:
    if os.name != "nt":
        raise core.EngineError("PowerShell inspection runs only on Windows.")
    script = _CHECKS[check]
    root = os.environ.get("SystemRoot") or "C:\\Windows"
    exe = Path(root) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"
    if not exe.is_file() or exe.is_symlink():
        raise core.EngineError("Trusted Windows PowerShell 5.1 executable unavailable.")
    try:
        proc = subprocess.run(
            [str(exe), "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
            encoding="utf-8", errors="replace", timeout=15, check=False
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise core.EngineError("Read-only Windows inspection failed or timed out.") from exc
    if proc.returncode != 0 or len(proc.stdout) > 6000:
        raise core.EngineError("Read-only Windows inspection did not complete cleanly.")
    try:
        result = json.loads(proc.stdout)
        if not isinstance(result, dict):
            raise ValueError("Expected object")
    except (ValueError, TypeError) as exc:
        raise core.EngineError("Windows inspection returned unrecognized JSON.") from exc
    return {"check": check, "result": result, "exit_code": 0,
            "read_only": True, "powershell_fixed_script": True}


def _gh(argv: list[str], *, timeout: int = 20) -> str:
    """Invoke fixed GitHub CLI argv, not an interpolated shell or agent script."""
    exe = shutil.which("gh")
    if not exe or not Path(exe).is_file():
        raise core.EngineError("GitHub CLI missing; install and authenticate 'gh' privately.")
    try:
        proc = subprocess.run(
            [exe, *argv], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, encoding="utf-8", errors="replace", timeout=timeout,
            stdin=subprocess.DEVNULL, check=False
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise core.EngineError("GitHub CLI request failed or timed out; outcome unverified.") from exc
    if proc.returncode != 0 or len(proc.stdout) > 60000:
        # Do not include stderr or full CLI environment (which may expose secrets).
        raise core.EngineError("GitHub CLI request failed or was too large; check gh auth and repository permissions.")
    return proc.stdout


def _github_json(endpoint: str) -> dict:
    try:
        data = json.loads(_gh(["api", "-X", "GET", endpoint]))
    except (ValueError, TypeError) as exc:
        raise core.EngineError("GitHub returned invalid API JSON.") from exc
    if not isinstance(data, dict):
        raise core.EngineError("GitHub returned unexpected API data.")
    return data


def _runner_status() -> dict:
    info = _github_json("repos/" + REPOSITORY + "/actions/runners?per_page=100")
    records = info.get("runners")
    if not isinstance(records, list):
        raise core.EngineError("Runner status not available with this GitHub permission scope.")
    out = []
    for runner in records[:100]:
        if not isinstance(runner, dict):
            continue
        labels = [item["name"] for item in runner.get("labels", [])
                  if isinstance(item, dict) and isinstance(item.get("name"), str)]
        out.append({"name": str(runner.get("name", ""))[:100],
                    "status": runner.get("status") if runner.get("status") in ("online", "offline") else "unknown",
                    "busy": runner.get("busy") if isinstance(runner.get("busy"), bool) else None,
                    "labels": labels[:30]})
    return {"repository": REPOSITORY, "runners": out,
            "provider_confirmed": True, "source": "authenticated-github-api",
            "note": "Read-only query; no runner registered or started."}


def _workflow_status() -> dict:
    url = ("repos/" + REPOSITORY + "/actions/workflows/" + WORKFLOW
           + "/runs?branch=" + REVIEW_BRANCH + "&per_page=5")
    info = _github_json(url)
    records = info.get("workflow_runs")
    if not isinstance(records, list):
        raise core.EngineError("Workflow status not available with this GitHub permission scope.")
    out = []
    for item in records[:5]:
        if not isinstance(item, dict):
            continue
        out.append({"id": item.get("id"), "status": item.get("status"),
                    "conclusion": item.get("conclusion"), "head_sha": item.get("head_sha"),
                    "url": item.get("html_url")})
    return {"repository": REPOSITORY, "workflow": WORKFLOW,
            "branch": REVIEW_BRANCH, "runs": out,
            "source": "authenticated-github-api"}


def _dispatch_source_only(expected_sha: str) -> dict:
    """Manual source-only workflow request, pinned by preflight check as far as API permits."""
    check = _github_json("repos/" + REPOSITORY + "/git/ref/heads/" + REVIEW_BRANCH)
    obj = check.get("object")
    observed = obj.get("sha", "") if isinstance(obj, dict) else ""
    if observed != expected_sha:
        raise core.EngineError("Reviewed branch HEAD changed; re-review before dispatch.")
    # CLI's workflow run uses a branch reference (not immutable); GitHub can
    # advance it after this check. Do not claim race-free immutable execution.
    _gh(["workflow", "run", WORKFLOW, "--repo", REPOSITORY,
         "--ref", REVIEW_BRANCH,
         "--field", "confirm_self_hosted=true",
         "--field", "build_unsigned_windows_candidate=false"], timeout=25)
    return {"dispatch_requested": True, "execution_confirmed": False,
            "repository": REPOSITORY, "branch": REVIEW_BRANCH,
            "workflow": WORKFLOW, "expected_sha": expected_sha,
            "unsigned_build_requested": False, "production_deploy_requested": False,
            "warning": "Dispatch is not a passed test. Verify actual run SHA and completion in GitHub."}


def execute(name: str, args: dict) -> dict:
    clean = normalize(name, args)
    if name == "windows.powershell.inspect":
        return _powershell(clean["check"])
    if name == "github.runner.status":
        return _runner_status()
    if name == "github.workflow.status":
        return _workflow_status()
    if name == "github.workflow.source_dispatch":
        return _dispatch_source_only(clean["expected_sha"])
    if name == "windows.source.verify":
        from engine import local_validation
        return local_validation.verify(clean["expected_sha"])
    raise core.EngineError("Unknown tool.")
