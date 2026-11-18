# AO native bridge phase 1 — safe capability discovery

This change introduces a **disabled** AO handshake through the existing Chrome MV3 supervisor and Windows native messaging host. It does not enable MCP execution, load external extensions, add Chrome permissions, install binaries, or alter GIZE encrypted-file formats.

## Protocol

Extension-owned `chrome.runtime.sendMessage({command:"ao_capabilities"})` passes through `background.js` and `TaskManager.aoCapabilities()` to the existing `com.theorg.bridge` native messaging host. The host replies:

```json
{"ok":true,"protocolVersion":1,"integration":"AO","enabled":false,"status":"disabled_pending_authorization_and_contract_tests","tools":[],"executionSupported":false,"note":"Discovery handshake only. No MCP servers, commands or external tools are launched."}
```

The extension checks the response strictly. A missing/unavailable native host fails closed; extra tools, an enabled flag, or an unexpected protocol cause rejection. An `ao_execute` native command is unsupported and returns `unsupported_command`.

## Acceptance

- Native host builds for Windows/.NET 8 and original self-tests pass.
- `tests/native-messaging-smoke.py` verifies the handshake over actual length-framed stdio, lists `ao_capabilities`, and rejects `ao_execute`.
- Chrome manifest has **no new permissions** and `background.js` still only accepts messages from the extension's own ID.
- No vendor AGPL code is imported. The original third-party AO reference lives in the separate reviewed vendor PR #78.
- Enterprise authorization, MCP OAuth/SSRF, tenant isolation, negative tool tests, approvals and end-to-end customer release are **not** implemented here and remain blocked.

## Next phases (separate changes)

1. Reconcile versioned AO schemas from OT #79 with the present native-host task IDs and TEBE tenant principal contract; verify no inconsistent naming.
2. Add read-only curated catalog with statically configured tool descriptors and independent TEBE authorization, disabled by default.
3. Add bounded, audited execution only with approved credentials, per-tenant permission checks, guarded network destinations and detailed negative tests.
4. Complete Windows packaging, Chrome UI accessibility, locales and synthetic OT/TEBE integration tests.

No production merge or deployment is authorized by this change. Keep source-ID master acceptance NO_GO until independently verified.
