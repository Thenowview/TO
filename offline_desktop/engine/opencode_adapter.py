"""TheOrg optional OpenCode CLI adapter. Never downloads a runtime or executes unapproved work.

OpenCode is a separate, user-installed coding agent. This module invokes its
documented headless CLI using a limited project copy and an explicit permission
policy. OpenCode is NOT an OS sandbox: use a VM for adversarial/untrusted code.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import signal
import shutil
import subprocess
import tempfile
import threading
import time
from typing import Any

from engine import core

SUPPORTED = {".py", ".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".json",
             ".html", ".css", ".md", ".txt", ".toml", ".yaml", ".yml", ".gitignore"}
IGNORED_DIRS = {".git", ".opencode", ".github", "node_modules", "dist", "build", "venv",
                ".venv", "__pycache__", "out", "models", "secrets", "data", "private"}
MAX_FILES = 240
MAX_BYTES = 8 * 1024 * 1024
MAX_FILE = 256 * 1024
MAX_OUTPUT = 100_000
MAX_SECONDS = 300
SAFE_MODEL = re.compile(r"^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_./:-]+$")
SAFE_NAME = re.compile(r"^[A-Za-z][A-Za-z0-9_.-]{0,70}$")


def _safe_file(rel: Path) -> bool:
    if any(part.lower() in IGNORED_DIRS or part.startswith(".") and part != ".gitignore"
           for part in rel.parts):
        return False
    if rel.suffix.lower() not in SUPPORTED:
        return False
    if rel.name.lower() in {"opencode.json", "opencode.jsonc", ".env", "credentials.json",
                            "id_rsa", "id_ed25519"}:
        return False
    if "secret" in rel.name.lower() or "credential" in rel.name.lower() or "token" in rel.name.lower():
        return False
    return True


def _digest_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for data in iter(lambda: handle.read(128 * 1024), b""):
            h.update(data)
    return h.hexdigest()


def manifest(base: Path) -> dict[str, str]:
    """Calculate a bounded result inventory, rejecting links and large/unexpected files."""
    result = {}
    total = 0
    for folder, dirs, files in os.walk(base, topdown=True, followlinks=False):
        root = Path(folder)
        # Prune excluded trees instead of traversing node_modules or model archives.
        if any((root / d).is_symlink() for d in dirs):
            raise core.EngineError("Symlink directory found; use a safe project copy.")
        dirs[:] = [d for d in dirs if d.lower() not in IGNORED_DIRS and not d.startswith(".")]
        for name in sorted(files):
            path = root / name
            rel = path.relative_to(base)
            if path.is_symlink():
                raise core.EngineError("Unsafe symlink encountered in the staged workspace.")
            if not _safe_file(rel):
                continue
            if len(result) >= MAX_FILES or path.stat().st_size > MAX_FILE:
                raise core.EngineError("Project file limit exceeded.")
            total += path.stat().st_size
            if total > MAX_BYTES:
                raise core.EngineError("Project size limit exceeded.")
            result[rel.as_posix()] = _digest_file(path)
    return result


def make_copy(source: Path, destination: Path) -> dict[str, str]:
    """Copy only allowed text source into an isolated, new folder."""
    source = source.resolve(strict=True)
    if not source.is_dir() or destination.exists():
        raise core.EngineError("Invalid or reused execution workspace.")
    source_files = manifest(source)
    destination.mkdir(parents=True, exist_ok=False)
    for rel in source_files:
        target = destination / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / rel, target)
    return source_files


def _policy(edit: bool) -> dict[str, Any]:
    # OpenCode V2 ordered permission rules. Last matching rule takes priority.
    # This denies shell/network/subagents/code-mode and all external directories.
    rules = [{"action": "*", "resource": "*", "effect": "deny"}]
    rules += [{"action": action, "resource": "*", "effect": "allow"}
              for action in ("read", "glob", "grep", "list")]
    if edit:
        rules.append({"action": "edit", "resource": "*", "effect": "allow"})
    rules += [
        {"action": "external_directory", "resource": "*", "effect": "deny"},
        {"action": "shell", "resource": "*", "effect": "deny"},
        {"action": "execute", "resource": "*", "effect": "deny"},
        {"action": "subagent", "resource": "*", "effect": "deny"},
        {"action": "webfetch", "resource": "*", "effect": "deny"},
        {"action": "websearch", "resource": "*", "effect": "deny"},
        {"action": "skill", "resource": "*", "effect": "deny"},
    ]
    return {
        "$schema": "https://opencode.ai/config.json",
        "autoupdate": False,
        "permissions": rules,
        "default_agent": "build" if edit else "plan",
        "mcp": {},
        "subagent_depth": 0,
    }


def _binary() -> str:
    override = os.getenv("THEORG_OPENCODE_BIN", "").strip()
    path = Path(override) if override else None
    bundled = core.BASE / "opencode" / ("opencode.exe" if os.name == "nt" else "opencode")
    if path and not path.is_file():
        raise core.EngineError("Configured OpenCode executable does not exist.")
    executable = (str(path.resolve()) if path else
                  str(bundled) if bundled.is_file() else shutil.which("opencode"))
    if not executable:
        raise core.EngineError("OpenCode CLI missing. Install OpenCode separately and verify 'opencode --version'.")
    return executable


def _require_v2(executable: str) -> str:
    """Fail closed: V1 ignores TheOrg's required ordered V2 permission policy."""
    try:
        proc = subprocess.run([executable, "--version"], capture_output=True, text=True,
                              timeout=10, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise core.EngineError("Unable to verify the OpenCode V2 CLI version.") from exc
    version = (proc.stdout or proc.stderr).strip()[:150]
    if proc.returncode != 0 or not re.search(r"(?<![\\d.])v?2\\.\\d+\\.\\d+(?:[-+][A-Za-z0-9.-]+)?(?!\\d)", version):
        raise core.EngineError("TheOrg requires OpenCode V2 with ordered permissions; installed CLI was not verified as V2.")
    return version


def installed() -> dict:
    try:
        exe = _binary()
        version = _require_v2(exe)
        return {"available": True, "compatible_v2": True,
                "version": version[:100], "executable": exe,
                "mode": "opt-in-external-runtime"}
    except core.EngineError as exc:
        return {"available": False, "compatible_v2": False,
                "reason": str(exc)[:200], "mode": "opt-in-external-runtime"}


def _stop_process_tree(proc: subprocess.Popen) -> None:
    """Best-effort termination of the agent and descendants after timeout."""
    if os.name == "nt":
        try:
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           timeout=8, check=False)
        except (OSError, subprocess.TimeoutExpired):
            pass
    else:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
    if proc.poll() is None:
        proc.kill()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass


def run(staged: Path, instruction: str, *, edit: bool, model: str,
        allow_provider_transfer: bool, deadline_seconds: int = 180,
        cancel_event: threading.Event | None = None) -> dict:
    """Run only after app-side explicit authorization, never automatically.

    Any provider may receive project context. An authorized user must explicitly
    consent to external-provider transfer before this function is called.
    """
    if allow_provider_transfer is not True:
        raise core.EngineError("Explicit AI provider data-transfer approval is required.")
    if type(instruction) is not str or not 5 <= len(instruction.strip()) <= 8500:
        raise core.EngineError("Invalid bounded task instruction.")
    if not isinstance(model, str) or not SAFE_MODEL.fullmatch(model):
        raise core.EngineError("Choose an explicit provider/model identifier.")
    if type(deadline_seconds) is not int or not 20 <= deadline_seconds <= MAX_SECONDS:
        raise core.EngineError("Execution timeout outside permitted bounds.")
    if cancel_event is not None and cancel_event.is_set():
        raise core.EngineError("OpenCode execution cancelled before launch.")
    if not staged.is_dir() or staged.is_symlink():
        raise core.EngineError("Staged source directory missing.")
    # An overwrite of an existing global project config must not loosen policy.
    exe = _binary()
    _require_v2(exe)
    config = _policy(edit)
    policy_path = staged / "opencode.json"
    if policy_path.exists():
        raise core.EngineError("Refusing an existing OpenCode configuration in worktree.")
    policy_path.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    original = manifest(staged)
    env = {}
    # Avoid passing CI tokens and provider API secrets from the parent process.
    for name in ("PATH", "SystemRoot", "WINDIR", "COMSPEC", "TEMP", "TMP", "HOME",
                 "USERPROFILE", "APPDATA", "LOCALAPPDATA", "XDG_CONFIG_HOME",
                 "XDG_DATA_HOME", "LANG"):
        if name in os.environ:
            env[name] = os.environ[name]
    env["OPENCODE_CONFIG_CONTENT"] = json.dumps(config, separators=(",", ":"))
    env["CI"] = "1"
    env["NO_COLOR"] = "1"
    agent = "build" if edit else "plan"
    prompt = ("TheOrg authorized task; this is a separate copy of approved project files.\n"
              "Stay inside this folder. Never run shell, network tools, subagents, or read "
              "private external files. Report exact changes and limitations. Do not claim "
              "tests ran unless tool output proves it.\n"
              + instruction.strip())
    argv = [exe, "run", "--format", "json", "--agent", agent, "--model", model, prompt]
    try:
        with tempfile.TemporaryFile(mode="w+b") as log:
            kwargs = ({"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt"
                      else {"start_new_session": True})
            proc = subprocess.Popen(argv, cwd=str(staged), env=env, stdin=subprocess.DEVNULL,
                                    stdout=log, stderr=subprocess.STDOUT, **kwargs)
            deadline = time.monotonic() + deadline_seconds
            while True:
                if cancel_event is not None and cancel_event.is_set():
                    _stop_process_tree(proc)
                    raise core.EngineError("OpenCode execution cancelled by owner; process tree termination requested.")
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    _stop_process_tree(proc)
                    raise core.EngineError("OpenCode timed out; process tree terminated on a best-effort basis; work remains unverified.")
                try:
                    exit_code = proc.wait(timeout=min(0.5, remaining))
                    break
                except subprocess.TimeoutExpired:
                    continue
            log.seek(0, 2)
            length = log.tell()
            log.seek(max(0, length - MAX_OUTPUT))
            raw = log.read(MAX_OUTPUT).decode("utf-8", "replace")
    except (OSError, ValueError) as exc:
        raise core.EngineError("OpenCode could not launch: " + str(exc)[:180]) from exc
    finally:
        # Never include policy file as a deliverable.
        policy_path.unlink(missing_ok=True)
    after = manifest(staged)
    unexpected = []
    for folder, dirs, files in os.walk(staged, topdown=True, followlinks=False):
        base = Path(folder)
        for d in dirs:
            if (base / d).is_symlink():
                unexpected.append(str((base / d).relative_to(staged)))
        for name in files:
            path = base / name
            rel = path.relative_to(staged)
            if path.is_symlink() or not _safe_file(rel):
                unexpected.append(rel.as_posix())
    changes = [{"path": key, "before": original.get(key), "after": after.get(key)}
               for key in sorted(original.keys() | after.keys()) if original.get(key) != after.get(key)]
    messages = []
    provider_errors = []
    for line in raw.splitlines():
        try:
            event = json.loads(line)
            part = event.get("part", {}) if isinstance(event, dict) else {}
            if isinstance(event, dict) and (event.get("type") == "error" or
                                             (isinstance(part, dict) and part.get("type") == "error")):
                provider_errors.append("OpenCode reported an error event.")
            if isinstance(part, dict) and part.get("type") == "text":
                text = part.get("text", "")
                if isinstance(text, str) and text:
                    messages.append(text[:8000])
        except (json.JSONDecodeError, TypeError):
            continue
    summary = "\n".join(messages)[-10000:] if messages else raw[-3500:]
    safety_findings = []
    if unexpected:
        safety_findings.append("New unapproved files or symlinks detected in execution copy.")
    if not edit and changes:
        safety_findings.append("Read-only agent changed copied project files.")
    if provider_errors:
        safety_findings.append("OpenCode emitted structured error events.")
    clean = exit_code == 0 and not safety_findings
    after_digest = hashlib.sha256(json.dumps(after, sort_keys=True).encode()).hexdigest()
    return {"engine": "opencode", "status": "submitted_for_qa" if clean else "failed",
            "exit_code": exit_code, "agent": agent, "model": model,
            "changed_files": changes[:60], "changed_count": len(changes),
            "unexpected_files": unexpected[:60],
            "safety_findings": safety_findings,
            "provider_error_event_count": len(provider_errors),
            "final_manifest_sha256": after_digest,
            "summary": summary, "output_bytes": length,
            "structural_only": True, "independent_qa_passed": False,
            "sandboxed": False, "external_provider_transfer": True}
