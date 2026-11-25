# GIZE TO — Source-linked Progress Register

## Native-host uninstall ownership — 2026-11-21 Riyadh

Owner: "bulk fix, auto approval". The uninstaller previously deleted the shared
host registry key unconditionally, including when another installation owned it.
Candidate cleanup checks the registered manifest's exact executable path before
removal; malformed/unreadable/foreign records are retained. NSIS calls that check
instead of deleting the key directly. Synthetic ownership tests pass locally;
Windows registry integration now verifies foreign preservation and owned removal.
See `docs/NATIVE-HOST-UNINSTALL-OWNERSHIP.md`. Partial WIN-07 evidence only; no live
PC process/profile/registration was changed by local tests and no signing or
physical Chrome acceptance is inferred.

## Dedicated-browser launcher fallback — 2026-11-21 Riyadh

Owner: "bulk fix, auto approval". Synthetic preference regression reproduced a
strict-mode launcher exception when ordinary Chrome Preferences omitted extension
metadata, preventing the Secure Preferences fallback. The candidate fixes missing,
null, malformed and incomplete records while preserving exact manifest name,
absolute installation path and extension-ID checks. Local synthetic PowerShell
regression passes after the fix and failed before it. Windows PowerShell CI added.
No real profile, native-host registry or permissions were modified by the test.
This is partial PC-01/WIN launch evidence, not physical device or signing acceptance.

## Windows crypto and merged review binding — 2026-11-20 UTC

PR #111 merged as `63691056c965e0479ac8ebc08dcea8a9294ce280` after all four
candidate workflows passed. Its downloaded Windows bridge passed both real
executable stdio smoke suites on the owner's PC. Offline crypto acceptance found
and fixed a Windows-only CLI test path (`C:\C:\...`); all 17 focused GAIZ1/GAIZ2,
`.gize` / legacy `.gaiz`, wrong-key/tenant and tamper tests then passed locally.
The focused suite is added to Windows CI. Details and exact hashes are in
`docs/OT-PC-ACCEPTANCE-20261121.md`. These are partial ENC/WIN/TASK evidence;
physical Chrome acceptance and trusted signing remain unverified. Superseded-app
removal is partial/locked, and user data remains preserved. No requirement ID is
newly VERIFIED by these automated checks.

## Reviewed-plan approval binding — 2026-11-20 UTC

Owner: "bulk fix, auto approval". The first Amuse intake/policy batch is merged
in OT #110, TEBE #712 and TEFE #115. This follow-up implements a selected reviewed
action pattern in the existing Chrome/native runtime: `agent_get` fingerprint,
exact-snapshot approval, stale-response UI guard and scoped field forwarding.
See `docs/REVIEWED-PLAN-APPROVAL.md`. Local JavaScript validation: 38 tests pass.
Native self-test and real framed smoke fixtures cover missing/stale snapshots;
compiled results and physical Chrome acceptance must be recorded for this head.
No requirement is newly VERIFIED; PC-05 and TASK-09 receive partial implementation
evidence only. Encryption identifiers/key custody are unchanged. Trusted signing
and removal of the superseded portable app remain blocked as previously recorded.

**Command:** `gize ot`  
**Canonical issue:** https://github.com/faisalwrokksa-hub/TO/issues/71

## Original reference package (inspected 2026-11-18)
- **Original uploaded file:** `execute fully.zip` (429,835,722 bytes)
- `Theepmo ref1.md`: package guide, precedence and limitations
- `Theepmo ref2.md`: **controlling master prompt, 150 full-text requirement IDs**; SHA-256 `0fc466747c50a9b3740e98da095fa7b89d93f9355eee80e2456aaebabb8f8bc3`
- `Theepmo ref3.md`: original OT Windows migration and offline requirements; SHA-256 `8a146afab8e8ef7818ca3f762a814b067732f5c1fefd4ae7a7f2854bd0206374`
- `Theepmo ref4.txt`: infrastructure and design context; SHA-256 `84f48c9674a9a0aae89e86d583a1eb6bac3ab9174544bf3ddef43229b7058a12`
- `Theepmo ref5.zip`: **81-entry reference website capture**, 237,776,248 bytes; SHA-256 `fcfe108b258c47e3896b5844a711c66d1cdb5fa43906d250d7bf7cd211596d66`
- `Theepmo ref6.zip`: **8-entry reference desktop package** including opaque binaries; 877,795,554 bytes; SHA-256 `16d02926ae0a879d9b37e54ace6f983da70310ef6a1597a364b416506f38ffe1`
- `Theepmo ref7.json`: checksums of six entries

**Source availability:** The large ZIPs and their embedded binaries are not yet hosted on GitHub. The uploaded file in this conversation is not a shared source for every expert. Until durable artifact upload and access controls are completed, each item is **NOT ASSESSED**. The separate original reference-to-OT handoff is absent from the package, and should be tracked as a blocker.

## Required inspection and update procedure
1. Review all source references and the full text of each ID in `Theepmo ref2.md` **before** claiming completion.
2. Inspect actual current repo source, PRs, commits, CI runs, security scans, production version and any necessary cross-repo integration. Note the exact source path and code path.
3. For each ID, retain checkbox unchecked until VERIFIED. Mark status as **NOT_ASSESSED**, **NOT_STARTED**, **IN_PROGRESS**, **BLOCKED**, **IMPLEMENTED_UNVERIFIED**, **VERIFIED**. Each VERIFIED item needs test + commit + deployment evidence where required.
4. Flag red tests and security failures with exact run/trace, likely root cause, proposed safe individual or bulk fix, severity and owner; never override protections just to green the release.
5. After a batch update this file and the issue; preserve the full list of IDs, append date, links and proof. Reconcile all branches and unique commits before deleting merged branches.
6. Routine authorized changes may be implemented and reviewed; **final production merge, deployment and public installer release require explicit release authorization per the source assignment**.

## Summary
- Assigned: **78** / 150 source requirements (provisional ownership)
- Verified: **0 confirmed from this extraction** (not a measured failure rate)
- Measured register statuses: **70 NOT_ASSESSED**, **7 IN_PROGRESS**, **1 VERIFIED** across the 78 assigned rows; no acceptance percentage is inferred.
- Last source inventory: **2026-11-18**

## Full assigned checklist

- [x] **OWN-01** — Confirm the three repository identities, guidance and canonical ownership. · **VERIFIED** · Source: [Theepmo-ref2.md#OWN-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence (2026-11-21 Riyadh): confirmed the three repository identities, their `GIZE-CHECK.md` entry points, declared ownership and active canonical trackers: [2029TEFE/TEFE guidance](https://github.com/2029TEFE/TEFE/blob/main/docs/GIZE-OWNER-INSTRUCTIONS.md) and [#75](https://github.com/2029TEFE/TEFE/issues/75); [2029TEBE/TEBE guidance](https://github.com/2029TEBE/TEBE/blob/main/docs/GIZE-OWNER-INSTRUCTIONS.md) and [#642](https://github.com/2029TEBE/TEBE/issues/642); [faisalwrokksa-hub/TO guidance](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/GIZE-OWNER-INSTRUCTIONS.md) and [#71](https://github.com/faisalwrokksa-hub/TO/issues/71). TEFE owns public frontend; TEBE owns authenticated web/API; OT owns Windows/offline/artifacts and cross-repository coordination. Governance documentation requirement; runtime tests and deployment evidence are inapplicable.
- [ ] **OWN-03** — Record launch scope, supported platforms, features and customer-facing promises without silently narrowing these requirements. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#OWN-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **OWN-04** — Preserve customer data, controls, legacy artifact references and unique branch work. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#OWN-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **OWN-05** — Record cost decisions, release authorization boundary and final main-only cleanup conditions. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#OWN-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **EVD-01** — Read and register all supplied sources and referenced handoff; identify unavailable inputs. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#EVD-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **EVD-02** — Establish a requirement-to-code-to-test evidence ledger using the IDs below. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#EVD-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **EVD-03** — Separate observed facts, proposals, mock results, live results and Windows results. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#EVD-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **EVD-04** — Record repository SHAs, runtime/OS versions, artifact hashes, dates and raw verification results. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#EVD-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **AUD-01** — Pin source/deployed revisions and identify build-to-deployment provenance. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#AUD-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **AUD-02** — Inventory branches/PRs, unique commits, checks and reusable work in all three repositories. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#AUD-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **AUD-03** — Map actual application routes, API contracts, schemas, queues, jobs and storage ownership. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#AUD-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **AUD-04** — Inventory Cloudflare zones/accounts, DNS, TLS, Workers/Pages, routes, cache rules and upload constraints. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#AUD-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **AUD-05** — Inventory server services, ports, databases, volumes, schedulers and deployment mechanisms. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#AUD-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **AUD-06** — Identify secret/key references and owners without exposing their values. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#AUD-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **AUD-07** — Run actual baseline tests/builds and representative customer journeys; separate pre-existing failures. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#AUD-07](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **AUD-08** — Produce legacy feature/data parity, locale coverage and desktop compatibility matrices. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#AUD-08](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **AUD-09** — Record verified infrastructure limitations and access gaps; estimate work only after this baseline. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#AUD-09](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **UX-04** — Redesign OT Workspaces / Tasks / Files / Settings, composer, approvals, event history and deliverables. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#UX-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **LOC-04** — Fully translate Windows installation, upgrade, offline tasks, key recovery and uninstall guidance. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#LOC-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **PC-01** — Launch the installed app offline and reopen existing authorized local workspaces without online login. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#PC-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **PC-02** — Show connection state and On this PC / Online via THE EPMO before task submission. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#PC-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **PC-03** — Preview a structured plan showing actions, workspace, inputs, destinations and permission requirements. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#PC-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **PC-04** — Implement reviewed adapters for supported file reading, report creation, local inference, approved app opening and configured project checks; identify unsupported actions honestly. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#PC-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **PC-05** — Enforce approved scope at dispatch; require fresh approval when action/scope changes. · **IN_PROGRESS** · Source: [Theepmo-ref2.md#PC-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **PC-06** — Constrain paths, handle Windows normalization/junctions/symlinks, revalidate before operations and test escape attempts. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#PC-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **PC-07** — Protect loopback/native bridge callers; enforce resource limits/timeouts and isolate project checks where supported. · **IN_PROGRESS** · Source: [Theepmo-ref2.md#PC-07](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **PC-08** — Keep credentials out of UI storage/logs/reports; use OS-managed protection where appropriate. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#PC-08](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **PC-09** — Make deterministic jobs independent of AI; enable local AI only after model compatibility/readiness checks. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#PC-09](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **PC-10** — Bound logs/progress, preserve workspace/task context and keep shell/navigation responsive during inference and large-file work. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#PC-10](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **TASK-01** — Enforce idempotent submission, atomic claims/transitions and durable receipts under concurrency. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#TASK-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **TASK-02** — Reconstruct task state after restart; resume event cursors or obtain authoritative snapshots. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#TASK-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **TASK-03** — Check side effects before retry; require review for uncertain outcomes and retain retry evidence. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#TASK-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **TASK-04** — Implement tested cancellation, terminal-state protection and audit history. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#TASK-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **TASK-05** — Queue online work offline only on explicit selection; show waiting for connection. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#TASK-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **TASK-06** — Revalidate identity, tenant, workspace access and approval on reconnect; resolve ambiguous submit outcomes by request ID. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#TASK-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **TASK-08** — Upload only authorized files; local workspace content remains local by default. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#TASK-08](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **TASK-09** — Pass duplicate submit, concurrent dispatch, stale approval, restart during write, worker crash, cancel/finish race and reordered-event tests. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#TASK-09](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **TASK-10** — Pass outage/reconnect, expired credential, revoked access, denied cross-tenant access and uncertain-remote-outcome tests; distinguish mocks from live evidence. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#TASK-10](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **SYNC-01** — Define authoritative records, version checks and merge policy for each synchronized object. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#SYNC-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **SYNC-02** — Handle concurrent edits, deletions/tombstones, attachment changes, duplicate delivery and changed/revoked approvals without silent overwrite. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#SYNC-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **SYNC-03** — Present conflicts for review when deterministic safe reconciliation is impossible; preserve provenance and both relevant revisions. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#SYNC-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **ENC-01** — Deliver threat model, actual versioned protocol/key specification and security review. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#ENC-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **ENC-02** — Default new exports/download filenames to .gize; accept .gize and .gaiz in existing applicable consumers. · **IN_PROGRESS** · Source: [Theepmo-ref2.md#ENC-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **ENC-03** — Preserve historical names/references and GAIZ1/GAIZ2 handlers; never bulk rename/re-encrypt user files during setup. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#ENC-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **ENC-04** — Verify content-based detection, integrity/signatures and authorization before releasing usable plaintext; prevent partial/unauthenticated output exposure. · **IN_PROGRESS** · Source: [Theepmo-ref2.md#ENC-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **ENC-05** — Protect local keys using supported OS mechanisms; document backup, recovery, rotation, lost-key behavior and tenant/user separation. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#ENC-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **ENC-06** — Demonstrate offline encryption/decryption without online login using local authorized keys; clearly reject missing/unauthorized keys. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#ENC-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **ENC-07** — Implement/document offline permission expiry, online-only policies and revocation limitations without misleading promises. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#ENC-07](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **ENC-08** — Share synthetic fixtures for both extensions and both versions; test renamed identical bytes, malformed/mismatched headers, tampering, missing keys, wrong recipients and round trips. · **IN_PROGRESS** · Source: [Theepmo-ref2.md#ENC-08](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **ENC-09** — Test applicable TO/TEBE/TEFE import, upload, download and verification consumers; publish version/consumer compatibility limits. · **IN_PROGRESS** · Source: [Theepmo-ref2.md#ENC-09](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **ENC-10** — Register both Windows associations where supported, default new files to .gize and preserve uninstall/data behavior. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#ENC-10](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **OPS-06** — Build once and promote identical pinned artifacts where supported; bind deployment to exact source and dependency provenance. · **IN_PROGRESS** · Source: [Theepmo-ref2.md#OPS-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **OPS-07** — Test health checks, safe schema rollout, rollback and failed-deployment recovery; verify actual deployed revision. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#OPS-07](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **WIN-01** — Enumerate supported Windows versions, installation modes and legacy upgrade baselines. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#WIN-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **WIN-02** — Produce verified backup, schema/version manifest and migration journal; preserve secrets through supported OS migration/recovery. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#WIN-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **WIN-03** — Pass clean install and each supported upgrade; rerunning setup must be safe. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#WIN-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **WIN-04** — Test active writers, locked files, disk exhaustion, interrupted migration and restart recovery. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#WIN-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **WIN-05** — Verify record counts, integrity, representative files, access permissions, shortcuts and file associations before default-launcher switch. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#WIN-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **WIN-06** — Rehearse rollback with prior installer and verified backup, preserving work created after upgrade through tested compatible export/restore. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#WIN-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **WIN-07** — Verify uninstall preserves user data unless deletion is explicitly requested; document updater ownership and behavior. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#WIN-07](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **WIN-08** — Deliver private candidate, checksum, dependency inventory and signing status; production signing and Windows acceptance remain release gates. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#WIN-08](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **WIN-09** — Demonstrate legacy upgrade → offline launch/task → verified output → .gize export → offline decryption → legacy .gaiz open → authorized online task → outage/reconnect. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#WIN-09](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **PERF-01** — Measure baseline/candidate on the same Windows device: cold/warm startup, navigation, durable receipt, event latency, large-file preview, idle/active memory and recovery. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#PERF-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **PERF-02** — Report inputs, sample counts, median, p95 and raw observations; meet predefined budgets and investigate regressions. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#PERF-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-01** — All mandatory requirement IDs implemented and verified; exclusions separately documented without disguising scope reductions. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-02** — Full connected enterprise acceptance scenario passes with synthetic tenants and correct permissions. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-03** — Every supported language passes every required surface; no accepted English fallback or untranslated required content. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-04** — Website, account, billing configuration, entitlements, support and customer-value journey pass. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-05** — Offline Windows execution, encryption/decryption, migration and recovery pass on supported target environments. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-06** — Both extensions/versions pass documented consumers and negative security cases; keys/recovery limitations are explicit. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-07** — Launch integrations, AI evaluations, load targets, monitoring and backup restoration pass. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-07](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-08** — Required source checks pass on the exact candidate commits; no unresolved release-blocking defect remains. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-08](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-09** — Deliver exact release hashes, installer/signing status, dependency inventory, rollout/rollback and operating guides. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-09](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-10** — Obtain the required production release authorization for the exact reviewed candidate. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-10](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-11** — Verify live deployment revisions, routes, TLS, private caching, health and approved production commercial configuration without unauthorized charges. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-11](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-12** — Preserve required unique work, finish dependencies and remove approved merged branches so the three repositories end with main only. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-12](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-13** — Retire duplicate sites/launchers/routes only after backup, dependency checks and appropriate release authorization. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-13](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending
- [ ] **REL-14** — Deliver final demonstration and honest declaration: paying-customer-ready, release-candidate-ready or blocked, supported by evidence. · **NOT_ASSESSED** · Source: [Theepmo-ref2.md#REL-14](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) · Evidence: pending

## Expert update log
| UTC time | Checked IDs | Verified IDs | Blocked IDs | PR/commit and tests | Next action |
|---|---|---|---|---|---|
| 2026-11-18 | ENC-04 local GAIZ2 plaintext lifecycle hardening | None verified; GAIZ2 unit and conformance must run on exact new commit | Full trusted authorization, offline key protection, cross-consumer and Windows checks remain | `gaiz/v2.mjs` commit `d3a5cb85075d8c5357902ad184a056eefc0b51ef`: clear temporary plaintext Buffer in `finally` in local decrypt path, matching managed-custodian hygiene | Check latest CI and independent security review; JavaScript strings and parsed objects may remain managed by runtime |
| 2026-11-18 | Initial source ID inventory | None verified | Source storage and original OT handoff | Instruction-only initial commit | Check actual repo implementation and link durable source artifacts |
| 2026-11-18 | ENC-08 parser-negative-vector test correction; broader release inventory reviewed | None verified (implementation test pending CI) | Original source binaries and OT handoff, production release gates | `gaiz/v2.test.mjs` on `gize/ot-bulk-audit-and-negative-vectors-20261118`; real-header parser negative cases substituted for escaped-string false positives | Trigger GAIZ CI on review PR, add missing extension/version fixtures and independent Windows/TEBE/TEFE evidence |
| 2026-11-18 | OPS-06 Chromium installer reliability: identified failure in [run #44373188798](https://github.com/faisalwrokksa-hub/TO/actions/runs/44373188798) (Chocolatey NSIS dependency HTTP 504), added bounded 3-attempt retry plus compiler and installer existence checks | None verified (rerun required) | Production build provenance/signing and installer readiness | `.github/workflows/chromium-browser-ci.yml` commit `52b7fe3cc145ce87cea91d51ff89bfe8feebba28` | Verify same-branch CI rerun and installation/uninstall smoke; no distribution until license and signing review |
| 2026-11-18 | ENC-02 local CLI default .gize export, synthetic renamed .gaiz verify/open test, explicit legacy filename and no-overwrite checks | None verified (new CI required; cross-product consumers pending) | Windows file associations, TEFE/TEBE readers and downloads require separate acceptance | `gaiz/cli.mjs`, `gaiz/cli-extension.test.mjs`, `gaiz/README.md`, `.github/workflows/gaiz-ci.yml`; branch tip `fd03e9f7411fe96478f933d98603a77431cb8bad` | Confirm exact-commit CI; verify extension and magic compatibility across three repositories and Windows integration |
| 2026-11-18 | ENC-09 cross-repository compatibility inspection: TEFE `.gaiz`-only UI changed to accept `.gize` and legacy `.gaiz`, canonical output names; TEBE preview reads GAIZ2 magic and remains authorization-denied | None newly verified; TEFE CI pending | TEBE GAIZ1 quarantine intake separate, no approved live upload/import; full consumer/Windows acceptance required | [TEFE draft PR #81](https://github.com/2029TEFE/TEFE/pull/81), `gaiz-format.mjs`, `gaiz2-verifier.mjs`, OT [PR #73](https://github.com/faisalwrokksa-hub/TO/pull/73) | Review TEFE checks, compare TO/TEBE/TEFE vectors, verify live integrations only after explicit approval |
| 2026-11-18 | OPS-06 CI concurrency — reduce redundant Windows builds after each PR revision; keep latest revision checks mandatory | None newly verified; current-head CI pending | Original archive, Windows signed installer, cross-repo integration and live deployment | `1102a01e71ca9dcc9bf57eef450c8245def541a1`: concurrency groups added to five OT workflows, cancel superseded PR runs only | Confirm CI runs on latest head, fix failures, preserve required security checks and release NO-GO |

| 2026-11-18 | OPS-06 bounded 15-minute NSIS packaging step and 180-second Chocolatey timeout; ENC-09 TEFE independently signed recipient-order and wrapped-key-size negative tests aligned with TO/TEBE | None newly verified on newest branches; CI rerunning | Original source archives, Windows installer signing, independent security review, all consumer acceptance | OT commit [`9d37729391ea6ac5ce886eff9745856b13485d9d`](https://github.com/faisalwrokksa-hub/TO/commit/9d37729391ea6ac5ce886eff9745856b13485d9d); TEFE commits [`23622ce`](https://github.com/2029TEFE/TEFE/commit/23622ce091faa2f66f3da88cde671f084c939595) and [`7f9b7de`](https://github.com/2029TEFE/TEFE/commit/7f9b7dedc36864ce1308f7bd0d29724d11149362) | Confirm exact newest CI, preserve draft PRs until acceptance; no security or release bypass |

| 2026-11-18 | OPS-06 Chromium NSIS build-speed fix: replace solid LZMA with non-solid zlib for large preview installer; package size may grow, installed files and signing/release gates unchanged | None newly verified; latest-head Windows installer CI pending | Offline Chromium install/uninstall smoke, artifact SHA and code signing still needed | [OT commit 4b63a626](https://github.com/faisalwrokksa-hub/TO/commit/4b63a626b18153e12e72c7c1580b831d953d8016), `tools/TheOrgChromium.nsi` | Check exact final head Chromium CI and installer smoke; keep production NO-GO |

## Mandatory expert update after EVERY task — owner instruction 2026-11-18
1. Before starting: inspect this task's **full acceptance wording** in [canonical source master](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md), current source code, test suites and dependencies. Write plan against stable ID.
2. Immediately **after each individual completed, reclassified, failed or blocked task**, update the task checkbox/status **in this file** and add a matching comment in the repository's progress issue. Do **not** defer until the end of a batch. Keep the full set of IDs and their source URLs intact.
3. For each update record UTC time, current status, source link, changed file paths, exact PR and commit SHA, test/scan run URL and result, deployment URL/SHA if required, blocker/fix, and next step. Only check the box when VERIFIED. Do not mark complete solely from a green PR or merged commit.
4. **Owner change requests:** user may write `gize tefe: <new instruction>`, `gize tebe: <new instruction>`, or `gize ot: <new instruction>` in a GitHub-capable chat, or comment on the appropriate progress issue. Expert must acknowledge, map to existing/new stable IDs, record new acceptance criteria and precedence, and update this file with a linked change log. Never silently remove old requirements.
5. **On each check command:** re-read ALL tasks and associated evidence, compare to latest code/PRs/checks/deployment, flag failing tests and security issues with severity and suggested safe bulk fixes, then publish the complete current checklist. No unsupported completion percentage.
6. User authorizes routine reversible engineering work and tests; preserve required review/security gates and explicit final release authorization. Changes to these Markdown files are not automated unless invoked by an agent or a CI workflow.


## AO integration: row-by-row synchronization addendum — 2026-11-18

**Scope:** This addendum explicitly crosswalks **all 78 existing OT source IDs** to the AO adoption assessment. It is a **planning/coverage index**, not a claim that each original requirement is implemented, that AO is needed by every item, or that any checkbox should be changed. Original source wording, source IDs, checkboxes, evidence, verified statuses and release requirements above remain controlling and unchanged. Assignments below are **candidate applicability only** until the expert checks actual code and records a specific decision.

**Pinned shared files, no re-download:** [AO reference files and original AGPL attribution](https://github.com/faisalwrokksa-hub/TO/tree/main/docs/vendor/agentone), already merged to OT `main` via [#78](https://github.com/faisalwrokksa-hub/TO/pull/78); [AO schemas and policy prototype #79](https://github.com/faisalwrokksa-hub/TO/pull/79) and [Chrome/Windows capability handshake #80](https://github.com/faisalwrokksa-hub/TO/pull/80) have since merged into `main` after CI. These merges do not establish full AO execution, tenant authorization, customer acceptance or production readiness. The curated conversation ZIP is **not** stored as a binary in GitHub and should not be described as available there. Existing `.gize`/`.gaiz` and GAIZ1/GAIZ2 identifiers remain unchanged.

**Source licensing boundary:** Use the internal name **AO** in GIZE requirements and tasks. Preserve upstream original names and AGPL-3.0 notices in the vendor archive, license/legal citations and immutable provenance. User-reported special permission needs scope and legal validation before distributed proprietary source reuse. Never run/install an uploaded EXE to infer source contents.

**For each source ID:** expert confirms AO applicability (applicable / dependency-only / not applicable), actual implementation path and pending acceptance; tests at exact commit and signs off security/tenant/locale/deployment evidence. An AO integration candidate cannot advance the original checkbox without meeting the source's full acceptance requirements. Do not silently introduce parallel ungoverned runtimes or production-facing claims.

| Original requirement ID | AO candidate mapping / individual owner subtask | AO assessment | Required individual follow-up |
|---|---|---|---|
| [OWN-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO ownership candidate — preserve boundaries, source IDs and release-authority decisions | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [OWN-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO ownership candidate — preserve boundaries, source IDs and release-authority decisions | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [OWN-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO ownership candidate — preserve boundaries, source IDs and release-authority decisions | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [OWN-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO ownership candidate — preserve boundaries, source IDs and release-authority decisions | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [EVD-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO master evidence candidate — trace pinned source, legal terms, actual commit/test/release evidence; never equate drafts with completion | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [EVD-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO master evidence candidate — trace pinned source, legal terms, actual commit/test/release evidence; never equate drafts with completion | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [EVD-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO master evidence candidate — trace pinned source, legal terms, actual commit/test/release evidence; never equate drafts with completion | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [EVD-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO master evidence candidate — trace pinned source, legal terms, actual commit/test/release evidence; never equate drafts with completion | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [AUD-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO master evidence candidate — trace pinned source, legal terms, actual commit/test/release evidence; never equate drafts with completion | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [AUD-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO master evidence candidate — trace pinned source, legal terms, actual commit/test/release evidence; never equate drafts with completion | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [AUD-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO master evidence candidate — trace pinned source, legal terms, actual commit/test/release evidence; never equate drafts with completion | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [AUD-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO master evidence candidate — trace pinned source, legal terms, actual commit/test/release evidence; never equate drafts with completion | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [AUD-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO master evidence candidate — trace pinned source, legal terms, actual commit/test/release evidence; never equate drafts with completion | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [AUD-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO master evidence candidate — trace pinned source, legal terms, actual commit/test/release evidence; never equate drafts with completion | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [AUD-07](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO master evidence candidate — trace pinned source, legal terms, actual commit/test/release evidence; never equate drafts with completion | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [AUD-08](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO master evidence candidate — trace pinned source, legal terms, actual commit/test/release evidence; never equate drafts with completion | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [AUD-09](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO master evidence candidate — trace pinned source, legal terms, actual commit/test/release evidence; never equate drafts with completion | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [UX-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO desktop UX/locale candidate — verify accessible, translated browser/desktop operations and denial states | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [LOC-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO desktop UX/locale candidate — verify accessible, translated browser/desktop operations and denial states | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [PC-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [PC-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [PC-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [PC-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [PC-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [PC-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [PC-07](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [PC-08](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [PC-09](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [PC-10](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [TASK-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO specialist execution candidate — controlled local tools, queue/idempotency, independent QA and sync authorization | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [TASK-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO specialist execution candidate — controlled local tools, queue/idempotency, independent QA and sync authorization | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [TASK-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO specialist execution candidate — controlled local tools, queue/idempotency, independent QA and sync authorization | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [TASK-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO specialist execution candidate — controlled local tools, queue/idempotency, independent QA and sync authorization | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [TASK-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO specialist execution candidate — controlled local tools, queue/idempotency, independent QA and sync authorization | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [TASK-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO specialist execution candidate — controlled local tools, queue/idempotency, independent QA and sync authorization | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [TASK-08](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO specialist execution candidate — controlled local tools, queue/idempotency, independent QA and sync authorization | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [TASK-09](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO specialist execution candidate — controlled local tools, queue/idempotency, independent QA and sync authorization | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [TASK-10](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO specialist execution candidate — controlled local tools, queue/idempotency, independent QA and sync authorization | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [SYNC-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO specialist execution candidate — controlled local tools, queue/idempotency, independent QA and sync authorization | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [SYNC-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO specialist execution candidate — controlled local tools, queue/idempotency, independent QA and sync authorization | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [SYNC-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO specialist execution candidate — controlled local tools, queue/idempotency, independent QA and sync authorization | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [ENC-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO encrypted-artifact dependency — preserve GAIZ1/GAIZ2 byte formats, .gize/.gaiz compatibility, authorization and negative fixtures | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [ENC-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO encrypted-artifact dependency — preserve GAIZ1/GAIZ2 byte formats, .gize/.gaiz compatibility, authorization and negative fixtures | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [ENC-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO encrypted-artifact dependency — preserve GAIZ1/GAIZ2 byte formats, .gize/.gaiz compatibility, authorization and negative fixtures | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [ENC-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO encrypted-artifact dependency — preserve GAIZ1/GAIZ2 byte formats, .gize/.gaiz compatibility, authorization and negative fixtures | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [ENC-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO encrypted-artifact dependency — preserve GAIZ1/GAIZ2 byte formats, .gize/.gaiz compatibility, authorization and negative fixtures | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [ENC-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO encrypted-artifact dependency — preserve GAIZ1/GAIZ2 byte formats, .gize/.gaiz compatibility, authorization and negative fixtures | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [ENC-07](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO encrypted-artifact dependency — preserve GAIZ1/GAIZ2 byte formats, .gize/.gaiz compatibility, authorization and negative fixtures | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [ENC-08](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO encrypted-artifact dependency — preserve GAIZ1/GAIZ2 byte formats, .gize/.gaiz compatibility, authorization and negative fixtures | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [ENC-09](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO encrypted-artifact dependency — preserve GAIZ1/GAIZ2 byte formats, .gize/.gaiz compatibility, authorization and negative fixtures | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [ENC-10](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO encrypted-artifact dependency — preserve GAIZ1/GAIZ2 byte formats, .gize/.gaiz compatibility, authorization and negative fixtures | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [OPS-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [OPS-07](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [WIN-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [WIN-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [WIN-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [WIN-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [WIN-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [WIN-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [WIN-07](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [WIN-08](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [WIN-09](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO Chrome/Windows candidate — extension/native host permission boundary, disabled handshake, signed installer and offline device tests | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [PERF-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [PERF-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-01](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-02](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-03](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-04](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-05](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-06](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-07](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-08](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-09](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-10](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-11](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-12](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-13](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |
| [REL-14](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md) | AO release/operations candidate — CI, supply chain/legal acceptance, performance, signed build, rollback and live readback | NOT_ASSESSED (AO impact) | Expert to cite code path + tested PR SHA + negative test/review evidence, or record not applicable with reason |

**Synchronization check:** 78/78 source IDs listed once, none re-numbered or marked completed. On each subsequent expert PR, update the specific row and original requirement status and record evidence in [OT issue](https://github.com/faisalwrokksa-hub/TO/issues/71). Source-only catalog and handshake implementation do not constitute customer acceptance. Production remains NO_GO until independently verified.


## AO Chrome/Windows batch audit — 2026-11-18 (23:14 Asia/Riyadh execution)

**Evidence basis:** GitHub PR heads and Actions check conclusions examined in this execution cycle; these are development/CI results, not customer deployment evidence. Do not convert the 78 unassessed source requirements into VERIFIED from these observations alone.

| Area | Work and evidence | Assessment / next gate |
| --- | --- | --- |
| Read-only AO native capability discovery | [TO #80](https://github.com/faisalwrokksa-hub/TO/pull/80) adds Chrome background/task manager handshake, .NET native host command and Windows native-messaging smoke assertions. Additional mocked Chrome negative tests committed on its feature branch. | IMPLEMENTED_UNVERIFIED for cross-repo/customer acceptance; native AO execution explicitly disabled; fresh CI and independent review required |
| AO tool policy/contracts | [TO #79](https://github.com/faisalwrokksa-hub/TO/pull/79) stages versioned schemas, a deny-first prototype and synthetic tests. | Prototype only; TEBE authorization, principal/tenant binding, credential custody, endpoint allowlists and live MCP tool dispatch NOT VERIFIED |
| GIZE artifact naming and compatibility | [TO #75](https://github.com/faisalwrokksa-hub/TO/pull/75) adds canonical new-export .gize filename handling and legacy .gaiz compatibility tests; GAIZ1/2 signed wire bytes remain unchanged. | Development checks green at inspected PR head, but production crypto/key custody, revocation and cross-product release sign-off remain BLOCKED |
| Source requirement synchronization | [TO #81](https://github.com/faisalwrokksa-hub/TO/pull/81) preserves the 78/78 row crosswalk to AO ownership and acceptance gates. | Source crosswalk implemented on PR only; each row still needs requirement-specific evidence |
| CI and Windows acceptance | Earlier audited PR heads #75, #79 and #80 reported clean GitHub check suites. #81 had an in-progress Windows build on inspection. | NOT equivalent to signed installer, local-machine upgrade, TEBE two-tenant end-to-end, or production security review |
| Merge and release | At inspection, #75 and #73 remained drafts; #79, #80 and #81 were open. No independent approval review was recorded on #75/#79/#80/#81. | NO_GO for auto-merge on unreviewed security/integration changes; do not bypass branch rules or approve own work |

**Open blockers:** (1) independent code/security review; (2) finish current-head Actions after concurrent branch updates; (3) real Windows installation/native host/Chrome E2E with synthetic tenant-separated data; (4) tenant-bound TEBE AO API and bounded execution policy, absent from the disabled discovery phase; (5) GIZE key custody and cross-language acceptance; (6) source ZIP/migration evidence that remains unavailable to all reviewers; (7) complete locale and customer-facing workflow acceptance; (8) explicitly authorized signed release and rollback readback. No production merge or deployment claimed.

## AO Chrome/Windows integration evidence update — 2026-11-18

**Integration scope:** AO phase 1 is read-only, disabled native capability discovery, not live AO execution, external MCP orchestration, tenant-authorized dispatch, or customer readiness. The candidate Chrome MV3 → Windows .NET native-messaging handshake is in [OT PR #80](https://github.com/faisalwrokksa-hub/TO/pull/80). Added synthetic malformed/enabled host-response denial regressions in tests/task-manager.test.cjs at commit 6b8ea9d. Actual Windows bridge framing and unsupported ao_execute rejection are covered by tests/native-messaging-smoke.py on the PR branch. Hardware acceptance and TEBE authorization remain unverified.

**AO contracts:** [OT PR #79](https://github.com/faisalwrokksa-hub/TO/pull/79) contains three versioned JSON schemas and an isolated deny-first policy prototype; commit 87724f9 adds .github/workflows/ao-contracts-ci.yml tests. This is not production authorization, crypto key custody, MCP egress security or AGPL legal certification. Execution must remain disabled pending independent security review and per-tenant TEBE enforcement.

**Related GIZE compatibility:** [OT PR #75](https://github.com/faisalwrokksa-hub/TO/pull/75) at observed SHA 9b77520 had six successful CI workflows, including portable Windows acceptance, but remains an unmerged draft. Crypto review and cross-product consumers remain pending. [OT PR #73](https://github.com/faisalwrokksa-hub/TO/pull/73) was undergoing concurrent changes and lacks a verified current-head full check set. Reconcile overlapping gaiz/cli.mjs, CI workflow, checklist and smoke tests without overwriting expert work.

**Per-ID synchronization:** The 78 candidate rows above remain NOT_ASSESSED for AO impact until each original requirement is individually inspected. The capability handshake cannot change original completion states. Owners: OT guarded Chrome/Windows execution, TEBE tenant and approval contracts, TEFE user-facing disclosures, master independent audit.

**Merge and release gates:** No reviews submitted on open OT PRs at this check. Do not self-approve or bypass required reviewers. Merge only with current-head CI and required review. Keep execution disabled, preserve upstream AGPL notices and .gize/legacy .gaiz, retain production NO_GO pending signed installers, real Windows upgrade/uninstall, all declared locales, two-tenant E2E security, legal approval and deployed-revision readback.

### 2026-11-18 AO bulk CI and security hardening readback

- OT #80 (commit `6b8ea9d`): **4/4 latest-head GitHub workflows SUCCESS**, including Windows Native Messaging and offline Chromium CI. This is *disabled capability discovery*, not AO execution. Mandatory human/security review and actual-device acceptance remain outstanding.
- OT #79: new CI workflow validates three AO schemas and a deny-first policy; shell quoting defect was fixed. Subsequent hardening binds privileged approvals to request ID, tool ID, tenant ID and principal ID and rejects unknown transports (latest candidate commit `c8038b5`); fresh CI and independent review required.
- OT #75 (commit `9b77520`): **6/6 latest-head workflows SUCCESS** including Windows portable acceptance; still draft, no independent cryptographic/tenant/release reviewer approval.
- OT #73: concurrent changes and merge conflict; latest-head complete CI and resolution outstanding. Do not discard unique GAIZ2/installer test changes.
- OT #81: this evidence addendum preserves all 78 original requirement mappings without marking any source ID complete. All PRs require their own current-head checks and required reviews; no auto-approval of privileged execution.

## Reconciled merge evidence — 2026-11-18 21:34 UTC

**Current status supersedes the older PR snapshots in this addendum.** The prior sections record what was observed *before* these merges; do not treat their former draft/CI/merge blockers as current. Routine PR merge approval is optional under the owner's updated instruction, while actual GitHub-enforced protections, successful latest-head CI and release safety gates remain mandatory.

| OT PR | Verified integration into `main` | Scope and limits |
|---|---|---|
| [#73](https://github.com/faisalwrokksa-hub/TO/pull/73) | MERGED as `8c6d3d147fa4be5aa840f41f2f7afdeebd6cdcef` after 5/5 CI passed | GAIZ2 negative vectors, default .gize, Windows CI and synthetic AO smoke; not external security certification |
| [#75](https://github.com/faisalwrokksa-hub/TO/pull/75) | MERGED as `28c645ac3fb9a39df6844084fd47d3731259cd46` after 6/6 CI passed | Canonical filename policy, compatibility tests and source-presence readiness tool; not proof of production key custody or signed customer release |
| [#79](https://github.com/faisalwrokksa-hub/TO/pull/79) | MERGED as `b33ce3d4f0604f2d75304299ed04c5534a4cc792` after 5/5 CI passed | AO contracts and deny-first isolated policy prototype; not server-enforced TEBE tenant authorization |
| [#80](https://github.com/faisalwrokksa-hub/TO/pull/80) | MERGED as `b592d10491583d8c20e4da0706e1899f7c05587d` after 4/4 CI passed | Read-only, disabled AO Chrome/Windows capability handshake; no privileged AO tool execution enabled |
| [#81](https://github.com/faisalwrokksa-hub/TO/pull/81) | Candidate until its newest commit passes CI and merges | 78/78 AO impact mappings remain NOT_ASSESSED, no source requirement marked VERIFIED by the mapping |

**Current remaining gates:** verify each of the 78 AO-impact mappings against the authoritative source and implementation, independent cryptographic/legal assessment, safe real-device Windows and Chrome integration, TEBE-authenticated two-tenant enforcement, TEFE consumer compatibility, supported locale acceptance, signed installer and evidence-backed production release/rollback. The presence of merged code does **not** close these gates. AO tool execution remains disabled; production release remains **NO_GO**.

## AO native-tool catalog integration — 2026-11-19

**Pending current-head CI; no source requirement verified.** PR [#82](https://github.com/faisalwrokksa-hub/TO/pull/82) adds six descriptive local tool-risk entries, fail-closed Chrome disclosures, and Windows self-tests. Original PC-05 and PC-07 remain unchecked **IN_PROGRESS** because per-action native enforcement, device acceptance and authenticated TEBE tenant policy are not proved by this catalog. Existing AO #79 contracts and #80 disabled read-only handshake are merged in `main`. All 78 source IDs and original evidence remain intact. Arbitrary MCP/tool execution and production deployment remain disabled.


## AO catalog validation patch — 2026-11-19

PC-05 and PC-07 remain IN_PROGRESS; no acceptance upgrade. PR #82 commit `35bcf26e28824ddd6b7c2205b99272f23ca1addf` adds strict Chrome-side descriptive catalog validation in `apps/chrome-extension/home.js` and executable negative tests in `tests/ui-contract.test.cjs`. Rejects duplicate/unknown tools, malformed records, expanded fields, altered risk/scope/execution/version/approval/batch flags, and remote execution. Local Node 24 syntax passed and UI contract suite passed 7/7 including 20 invalid-catalog cases. This display validator does not grant native authority or prove native enforcement. Exact-head Windows/Chromium CI and independent security review pending; no .NET runtime or Windows hardware in this execution environment. MCP remains disabled; customer release NO_GO. Modern Web Guidance adapter read; upstream npm CLI not run in restricted network environment; existing MV3/CSP standards preserved.


## Native approval binding batch — 2026-11-19

Owner instruction: "fix in bulk, auto approval = 1". Existing PR #82 reused. PC-05/PC-07 remain IN_PROGRESS; TASK-04/TASK-09 acceptance not upgraded. Native candidate changes in `engine/bridge/LocalAgentEngine.cs` and `engine/bridge/Program.cs`: strict exact plan JSON schema for model/stored plans; duplicate/case-colliding native JSON field rejection; approval fingerprint binds job/company/order/plan/approved hosts; atomic approval and execution compare stored plan/scope; completion requires live per-step token and successful state update. Added compiled self-test cases for duplicate requests, seven altered/malformed plans, expanded host scope, process restart and browser receipt replay. Native tests pending Windows CI; local .NET unavailable. Prior Chrome UI suite 7/7 passed locally. Existing preview queued jobs without fingerprint fail closed: create and explicitly approve a fresh plan. Fingerprint detects approval drift, not hostile OS/database-owner tampering. No tenant authentication, model acceptance, independent review, hardware acceptance or signing gate claimed complete. Customer release remains NO_GO; remote MCP disabled.


## Local inference transport limits — 2026-11-19

Owner authorizes code/deployment changes and routine completion auto-approval. PC-07/PC-09/PC-10 remain IN_PROGRESS or their existing source status; no source ID newly VERIFIED. Existing PR #82 candidate adds local-only no-proxy/no-redirect inference transport, a 65-second deadline covering response headers and body, 512 KiB response bound for declared and unknown-length bodies, explicit malformed/empty-envelope rejection and deterministic cancellation errors. Compiled synthetic self-tests cover valid response, six malformed envelopes, redirect denial, declared and streamed overflow (at most one excess byte read), and cancellation. These tests do not load a model or prove offline AI/hardware acceptance. CI pending at commit creation; exact-head evidence is reported in #71/PR #82. No production release, signed installer or remote MCP activation claimed.


## PC-04 / PC-05 / PC-07 — pinned Windows executable candidate (2026-11-19)

The reviewed Notepad-only tool previously called Process.Start with a bare executable name, allowing current-directory/PATH resolution. Candidate now resolves the absolute Windows system-directory Notepad path and fails closed when unavailable; no new arguments, shell, browser permission or remote capability. Compiled Windows self-test temporarily replaces process PATH, verifies the absolute system target is unchanged, and restores PATH in finally without launching an application. CI and independent review pending at commit creation. Source requirement statuses and checkboxes remain unchanged; this is one bounded implementation subcheck, not complete Windows acceptance. Owner authorized code/deployment completion work; no production target, signing or real-device evidence inferred.

## Release preflight safety regression — 2026-11-19

REL-08 / REL-09 / REL-11 candidate subcheck in PR to be linked from issue #71: tighten `tools/check-release-readiness.cjs` so production `GO` cannot be computed without an exact matching current build SHA, and a syntax-only URL cannot identify a local/IP-literal deployment destination as verified. Add negative tests for IPv4 loopback/private/metadata, IPv6 loopback/link-local, local-only DNS, malformed names and missing/mismatched build commits. This is a preflight policy improvement only: all original source checkboxes remain unchecked, real DNS/TLS/route ownership is independently unverified, signed Windows release and production deployment remain `NO_GO`. GitHub CI and exact PR evidence must be recorded after completion.

## PC-07 browser navigation scope hardening — 2026-11-19

**Candidate, not customer acceptance.** The OT native agent now rejects local and special-use DNS suffixes, IP literals, malformed labels, and blank comma entries when parsing owner-reviewed browser hosts. It preserves normal normalized DNS hosts and exact-URL receipts. Compiled .NET synthetic self-tests exercise 21 rejected host scopes and six mismatched browser navigation receipts without opening a browser. This reduces accidental local-service/navigation scope expansion; it does **not** resolve live DNS addresses, prove TLS ownership, certify a browser visit, or constitute independent Chrome GUI acceptance. PC-07 and cross-repo/Windows release requirements remain unchecked **IN_PROGRESS** until exact-head CI, physical-device and independent acceptance evidence are recorded. Production `NO_GO` remains unchanged.


## Measured register reconciliation — 2026-11-19

EVD-02 evidence-maintenance subcheck: counted the 78 original assigned checkbox rows against the controlling 150-ID source; all original rows remain unchecked. The prior summary said 78 not assessed despite seven rows already IN_PROGRESS. Corrected summary only; no requirement status upgraded. Current implementation baseline is `babb4c5cde3a912b62663ecc9fa2b86f3339f15b` (merged PR #96). Main Windows bridge and offline Chromium workflows succeeded (44514196998, 44514197133); these are CI evidence, not physical-device acceptance. Signing, actual release destination/readback, independent cryptography/security/legal acceptance, real offline inference and authenticated cross-repo customer acceptance remain unavailable; customer NO_GO. Next implementation batch: inspect tenant-bound native authorization contract and add negative tests without enabling remote execution.


## PC-05 / PC-07 cross-workspace native command regression — 2026-11-19

Candidate test commit `5d59f7302d2b5375d246769f68deab8c35321b7d` in PR #97 extends compiled native self-tests to reject seven foreign-company commands against a known job (approve, run-next, safe-batch, cancel, recover, review, browser completion) and confirms owner job state is unchanged. Uses fresh native Controller instances and synthetic SQLite state. No runtime capability enabled; this tests local workspace isolation, not authenticated enterprise identity. Fresh exact-head Windows CI pending; physical hardware, tenant integration, signing and independent acceptance unavailable. All 78 IDs and statuses retained; customer NO_GO.


### PC-05 / PC-07 test fixture correction — 2026-11-19
Exact head `733318899529058c1b92e022cf5267d9eaffa71f` failed Windows self-test (run44553395746/job135662927449): owner state assertion assumed completed_pending_review after agent_review had already transitioned the job. Fix `280f01c1577518597bb3c91ba7427568c68e5494` snapshots actual owner status and step index before the seven foreign commands and requires both unchanged afterward. Denial assertions remain intact. Fresh exact-head CI pending; no runtime security failure or acceptance inferred. All original requirement statuses unchanged; NO_GO remains.


## PC-05 / PC-07 recovery and stale receipt regression — 2026-11-19

Candidate `5c2a7be1ca4cc82ea5e8a64953e3402e94d44c1f` adds compiled synthetic native tests: restart during pending browser navigation, require blocked/manual-review recovery, reject run-next/safe-batch/reapproval and late original-token receipt, preserve unfinished step index. No browser launched and no real hardware outcome inferred. Main baseline29676ed0f9785dea72c8f0e92e9191d52b72c6d4 had all five core checks SUCCESS. Fresh candidate Windows CI pending. All78 assigned IDs/statuses unchanged; NO_GO until signing, deployment destination/readback, real offline-model, tenant integration and independent hardware/security acceptance.


## PC-05 / PC-07 atomic recovery candidate — 2026-11-19

Codef162a6c517f854254e6137d95160d59362a4a069 replaces unconditional recovery update with BEGIN IMMEDIATE transaction, matching company/running state/step index/token and requiring one affected row before audit commit; clears persisted step token. Concurrently changed state fails closed rather than overwriting completion. Synthetic native tests assert database token is NULL and repeated recovery cannot resume, alongside existing late-receipt/replay denials. Exact-head Windows CI pending; no physical concurrency/hardware acceptance claimed. All78 original source statuses retained; deployment/signing/tenant/independent acceptance remain NO_GO.


## PC-05 / PC-07 completion-before-recovery regression — 2026-11-20

Test candidate0b8e1e8d0c61874d4fbe09a0f6aace237dc0d4f7 checks completed browser status/index survive subsequent recovery and consumed receipt cannot be revived. Complements recovery-before-receipt tests. These are deterministic ordered SQLite/Controller fixtures, not simultaneous thread interleaving or physical browser acceptance. Main0103ed7c1465018615be5a4c05e8564d7b99627e has all five core checks SUCCESS. Fresh candidate Windows CI pending; all78 requirement statuses preserved and customer NO_GO remains for signing/real target/hardware/model/tenant/independent acceptance.


## PC-05 / PC-07 concurrent recovery regression — 2026-11-20

Candidate5acde1f10163edda0a35479feab14a6bb80ab038 releases two native Controller workers together against synthetic SQLite: receipt completion versus recovery. Requires completion within30seconds, either blocked/index0 or completed_pending_review/index1, and denies receipt replay afterward. Actual worker scheduling is nondeterministic; this does not force every stale-snapshot interleaving or prove physical hardware acceptance. Exact-head Windows CI pending. Baselinebdf9287 core checks all SUCCESS. All78 original statuses unchanged; customer NO_GO for signing/target/hardware/model/tenant/independent acceptance.


## Artifact compatibility ambiguity rejection — 2026-11-20

Candidate2071fbd74ff8d08e35ba35b01639e39e644e7b42 rejects duplicate JSON member names recursively before GAIZ1/GAIZ2 structural acceptance. Tests a46f551f986534eda8ba5e3d7cbec7d1a8e3b215 cover positive structural intake and duplicate signature/manifest tenant denial across both wire headers and .gaiz/.gize suffixes. Structural intake is not signature verification/decryption/tenant authorization. Fresh Windows CI pending; all78 original source statuses unchanged, release NO_GO retained.


## Artifact malformed-envelope regression — 2026-11-20

Candidate1c13f46a9fa084cce5f06fdb5570c27e06507787 adds36 negative structural intake cases: invalid root/manifest/signature/ciphertext types, trailing commas/comments/trailing data, excessive nesting and invalid UTF8, across GAIZ1/GAIZ2 and both .gaiz/.gize suffixes. Baseline75fa745 core checks SUCCESS. Exact-head compiled Windows CI pending; no cryptographic/decryption/tenant acceptance inferred. All78 original statuses retained; customer NO_GO remains for signing/target/hardware/model/tenant/independent acceptance.


### Invalid UTF8 intake finding — 2026-11-20
PR #103 head3d3f75d Windows job136102748609 failed invalidUTF8 rejection: JsonDocument structural parsing did not force decoding of unused string data. Candidate fix explicitly decodes the already8MiB-bounded envelope with throwing UTF8 before JSON parsing, retaining depth/comments/duplicate restrictions and the negative test. Fresh exact-head CI required; no cryptographic or customer acceptance claimed. NO_GO unchanged.


## Windows archive path boundary — 2026-11-20

EVD-02/EVD-03 bounded native intake evidence: runtime `45379e6ed70cc90fcb24196c34ec3687e6a298a3` normalizes separators before rejecting rooted/UNC paths, drive paths, alternate data streams and traversal. Self-tests `34d77146a3c2ef7b333e8497002a5e7c46327796` cover nine unsafe names plus two safe nested relative names. Baseline `beae57fb4db3b263624e3902aa4d2cd7e94e6e9e` actual postmerge checks SUCCESS. Exact-head Windows CI pending; dotnet unavailable locally. This is structural intake only, not extraction, malware scanning, cryptographic or independent Windows acceptance. Original source statuses remain unchanged; signing/key custody, physical hardware, real inference, tenant integration, independent security/legal and actual deployment target/rollback/readback remain NO_GO. Next: inspect final CI and remaining offline runtime gaps.


## EVD-02/EVD-03 — bounded offline note reads, 2026-11-20
Runtime 5d1ab9096a244cef138f281c1abb105caee684eb bounds actual open-stream reads to 32768 bytes and uses strict UTF8, avoiding reliance on an earlier file-size observation. Tests cover exact limit, one-byte overflow and malformed UTF8. Exact-head Windows CI pending; no local dotnet or physical hardware evidence. Reparse-point custody is a separate unresolved dependency. Original 78 source statuses unchanged; no full requirement verification. NO_GO remains signing/key custody, hardware, real inference, tenant integration, independent security/legal and release target/rollback/readback.


## EVD-02/EVD-03 — existing note-link denial, 2026-11-20
Candidate runtime abba678dbecf08742b624843380959ed01d1bcc9 rejects existing reparse-point components before bounded note reads; negative symbolic-link fixture51fe1bbd98347570ee7722ca2add7fb406d22bc1. This pre-open inspection does not solve concurrent parent replacement or establish complete handle-based custody. Windows CI must create the real synthetic link and pass; privilege failure is not a pass. Baseline42dd9f1 postmerge checks SUCCESS. No original requirement status promoted; customer NO_GO remains signing/key custody, physical hardware, real inference, tenant integration, independent security/legal and actual deployment/rollback/readback.


## EVD-02/EVD-03 — parent-directory link regression, 2026-11-20
Test candidate 775b94177f5f4464c10abbf6c5ab3a9a0e79a06d creates a real synthetic directory symbolic link, requires denial of a regular leaf reached through it, and requires the same leaf through its ordinary parent to remain readable. Baseline abe75fa60529905833cc65107d802aeaade07e38 postmerge Windows/build/packaging checks SUCCESS. Exact-head Windows CI pending; do not skip privilege failures. No concurrent replacement/handle custody guarantee, physical Windows or independent acceptance inferred. Original source statuses and customer NO_GO unchanged. Next: exact-head checks then handle-bound custody investigation.


## EVD-02/EVD-03 — bounded output integrity hashing, 2026-11-20
Runtime4a00e4296d55fe63964d457c8b6de40c70208ff5 replaces unbounded review File.ReadAllBytes with an open-stream 32768-byte bound and hashes original bytes without decoding. Tests259e071813d90f1a55eb79be7e5fc126cdc10112 require exact-limit raw-byte SHA equivalence and one-byte overflow rejection. Exact-head Windows CI pending; no physical acceptance. Existing reparse/parent replacement custody remains separate. Original statuses unchanged; customer NO_GO signing/key custody, hardware, real inference, tenant integration, independent security/legal and target/rollback/readback.


## EVD-02/EVD-03 — public review oversized-output regression, 2026-11-21
Test da95532fa08d6b4e21e518b2557911bc78da1435 replaces a real completed synthetic job output with32769 bytes, calls agent_review through a fresh Controller, requires rejection and unchanged completed_pending_review status, then restores fixture bytes in finally. Baseline fba5b4b07c5d7dd5f8074856c03b488ad44a0895 actual postmerge Windows/build/packaging checks SUCCESS. Exact-head Windows CI pending; no physical/independent acceptance. No original requirement status promoted; customer NO_GO retained for signing/key custody, hardware, real inference, tenant integration, independent security/legal and deployment/rollback/readback. Next: inspect CI and review replacement/link custody.


## Amuse intake and policy hardening — 2026-11-20 UTC

Owner instruction: "fix in bulk" after requesting relevant source files pushed across repositories, latest-build PC acceptance and removal of the superseded installed app. Selected uploaded source is now readable and hash-pinned in the OT companion candidate. OT authorization flags, allowlist types and MCP URL syntax are hardened; 19 targeted policy tests pass. See `docs/vendor/amuse/GIZE-ADOPTION.md`.

Scope remains IMPLEMENTED_UNVERIFIED / partial integration. No source ID is newly VERIFIED. Amuse runtime/credential broker wiring, exact-build physical Chrome/Windows acceptance, signing and release remain outstanding. The older TheOrg Workspace 2 observations are excluded from current-build acceptance. The prior claim of no open OT PRs was stale at this audit. Follow the linked candidate PR and canonical issue for exact SHA/CI and subsequent device evidence.







## EVD-02/EVD-03 — integrity path link denial, 2026-11-21
Runtime d0ab60c04c33d7e6c65ab0ef09e2764aa8f1dd62 applies existing file/parent reparse-component rejection to bounded integrity hashing, matching note reads. Negative fixture4942d831c42cbfcd047cb53209d9af2bda65c880 requires denial of a real symbolic output link. Exact-head Windows CI pending. Pre-open checks do not close concurrent parent replacement; physical/signing/independent acceptance remains unavailable. No full source status promoted, customer NO_GO retained. Next: CI and guarded merge, then handle-bound custody work.


## EVD-02/EVD-03 — public review linked-output regression, 2026-11-21
Test cb96418ce839e762192ea4aff03b1be5cedb8676 replaces a completed synthetic output with a symbolic link to identical bytes, requires public agent_review rejection and unchanged pending-review state, then restores fixtures. Baseline643f476f851a63b1282f1f2f892bdeb2dde56378 postmerge checks SUCCESS. Exact-head Windows CI pending; no privilege skip or physical acceptance. Concurrent parent replacement remains unresolved. Original statuses unchanged; customer NO_GO signing/key custody, physical Chrome, inference/tenant integration, independent security/legal and release target/rollback/readback retained.


## WIN-04 / EVD-02 — locked-output regression, 2026-11-21
Synthetic exclusive FileShare.None writer fixture requires bounded read/hash IO rejection while held, then ordinary read success after release. This is a narrow active-writer subcheck, not migration/physical acceptance or concurrent parent-replacement custody. Baseline a1d68f616460897097e53bcd5219c18ae0539d87 postmerge checks SUCCESS. Exact-head Windows CI pending; original source statuses unchanged and customer NO_GO retained. Next: Windows result and handle-bound custody investigation.


## EVD-02/EVD-03 — Windows opened-path verification, 2026-11-21
Runtime8766ebb5dbd8676f1719b85f3de6c23454dc244a checks GetFinalPathNameByHandleW after opening and before reading/hash; failure or expected-path mismatch rejects. Test4b4dae0e000347a28d6e81b32835ce57c1d05e81 requires real Windows matching-path success and mismatch denial. Exact-head CI pending. This is path verification, not complete file identity/hardlink custody or exhaustive parent-swap proof; other hosts retain existing pre-open checks. Native-error and deterministic swapped-parent fixtures remain outstanding. No full requirement promoted; NO_GO signing/hardware/model/tenant/independent acceptance and release evidence retained.


## EVD-02/EVD-03 — redirected opened-handle regression, 2026-11-21
Test d551df75862fc7ade621097058f0b9e7b393d8df opens a real synthetic Windows symbolic link directly, then requires handle final-path validation to reject the requested link path with stream position still zero. Models redirected opening after prior inspection; not a scheduled concurrent parent-swap or hardlink identity proof. Baseline6344735c62274e2170198a19a695b9bebd9de074 postmerge checks SUCCESS. Exact-head Windows CI pending; source statuses unchanged, NO_GO signing/hardware/model/tenant/independent and release evidence retained. Native error fixture remains next.


## EVD-02/EVD-03 — non-disk opened-handle rejection, 2026-11-21
Test 47a9fc28ecd71083a2202f8d2b1530daec9ed8f9 opens Windows NUL read-only and requires RequireOpenedPath IOException rejection when a normal output path is expected. Exact-head CI must establish actual native behavior; no test skip. This checks denial of a non-disk handle, not a specific injected Win32 error code or concurrent parent swap. Baseline2e014211 postmerge checks SUCCESS; original source statuses/NO_GO retained. Physical/signing/independent acceptance remains open.


## EVD-02/EVD-03 — deterministic parent substitution, 2026-11-21
Test 67ebeec0b678b86192d78534e0494d5e0a78eebb observes an ordinary parent, moves it and replaces it with a directory symlink before opening; opened-handle verifier must reject with zero bytes consumed. This deterministically models the inspection/open boundary, not exhaustive thread scheduling or hardlink identity protection. Baseline41825aaa postmerge checks SUCCESS. Exact-head Windows CI pending; original source statuses unchanged and customer NO_GO retained for signing/key custody, physical Chrome, inference/tenant, independent security/legal and release evidence.


## TASK-04/TASK-09 — cancellation terminal-state guard, 2026-11-21
Cancellation previously updated by ID after a stale status read and could rewrite completed work. Candidate conditional update permits only same-company awaiting_approval/queued status matching the observed snapshot; concurrent claim or terminal state rejects. Public Controller negative test requires completed_pending_review remain unchanged. Exact-head Windows CI pending; cancellation audit atomicity and exhaustive race coverage remain separate. No source ID promoted; NO_GO retained.

- Follow-up: exact-head CI 44935097180 failed the status assertion because the test ran after review changed the state. Test reordered in 6d0fdc5; cancellation and audit event now share an immediate transaction with status/company/step-index compare-and-update in 495a7f5. Fresh exact-head CI and race acceptance pending; no VERIFIED promotion.


## TASK-04/TASK-09 — cancellation audit rollback fault, 2026-11-21
Test 6487471e5ebff9f73b5ec48c6061f07cdcf6dc21 injects SQLite trigger ABORT on cancellation audit insert, requires fresh Controller state remain awaiting_approval, removes trigger finally, then existing cancellation test continues. Current main7ad121cc already implements transactional cancellation; reused rather than duplicated. Exact-head Windows CI pending. No full requirement or physical acceptance promoted; NO_GO retained.


## PC Assist execution candidate — 2026-11-21T23:08Z

Owner clarified that THEEPMO PC Assist is GIZE Desktop Tools plus its Chrome extension, and requested actual full-task/PC execution. Browser slice: apps/chrome-extension/browser-workflow.js and browser-workflow-ui.js add reviewed single-origin read/fill/click/assertion execution, plan fingerprints, work-order-scoped durable receipts, permission checks, stop and no automatic replay. 64 local Node checks passed, including 17 new workflow tests in tests/browser-workflow.test.cjs. Full evidence, explicit optional-permission delta and remaining gaps: docs/PC-ASSIST-BROWSER-WORKFLOWS.md.

PC-03/04/05/07 and TASK-01/02/03/04: PARTIAL IMPLEMENTATION EVIDENCE ONLY. Existing requirement statuses remain; none newly VERIFIED. Real installed Chrome execution, Windows application interaction, natural-language/adaptive task completion, localization and a fair Codex/Agent One benchmark are not established. Candidate GitHub CI/PR/SHA to be linked from canonical issue #71 after publication. No deployment or extension permission grant occurred.

## Windows task-plan/cancellation follow-up

PC-03/04/05/07 and TASK-01/02/03/04: additional partial candidate evidence for
optional local-model proposals from observed controls, bounded reviewed same-window
plans, per-window locks, durable step receipts and stop-before-next-action.
68 local Node checks pass; worker/Python syntax passes. Four workflows passed at
8f770fb91a498d5e4f342c36d29ece5f87d39e12 before these newer changes. Fresh candidate CI
and tests/desktop-accessibility-smoke.py must establish runtime acceptance.
No owner-PC/model inference acceptance or VERIFIED promotion. See
docs/PC-ASSIST-WINDOWS-ACCESSIBILITY.md and canonical issue #71.



## PC-05 / SECURE-MEMORY — embedded permission boundary, 2026-11-22
Runtime 333eb33cc6e2b78541ac10c796bed7b4ff934090 explicitly denies unbrokered WebView2 permission requests on workspace and per-job browsers and disables general autofill/password autosave. Contract regression 7e407e8434b9476887aa4abaf51c884e3b70c82d requires all three controls on both surfaces. Static contract evidence only; fresh Windows compilation/launch CI and actual device denial acceptance pending. Existing standalone PR reused; no credential vault or VERIFIED acceptance inferred. NO_GO retained.


### PC-05 workspace origin follow-up — 2026-11-22
Candidate b75e5425fa2739ffb98cc6e019e98cd36bc69234 rejects custom ports and userinfo in privileged workspace navigation/message sources. Static negative contract f01452a471f2cee5e7b49535bfe3e9f24b25c78d guards both constraints. Prior f92482670df3f4831353b0caabbd28bc3fb2c607 passed seven actual checks; fresh candidate CI pending. Runtime adversarial WebView acceptance remains unavailable; no VERIFIED promotion, NO_GO retained.


### PC-05 runtime boundary test follow-up — 2026-11-22
Windows standalone Smoke now invokes production WorkspaceUrl for custom-port, userinfo, HTTP, wrong-host and wrong-path negatives plus ordinary positive. It reads actual initialized workspace and both job WebView profiles and fails if general autofill or password saving is enabled. Fresh candidate Windows launch CI pending; no user hardware or permission-prompt acceptance inferred. Prior head39a0575 passed seven checks; draft remains unmerged. NO_GO retained.


### SECURE-MEMORY synthetic revocation/company boundary — 2026-11-22
Existing Credential Manager candidate now has standalone Windows Smoke assertions that another company cannot load the synthetic saved login, deletion makes it unavailable, and repeated deletion succeeds. Reuses existing vault and cleanup, no live credentials. Fresh exact-head CI pending. Lock/wrong-user/tamper and scoped autofill broker acceptance remain incomplete; no independent acceptance or VERIFIED promotion. NO_GO retained.


### SECURE-MEMORY strict scope validation — 2026-11-22
Runtime b5d7b8c2163cfffea69cfbea7667b355e9f071db replaces .NET dollar anchors with absolute end-of-string anchors for company/job credential scope identifiers. Windows Smoke rejects trailing-newline IDs, HTTP, custom port and URL userinfo. Prior4f5ef30 passed seven checks including company isolation/revocation; fresh candidate CI pending. No full security/physical acceptance, NO_GO retained.


### SECURE-MEMORY synthetic replacement lifecycle — 2026-11-22
Standalone Windows Smoke now replaces the scoped synthetic saved login and requires both updated username/password on readback before existing deletion/absence checks. Prior892ceebb passed seven checks including strict-scope negatives; fresh exact-head CI pending. No real credentials, wrong-user/lock/broker or independent hardware acceptance inferred. NO_GO retained.


### SECURE-MEMORY malformed native record boundary — 2026-11-22
523cfbca1189bffd526120c9d619dea4e81eb6b8 rejects empty/odd/oversized credential blobs, null blob pointers and empty/oversized usernames before secret marshaling. 9d609f6d31f61dbb8c39009ea70d862edd4b70d1 exercises malformed metadata negatives without dereferencing synthetic pointers. Priorcbfffc2 passed seven checks; fresh CI pending. OS vault tamper/wrong-user/lock and hardware acceptance remain separate, NO_GO retained.


### SECURE-MEMORY saved-login target denial — 2026-11-22
Saved-login adapter now rejects disconnected, read-only, disabled, inert, hidden/aria-hidden and CSS invisible/collapsed targets before filling. Static contract regression guards these denial predicates. Fresh CI pending; actual hostile-page/physical acceptance remains unavailable. Prior0ec19e5 passed seven checks. NO_GO retained; no VERIFIED promotion.


### SECURE-MEMORY executable target guard regression — 2026-11-22
Regression executes the production saved-login visibility predicate extracted from the packaged C# script with synthetic element/style fixtures: ordinary positive; disconnected/disabled/read-only/concealed/zero-rect and CSS hidden/collapse/none negatives. This is executable predicate coverage, not a real DOM/hostile-page or physical browser test. Prior16acbe062 passed seven checks; fresh CI pending. NO_GO retained.


### SECURE-MEMORY actual WebView DOM candidate — 2026-11-22
be240358fc97cefc4e416d06f6863385093de761 shares production AutofillVisibility with Windows launch Smoke. Smoke creates/removes synthetic DOM inputs in the packaged workspace and requires ordinary visible positive plus hidden/inert/aria-hidden ancestor, read-only, disabled, CSS hidden/collapse/none and disconnected negatives. No credentials or third-party page involved. Fresh Windows CI pending; this does not establish hostile-origin/provider or physical acceptance. NO_GO retained.


### SECURE-MEMORY session lock candidate — 2026-11-22
f1d10c5a959337baa91c4d382267beaa846f37dc defaults app-session credential access to locked and rejects Load/Save while locked. Desktop11f84a62aeb4d84e1d0396d5c22d32bf356662f2 adds explicit native-toolbar unlock confirmation/relock and synthetic locked read/save denials. This is process-local user consent, not Windows reauthentication or protection against other processes; OS credential custody unchanged. Fresh Windows CI pending; idle/session-lock hooks and full broker/wrong-user/physical acceptance remain incomplete. NO_GO retained.


### SECURE-MEMORY Windows session lifecycle candidate — 2026-11-22
Desktop subscribes Windows SystemEvents.SessionSwitch to revoke process-local vault consent on every session transition, locks on close and unsubscribes the static event. Smoke explicitly unlocks, invokes the production session-lock handler, requires locked state and then existing Load/Save denials. Fresh Windows CI pending. Synthetic event invocation does not verify real OS notification delivery or credential reauthentication; owner hardware/security acceptance and NO_GO unchanged.


### SECURE-MEMORY bounded consent lease — 2026-11-23
1a643884a8893cce4adb8188a060b7446779c918 limits each explicit unlock to five monotonic minutes; expiry/backward elapsed time locks and stays locked until new consent. Read/Save existing guards evaluate the lease. 07a36d31793a4ce3f7188b7ab9cdcd33d7aec268 tests initial lock, pre-boundary positive, exact expiry, sticky expiry and backward clock denial with deterministic fake ticks. Fresh Windows CI pending; maximum consent duration, not idle detection/OS reauthentication. NO_GO retained.


### SECURE-MEMORY concurrent consent state — 2026-11-23
6027714e78300c257e6f526ea0f348427ecaf360 synchronizes lease read/expiry/lock/unlock state for UI and Windows SessionSwitch threads.0990bf51ac4dbeba33eeeb7e8c5e585b6d8e0b8a requires 256 parallel expired reads and 256 reads after cross-thread revocation all deny. Fresh Windows CI pending. Does not make credential retrieval/fill atomic with revocation; in-flight broker race and physical/security acceptance remain separate. NO_GO retained.


### SECURE-MEMORY revoked native read candidate — 2026-11-23
fd018ff9d4e5d3198170a9fcf0c49f4c32a464b0 captures consent generation before native retrieval and validates it before returning credentials. Lock/unlock increments generation; stale consent cannot revive after unlock.1dc1cb5593e7d2b5cea1e9e0cb394db95ac26206 tests lock/unlock stale denial and fresh positive. Fresh CI pending. Post-return browser dispatch/save race remains separate; no complete atomic broker or physical/security acceptance claimed. NO_GO retained.


### SECURE-MEMORY browser dispatch initiation — 2026-11-23
Runtimea58497652dfc06287d85a5b8866bfcbb2552406c validates consent generation under the lease monitor while initiating a callback. Desktopae43a44b6500f9d6abbe4100d5e13b76388fac28 captures before Load, dispatches ExecuteScriptAsync through that boundary and tests stale callback never invoked/fresh positive. Fresh Windows CI pending. Already queued renderer execution cannot be retracted by this boundary; save atomicity/renderer/physical/security acceptance remain open. NO_GO retained.


### SECURE-MEMORY native save consent — 2026-11-23
23906da8c46d8a030c3ce5acf46e3de99baa12d6 validates captured consent under lease monitor with native credential write. Desktopb136c46f7145aced33062e5862fc3862030eda32 captures before dialog; stale lock/unlock consent must reject and actual Credential Manager readback remain absent. Existing fresh save/replacement positives follow. Fresh Windows CI pending. Already-queued renderer and physical/security acceptance remain separate; NO_GO retained.


### SECURE-MEMORY password dialog failure cleanup — 2026-11-23
Save dialog password control is cleared in finally on successful save, cancellation or exception. Windows Smoke injects synthetic save failure and no-op cancellation and requires empty TextBox afterward. Fresh CI pending; managed strings/OS/renderer zeroization not claimed. NO_GO retained for physical/security/signing/release acceptance.


### PC-05 / Code Mode argument snapshot — 2026-11-23
Gateway now uses validated bounded JSON snapshot before asynchronous authorization/invocation. Negative regression mutates original nested arguments during authorization and requires reviewed snapshot at invocation. Mock-runner evidence only, fresh CI pending; no hardened sandbox/live MCP activation or independent security acceptance. NO_GO retained.


### PC-05 / Code Mode callback lifecycle — 2026-11-23
Runner completion or failure closes the gateway callback; pending authorization must recheck closure before dispatch. Six local negative tests passed, including retained callbacks after success/failure and delayed authorization after exit. Mock runner only; no cancellation of already dispatched effects, hardened sandbox, physical Windows or independent acceptance established. Fresh GitHub CI pending. Mapping of 78 original OT source IDs to 150 master IDs is traceability, not verified completion. NO_GO retained.

### PC-05 / trusted context snapshot — 23 November 2026
Strict string identities and bounded context copy precede async discovery/execution policy. Eight local negative tests passed, including caller tenant mutation and identity coercion rejection. Mock runner only; fresh CI pending. NO_GO remains for hardened sandbox, Windows hardware, signing/key custody and independent acceptance; 78-to-150 traceability is not acceptance.

### PC-05 / request mutation boundary — 23 November 2026
Code string captured before initial async authorization; discovery copies validated query/limit. Nine local negative tests passed for code capture and previous boundaries; final discovery field-copy refinement awaits fresh checks. Prior head e38a69cd89b8ed44606078c341d5b3db0cb04eae ran only Safe automatic PR merge (45183553434); full runtime/Windows CI unavailable on that head. No merge. NO_GO remains physical/sandbox/signing/key custody/independent acceptance. Source mapping is not completion.

### PC-05 / complete local Code Mode regression — 23 November 2026
All three Code Mode suites passed locally: 17 tests, 0 failures, including discovery-limit mutation during asynchronous policy. Runtime blob 12e1c580dbf906d305ed9e13c9c1a0990cb91ac3. Reconciled 78 unique source rows: all IDs occur in master register; this is traceability, not accepted completion. Current prior head e8eb8ca79e7ea7e57628bb401bfb221d4f44a9c8 has only Safe automatic PR merge run 45193168508, no full runtime/Windows workflow evidence. Merge remains blocked; NO_GO for hardened runner, hardware/provider, signing/key custody and independent/customer acceptance.

### PC-05 / configuration readiness — 23 November 2026
Runtime a8926f760f82b580ed70853751c4f5c5b3d0e030 reports enabled only with isolated-runner kind plus callable run, authorization and dispatcher. Negative suite 3600f75a425badb307077dc90af5ba801bc8d54b: 11 local tests passed, incomplete configurations denied. This flag confirms configuration only, never sandbox review or acceptance. Prior head c4f04584acb75b886cc6cde0dd3520e9fbe11af1 ran only safe-auto-merge 45204025576; full Windows/runtime CI remains unavailable. NO_GO retained.

### PC-05 / native catalog risk fidelity — 23 November 2026
Runtime 9377e771dda450128ff84c3c66c18b45c34ddbce pins risk class per known native tool, rejecting receipt risk substitution rather than trusting claimed read-only status. Tests d702c27c7c42cfdcb989ba792643e9728915bd8a: 3 local tests passed including 12 risk-class substitutions across six tools; baseline positive retained. Metadata only, no native execution activation. Prior head 3de3db80d7df33f5bb1b0ad4a34fbca27bcc8aef has only automatic-merge run 45215917070; full CI unavailable. NO_GO retained for sandbox/hardware/signing/key custody and independent acceptance.

### PC-05 / native descriptor scope fidelity — 24 November 2026
Compared actual LocalAgentEngine agent_tools descriptors. Runtime 7e3935b96b17d6b53e577272099ef7f67a9eb688 pins scope/execution/safeBatch per tool; corrected synthetic fixture to actual distinct scopes. Tests 8b179d68a4530ebbcc99cf8c3c7d3883ec156319: 4 local tests passed including 18 scope/execution/batching substitutions and 12 risk substitutions. Main 25f3a00a6bd379fa49a7287e18fb4c99d7f787fa bridge/build/portable/onefile CI passed; no physical acceptance implied. New candidate CI pending. Metadata only; NO_GO retained.

### PC-05 / C# descriptor source conformance — 24 November 2026
Five local native-catalog tests passed, including parsing all six actual LocalAgentEngine source descriptors into metadata adapter, preserving 30 altered-claim denials. Source conformance only: not a launched native receipt or physical acceptance. Existing draft #150 reused; prior-head CI green, new-head CI pending. NO_GO retained.

### PC-05 / framed native receipt integration — 24 November 2026
Added real published-host agent_tools framed exchange into metadata adapter, with malformed/extra frame rejection and MCP-enabled claim denial. Windows bridge CI invokes it after native smoke tests. Local Node syntax passed; actual Windows process execution unavailable locally, fresh CI pending. Prior draft head 029d0ee3e28b1b344829cda50f383f2f75254cc5 checks green. NO_GO retained; no physical/sandbox/security acceptance or execution activation.

### PC-05 / actual Windows receipt verified — 24 November 2026
Exact head 8b23a051ce46ac240fa237f303d3238ad411127f windows-bridge job 138118129360 succeeded; logs confirm actual framed native catalog accepted and MCP activation claims denied. All 11 non-preview checks passed; preview skipped. Extended test f11065f5a24bfbb1f087690239e286670f3b98fa adds 24 per-descriptor altered-claim denials on the actual receipt; syntax passed, fresh Windows CI pending. Hosted Windows integration is not physical Windows or independent security/customer acceptance. Draft retained; NO_GO remains.

### OFFLINE / small context request ceiling — 24 November 2026
Runtime 4d82e26d4a9b817364d5d16c73c87a21f7c61377 no longer raises valid sub-1024 token requests to 1024. Tests f29cbaec8e8be772104cdbead6e6b447b0492ac7: seven local resource-guard tests passed, including ten small-context/headroom combinations. No real model loading or memory guarantee claimed. Prior head 54a5b9f6923339a56eb3c8dd5073a86655c1ecdb all non-preview checks passed including actual native receipt denials. New CI pending; draft/NO_GO retained.

### OFFLINE / bounded model stream — 24 November 2026
Runtime 63c4dcae6c1a5500e743ddae89345c44e9a3b111 rejects stream chunks exceeding remaining declared length before writing; prevents negative remaining counter/unbounded read continuation. Test 008fd429a5a95717016e884dbb8ce5420de6d66b runs actual extracted import function with oversized synthetic reader and requires no partial/installed file. Fresh CI pending; no local execution claimed this batch. Prior head 58a0f95714025b05feecc1e775e20ae7dc144942 non-preview CI green. NO_GO retained.

### OFFLINE / ZIP stream ceiling — 24 November 2026
Runtime c0c1514f76e2e1f902c03a47114045c817bc3321 rejects oversized/non-byte ZIP chunks before writing. Tests d6674e6006548506a6f4f22adc1d9b38b31f2923: nine local resource tests pass, including actual extracted GGUF/ZIP importer functions and no leftover partial files. Prior 90ebe091de04adf954175a486aa42020b8ec906c all non-preview CI passed; new CI pending. NO_GO retained; no hardware/model inference/security acceptance claimed.

### PC-05 / scoped execution admission — 24 November 2026
Gateway instance rejects overlapping execute calls for the same tenant/principal/job until the admitted execute settles; fresh call after completion allowed. Runtime 6bd63f77c9583fe4d676fe8fa6284ee50e39d963; tests aa494120c53b88c5a1914ed86cd46034b542c543:16 local negative tests pass. Instance-local only; timeout does not terminate worker or retract in-flight operations, so no complete recovery/side-effect guarantee. Main packaging retries succeeded on c01f130073910916f9a76eb675c8a6d458e6d0cc. Candidate CI pending; NO_GO retained.

### PC-05 / timeout replay quarantine — 24 November 2026
Runtime 9184797dd55237944c9143e9fea5a132cd6c3081 retains instance-local admission after timeout; same job cannot replay while unrelated job continues. Tests d132ecdf808bd726e588c525be698f09dae1cf98:17 local negative tests pass. Host must verify recovery before replacing gateway; no termination or distributed/persistent quarantine claimed. Main65182d1f9f4922b1a11563157ce2d70148ebad61 CI green. Candidate CI pending; NO_GO retained.

### PC-05 / bounded admission retention — 24 November 2026
Runtime dd2d9bda44fd53e5f4bcf6be731ca6d2bb0646a4 caps active/quarantined scoped keys at256, rejecting overflow without eviction/replay. Tests928eeac97288f1b27d2498db1367beb7ce9bcbcd:18 local negatives passed, including256 concurrent admissions,257th denial, retained first-job denial and normal capacity reuse. Prior0fdd41a251f8e3b043ccd47c50e5cbeb997e0019 checks green; new CI pending. Instance-local only, no worker termination/persistent recovery. NO_GO retained.

### OFFLINE / telemetry normalization — 24 November 2026
Runtime03e5e3e3a463d8d6573b22281c759ccf91a7ab29 normalizes malformed RAM telemetry to unknown and malformed CPU counts to1; prevents type exceptions/false optional inference readiness. Testff40b1c3cf2d009675edc4939eb55aaeda4491fa covers string/bool/negative/NaN. Ten local resource tests passed. Main823b42a77b8008bd10d9afdd8a52c3cfbc12df27 CI green. Candidate CI pending; no real inference/hardware acceptance. NO_GO retained.

### OFFLINE / healthy and low telemetry policy — 24 November 2026
Test5d74c63001990fa569299ae0475115784f3817c3 verifies healthy8GiB/2GiB telemetry retains optional-model eligibility and preflight requirement; low128MiB and unavailable telemetry deny eligibility. Eleven local resource tests passed. Prior da4eefce878441c02dd7ee8f7bad4e8162a1fa4a all non-preview checks green. Fresh CI pending; no model loading or hardware acceptance. NO_GO retained.

### OFFLINE / RAM measurement consistency — 24 November 2026
Runtime f3f236d1d6273ac38e80ae3489c89044fa47c5b6 marks available RAM unknown when exceeding valid physical total. Tests5f35c977bb81d9ce842f6582033ffdc5daf84063:12 local resource tests pass, including contradictory8GiB available/4GiB total denial and equal-boundary positive. Maina47e7b4817b57cbce3647f088e8440ddf562d688 CI green. New CI pending; no real inference/hardware guarantee. NO_GO retained.

### PC-07 / PC-09 — fresh model-launch RAM admission — 24 November 2026
Runtime 1e298f41805aed2736f3616e350fee3a17371805 remeasures available RAM under the model lock after port probing, denies insufficient/unknown/invalid memory before Popen, and sizes context from that fresh reading. Tests 152a4c3c80ed437505bd5f63ee4b8dc801c0f8ef: 13 local resource tests pass; actual extracted launch function tested with stale healthy preflight then missing/128MiB/bool/negative RAM (no process/settings/audit), plus healthy 2GiB launch with context reduced to2048. Mock process only; no real model or Windows hardware acceptance. Main6f1ec2bbecdc59c23388148481195e8a3735d3dd CI green; candidate CI pending. 78 unique original OT IDs found in master150; mapping is not acceptance, no VERIFIED total changed. NO_GO: real inference, physical Chrome/Windows/provider authorization, sandbox termination/persistent recovery, independent security/legal/key custody/customer acceptance, trusted signing and verified deployment/rollback evidence remain unavailable. TEFE/TEBE code untouched. Next inspect exact candidate CI, merge only normally when permitted, then continue resource/recovery dependencies.

### PC-07 / model shutdown recovery — 24 November 2026
Test commit 54444a142ad894171d3f22ab598a41625e9d489f: 14 local resource tests pass. Actual extracted stop_local_model tested with mocked process: terminate timeout escalates to kill and bounded5s wait; kill failure retains process handle, releases lock and emits no successful-stop audit. No runtime change, real process termination, physical Windows or persistent recovery acceptance claimed. Main cf642ade89d7cc05af381f24cf770ea28b23dc4b actual CI green. 78 unique original IDs present in master150; no accepted totals promoted. Candidate CI pending. NO_GO retained for real inference/physical Chrome-Windows/provider, sandbox/persistent recovery, independent security/legal/key custody/customer gates, signing and verified deployment/rollback. Next exact-head CI and normal eligible merge; extend failed post-kill wait coverage.

### PC-07 / post-kill timeout recovery — 25 November 2026
Test 94b4d86f1e940308609bf93e7f67588128074ac9 extends actual extracted shutdown-function regression to a second wait timeout after kill: handle retained, lock released, no false successful-stop audit. 14 local resource tests PASS (existing test expanded with third scenario); mock process only, no physical termination acceptance. Main b2935418e04d1f637790a978309425c5eba03fc4 actual CI green. 78unique original IDs present in master150, acceptance totals unchanged. New candidate CI pending. NO_GO real inference/physical Chrome-Windows/provider, hardened sandbox/persistent recovery, independent security/legal/key custody/customer acceptance, trusted signing and established deployment/rollback/readback. Next inspect exact-head CI and eligible normal merge; extend refusal to relaunch while retained process remains active.

### PC-07 / retained model relaunch denial — 25 November 2026
Test 218742cfcf4a1b8eb5e80a6b9d674e869f409fb8: 15 local resource tests PASS. Actual extracted start_local_model with retained active process rejects second launch before spawn/settings/audit, preserves handle and releases lock. Synthetic GGUF and mock process only; no real inference or physical Windows acceptance. Main883b36dee5dae1019ba7009c6d8d7743ddea220e actual CI green. 78unique original IDs present in master150; acceptance totals unchanged. Candidate CI pending. NO_GO real inference/physical Chrome-Windows/provider authorization, hardened sandbox/persistent recovery, independent security/legal/key custody/customer gates, trusted signing and destination/rollback/readback evidence. Next exact-head CI/eligible merge and broader recovery dependency review.

### PC-07 / Windows pinned-runtime download reliability — 25 November 2026
Runtime 824fe53c9c70a7493ad6e148fccaa72af50b65b8 removes unauthenticated release-metadata API lookup; directly downloads exact b12248 official asset, preserving pinned SHA256 and mismatch rejection before extraction. Test 2cb1d892893b458b7604f7b39cba848abd473822: one local source-contract test passes (API/credential dependencies absent, fixed digest and fail-closed ordering present). PowerShell unavailable locally; actual download, hash rejection execution and Windows build require candidate CI, not claimed verified. Main e7238acca1574cc251a8613feb8d473baeeea643 CI green. NO_GO physical Windows/Chrome, real inference/provider, sandbox/persistent recovery, independent security/legal/key custody/customer, trusted signing and deployment/rollback/readback. No acceptance counts promoted. Next exact-head CI and ordinary eligible merge.

### PC-07 / executable tampered runtime rejection — 25 November 2026
Test 3e691dfa3179bc48e44984886c632d57b46e95f6 executes actual llama download/verification script section through PowerShell, mocks download to four synthetic bytes, requires hash mismatch and forbids extraction. Windows missing PowerShell is a failure; non-Windows without it explicitly skips. Local result: one source-contract PASS, one executable test SKIPPED (PowerShell unavailable), not two passes. Main4d72ae9aadb3ce790c5f9ed5f788f1e39fd20e15 CI green. Candidate Windows execution pending. NO_GO hardware/real inference/provider, hardened sandbox/persistent recovery, independent security/legal/key custody/customer, signing/deployment/rollback/readback. No acceptance counts changed. Next exact-head Windows test evidence and eligible normal merge.
