"""Approved interactive GitHub runner lifecycle for the user's own Windows PC.

Runs only existing, locally installed GitHub Actions runner scripts in a visible
console. Registration token entry stays inside that console: not in args, logs,
SQLite, model prompts, or API requests. No downloads, installation, elevated
privileges, GitHub billing changes, workflow dispatch, merge or deployment.
"""
from __future__ import annotations

import os
from pathlib import Path
import subprocess

from engine import core

REPO_URL = "https://github.com/faisalwrokksa-hub/TO"
LABEL = "theorg-win"
LOCATIONS = ("user_downloads", "system_root")


def _root(location: str) -> Path:
    if location not in LOCATIONS:
        raise core.EngineError("Only fixed, known runner installation locations are accepted.")
    if os.name != "nt":
        raise core.EngineError("GitHub runner console control requires Windows.")
    root = (Path.home() / "Downloads" / "actions-runner"
            if location == "user_downloads" else Path("C:/actions-runner"))
    if root.is_symlink() or not root.is_dir():
        raise core.EngineError("Runner root missing or redirected through a symlink.")
    from engine import capabilities
    info = capabilities._runner_probe(root)
    if not info["installation_complete"]:
        raise core.EngineError("Runner installation files are incomplete.")
    return root


def _spawn_console(root: Path, script_name: str, args: list[str]) -> int:
    if script_name not in ("config.cmd", "run.cmd"):
        raise core.EngineError("Only official local runner entry-point names are allowed.")
    target = root / script_name
    if not target.is_file() or target.is_symlink():
        raise core.EngineError("Runner entry-point is not a regular file.")
    cmd = Path(os.environ.get("SystemRoot", "C:/Windows")) / "System32" / "cmd.exe"
    if not cmd.is_file() or cmd.is_symlink():
        raise core.EngineError("Trusted Windows command interpreter unavailable.")
    try:
        proc = subprocess.Popen(
            [str(cmd), "/k", script_name, *args], cwd=str(root),
            stdin=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NEW_CONSOLE,
            close_fds=True
        )
    except OSError as exc:
        raise core.EngineError("Could not open the approved runner console.") from exc
    return proc.pid


def registration_prompt(location: str) -> dict:
    """Open a visible registration wizard; owner enters token privately."""
    root = _root(location)
    if (root / ".runner").exists():
        raise core.EngineError("Runner registration marker exists; do not register twice.")
    pid = _spawn_console(root, "config.cmd", [
        "--url", REPO_URL, "--labels", LABEL
    ])
    return {
        "console_process_started": True,
        "pid": pid,
        "operation": "interactive_runner_registration",
        "registration_confirmed": False,
        "runner_online": None,
        "credential_handling": "Enter fresh GitHub token directly into the visible console; never into TheOrg.",
        "status_source": "process-spawn-only"
    }


def start_registered(location: str) -> dict:
    """Open run.cmd; actual Online status must be verified via GitHub API."""
    root = _root(location)
    marker = root / ".runner"
    if not marker.is_file() or marker.is_symlink():
        raise core.EngineError("Runner registration has not been confirmed locally.")
    pid = _spawn_console(root, "run.cmd", [])
    return {
        "console_process_started": True,
        "pid": pid,
        "operation": "start_registered_runner",
        "runner_online": None,
        "status_source": "process-spawn-only",
        "warning": "A launched console is not proof the runner is Online. Verify through authenticated GitHub API."
    }
