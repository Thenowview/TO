"""Resolve the bridge's Windows workspace without trusting LOCALAPPDATA overrides."""
import ctypes
from ctypes import wintypes
import os
from pathlib import Path


def bridge_workspace():
    # The .NET host uses Environment.SpecialFolder.LocalApplicationData, not the
    # process environment variable. Never silently fall back to a different root.
    if os.name != "nt":
        raise RuntimeError("Windows native-host smoke tests require Windows")
    shell = ctypes.WinDLL("shell32", use_last_error=True)
    resolve = shell.SHGetFolderPathW
    resolve.argtypes = [wintypes.HWND, ctypes.c_int, wintypes.HANDLE,
                        wintypes.DWORD, wintypes.LPWSTR]
    resolve.restype = ctypes.c_long
    buffer = ctypes.create_unicode_buffer(32768)
    # CSIDL_LOCAL_APPDATA; current user; SHGFP_TYPE_CURRENT. This only reads.
    result = resolve(None, 0x001C, None, 0, buffer)
    if result != 0:
        raise OSError(f"Windows LocalApplicationData lookup failed: {result}")
    local = Path(buffer.value)
    if not local.is_absolute() or not local.is_dir():
        raise RuntimeError("Windows returned an invalid LocalApplicationData folder")
    return local / "TheOrg" / "workspace"
