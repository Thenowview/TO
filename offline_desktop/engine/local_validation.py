"""Explicitly approved local source verification of a pinned, trusted Windows checkout.

No arbitrary commands, automatic checkout, package install, workflow dispatch,
build, merge, deploy, or mutable repository content selected by an AI model.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import subprocess
import time

from engine import core

_SHA = re.compile(r"^[a-f0-9]{40}$")
_MAX_SECONDS = 300
_MAX_REPORT_BYTES = 180000


def _trusted_root() -> Path:
    configured = os.getenv("THEORG_TRUSTED_REPO_DIR", "")
    if not configured or not Path(configured).is_absolute():
        raise core.EngineError("Set THEORG_TRUSTED_REPO_DIR to a trusted absolute local checkout.")
    root = Path(configured)
    if root.is_symlink():
        raise core.EngineError("Trusted checkout must not be a symlink.")
    root = root.resolve(strict=True)
    if not root.is_dir() or not (root / ".git").exists():
        raise core.EngineError("Trusted checkout must contain Git metadata.")
    script = root / "tools" / "Test-TheOrg-Source-Local.ps1"
    if not script.is_file() or script.is_symlink():
        raise core.EngineError("Trusted source-check script is absent or is a symlink.")
    return root


def _git(root: Path, *args: str) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args], stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, text=True, encoding="utf-8",
            errors="replace", stdin=subprocess.DEVNULL, timeout=12, check=False
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise core.EngineError("Trusted Git checkout inspection is unavailable.") from exc
    if result.returncode != 0 or len(result.stdout) > 500:
        raise core.EngineError("Git checkout inspection failed.")
    return result.stdout.strip()


def _checked_checkout(root: Path, expected_sha: str) -> None:
    toplevel = Path(_git(root, "rev-parse", "--show-toplevel")).resolve(strict=True)
    if toplevel != root:
        raise core.EngineError("Trusted checkout does not match its Git repository root.")
    actual_sha = _git(root, "rev-parse", "HEAD")
    if actual_sha != expected_sha:
        raise core.EngineError("Checkout commit differs from the approved SHA.")
    # Untracked source can be executed by discovery imports. Reject all dirty
    # files except generated reports under out/, which are non-source artifacts.
    changes = _git(root, "status", "--porcelain", "--untracked-files=all")
    for change in changes.splitlines():
        if change.startswith("?? ") and change[3:].replace("\\", "/").startswith("out/"):
            continue
        raise core.EngineError("Trusted checkout contains modified or untracked source; refuse execution.")


def _terminate_windows_tree(pid: int) -> None:
    """Best-effort clean-up for child processes after the bounded deadline."""
    windir = Path(os.environ.get("SystemRoot", "C:/Windows"))
    killer = windir / "System32" / "taskkill.exe"
    if os.name == "nt" and killer.is_file() and not killer.is_symlink():
        try:
            subprocess.run([str(killer), "/PID", str(pid), "/T", "/F"],
                           stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=12, check=False)
        except (OSError, subprocess.TimeoutExpired):
            pass


def _validated_report(report_path: Path, expected_sha: str, previous_mtime: int | None) -> list[dict]:
    if not report_path.is_file() or report_path.is_symlink():
        raise core.EngineError("Verification exited zero but no safe evidence report exists.")
    if (previous_mtime is not None and
            report_path.stat().st_mtime_ns == previous_mtime):
        raise core.EngineError("Verification evidence is stale; do not mark source tests passed.")
    if report_path.stat().st_size > _MAX_REPORT_BYTES:
        raise core.EngineError("Source verification evidence exceeds the accepted size.")
    try:
        report = json.loads(report_path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError, UnicodeError) as exc:
        raise core.EngineError("Source verification evidence is not valid UTF-8 JSON.") from exc
    if not isinstance(report, dict):
        raise core.EngineError("Source verification evidence must be a JSON object.")
    checks = report.get("checks")
    if (report.get("commit") != expected_sha or report.get("source_only") is not True
            or report.get("passed") is not True
            or report.get("deployment_performed") is not False
            or report.get("windows_executable_verified") is not False
            or not isinstance(checks, list) or len(checks) < 2
            or any(not isinstance(item, dict) or item.get("passed") is not True
                   for item in checks)):
        raise core.EngineError("Source verification did not produce complete pinned PASS evidence.")
    return checks


def verify(expected_sha: str) -> dict:
    """Run the fixed source-only script; return provider-neutral execution evidence."""
    if os.name != "nt":
        raise core.EngineError("Source verification requires Windows x64.")
    if type(expected_sha) is not str or not _SHA.fullmatch(expected_sha):
        raise core.EngineError("Expected SHA must be exactly 40 lowercase hex characters.")
    root = _trusted_root()
    _checked_checkout(root, expected_sha)
    ps = Path(os.getenv("SystemRoot", "C:/Windows")) / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"
    if not ps.is_file() or ps.is_symlink():
        raise core.EngineError("Official Windows PowerShell executable unavailable.")

    report_path = root / "out" / "source-verification" / "source-results.json"
    previous_mtime = report_path.stat().st_mtime_ns if report_path.is_file() else None
    script = root / "tools" / "Test-TheOrg-Source-Local.ps1"
    argv = [str(ps), "-NoLogo", "-NoProfile", "-NonInteractive",
            "-ExecutionPolicy", "RemoteSigned", "-File", str(script)]
    start = time.monotonic()
    # Ignore untrusted test stdout/stderr rather than persisting possible secrets.
    try:
        proc = subprocess.Popen(
            argv, cwd=str(root), stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        )
    except OSError as exc:
        raise core.EngineError("Could not start the approved local source verifier.") from exc
    try:
        code = proc.wait(timeout=_MAX_SECONDS)
    except subprocess.TimeoutExpired as exc:
        _terminate_windows_tree(proc.pid)
        try:
            proc.kill()
        except OSError:
            pass
        raise core.EngineError("Source verification timed out; child termination is best effort; inspect manually.") from exc

    duration = round(time.monotonic() - start, 2)
    if code != 0:
        return {
            "status": "failed", "exit_code": code, "duration_seconds": duration,
            "approved_sha": expected_sha, "source_tests_passed": False,
            "build_performed": False, "deployment_performed": False,
            "note": "Fixed source verifier exited nonzero; review the local out/source-verification/source-results.json. Output was suppressed to avoid credential disclosure."
        }
    _checked_checkout(root, expected_sha)  # Reject source modified during tests.
    checks = _validated_report(report_path, expected_sha, previous_mtime)
    return {
        "status": "passed", "exit_code": 0, "duration_seconds": duration,
        "approved_sha": expected_sha, "source_tests_passed": True,
        "number_of_checks": len(checks), "build_performed": False,
        "deployment_performed": False, "evidence_source": "local-checkout-report",
        "note": "Source tests passed. Windows build and real-provider E2E remain unverified."
    }
