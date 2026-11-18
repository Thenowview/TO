# AO expert changes — precise ownership

## OT / Chrome + Windows
Inspect `apps/chrome-extension/manifest.json`, `background.js`, `task-manager.js`, `supervisor-plan.js`, `agent-playbooks.js`. Do not change current behavior by default. Add an opt-in registry client through existing native messaging; local host enforces tool ID, input shape, allowlisted MCP endpoints, pinned STDIO commands, OAuth audience, replay nonce, cancel/timeout and logged evidence. Deny arbitrary shell, filesystem, content scripts or host permissions. Test cross-origin, prompt injection, non-idempotent retry, signed .gize round-trip and real Windows. Reconcile active expert PRs.

## TEBE / Enterprise authorization
Create versioned DTOs corresponding to `contracts/`; enforce authn, tenant, principal, entitlement, role, workflow state and tool risk on **every call**. Add per-tenant credential custody, SSRF prevention, egress allowlists, immutable evidence and idempotency keys. Keep features disabled until two-tenant RLS, MCP negative cases, OT fixtures, Arabic/English plus full declared locale matrix and live route readback pass.

## TEFE / Public surface
Use AO only internally; Orgaiz → THEEPMO → GIZE AI externally. Announce integrations only if actually deployed and tested; no vendor binaries/modules in marketing. Confirm accessibility, full locales and deployment artifact SHA.

## GIZE THEEPMO / Master
Record AO separate from existing 150 acceptance IDs; crosswalk each to actual owner IDs, PR SHA, tests, legal review, security, deployment, staged test and GO/NO_GO. Keep release NO_GO until verified. Never force-merge, delete expert branches or bypass CI.
