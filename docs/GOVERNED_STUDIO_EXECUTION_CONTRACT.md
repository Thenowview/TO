# Governed Business Studio — cross-repository delivery contract
Status: implementation specification, not evidence of shipped runtime. Last updated: 2026-11-17.

## End-to-end journey
Template → draft form → configure approval/fulfillment → preview → synthetic validation → reviewer submission → independent approval → publisher publication → authorized catalog → request submission → operation and evidence → revision/retirement.

Every definition has a tenant-bound immutable definition ID and monotonically increasing version. Submitted requests pin BOTH formVersionId and workflowVersionId, and never follow later edits. Only a new approval/publishing transaction can expose a revised version. Retiring a service prevents new submissions but does not invalidate in-flight requests.

## Internationalization — ALL supported application locales
Do not hard-code en/ar as the complete locale list. At validation and publication time obtain the enabled locale set from TEBE's authoritative tenant/application locale registry. Each enabled locale must have human-reviewed labels, help text, descriptions, enum values, conditional instructions, errors, approval/delegation/rejection reasons, timeout/escalation messages, accessible names, catalog metadata, notifications, status transitions and evidence captions. Treat English and Arabic as baseline examples, not a limit.

- Every field and step has stable locale-independent IDs; translation maps use canonical BCP-47 locale tags.
- Validate all visible and conditionally visible fields in each supported locale; client and server use the same locale-independent validation rules and machine-readable error codes.
- Missing, empty or machine-placeholder localized content is a BLOCKING publish validation error. Never silently fall back for published catalog/service experiences. Draft previews may explicitly display missing-translation warnings.
- Direction is derived per locale/script (RTL for Arabic and other RTL locales), not globally forced. Use logical CSS properties, mirrored directional controls as appropriate, correct tab order, keyboard interaction, focus restoration, screen-reader announcements and WCAG 2.2 AA targets.
- Number/date/currency formatting uses locale-aware formatters while storage and conditional evaluation use canonical values. Preserve typed submissions when switching locale.
- Attachments: translated instructions and error text; upload file rules are locale-independent; no leaking attachments across tenant boundaries.

## Governance invariants
- Authorizations are enforced in API and persistence, not only by hidden buttons: creator can edit drafts; reviewer can approve/reject; publisher can publish only approved unchanged version; operator can fulfill assigned tasks only. Explicit privileged separation and no self-approval by default.
- Approval steps support named users, groups, requester manager, sequential and conditional routing, plus explicit ANY/ALL semantics. Verify manager identity and group membership at assignment time; record snapshots.
- Define rejection, return-for-revision, delegation (authorized and audited), deadlines, escalation, cancellation, retry/idempotency; no implicit approval on timeout.
- Fulfillment uses scoped TO/OT step contracts with strict version, allowed capability, tenant and permission scoping. Imports are inert until signature/integrity checks, schema validation, explicit authorization and fresh review; never activate permissions, integrations, executable steps or workflows implicitly.
- GIZE AI can propose editable draft schemas and routes only; deterministic validation and human authorization are mandatory before review, publication and execution.
- Security: tenant isolation, server-side access policy, optimistic version checks, audit append-only events, safe attachment handling, no secrets in exported evidence, immutable lineage for secure packages.
- Keep established `.gaiz` filename, extension and wire-format compatibility. GIZE AI rebrand is presentation/terminology only; any format rename requires separate migration and compatibility review.

## Synthetic acceptance scenario
1. Business creator selects "Project change request", defines typed fields, conditional finance fields, attachments and translated instructions for EVERY supported locale.
2. Workflow: requester-manager approval followed by Finance ALL approval when budget impact exceeds threshold; otherwise bypass finance per explicit branch. Configured rejection, revision, delegation and escalation behavior is visible and tested.
3. Creator previews all locales and validates synthetic requests, then submits immutable draft for reviewer approval. Reviewer accepts; separate publisher publishes exact reviewed version.
4. Authorized requester finds private catalog item, submits and tracks fulfillment. Assigned operator completes fulfillment and attaches traceable tenant-scoped evidence with form/workflow versions and event history.
5. Unauthorized creator cannot publish, impersonate reviewer, bypass manager/Finance approval, read another tenant's records or activate imported packages. Confirm server-side denials, no side effects, and audit events.
6. A later edit creates a new draft; previously submitted requests retain pinned versions. Retired services reject new requests without disrupting prior ones.

## Release gates
Contract/schema tests; approval graph/ANY-ALL and conditional route tests; authorization/tenant negative tests; locale completeness and multilingual accessibility tests (all supported locales); package-import inertness tests; synthetic end-to-end acceptance; reviewer signoff. No production deployment until these pass.

## TO / OT canonical reusable capability boundary
Define versioned, read-only execution-step metadata (contractId, contractVersion, inputSchema, outputSchema, capabilityScope, requiredPermissions, timeoutPolicy, idempotencyKeyPolicy, evidenceSchema, localizedDescriptions). No arbitrary code, URL callback, provider credential, browser automation or external integration may be enabled by importing metadata. TEBE explicitly authorizes a pinned contract version before invocation. Return deterministic execution status and scoped evidence references; record operator/system principal and authorization decisions.
GIZE AI returns proposed form/workflow drafts with provenance and locale-completeness diagnostics, never a publishable, executable or permission-granting artifact. Validate drafts against schema, conditional graphs, allowed capability registry, all enabled locale requirements and tenant policy.
Export/portable evidence packages use the existing canonical secure-artifact process only once security-verified; preserve the lowercase `.gaiz` extension and current format compatibility. Imported packages default to inert quarantine pending integrity, tenant binding, contract validation and separately recorded human review.
