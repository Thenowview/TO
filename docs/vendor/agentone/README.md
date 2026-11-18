# AO — GIZE AI integration reference package

**Project-facing name:** AO. **Upstream identity:** AgentOne (retained only in legal attribution, original filename, original paths and provenance).

## Provenance

- Upstream project: https://github.com/The-Best-Codes/agent-one
- Source snapshot: `2c3754d527ba605f8490324f261f3c4b4c0e822b` (18 November 2026 inspection)
- Source URL pattern: `https://github.com/The-Best-Codes/agent-one/blob/2c3754d527ba605f8490324f261f3c4b4c0e822b/<path>`
- Original third-party license: [AGPL-3.0](./upstream/LICENSE), copied verbatim. Keep notices, attribution and source paths.
- Source files preserved without modification in `upstream/`; they are **reference-only**, not automatically compiled, installed, executed, published, or imported into GIZE.
- User-provided file: `AgentOne Installer.exe` (813,088 bytes; SHA-256 `7267252b31e3e388de9086269dd6be89e179f4fda1978afa6700149d1d367f5a`). Local static inspection reports Windows PE32 .NET bootstrapper with store/package-management strings, not a ZIP/source archive; it was **not executed** or extracted into source. Do not treat it as a signed, independently verified upstream distribution. The installer is **not** copied into the repository.
- The GIZE owner reports obtaining direct permission from the original upstream rights holder. Scope, written grant, holder's authority, sublicense/distribution permissions and commercial/private-source terms have **not** been independently checked. Until documented, handle copied source in this isolated AGPL-marked reference area and require a licensing decision before incorporation into distributed proprietary code. Do not assume the owner's permission cancels AGPL conditions.

## Pre-fetched files (no expert redownload)

These exact upstream files are copied in `upstream/` at the pinned commit:

| Path inside upstream | Purpose | Responsible GIZE expert |
|---|---|---|
| `LICENSE`, `README.md` | Attribution, terms, upstream feature/architecture context | All |
| `src/lib/ai/tools/approval.ts` | Tool-specific approval rules and UI state | OT/TEBE |
| `src/lib/ai/tools/auto-mode.ts` | Risk review and tool-call classification patterns | OT/TEBE |
| `src/lib/ai/tools/mcp/index.ts` | MCP transport, local process and HTTP client lifecycle | OT/TEBE |
| `src/lib/ai/tools/mcp/oauth.ts` | MCP auth and token-recovery patterns | OT/TEBE |
| `src/lib/extensions/install.ts`, `src/lib/extensions/manifest.ts` | Extension catalog, configuration and installation | OT |
| `src/lib/ai/tools/subAgent.ts` | Delegated specialist and context management | OT/TEBE |
| `src/lib/ai/tools/createScheduledAgent.ts` | Local scheduling interface | OT/TEBE |
| `src/lib/ai/tools/computerUseObserve.ts`, `computerUseAct.ts` | Observe/act interface | OT |
| `src/lib/ai/tools/executeCommand.ts` | Desktop command tool boundaries | OT |
| `src-tauri/src/computer_use/permissions.rs`, `actions.rs` | Native computer-use permissions/actions | OT |
| `src-tauri/capabilities/default.json` | Permission design *anti-pattern review*; **do not transplant broad host permissions** | Security reviewer |

Files may rely on other upstream dependencies; this is a curated engineering reference set, **not** a standalone build, binary installer or complete vendor codebase. If a needed dependency is missing, record the exact requested path in the master issue before extending the reference set.

## Required reading order

1. Read this file and [GIZE adoption plan](./GIZE-ADOPTION.md).
2. Read original `upstream/LICENSE` and note the explicit separate grant if provided by the owner.
3. Read only the modules for your assigned ownership.
4. Inspect existing GIZE code/PRs first; implement nonconflicting improvements rather than blindly copying vendor internals.
5. Report source ID → GIZE path → PR SHA → tests → security result → release evidence to the canonical issues.

## Key safety distinctions

The upstream desktop Tauri application is **not** a Chrome extension. GIZE OT already has an MV3 extension and native-message bridge; preserve them. An MCP "extension" is a tool server, not a Chromium extension. Neither a model's approval verdict nor a user-facing "auto" switch replaces TEBE tenant policy, cryptographic authorization, deterministic allowlists or required production-release approval.

No routine integration step should turn on unlimited shell/filesystem access, mount production customer data, install arbitrary MCP packages, or change the current GAIZ1/GAIZ2 wire format.
