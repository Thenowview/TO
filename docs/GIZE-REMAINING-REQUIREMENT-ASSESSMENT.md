# GIZE assessment of the 133 remaining requirements

Assessment date: 2026-11-21 (Riyadh).

This is a task-by-task evidence review. Each row records relevant evidence where located and the outstanding test, evidence, or decision. Where a row lists a check only, the reviewed sources did not establish task-specific proof. A listed check has not been executed by this assessment. Requirement status changes need review against the applicable acceptance criteria.

Source: [canonical 150 requirements](./gize-sources/Theepmo-ref2.md). This set excludes the 14 previously in progress and the three items handled in [TEFE #117](https://github.com/2029TEFE/TEFE/pull/117) and [OT #114](https://github.com/faisalwrokksa-hub/TO/pull/114).

## Assessment outcome

| Repository | Partial evidence | Evidence gap | Selection unresolved |
| --- | ---: | ---: | ---: |
| TEFE | 6 | 3 | 0 |
| TEBE | 8 | 45 | 1 |
| OT | 34 | 36 | 0 |

**Partial evidence** means a relevant implementation, test, or release signal was found and the full requirement remains unverified. **Evidence gap** means the sources reviewed did not demonstrate this requirement. **Selection unresolved** applies to the conditional MarkItDown requirement. These are assessment ratings and do not change canonical checklist statuses.

## Evidence reviewed

- TEFE [production and PR #116 check evidence](https://github.com/2029TEFE/TEFE/issues/75#issuecomment-7052273616), [disabled discovery fix #114](https://github.com/2029TEFE/TEFE/pull/114), and [Amuse boundary #115](https://github.com/2029TEFE/TEFE/pull/115).
- TEBE [architecture and supported runtime](https://github.com/2029TEBE/TEBE/blob/main/README.md), [row-level security schema](https://github.com/2029TEBE/TEBE/blob/main/packages/db/sql/rls.sql), [production verification](https://github.com/2029TEBE/TEBE/actions/runs/44825291409), and [workspace PR #713](https://github.com/2029TEBE/TEBE/pull/713).
- OT [physical PC evidence](./OT-PC-ACCEPTANCE-20261121.md), [source reconstruction guide](./gize-sources/RECONSTRUCT-AND-VERIFY.md), [archive path tests #104](https://github.com/faisalwrokksa-hub/TO/pull/104), [plan binding #111](https://github.com/faisalwrokksa-hub/TO/pull/111), [Windows crypto tests #112](https://github.com/faisalwrokksa-hub/TO/pull/112), and [launcher fallback #113](https://github.com/faisalwrokksa-hub/TO/pull/113).

## TEFE (9)

[Source checklist](https://github.com/2029TEFE/TEFE/blob/main/docs/GIZE-SOURCE-CHECKLIST.md)

| ID | Requirement | Evidence rating | Finding and remaining acceptance check |
| --- | --- | --- | --- |
| UX-01 | Deliver original design specification/tokens and reusable components compatible with existing stacks. | Partial evidence | Shared CSS exists; design spec and reusable component inventory unresolved |
| UX-05 | Implement functional empty/loading/offline/forbidden/error/recovery states; remove misleading placeholders and dead actions. | Partial evidence | #114 covers disabled discovery; exercise loading, denied, offline and recovery states per route |
| UX-08 | Deliver resource evaluation and adopted-component/license mapping with demonstrated screens and exclusions. | Partial evidence | Amuse boundary documented; map adopted components to licenses and running screens |
| OWN-02 | Inventory live domains, products and naming; define reviewed compatibility/redirect handling. | Partial evidence | Cloudflare serves TEFE and Servitro serves TEBE; reconcile current redirects, domains and compatibility owners |
| COM-01 | Publish accurate product scope, packages, prices/currencies, quotas, storage/AI limits and overage behavior. | Evidence gap | Compare published pricing and limits with approved quotas, overage and currencies |
| COM-03 | Deliver guided setup, useful templates, first successful workflow and customer migration guidance. | Partial evidence | #116 refreshed public styling; measure first successful guided setup and migration with a synthetic customer |
| COM-07 | Provide privacy/terms, support contact, response commitments and customer-facing known limitations consistent with delivered behavior. | Partial evidence | Amuse product boundary documented; reconcile public legal, support commitments and actual limitations |
| COM-09 | Measure onboarding completion, first-value time and critical conversion failures with appropriate privacy controls. | Evidence gap | Verify privacy-safe onboarding events and calculate first-value time and conversion failures |
| COM-10 | Document sustainable unit economics for selected packages and actual hosting/storage/AI usage assumptions. | Evidence gap | Build package economics from observed hosting, storage and AI costs |

## TEBE (54)

[Source checklist](https://github.com/2029TEBE/TEBE/blob/main/docs/GIZE-SOURCE-CHECKLIST.md)

| ID | Requirement | Evidence rating | Finding and remaining acceptance check |
| --- | --- | --- | --- |
| WF-01 | Strategy: objectives, owners, measurable outcomes, targets and links to portfolios/programs/projects. | Evidence gap | Trace one objective through owner, KPI target, and linked delivery hierarchy |
| WF-02 | Demand: configurable requests, classification, duplicate review, attachments, validation and review routing. | Evidence gap | Submit duplicate and invalid intake, then route a valid attachment-backed request |
| WF-03 | Business case: options, assumptions, proposed benefits, costs, risks, sponsor and decision evidence. | Evidence gap | Compare options and confirm sponsor decision and supporting evidence persist |
| WF-04 | Prioritization: versioned scoring for strategic value, benefit, cost, risk, urgency and resource demand; transparent ranking and recorded override reasons. | Evidence gap | Re-run ranking under two scoring versions and inspect an authorized override audit record |
| WF-05 | Capacity: roles, skills, calendars, availability, allocations and demand forecasts; overcommitment detection before commitments. | Evidence gap | Allocate overlapping roles/calendars and detect overcommitment before approval |
| WF-06 | Finance: proposed/approved budgets, funding sources, actuals, commitments, forecasts, variance, currencies and authorized adjustments. | Partial evidence | Production RLS catalog check evidenced; reconcile budget, actuals, FX and authorized adjustments |
| WF-07 | Scenarios: compare project selection, funding, staffing and timing against shared constraints; retain assumptions and approve before modifying live plans. | Evidence gap | Run constrained alternatives and confirm the baseline changes only after approval |
| WF-08 | Delivery: tasks, owners, dependencies, milestones, schedules, baselines, progress, stage gates and risk/RAID. | Evidence gap | Deliver a staged project with baseline, schedule dependency, milestone and RAID record |
| WF-09 | Change control: review scope/cost/schedule/resource changes and their effects on dependent work, funding and approvals. | Evidence gap | Propose a cost/schedule change and verify downstream impacts and sign-off |
| WF-10 | Benefits: baseline, target, measurement source, accountable owner, realization dates, actuals and post-project review. | Evidence gap | Record baseline and target, post measured actual, and verify accountable owner and closeout |
| WF-11 | Rebalancing: periodic continue/pause/change/stop decisions based on capacity, delivery, forecasts and outcomes, with audit history. | Evidence gap | Rebalance active work and recover the recorded continue/pause/change/stop decision history |
| WF-12 | Reporting: consistent drill-down from executive KPIs to governed source records; explicit freshness and calculation definitions. | Evidence gap | Drill down from executive KPI to source and validate freshness and calculation |
| WF-13 | Studio lifecycle: template → typed/conditional accessible form → approval/fulfillment configuration → preview → synthetic validation → review → approved publication → authorized operation → monitoring → revision/retirement. | Evidence gap | Exercise template publication, operation, revision and retirement using a conditional form |
| WF-14 | Delegation/escalation: bounded delegated authority, deadlines, notifications, escalation and persistent audit; no silent automatic decision approval. | Evidence gap | Exercise delegation expiry, escalation notifications and persisted authority decisions |
| WF-15 | Execute the full acceptance scenario: three competing initiatives, only two fitting budget/capacity, approved scenario, delivery, resource shortage, reviewed revised plan and measured benefits. | Evidence gap | Run the three-initiative scenario including shortage, reapproval and measured benefits |
| UX-03 | Redesign TEBE shell, executive/portfolio views, intake, approvals, Studio, tasks, documents, reporting and administration. | Partial evidence | #713 styles shell and dashboard; inspect intake, approvals, Studio, docs/reporting/admin screen inventory |
| UX-09 | If selected, isolate MarkItDown conversion with validated types/size, bounded resources/time, restricted network and tenant-scoped outputs; treat converted text as untrusted. | Selection unresolved | No adoption decision found; record selection and, if selected, test isolated conversion |
| LOC-01 | Publish one supported-language registry and complete surface-by-language coverage matrix. | Evidence gap | Publish registry and verify each surface-by-language entry |
| LOC-02 | Fully translate website, authenticated UI, forms, validation, permissions, errors, empty/recovery states and accessibility labels. | Evidence gap | Test forms, errors and accessibility labels across both web apps per supported locale |
| LOC-03 | Fully translate notifications, emails, reports, PDFs, exports and backend-generated customer messages. | Evidence gap | Render and inspect email, notification, PDF, report and export output per locale |
| LOC-05 | Implement pluralization, locale-sensitive dates/numbers/currencies/time zones, fonts, text expansion and appropriate text direction. | Evidence gap | Check plural forms, dates, money/time zone, direction and text expansion |
| LOC-06 | Preserve locale across accounts, devices, sessions, online/offline use and asynchronous jobs; define locale precedence. | Evidence gap | Verify preference precedence across account/device and queued online/offline jobs |
| LOC-07 | Verify localized search/sorting and multilingual inputs; preserve original content language separately from UI language. | Evidence gap | Exercise localized sort/search and preserve source language independently |
| LOC-08 | Test AI interactions/output in every supported language using reviewed evaluation cases; record limitations and block unsupported promises. | Evidence gap | Run reviewed multilingual AI prompts and record unsupported cases |
| LOC-09 | Pass automated key/completeness checks plus end-to-end linguistic/layout review for every supported locale and surface. | Evidence gap | Combine translation-key completeness with native-speaker end-to-end review |
| LOC-10 | Deliver per-language results showing zero unresolved missing required translations or accepted fallback substitutions. | Evidence gap | Produce per-locale missing/fallback report and resolve all required entries |
| TASK-07 | Implement versioned create/lookup/status/events/cancel/delivery contracts; surface eligible jobs in TEBE. | Evidence gap | Inspect versioned contracts and run create/status/events/cancel/delivery from TEBE |
| API-01 | Document existing and proposed versioned endpoints, authentication, schemas, limits, error behavior and consumer compatibility. | Partial evidence | Nest API is documented at architecture level; inventory versioned endpoints, errors, limits and consumers |
| API-03 | Verify TLS/DNS/routes, security rules, CORS/CSRF where applicable, streaming/timeouts and encrypted-file upload limits. | Partial evidence | Production deploy healthy; validate HTTPS routing, request boundaries, timeout and upload-size limits |
| INT-01 | Prioritize required Microsoft 365/Teams, email/calendar and Jira integrations against actual customer journeys; deliver a declared launch connector set and track others explicitly. | Evidence gap | Approve supported launch connector inventory from actual journeys |
| INT-02 | For each launch connector define authoritative system, scopes, mapping, sync direction, rate limits, retries, idempotency, conflict handling and reconciliation. | Evidence gap | Document scopes, mapping and reconciliation, then replay sync in a test account |
| INT-03 | Test expired/revoked connector credentials, outages and cross-tenant denial; do not claim unsupported integrations. | Evidence gap | Run credential expiry/revocation and outage tests with synthetic tenants |
| INT-04 | Provide governed import/export and documented APIs/webhooks with scoped credentials and replay-safe delivery where included. | Evidence gap | Verify approved import/export and webhook delivery with replay-safe scoped credentials |
| AI-01 | Define supported tasks, models/providers, local readiness and manual handoffs; preserve offline deterministic operation. | Evidence gap | Record supported tasks/model readiness and prove deterministic offline handoff |
| AI-02 | Enforce permission-aware retrieval and tenant isolation before context reaches a model. | Evidence gap | Verify retrieval enforces access before any synthetic context reaches an approved model |
| AI-03 | Treat documents, converted Markdown and model outputs as untrusted; prevent retrieved instructions from expanding tool permissions. | Evidence gap | Test that document/model output does not modify authorized task scope |
| AI-04 | Provide evidence/source references and distinguish proposals from approved records; show uncertainty where appropriate. | Evidence gap | Trace model proposal to evidence and approved record; inspect uncertainty display |
| AI-05 | Keep funding, approval, privileged execution and prioritization overrides behind explicit authorized decisions. | Partial evidence | #111 local approval binding evidenced; validate backend privileged decision controls separately |
| AI-06 | Maintain model/prompt versions, evaluation datasets and per-language quality checks with predefined pass criteria. | Evidence gap | Version evaluator fixtures and thresholds by supported language |
| AI-07 | Test unsupported claims, injection attempts, sensitive-data leakage and tool scope violations; record failures and remediation. | Evidence gap | Run defensive regression suite for permissions, leakage and unsupported claims |
| AI-08 | Define provider data handling, retention, consent, usage metering, per-tenant limits and sustainable cost budgets. | Evidence gap | Confirm metering, retention/consent, tenant caps and model-provider cost budgets |
| OPS-02 | Establish central logs, metrics, correlation IDs, bounded retention, alert thresholds and named incident ownership without leaking sensitive content. | Partial evidence | Production health evidence exists; verify monitoring, redaction, retention and incident ownership |
| OPS-03 | Document customer incident/status communications and support escalation. | Evidence gap | Run incident escalation tabletop and record customer status timeline |
| OPS-04 | Run representative load/soak tests at the declared launch load; document bottlenecks, database/index/connection limits and scaling triggers. | Evidence gap | Run representative staging soak and baseline latency/resource thresholds |
| OPS-05 | Verify scheduled encrypted backups and restoration, measuring actual recovery time and data loss against approved targets. | Evidence gap | Restore a scheduled encrypted backup in isolation and measure recovery and loss |
| OPS-08 | Record operating costs, storage growth, AI usage and capacity margins sufficient for launch commitments. | Partial evidence | Servitro disk margin sampled; measure ongoing cost, growth and operating capacity |
| SEC-03 | Apply supported secret/key management, rotation and least-privilege service access; verify no secrets in source/builds/logs. | Evidence gap | Verify least-privilege secret references, rotation and absence of sensitive values in outputs |
| DATA-01 | Define retention, deletion, tenant export, account closure, backup retention, residency and audit-access rules; verify customer claims. | Evidence gap | Validate retention, export, erasure and residency claims on synthetic tenant data |
| DATA-02 | Identify applicable privacy/security obligations and required owner/legal review; do not claim certifications not obtained. | Evidence gap | Identify applicable obligations and obtain owner/legal review |
| COM-02 | Verify signup/invitation, email verification/recovery, account creation, tenant provisioning and first-admin onboarding. | Partial evidence | Production sign-in and anonymous denial evidenced; exercise invite, recovery, provisioning and first admin |
| COM-04 | Verify checkout/webhook signatures, idempotency, subscription state transitions and correct entitlements using provider test facilities. | Evidence gap | Verify provider test webhooks, replay protection, state transitions and entitlements |
| COM-05 | Verify plan changes, renewal/failure/grace behavior, cancellation, receipts/invoices and documented refund/tax handling appropriate to the business. | Evidence gap | Exercise renewal failure, grace, cancellation, invoice and refund handling in test mode |
| COM-06 | Confirm production merchant configuration, approved live credentials and required activation without exposing secrets or making unauthorized charges. | Evidence gap | Owner/provider approval and approved live merchant activation are required; no charge test performed |
| COM-08 | Demonstrate full paid-plan journey from provisioning to value delivery and account closure/export; verify launch configuration separately from test billing. | Evidence gap | Run authorized test-mode paid journey through closure and export; check launch configuration separately |

## OT (70)

[Source checklist](https://github.com/faisalwrokksa-hub/TO/blob/main/docs/GIZE-SOURCE-CHECKLIST.md)

| ID | Requirement | Evidence rating | Finding and remaining acceptance check |
| --- | --- | --- | --- |
| OWN-03 | Record launch scope, supported platforms, features and customer-facing promises without silently narrowing these requirements. | Partial evidence | Repo boundaries documented; approve the launch-scope and claims matrix |
| OWN-04 | Preserve customer data, controls, legacy artifact references and unique branch work. | Partial evidence | OT PC notes preserve user data; prove data and branch preservation across all three repos |
| OWN-05 | Record cost decisions, release authorization boundary and final main-only cleanup conditions. | Partial evidence | Owner guidance exists; record approved cost and main-only cleanup criteria |
| EVD-01 | Read and register all supplied sources and referenced handoff; identify unavailable inputs. | Partial evidence | Archive reconstruction guide exists; reconcile every source, inaccessible item and immutable hash |
| EVD-02 | Establish a requirement-to-code-to-test evidence ledger using the IDs below. | Partial evidence | 150 IDs reconcile exactly; attach implementation paths, test runs and release evidence per ID |
| EVD-03 | Separate observed facts, proposals, mock results, live results and Windows results. | Partial evidence | OT PC notes separate synthetic and device evidence; verify consistency across all trackers |
| EVD-04 | Record repository SHAs, runtime/OS versions, artifact hashes, dates and raw verification results. | Partial evidence | Exact deployment SHA and Windows artifacts exist; complete OS/runtime/hash/date and raw-output records |
| AUD-01 | Pin source/deployed revisions and identify build-to-deployment provenance. | Partial evidence | TEFE #116 and TEBE #712 have deployment provenance; reconcile current heads and desktop artifact hashes |
| AUD-02 | Inventory branches/PRs, unique commits, checks and reusable work in all three repositories. | Partial evidence | PR queue checked; compare retained branches and unique commits across repos |
| AUD-03 | Map actual application routes, API contracts, schemas, queues, jobs and storage ownership. | Partial evidence | TEBE architecture listed; inventory routes, schemas, queue jobs and storage boundaries |
| AUD-04 | Inventory Cloudflare zones/accounts, DNS, TLS, Workers/Pages, routes, cache rules and upload constraints. | Partial evidence | Active Worker/traffic evidenced; reconcile zones, DNS, TLS, cache/route rules and upload limits |
| AUD-05 | Inventory server services, ports, databases, volumes, schedulers and deployment mechanisms. | Partial evidence | Servitro health logs provide service evidence; verify ports, volumes, schedulers and removal boundaries |
| AUD-06 | Identify secret/key references and owners without exposing their values. | Evidence gap | Record named secret owners and rotation and access references without values |
| AUD-07 | Run actual baseline tests/builds and representative customer journeys; separate pre-existing failures. | Partial evidence | CI builds pass in verified runs; reproduce representative authenticated customer journeys against baseline |
| AUD-08 | Produce legacy feature/data parity, locale coverage and desktop compatibility matrices. | Evidence gap | Build parity matrix from legacy app data and new supported platforms/locales |
| AUD-09 | Record verified infrastructure limitations and access gaps; estimate work only after this baseline. | Partial evidence | Servitro headroom and Northflank quota evidenced; complete access and infrastructure baseline |
| UX-04 | Redesign OT Workspaces / Tasks / Files / Settings, composer, approvals, event history and deliverables. | Partial evidence | README identifies workspace UI; exercise composer, approvals, history and deliverables on Windows |
| LOC-04 | Fully translate Windows installation, upgrade, offline tasks, key recovery and uninstall guidance. | Evidence gap | Inspect localized Windows install, update, key recovery and uninstall instructions on device |
| PC-01 | Launch the installed app offline and reopen existing authorized local workspaces without online login. | Partial evidence | #113 passes synthetic Windows fallback tests; launch offline on the target device and reopen existing workspace |
| PC-02 | Show connection state and On this PC / Online via THE EPMO before task submission. | Evidence gap | Walk connection-state UI and exercise explicit local/online submission options |
| PC-03 | Preview a structured plan showing actions, workspace, inputs, destinations and permission requirements. | Partial evidence | #111 binds approval to plan snapshot; inspect displayed inputs, destinations and permissions on device |
| PC-04 | Implement reviewed adapters for supported file reading, report creation, local inference, approved app opening and configured project checks; identify unsupported actions honestly. | Evidence gap | Identify adapter registry; execute each supported local adapter with authorized synthetic inputs |
| PC-06 | Constrain paths, handle Windows normalization/junctions/symlinks, revalidate before operations and test escape attempts. | Partial evidence | #104 Windows archive path evidence; verify operation-time path containment and reparse handling on Windows |
| PC-08 | Keep credentials out of UI storage/logs/reports; use OS-managed protection where appropriate. | Evidence gap | Inspect UI storage, logs and receipts for synthetic credential leakage and validate OS custody |
| PC-09 | Make deterministic jobs independent of AI; enable local AI only after model compatibility/readiness checks. | Evidence gap | Run a deterministic job disconnected, then exercise supported and unavailable local model cases |
| PC-10 | Bound logs/progress, preserve workspace/task context and keep shell/navigation responsive during inference and large-file work. | Evidence gap | Collect UI responsiveness, bounded logs and retained context under large-file and inference workloads |
| TASK-01 | Enforce idempotent submission, atomic claims/transitions and durable receipts under concurrency. | Evidence gap | Exercise concurrent submit and claim with one durable outcome |
| TASK-02 | Reconstruct task state after restart; resume event cursors or obtain authoritative snapshots. | Evidence gap | Restart before and after a write and verify authoritative receipts and event cursor recovery |
| TASK-03 | Check side effects before retry; require review for uncertain outcomes and retain retry evidence. | Evidence gap | Induce uncertain completion and require reconciliation before retry |
| TASK-04 | Implement tested cancellation, terminal-state protection and audit history. | Evidence gap | Race cancellation with completion and inspect terminal-state/audit behavior |
| TASK-05 | Queue online work offline only on explicit selection; show waiting for connection. | Evidence gap | Disconnect before selecting online queue and verify explicit opt-in and wait UI |
| TASK-06 | Revalidate identity, tenant, workspace access and approval on reconnect; resolve ambiguous submit outcomes by request ID. | Evidence gap | Reconnect after access and approval expiry; resolve ambiguous request ID once |
| TASK-08 | Upload only authorized files; local workspace content remains local by default. | Evidence gap | Verify only explicitly authorized files cross the local-to-hosted boundary |
| TASK-09 | Pass duplicate submit, concurrent dispatch, stale approval, restart during write, worker crash, cancel/finish race and reordered-event tests. | Partial evidence | #111 covers stale approval; extend acceptance to concurrent, crash, cancellation and event-order cases |
| TASK-10 | Pass outage/reconnect, expired credential, revoked access, denied cross-tenant access and uncertain-remote-outcome tests; distinguish mocks from live evidence. | Evidence gap | Run real hosted outage/reconnect and access-denial scenarios with synthetic tenants |
| SYNC-01 | Define authoritative records, version checks and merge policy for each synchronized object. | Evidence gap | Publish object-by-object authority, version and merge rules |
| SYNC-02 | Handle concurrent edits, deletions/tombstones, attachment changes, duplicate delivery and changed/revoked approvals without silent overwrite. | Evidence gap | Exercise concurrent edits, tombstones, attachment changes and approval revocation |
| SYNC-03 | Present conflicts for review when deterministic safe reconciliation is impossible; preserve provenance and both relevant revisions. | Evidence gap | Induce conflicts; inspect review queue, provenance and retained revisions |
| ENC-01 | Deliver threat model, actual versioned protocol/key specification and security review. | Partial evidence | Versioned round-trip evidence exists; complete threat model, key specification and review |
| ENC-03 | Preserve historical names/references and GAIZ1/GAIZ2 handlers; never bulk rename/re-encrypt user files during setup. | Partial evidence | #112 tests legacy compatibility; verify migration does not rename or rewrite existing user files |
| ENC-05 | Protect local keys using supported OS mechanisms; document backup, recovery, rotation, lost-key behavior and tenant/user separation. | Evidence gap | Prove OS-backed key custody, rotation, separation and recovery on the target PC |
| ENC-06 | Demonstrate offline encryption/decryption without online login using local authorized keys; clearly reject missing/unauthorized keys. | Partial evidence | #112 covers synthetic CLI keys; verify offline UI success and unauthorized-key rejection on device |
| ENC-07 | Implement/document offline permission expiry, online-only policies and revocation limitations without misleading promises. | Evidence gap | Exercise offline permission expiry and document disconnected revocation limitations |
| ENC-10 | Register both Windows associations where supported, default new files to .gize and preserve uninstall/data behavior. | Evidence gap | Validate both Windows associations, default export and data-preserving uninstall |
| OPS-07 | Test health checks, safe schema rollout, rollback and failed-deployment recovery; verify actual deployed revision. | Partial evidence | Healthy deploy evidenced; exercise failed deployment and rollback with revision readback |
| WIN-01 | Enumerate supported Windows versions, installation modes and legacy upgrade baselines. | Partial evidence | Windows repo documents runtime; verify supported versions and legacy upgrade matrix |
| WIN-02 | Produce verified backup, schema/version manifest and migration journal; preserve secrets through supported OS migration/recovery. | Evidence gap | Produce verified backup, schema/version manifest and recovery journal |
| WIN-03 | Pass clean install and each supported upgrade; rerunning setup must be safe. | Evidence gap | Run clean install, supported upgrades and repeated setup on target systems |
| WIN-04 | Test active writers, locked files, disk exhaustion, interrupted migration and restart recovery. | Partial evidence | PC notes report locked files; test disk shortage, active writers and interrupted migration |
| WIN-05 | Verify record counts, integrity, representative files, access permissions, shortcuts and file associations before default-launcher switch. | Evidence gap | Compare integrity, counts, permissions, shortcuts and associations before switch |
| WIN-06 | Rehearse rollback with prior installer and verified backup, preserving work created after upgrade through tested compatible export/restore. | Evidence gap | Restore prior installer and backup while preserving post-upgrade work |
| WIN-07 | Verify uninstall preserves user data unless deletion is explicitly requested; document updater ownership and behavior. | Partial evidence | Verify data-preserving uninstall and updater ownership; legacy removal was partial |
| WIN-08 | Deliver private candidate, checksum, dependency inventory and signing status; production signing and Windows acceptance remain release gates. | Partial evidence | Single EXE CI artifact exists; capture checksum, dependencies, trusted signature and device acceptance |
| WIN-09 | Demonstrate legacy upgrade → offline launch/task → verified output → .gize export → offline decryption → legacy .gaiz open → authorized online task → outage/reconnect. | Evidence gap | Run complete Windows migration, offline GIZE and authorized reconnect journey |
| PERF-01 | Measure baseline/candidate on the same Windows device: cold/warm startup, navigation, durable receipt, event latency, large-file preview, idle/active memory and recovery. | Evidence gap | Measure baseline and candidate on the same Windows device and workloads |
| PERF-02 | Report inputs, sample counts, median, p95 and raw observations; meet predefined budgets and investigate regressions. | Evidence gap | Publish raw measurements, sample counts, median/p95 and budget comparison |
| REL-01 | All mandatory requirement IDs implemented and verified; exclusions separately documented without disguising scope reductions. | Partial evidence | All 150 IDs reconciled; require evidence-based acceptance and approved exclusions |
| REL-02 | Full connected enterprise acceptance scenario passes with synthetic tenants and correct permissions. | Evidence gap | Run a connected synthetic enterprise scenario under correct roles |
| REL-03 | Every supported language passes every required surface; no accepted English fallback or untranslated required content. | Evidence gap | Require per-surface per-locale acceptance with no unresolved fallback |
| REL-04 | Website, account, billing configuration, entitlements, support and customer-value journey pass. | Evidence gap | Exercise public onboarding, entitlements, support and test-mode billing journey |
| REL-05 | Offline Windows execution, encryption/decryption, migration and recovery pass on supported target environments. | Partial evidence | Windows smoke/crypto CI evidence exists; run target-device migration/recovery and offline scenario |
| REL-06 | Both extensions/versions pass documented consumers and negative security cases; keys/recovery limitations are explicit. | Partial evidence | CLI compatibility tested; verify applicable consumers and key/recovery constraints |
| REL-07 | Launch integrations, AI evaluations, load targets, monitoring and backup restoration pass. | Evidence gap | Require connector, AI, load, monitoring and backup/restore evidence |
| REL-08 | Required source checks pass on the exact candidate commits; no unresolved release-blocking defect remains. | Partial evidence | Latest tracked PR checks available; validate exact release candidates and outstanding defects |
| REL-09 | Deliver exact release hashes, installer/signing status, dependency inventory, rollout/rollback and operating guides. | Partial evidence | Candidate SHAs and build artifacts exist; complete signed artifacts, dependency and rollback packet |
| REL-10 | Obtain the required production release authorization for the exact reviewed candidate. | Evidence gap | Obtain release sign-off for the exact customer candidate |
| REL-11 | Verify live deployment revisions, routes, TLS, private caching, health and approved production commercial configuration without unauthorized charges. | Partial evidence | TEFE #116 and TEBE #712 verified live; verify latest exact revisions, private caching and approved commercial settings |
| REL-12 | Preserve required unique work, finish dependencies and remove approved merged branches so the three repositories end with main only. | Evidence gap | Verify dependency closure and branch-unique work before any authorized cleanup |
| REL-13 | Retire duplicate sites/launchers/routes only after backup, dependency checks and appropriate release authorization. | Partial evidence | Locked legacy install reported; verify backup/dependencies and release authorization before retirement |
| REL-14 | Deliver final demonstration and honest declaration: paying-customer-ready, release-candidate-ready or blocked, supported by evidence. | Evidence gap | Run final demo and document readiness based on observed acceptance |
