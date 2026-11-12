"""Bounded Windows top-level window inventory and guarded focus control.

Uses Windows user32 APIs; no arbitrary shell, keystroke injection, screenshots,
process execution, credential access, or persistent privilege changes.
"""
from __future__ import annotations

import hashlib
import os
import re

from engine import core

_MAX_WINDOWS = 40
_TITLE_LIMIT = 150
_HEX_SHA256 = re.compile(r"^[0-9a-f]{64}$")


def _enumerate() -> list[dict]:
    """Query visible, titled top-level Windows only; never inspect text fields."""
    if os.name != "nt":
        raise core.EngineError("Windows UI inventory requires a local Windows session.")
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.WinDLL("user32", use_last_error=True)
    user32.EnumWindows.argtypes = [ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM), wintypes.LPARAM]
    user32.EnumWindows.restype = wintypes.BOOL
    user32.IsWindowVisible.argtypes = [wintypes.HWND]
    user32.IsWindowVisible.restype = wintypes.BOOL
    user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
    user32.GetWindowTextLengthW.restype = ctypes.c_int
    user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
    user32.GetWindowTextW.restype = ctypes.c_int
    user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    user32.GetWindowThreadProcessId.restype = wintypes.DWORD
    found: list[dict] = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def callback(hwnd, _):
        if len(found) >= _MAX_WINDOWS:
            return False
        if not user32.IsWindowVisible(hwnd):
            return True
        length = user32.GetWindowTextLengthW(hwnd)
        if length <= 0:
            return True
        buffer = ctypes.create_unicode_buffer(min(length, _TITLE_LIMIT) + 1)
        copied = user32.GetWindowTextW(hwnd, buffer, len(buffer))
        if copied <= 0:
            return True
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        title = buffer.value[:_TITLE_LIMIT].strip()
        if title and pid.value > 0:
            found.append({
                "hwnd": int(hwnd), "pid": int(pid.value),
                "title": title,
                "title_sha256": hashlib.sha256(title.encode("utf-8", errors="replace")).hexdigest(),
            })
        return True

    # False may mean the callback voluntarily stopped after reaching the cap.
    if not user32.EnumWindows(callback, 0) and len(found) < _MAX_WINDOWS:
        raise core.EngineError("Win32 visible-window enumeration failed.")
    return found


def inspect() -> dict:
    entries = _enumerate()
    return {
        "windows": entries, "count": len(entries), "truncated": len(entries) >= _MAX_WINDOWS,
        "source": "local-user32-visible-top-level-windows",
        "focus_performed": False, "input_sent": False,
        "note": "Window titles may contain personal information; no screenshot or window content was read."
    }


def normalize_focus(args: dict) -> dict:
    if type(args) is not dict or set(args) != {"hwnd", "pid", "title_sha256"}:
        raise core.EngineError("Focus requires exact hwnd, pid and inspected title digest.")
    hwnd, pid, digest = args["hwnd"], args["pid"], args["title_sha256"]
    if (type(hwnd) is not int or hwnd <= 0 or hwnd > 2**64-1 or
            type(pid) is not int or pid <= 0 or pid > 2**32-1 or
            type(digest) is not str or not _HEX_SHA256.fullmatch(digest)):
        raise core.EngineError("Malformed window identity; re-inspect and select a visible window.")
    return {"hwnd": hwnd, "pid": pid, "title_sha256": digest}


def focus(args: dict) -> dict:
    target = normalize_focus(args)
    if os.name != "nt":
        raise core.EngineError("Window focus requires a local Windows session.")
    matching = [w for w in _enumerate() if all(
        w[k] == target[k] for k in ("hwnd", "pid", "title_sha256"))]
    if len(matching) != 1:
        raise core.EngineError("Window changed or is not visible; approve a fresh inventory.")
    import ctypes
    from ctypes import wintypes
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    user32.SetForegroundWindow.argtypes = [wintypes.HWND]
    user32.SetForegroundWindow.restype = wintypes.BOOL
    user32.GetForegroundWindow.argtypes = []
    user32.GetForegroundWindow.restype = wintypes.HWND
    # Windows may deny background focus; return actual observed state.
    accepted = bool(user32.SetForegroundWindow(target["hwnd"]))
    observed = int(user32.GetForegroundWindow() or 0)
    return {
        "requested_hwnd": target["hwnd"], "pid": target["pid"],
        "focus_confirmed": accepted and observed == target["hwnd"],
        "observed_foreground_hwnd": observed,
        "input_sent": False, "source": "local-user32-foreground-verification",
        "note": "No keyboard, mouse, or privileged input was sent."
    }
