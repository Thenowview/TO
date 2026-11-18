# GIZE × THEEPMO — Cross-repository bulk-fix reconciliation (18 November 2026)

**Owner instruction:** bulk fix, auto approval. **Scope:** TEFE, TEBE, OT and master issue #71. **Decision:** NO_GO for production/customer release until independent acceptance. This is a coordinated review handoff, not a deployed implementation or verified 150-ID completion.

## Canonical controls
- Source of truth: [controlling 150-ID specification](./gize-sources/Theepmo-ref2.md).
- TEFE [issue #75](https://github.com/2029TEFE/TEFE/issues/75), TEBE [issue #642](https://github.com/2029TEBE/TEBE/issues/642), OT/master [issue #71](https://github.com/faisalwrokksa-hub/TO/issues/71).
- Owner amendments: [TEFE](https://github.com/2029TEFE/TEFE/issues/75#issuecomment-6988319234), [TEBE](https://github.com/2029TEBE/TEBE/issues/642#issuecomment-6988320318), [OT/master](https://github.com/faisalwrokksa-hub/TO/issues/71#issuecomment-6988321232).
- No forced merges, protection bypass, production deployment, customer data mutation, branch deletion or expert-branch overwrites. Routine safe changes on isolated branches may be reviewed and merged under existing protections after required checks; production release remains separate.
- Before acting, refresh every PR head/status, current main, CI, reviews and file overlap: these are time-sensitive snapshots.

## Latest audited evidence and actionable batches

| Workstream | Current observed work | Next safe fix | Exit gate |
|---|---|---|---|
| TEFE (#75, 12 IDs) | PRs #77–#82: GIZE portal locale/catalog, release-output safety, read-only audit docs, production-link integrity, .gize/.gaiz input and GAIZ2 recipient checks, EN/AR automated accessibility. #76 superseded/closed. | Reconcile overlapping app.js/marketing and candidate build changes, finish reviewed translations across declared locales (do not accept English fallback as complete), verify current SHA with accessibility/security/responsive CI, review and stage Cloudflare publish evidence separately. | Native-language review, exact-head CI, reviewed PRs, deployed bundle SHA and live readback, FE↔BE contract |
| TEBE (#642, 60 IDs) | #644–#646 and later #650/#651 security and infrastructure improvements reported merged; open PRs rapidly changing. main checklist 3 IN_PROGRESS / 57 NOT_ASSESSED at last read. | Preserve already merged work, refresh PR statuses (including #652–#655) and CI; reconcile API-02/04/05 and SEC-01 evidence per source ID; finish tenant-safe versioned artifact and task interfaces, governed Studio/AI, full portfolio journey, locale content and entitlements. | Real two-tenant DB/RLS + API tests, permission-aware AI, versioned TO fixtures, full customer workflow, actual VPS deployment readback and rollback |
| OT (#71, 78 IDs) | Draft PRs #73/#75 include .gize export, legacy read, GAIZ2 conformance/negative tests, Windows CI stability/readiness. Four latest-head PR #73 tests reported passing before later head changes; Chromium CI lag. PR #75 has had a GAIZ candidate failure on one earlier inspected head. | Reconcile overlap in gaiz/cli.mjs and gaiz-ci.yml between #73/#75, fix/retest any exact-head regression; bounded NSIS/Chromium CI, real authorized offline decrypt/key custody and Windows signing/device tests. | All latest-head Windows/GAIZ checks, true crypto and revocation acceptance, signed installer, versioned TEBE consumer tests |
| Master #71 | All 150 unique IDs assigned: TEFE 12, TEBE 60, OT 78; zero source checkboxes marked VERIFIED on inspected main snapshots. | Adopt requirement matrix with status and exact evidence. Synchronize owner's new instruction into each expert's durable checklist/owner log through separate reviewable PRs. Do not conflate issue posting with implementation. | 150 source-ID reconciliation, full 16-step synthetic paying-customer journey and independent security/localization/deployment evidence |

## Cross-repository blockers (P0)
1. **Canonical portable artifact**: OT generates signed, authorized .gize; TEBE verifies/enforces tenant/recipient/entitlement/revocation with versioned transport; Windows opens authorized offline; TEFE's public preview remains untrusted sample only. Preserve old .gaiz read and GAIZ1/GAIZ2 protocol bytes. Require negative cross-consumer fixtures.
2. **Customer journey**: strategy → demand → business case → prioritization → capacity/budget → scenario approval → delivery/change → benefits realized; connected evidence and audit, not disconnected UI demos.
3. **Enterprise security and commercial acceptance**: tenant isolation, permission-aware AI/agents, provider/tool boundaries, identity/session safety, licensed customer entitlements, approved release environment, full rollback.
4. **Localization**: registry-defined supported languages complete on marketing, app, desktop, validation, reports, notifications, generated artifacts; document any preview fallback as a launch blocker if locale is claimed supported.
5. **Deployment proof**: a workflow named “Deploy production” with success may still skip actual deploy; inspect jobs, artifact identity and live readback. TEFE Cloudflare verifier skips are not release evidence. OT config/release-gates.json currently NO_GO.

## Recording protocol
For every source ID maintain: ID | owner | status (NOT_ASSESSED, NOT_STARTED, IN_PROGRESS, BLOCKED, IMPLEMENTED_UNVERIFIED, VERIFIED) | source text | main and PR code paths | tested head SHA and result | security/locales/contract version | live deployment SHA/readback | blocker | next action. Count per ID only, no fabricated percentages. Reviewers must not mark VERIFIED because a PR exists or a focused test passed. Keep current unresolved tasks open.

## Auto approval interpretation
The owner approves safe bulk execution within preexisting reviewer/CI rules, not bypass of security, failing tests, or release authorization. Never merge drafts without explicit ready state and required reviews. Do not merge overlapping work until reconciled; prevent production triggers from being mistaken for permission to deploy. Update issue #71 and the relevant owner issue after verified milestones.
