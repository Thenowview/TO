# AO integration evidence — GIZE OT / Chrome + Windows

**Date:** 2026-11-18 (UTC)  
**Source master:** [Theepmo-ref2.md](../gize-sources/Theepmo-ref2.md)  
**AO source and provenance:** [pinned reference README](./vendor/agentone/README.md) · [adoption contract](./vendor/agentone/GIZE-ADOPTION.md)  
**Live review branches:** [AO PR #82](https://github.com/faisalwrokksa-hub/TO/pull/82) · [OT GIZE PR #73](https://github.com/faisalwrokksa-hub/TO/pull/73)

This is a **separate AO pattern register**, not extra completed requirements or a new denominator for the original 78 OT / 150 master source IDs. Allowed states: REFERENCE_ONLY, SPECIFIED, IMPLEMENTED_UNVERIFIED, VERIFIED, BLOCKED. A passing developer CI suite alone cannot certify production AO integration.

| AO item | Related source IDs | Evidence and actual boundary | Status | Remaining acceptance |
|---|---|---|---|---|
| AO-OT-01 Pinned upstream reference and license | GOV/REL evidence, PC-04 | Main merged pinned AO/AgentOne source references in PR #78. Copied AGPL-3.0 license preserved; separate written commercial grant unverified. Never run supplied installer for source extraction. | REFERENCE_ONLY | Independent legal/distribution rights, exact pin, threat model |
| AO-OT-02 Existing Chrome/native inventory | PC-03, PC-04, PC-05, PC-07 | Inspected MV3 background, task-manager, native-message host, SQLite agent engine and Windows installer workflow. Chrome Supervisor now displays native tool risk/scope via inert `textContent`, including unavailable/unknown-tool warnings; worker receives no shell or file privilege. UI contract regression added. | IMPLEMENTED_UNVERIFIED | Exact-head UI CI, browser origin/extension identity tests, manual Windows GUI acceptance |
| AO-OT-03 Versioned closed native capability catalog | PC-05, PC-07, PC-09 | PR #82 adds `ao.local.tools.v1` descriptors for exactly 6 existing tools. Each requires owner approval; consequential actions excluded from safe batch; MCP and remote execution flags false. C# self-test added. | IMPLEMENTED_UNVERIFIED | Exact-head Windows CI (first attempt exposed C# self-test variable shadowing, corrected), contract review, tool-scope and risk-class negative tests |
| AO-OT-04 Persistent local agent approval and recovery | PC-05, TASK-01, TASK-02, TASK-04, TASK-09 | Existing SQLite jobs, explicit approval, no automatic replay and independent QA checks. PR #73 adds real multi-process Native Messaging synthetic approval/batch/tenant tests. | IMPLEMENTED_UNVERIFIED | Final PR #73 exact-head CI; cancel/race/crash tests, real browser evidence |
| AO-OT-05 Curated MCP transport / OAuth / key custody | PC-04, PC-07, PC-08, SYNC-01 | **No MCP connection is enabled in AO PR #82.** No arbitrary MCP server/tool, command execution, token storage, outbound OAuth or broad browser permissions are introduced. | REFERENCE_ONLY | Versioned OT/TEBE connector contract, allowlisted server and audience, credential/OS custody, SSRF/replay tests, security review |
| AO-OT-06 Computer-use on Windows | PC-04, PC-06, PC-07, PC-10 | Current native tools are restricted to existing notes/read-only diagnostics, reviewed HTTPS navigation and explicit Notepad launch. Upstream broad Tauri permission definitions are **not** adopted. | REFERENCE_ONLY | Least-privilege per-action Windows APIs, session approval, denial tests, GUI accessibility |
| AO-OT-07 Offline/online and tenant boundary | PC-01, PC-08, TASK-06, TASK-08, TASK-10 | Local deterministic actions require no enterprise sign-in; existing Native Messaging synthetic company isolation tests do not prove live authenticated TEBE tenant/RLS. | SPECIFIED | Connected TEBE contract, revoked tenant/session, offline reconnection, secrets and audit acceptance |
| AO-OT-08 Installer, signing, UX, languages | WIN-01–WIN-09, LOC-04, OPS-06 | OT candidate CI builds are unsigned previews, not a signed customer migration or every-language validation. | BLOCKED | Historical source package, signed installer, real Windows lifecycle and locale/RTL checks, production readback |

## Safe auto-merge policy

Routine reversible implementation and testing may proceed under owner approval, with optional review waived on the owner's updated instruction. Never bypass GitHub-enforced protections or failed CI. This catalog-only change does not enable AO execution; production signing, real-device acceptance and final release authorization remain separate gates. Auto-merge does not mean deploy; no production deployment is configured here. Preserve open branches until explicitly approved cleanup.

## Active implementation evidence — current batch

- Native tool catalog and safety assertions: `engine/bridge/LocalAgentEngine.cs`, `engine/bridge/Program.cs`.
- Chrome review disclosure: `apps/chrome-extension/home.js` and `tests/ui-contract.test.cjs`; no additional extension permissions or active MCP.
- Earlier Windows CI [run #44389653618](https://github.com/faisalwrokksa-hub/TO/actions/runs/44389653618) failed compiling a **new self-test** because of C# local-variable shadowing; corrected in [commit 1e6d355](https://github.com/faisalwrokksa-hub/TO/commit/1e6d355e308a6df3948883af7790ceb9133c177b). Do not claim the corrected build passed until an exact-head run completes.
- Four AO-branch workflows adopt existing PR-only superseded-run cancellation, preserving main-push builds. Status of the newest exact-head run and required independent review determine PR merge eligibility; not the existence of a successful run on an older commit.

## Open severity / evidence gaps

- **P0** — Commercial/vendor reference permission scope and independent cryptographic/security review not yet verified.
- **P0** — Production signing, tenant-authorized AO remote/tool execution, and storage/key custody not accepted; remote MCP remains disabled.
- **P1** — Real Chrome extension/native messaging origin and Windows install/migrate/rollback GUI acceptance lacking.
- **P1** — OT→TEBE versioned AO tool/approval/trace schema, all-locale UI and cross-tenant end-to-end results missing.
- **P1** — Source ZIP ownership/integrity and separate OT handoff still require owner-provided durable access.

No blanket PASS, production readiness, deployment, arbitrary tool access, or AI-driven automatic approval is claimed.


## Integration reconciliation — 2026-11-19

OT PRs [#73](https://github.com/faisalwrokksa-hub/TO/pull/73), [#75](https://github.com/faisalwrokksa-hub/TO/pull/75), [#79](https://github.com/faisalwrokksa-hub/TO/pull/79), [#80](https://github.com/faisalwrokksa-hub/TO/pull/80) and [#81](https://github.com/faisalwrokksa-hub/TO/pull/81) have merged to main with CI evidence. Earlier notes are dated snapshots. PR #82 adds catalog and UI *descriptions*, not permission grants. Re-run exact-commit bridge/Windows and Chromium CI after reconciliation. Leave AO MCP/remote execution disabled and production gate NO_GO until security and hardware acceptance are demonstrated.


## Native enforcement candidate — 2026-11-19

PR #82 now also binds approval to an exact plan and host scope, rejects malformed/expanded persisted or model plan schemas and ambiguous native JSON, and verifies live completion tokens/state. Native self-tests exercise denial without file side effects, restored authorized plan execution across processes and replay rejection. This is pending compiled CI and independent review. Older queued preview jobs need fresh creation/approval; no automatic approval migration. This does not defend against an attacker controlling both SQLite state and its approval evidence. Real extension identity, OS key custody, signed installers and customer acceptance remain open. No MCP enabled.
