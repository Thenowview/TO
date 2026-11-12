"""Optional, read-only Google Workspace connectivity probes on local Windows.

OAuth access tokens must be provisioned separately in Windows Credential
Manager; this module never creates, refreshes, displays, commits, or logs them.
A successful probe proves only an authorized read of one fixed provider endpoint.
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request

from engine import core

# Fixed provider, scopes, credential targets and endpoints. No caller URLs.
_PROBES = {
    "gmail": {
        "target": "TheOrg/google/gmail-readonly",
        "url": "https://gmail.googleapis.com/gmail/v1/users/me/labels",
        "scope": "https://www.googleapis.com/auth/gmail.labels",
    },
    "drive": {
        "target": "TheOrg/google/drive-readonly",
        "url": "https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id)",
        "scope": "https://www.googleapis.com/auth/drive.metadata.readonly",
    },
    "calendar": {
        "target": "TheOrg/google/calendar-readonly",
        "url": "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1&fields=items(id)",
        "scope": "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    },
}
_TOKEN = re.compile(r"^[A-Za-z0-9._~+/-]{20,4096}$")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def catalog() -> list[dict]:
    return [{"provider": name, "scope": p["scope"],
             "credential_target": p["target"], "operation": "connection_read_probe",
             "configured": None, "connected": None,
             "status": "not_verified",
             "note": "Credential presence and actual provider access require an explicit approved probe."}
            for name,p in _PROBES.items()]


def normalize(provider: str) -> str:
    if type(provider) is not str or provider not in _PROBES:
        raise core.EngineError("Only Gmail, Drive and Calendar read-only probes are available.")
    return provider


def _read_windows_credential(target: str) -> str:
    if os.name != "nt":
        raise core.EngineError("Google credential probe requires Windows Credential Manager.")
    import ctypes
    from ctypes import wintypes

    class FILETIME(ctypes.Structure):
        _fields_ = [("low", wintypes.DWORD), ("high", wintypes.DWORD)]
    class CREDENTIALW(ctypes.Structure):
        _fields_ = [
            ("Flags", wintypes.DWORD), ("Type", wintypes.DWORD),
            ("TargetName", wintypes.LPWSTR), ("Comment", wintypes.LPWSTR),
            ("LastWritten", FILETIME), ("CredentialBlobSize", wintypes.DWORD),
            ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
            ("Persist", wintypes.DWORD), ("AttributeCount", wintypes.DWORD),
            ("Attributes", ctypes.c_void_p), ("TargetAlias", wintypes.LPWSTR),
            ("UserName", wintypes.LPWSTR)
        ]
    advapi = ctypes.WinDLL("Advapi32", use_last_error=True)
    advapi.CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                                 ctypes.POINTER(ctypes.POINTER(CREDENTIALW))]
    advapi.CredReadW.restype = wintypes.BOOL
    advapi.CredFree.argtypes = [ctypes.c_void_p]
    advapi.CredFree.restype = None
    ptr = ctypes.POINTER(CREDENTIALW)()
    if not advapi.CredReadW(target, 1, 0, ctypes.byref(ptr)):
        raise core.EngineError("Read-only Google credential not provisioned or unavailable.")
    try:
        credential = ptr.contents
        size = credential.CredentialBlobSize
        if not 20 <= size <= 8192 or not credential.CredentialBlob:
            raise core.EngineError("Windows Credential Manager token has an invalid length.")
        raw = ctypes.string_at(credential.CredentialBlob, size)
        # cmdkey often stores text as UTF-16LE; custom credential writers may
        # store ASCII UTF-8. Neither representation is ever persisted here.
        if len(raw) % 2 == 0 and raw[1::2].count(0) >= len(raw) // 4:
            token = raw.decode("utf-16-le")
        else:
            token = raw.decode("utf-8")
        token = token.strip("\x00")
        if not _TOKEN.fullmatch(token):
            raise core.EngineError("Credential is not a supported OAuth bearer token.")
        return token
    except (UnicodeError, ValueError) as exc:
        raise core.EngineError("Windows Credential Manager token encoding is invalid.") from exc
    finally:
        advapi.CredFree(ptr)


def probe(provider: str) -> dict:
    """Provider-confirmed, bounded GET only; never return record content."""
    provider = normalize(provider)
    descriptor = _PROBES[provider]
    token = _read_windows_credential(descriptor["target"])
    req = urllib.request.Request(
        descriptor["url"], method="GET",
        headers={"Authorization": "Bearer " + token,
                 "Accept": "application/json",
                 "User-Agent": "TheOrg-local-readonly-health/1"}
    )
    opener = urllib.request.build_opener(_NoRedirect())
    try:
        with opener.open(req, timeout=12) as response:
            status = response.status
            if status != 200:
                raise core.EngineError("Google provider probe did not return HTTP 200.")
            data = response.read(32769)
            if len(data) > 32768:
                raise core.EngineError("Google provider probe response exceeds the accepted limit.")
            try:
                parsed = json.loads(data.decode("utf-8"))
            except (ValueError, UnicodeError) as exc:
                raise core.EngineError("Google provider returned invalid response JSON.") from exc
            if not isinstance(parsed, dict):
                raise core.EngineError("Google provider response must be a JSON object.")
            expected_key = {"gmail":"labels", "drive":"files", "calendar":"items"}[provider]
            if not isinstance(parsed.get(expected_key), list):
                raise core.EngineError("Google provider did not return the expected read-only resource shape.")
    except urllib.error.HTTPError as exc:
        # Do not include server response bodies, URL, authorization or tokens.
        raise core.EngineError("Google provider rejected read-only authentication or scope (HTTP " +
                               str(exc.code) + ").") from None
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise core.EngineError("Google provider is unreachable; no authorization is confirmed.") from None
    return {
        "provider": provider, "connected": True,
        "read_probe_verified": True, "http_status": 200,
        "credential_target": descriptor["target"],
        "requested_scope": descriptor["scope"],
        "source": "provider-HTTPS-readonly",
        "record_content_returned": False, "external_write_performed": False,
        "note": "A successful fixed read confirms current token access; other scopes and actions remain unverified."
    }
