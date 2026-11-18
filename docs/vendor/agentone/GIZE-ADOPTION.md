# GIZE AgentOne adoption — expert execution and master audit

**Requested outcome:** Improve existing GIZE application + Chrome extension using pinned AgentOne reference files, while current experts work without interruption. **Release status:** NO_GO pending proof. **Source and terms:** [reference package](./README.md). Never treat installer contents as source.

## Ownership and proposed implementation

### OT (Chrome extension, offline desktop, GIZE format; issue #71)
- [ ] Inventory existing `apps/chrome-extension/manifest.json`, `background.js`, `task-manager.js`, `supervisor-plan.js`, `agent-playbooks.js`, and native messaging hosts before changes.
- [ ] Design **opt-in, curated local/remote MCP adapter** in the native host. Do **not** add arbitrary `host_permissions`, broad content scripts or raw tools to the browser worker. Tool descriptor includes ID, version, risk class, schema, authenticated transport, requested grants, timeout and evidence policy.
- [ ] Keep Chrome service worker as minimal supervisor UI/messenger; local machine tasks run in signed/approved native context, with narrow file/process/domain permissions.
- [ ] Add risk classes: read-only, reversible write, consequential external write, destructive/privileged. Deterministic deny overrides model auto-approval. Audit permission decisions and token scope.
- [ ] Reuse existing specialist queue and independent QA; add per-tool traces, bounded retry, cancellation and verified result rather than duplicate agent engines.
- [ ] Ensure local-model operations, Windows native host and opt-in MCP degrade honestly offline; no cloud sign-in required for authorized offline local operations.
- [ ] Preserve `.gize` default / `.gaiz` legacy read and GAIZ1/GAIZ2 signatures/protocol bytes. AgentOne is NOT cryptographic format authority.
- [ ] Test extension/native host origin checks, request replay, OAuth storage/isolation, prompt injection from tools, arbitrary command prevention and manual Chrome side panel usability.

### TEBE (tenant-authenticated web/API, business governance; issue #642)
- [ ] Define versioned **AgentTool**, **AgentJob**, **ApprovalDecision**, **AgentTrace** and **ArtifactRef** contracts compatible with OT bridge; no duplicate runtime.
- [ ] Authorize every server-executed tool by tenant, principal, entitlement, workflow state, data classification and operation. AI classifier is supplementary only.
- [ ] Govern Studio-created agents with approved publishing/revision/retirement and human checkpoints on consequential activities.
- [ ] Curate server-side MCP connector catalog; per-tenant encrypted credentials, egress restrictions, SSRF prevention, OAuth audience binding, revocation and timeouts.
- [ ] Use server-side durable scheduling for enterprise approvals/escalations. Desktop scheduler is not reliable as sole authoritative scheduler.
- [ ] Keep generated reports and `.gize` artifacts behind existing fail-closed identity, recipient, provenance, cache and revocation checks; ensure actual production route and RLS tests before shipping.
- [ ] Implement least-privileged two-tenant tests, replay/forged tool result tests, step-level audit and disabled-by-default feature flags.

### TEFE (public marketing, onboarding; issue #75)
- [ ] Reflect capabilities truthfully in Orgaiz → THEEPMO → GIZE AI marketing; do not claim MCP marketplace, full computer use or automated workflows shipped until accepted.
- [ ] Document supported platforms, trust boundaries, user consent and extension/native-host installation (no bundled unverified EXE).
- [ ] Expand localization and accessibility tests across all declared supported locales; no unreviewed fallback presented as full translation.
- [ ] Keep marketing builds free of third-party reference source, native binaries, secrets and experimental MCP servers.

### Master auditor GIZE THEEPMO (issue #71)
- [ ] Add an **AgentOne adoption evidence subsection** without renumbering or double counting original 150 source IDs.
- [ ] Track `REFERENCE_ONLY → SPECIFIED → IMPLEMENTED_UNVERIFIED → VERIFIED` for each new pattern, separately from source-ID statuses. Crosswalk relevant 150-ID entries and do not claim new requirements completed.
- [ ] Verify upstream source pin, copied-file paths and unmodified license; record actual owner grant terms before any proprietary distribution.
- [ ] Confirm exact approval boundary, extension/native host/TEBE contract, tenant/recipient protection, offline Windows operation, all locales, installation integrity and customer acceptance.
- [ ] Run threat model, staged synthetic E2E, negative MCP injection and malicious server tests, production gates and actual release readback before GO.

## Safe execution sequencing

1. License/permission scope and source inventory; do not execute installer. Prepare isolated reference branch/PR with copied source and license.
2. Design versioned schemas and P0 approval/security threat model across OT and TEBE.
3. Implement OT local curated MCP sandbox and bounded agent orchestration behind disabled default; implement TEBE corresponding governed API in separate expert branches.
4. Integrate TEFE claims and native-language help only when supported by actual tested release.
5. Cross-project synthetic customer acceptance, security, signer, CI, deploy readback; no skip of current security/release gates.

## Completion protocol

Each expert posts own GitHub issue: requirement ID, changed path, tested head, observed test output, review, branch, blocked dependencies, actual deployment identity. Master reconciles without altering active expert branches. Auto-approval applies only to safe reversible work **within** repo protections; payments, privileged tool execution, data publication, branch deletions, permission expansion and production release require their explicit safeguards.
