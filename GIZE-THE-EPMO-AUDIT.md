# GIZE THE EPMO — Master Cross-Repository Audit

**Chat command:** `gize the epmo`

## Authoritative references
| Workstream | Instructions | Progress |
|---|---|---|
| TEFE frontend | [GIZE-CHECK.md](https://github.com/2029TEFE/TEFE/blob/main/GIZE-CHECK.md) | [Issue #75](https://github.com/2029TEFE/TEFE/issues/75) |
| TEBE backend | [GIZE-CHECK.md](https://github.com/2029TEBE/TEBE/blob/main/GIZE-CHECK.md) | [Issue #642](https://github.com/2029TEBE/TEBE/issues/642) |
| OT Windows/GIZE runtime (TO repository) | [GIZE-CHECK.md](https://github.com/faisalwrokksa-hub/TO/blob/main/GIZE-CHECK.md) | [Issue #71](https://github.com/faisalwrokksa-hub/TO/issues/71) |

## Mandatory audit on each check
1. Fetch current instructions, task lists, repository source files, linked issues and latest expert comments, open/merged PRs, workflow runs, security findings and deployment evidence across all three.
2. Locate the canonical requirement package, immutable storage URL, checksum, manifest and source-file-to-task map. **The uploaded `execute fully.zip` has not yet been transferred into GitHub**; if absent, explicitly flag SOURCE BLOCKED and don't claim a full requirements reconciliation.
3. Reconcile every applicable requirement with implementation and acceptance criteria. Record source path, requirement ID, owning repo, code path, PR/commit, CI run, deployment version, UTC checked time.
4. Categorize VERIFIED, IMPLEMENTED UNVERIFIED, IN PROGRESS, BLOCKED, NOT STARTED, NOT ASSESSED. Present a **full checkbox checklist** per repository, not just a summary. Do not call unchecked tasks missing implementations until inspected.
5. Identify cross-repository blockers, mismatched API contracts, multilingual/UI versus API differences, auth/tenancy/security, Windows compatibility, GIZE terminology and encrypted format compatibility.
6. Flag every failed test or security check with exact evidence, severity, likely root cause, suggested fix and safe bulk-fix group. Do not auto-approve bypass of failed checks.
7. With standing authorization, execute safe fixes on branches; run routine tests and security scans; request or enable auto-merge only after repository protections pass; deploy through verified pipeline; verify deployed SHA; safely remove only merged unprotected branches with no unique work.
8. Update each repository's status checklist and progress issue with fresh UTC timestamp, evidence URLs, done/remaining/blocked and next action. Aggregate in TO master issue.

## Executive output: paying-customer readiness
- All three repository verified completion counts; percentage only after source requirements and applicability have been enumerated.
- End-to-end signup, authorization, billing (when in scope), onboarding, customer journeys, tenant isolation, localization, auditability, backup/recovery, monitoring, accessibility, and production rollback checks.
- Release blockers P0/P1 and evidence-based go/no-go decision.
- Next prioritized actions for each expert; no speculative release confidence.

## Important limitations
This Markdown is a **runbook and prompt reference**, not a self-executing script. Automatic periodic checks require actual CI workflows or scheduled agents. A source ZIP around 430 MB cannot be committed through GitHub's standard text-file contents interface; host its vetted source artifacts using appropriate durable storage and register a SHA-256 manifest.


## Live first-pass baseline crosscheck — 2026-11-18
**This section records direct source inspection, not a completed 150-item runtime audit.** Revalidate on each command run.

| Repo | Requirement ownership | Inspected evidence | Remaining uncertainty |
|---|---:|---|---|
| [TEFE](https://github.com/2029TEFE/TEFE) | 12 | README identifies marketing-only scope; CI workflow defines Node tests and production candidate bundle; PR #74 describes cleanup and local tests | All 12 still unassessed at full acceptance depth; current CI success and Cloudflare production SHA not confirmed; historical README says auto-production deploy disabled |
| [TEBE](https://github.com/2029TEBE/TEBE) | 60 | README lists Next.js 15, NestJS 11, PostgreSQL/Redis, tenancy controls; CI defines broad source gates including security, locale, GAIZ tests; recent PR #641 describes storage headroom | 60 IDs not yet end-to-end checked; no current production release/runtime check; security/runtime tests not proven green on current main |
| [OT/TO](https://github.com/faisalwrokksa-hub/TO) | 78 | README describes Chrome MV3 + Windows bridge, SQLite and preview state; PR #70 preparatory cleanup; OT source instructions committed | 78 IDs not yet desktop-tested; no owner-PC installer proof, no complete offline decryption migration proof, reference desktop binary package not hosted |

### Cross-cutting release blockers requiring evidence
1. Versioned, access-controlled hosting for reference website and Windows binaries, plus `ref4` context and `ref7` original manifest. [Artifact registry](docs/gize-sources/ASSET-REGISTRY.md).
2. Exact current main commit CI/security evidence from real completed GitHub Actions runs. GitHub combined-status lookup returned empty arrays for the documentation-only current heads; **not** proof of passing or failing actions.
3. Source-linked test evidence for supported-language translations (not fallback), end-to-end strategy-to-outcome, secure GIZE encrypted exports and legacy reads, offline authorization, tenancy/permissions, billing and support/legal.
4. Production version and deployment identity for public site, authenticated app and Windows installer; backup, rollback and final owner release authorization.

### Owner instructions
- `gize tefe: <change>`, `gize tebe: <change>`, `gize ot: <change>`: open/update linked expert issue and modify corresponding checklist/acceptance criteria with change log and evidence.
- `gize the epmo: <change>`: record cross-repo instruction in master TO issue, map changes to specific task IDs, ask each expert to reconcile and update its checklist.
- Each verified task: **update its checklist file and issue immediately**, not just after a batch. For failing tests/security checks report precise links, severity, cause and proposed safe bulk fixes; protect mandatory gates.


## Release gate checklist — pending independent verification (2026-11-18)
The **14 REL IDs** below are cross-repository gates, not proof of implementation. All are unchecked because the required full acceptance evidence has not been verified. Source text: [Theepmo-ref2.md](docs/gize-sources/Theepmo-ref2.md).

- [ ] **REL-01** — All 150 mandatory IDs verified or exclusions expressly approved and disclosed.
- [ ] **REL-02** — Connected end-to-end strategy-to-outcome scenario verified with synthetic tenants and access controls.
- [ ] **REL-03** — All supported locales complete on website, app, backend and Windows with no untranslated required content.
- [ ] **REL-04** — Website/account/billing configuration/entitlements/support and first-value commercial journey proven.
- [ ] **REL-05** — Supported Windows environments pass offline execution, encrypted read/write, migration, recovery and upgrades.
- [ ] **REL-06** — New `.gize` and legacy `.gaiz` artifact interoperability and negative security conformance proven.
- [ ] **REL-07** — Actual launch integrations, AI evals, load, monitoring and backup restore pass.
- [ ] **REL-08** — Exact release candidate's CI, security and other source gates pass with no release-blocking defects.
- [ ] **REL-09** — Exact hashes, signing, dependencies, rollout, rollback, service operations and support guides available.
- [ ] **REL-10** — Explicit final owner authorization for **exact** release candidate captured.
- [ ] **REL-11** — Deployed production revisions, TLS/routes/private caching/health and approved commercial config verified.
- [ ] **REL-12** — All required unique branch work safely preserved/merged; only approved merged branches cleaned, main-only final target verified.
- [ ] **REL-13** — Duplicate sites/routes retired only after backups, dependency assessment and release authorization.
- [ ] **REL-14** — Demonstration and evidence-backed readiness declaration delivered.

**Current readiness classification:** **NOT VERIFIED / NOT YET APPROVED FOR PAYING-CUSTOMER LAUNCH**. This is not a claim all software is absent; it is the correct conclusion in the absence of proven release gates.

### Priority implementation/audit batches
1. **P0 security and release identity:** verify SEC-01–03, data isolation, auth/revocation, dependency scans, exact current Actions runs and SHA-bound deployment (TEBE/TO).
2. **P0 product workflow and business value:** run synthetic connected enterprise acceptance across objective → demand → funding/capacity → approval → execution → benefits, with real backend persistence and authorization (TEBE).
3. **P0 localization and GIZE crypto:** exhaustively test supported locales and backend output, `.gize` writes, legacy read, offline decryption and Windows recovery (TEFE/TEBE/TO).
4. **P0 commercial and ops:** payment/provider test-cycle, entitlement/webhook/renewal cases, terms/support, production health, backups/restore and rollback (TEBE/TEFE).
5. **P1 visual/desktop reference parity:** grant selected experts access to owner-private Drive ZIP parts; reconstruct and independently SHA-256-verify; record visual and desktop gaps as individual source-backed requirements (TEFE/TO).

Each batch must report passing and failing tests separately with concrete CI/log URLs; group related root causes for safe bulk fixes, never suppress gates.
