# TheOrg Intelligence — independent Cloudflare website

## Deployment (2026-11-13)
- Cloudflare account: **theorgnet@gmail.com** (ID `8c3498934294713cb33f436ff86fc361`).
- Worker: `theorg-intelligence`.
- Public demo URL: https://theorg-intelligence.theorgnet.workers.dev
- Latest confirmed deployment ID: `883b1621-25cd-4314-9a0b-7055f1dfdcc6` (Cloudflare reports 100%).
- Source: `sites/theorg-intelligence/index.html` on review branch `feat/theorg-executive-intelligence-site-20261113` / PR #25.
- Publication method: explicit Cloudflare API upload, **not automatic GitHub deployment**.

## What works in the demo
- Responsive executive, strategy, risk, decision, knowledge and AI Supervisor workspaces.
- Editable fictional metrics (strategy, maturity, compliance, risk) with 0–100 validation and target-gap calculations.
- KPI value/target updates across workspaces; browser-local scenario persistence, reset and JSON export.
- Markdown executive brief download derived from current illustrative metrics.
- Browser-local demonstration work-order drafts, simulated approval/QA/closure/rejection, local audit trail and JSON export.
- Print view, selected KPI detail, navigation and labeled sample data.

**Not yet integrated:** TheOrg's real Windows/Python agent runtime, real AI inference, verified human authorization, authenticated account access, cloud database, company isolation, THEEPMO enterprise data or actual agent execution. Browser-local approval buttons are **not** real executive approvals.

## Release safety
The site is completely separate from THEEPMO code, APIs, databases, DNS and infrastructure. No THEEPMO data is used. Client-side Content Security Policy blocks network calls; no external scripts or paid services are included. The sample calculations are deterministic; trends/outlooks are illustrative and are not modeled predictions. Do not enter confidential information in the demo.

The Worker exposes `GET /api/health` with `mode: synthetic-demo`, and makes no connection to local agents. Do **not** expose native messaging or localhost APIs directly to the internet. See [INTEGRATION_CONTRACT.md](INTEGRATION_CONTRACT.md) for a future authenticated, opt-in, outbound-only pairing architecture.

## Testing
- `node sites/theorg-intelligence/verify.mjs` checks the inline script syntax and static safety/contract properties.
- GitHub Actions workflow `TheOrg Intelligence site checks` was created. Its latest observed run **failed**, with job logs unavailable from GitHub; no green CI claim is made.
- Cloudflare API accepted and deployed the Worker at 100%; independent live browser acceptance remains pending.
- No end-to-end tests have been completed for Windows agents or authenticated enterprise workflows.

## Next integration sequence
1. Fix GitHub Actions runner/visibility and achieve reproducible passing source checks.
2. Verify website in real desktop/mobile browsers and keyboard navigation.
3. Finish existing TheOrg local runtime and real-device gates.
4. Implement authenticated tenant-scoped, opt-in device pairing without exposing local services.
5. Enable real queued work orders, explicit owner approval, independent QA and evidence receipts.
6. Connect a separate governed KPI data store if desired; leave THEEPMO unchanged.
7. Introduce dedicated deployment workflow with least-privilege Cloudflare credentials and safety gates.

## Bulk-fix follow-up — 2026-11-13
- Added `build-worker.mjs`, a deterministic generation path from the reviewed HTML to `dist/worker.mjs`. It preserves the existing read-only synthetic demo health endpoint, strict CSP, and blocked external/network integrations.
- Added `verify-worker.mjs` checking the generated Worker boundaries and health route.
- Updated site-only GitHub Actions to generate and verify the Worker during the site acceptance job. No paid dependencies, secrets, new Cloudflare resources, or production-domain changes.
- Source script syntax and six workspace markers were checked separately from the GitHub runner.
- **CI remains blocked:** The newest site job failed with no step summaries, and GitHub returned 404 BlobNotFound for its job logs; the unrelated bridge/Windows workflows likewise fail. Treat this as an unresolved runner/infrastructure or workflow-initialization issue until GitHub exposes evidence. No green-build or root-cause claim.
- The **previously deployed website remains unchanged** by this build/CI-only source batch. Cloudflare did not receive another upload.
- For repeatable future deployment, generate `dist/worker.mjs`, validate it, and deploy that artifact to account `8c3498934294713cb33f436ff86fc361` under service `theorg-intelligence`. Never deploy while validation is red.

## Bulk integration foundation — November 13, 2026

- Added a separately staged, **not deployed** Cloudflare Access JWT + D1 gateway (`enterprise-gateway.mjs`) with company-scoped read endpoints and a proposal-only create endpoint; **no agent execution or approval authorization** is exposed.
- Added isolated enterprise D1 schema (`schema.sql`), deterministic KPI/state machine rules (`intelligence-rules.mjs`) and built-in Node tests (`enterprise.test.mjs`).
- Added manual-only website deployment workflow pinned to the verified Theorgnet Cloudflare account; it requires a dedicated `THEORG_CF_TOKEN` GitHub secret before any run.
- Added minimal `TheOrg Runner Diagnostic` workflow. Both the diagnostic and site CI jobs failed before reporting step output; GitHub logs remain unavailable. CI recovery is **blocked externally**, not verified fixed.
- Basic KPI and approval rule cases were independently exercised in a JS sandbox, with 7 selected cases passing. This is not a substitute for the full GitHub/Windows/browser test suite.
- See [GATEWAY_SETUP.md](GATEWAY_SETUP.md) before configuring any cloud enterprise backend.
- The public website remains the last confirmed synthetic-only Worker deployment; no new public business API has been created or enabled.

## Bulk source repair — November 13, 2026 (runtime and CI)
- Replaced an outdated `verify-worker.mjs` route assertion referencing the retired single-route Worker. The new check covers `/`, `/api/health`, `/operations`, first-party analytics/report modules, CSP and allowed HTTP methods.
- Corrected `task-engine.test.mjs` independent QA success case to compute a **real** SHA-256 receipt instead of a hard-coded placeholder digest.
- Hardened `local-task-runtime.py` (source-only opt-in loopback service): reject NaN/Infinity and invalid task inputs, require distinct runtime/executive/reviewer identities, reject malformed JSON/content lengths and unexpected queries, verify symlinks before path resolution, preserve atomic SQLite task/audit changes.
- Added `test_local_task_runtime.py` with **10** standard-library SQLite/authorization/evidence/restart test methods. The GitHub site CI workflow now includes `python3 -m unittest discover -s sites/theorg-intelligence -p 'test_local_task_runtime.py' -v`.
- Independently checked source-level JavaScript syntax/contract markers; full Python regression suite and GitHub CI execution are **not independently verified**.
- Latest GitHub Actions commit run `43445433463` (site CI) and run `43445433424` (minimal runner diagnostic) still show failure. This indicates a separate unresolved Actions execution/scheduling or account-level issue; root cause not established without runner logs.
- No source-to-production merge, Windows runtime start, credential provisioning, paid action or new Cloudflare Worker upload occurred in this repair batch. The existing `theorg-intelligence-lab` demo remains on its previous confirmed preview deployment.

## Continued repair and isolated preview — 2026-11-13
- Hardened deterministic task KPI validation: rejects empty datasets, coercible numeric strings, nulls, missing metric names and out-of-range values instead of silently coercing them.
- Project delays now require strict ISO `YYYY-MM-DD` calendar dates and compute day differences using UTC, not locale/ambiguous parsing. Forecast horizon must be an integer.
- Risk scoring requires whole-number likelihood and impact (1–5). An empty workforce or incomplete telemetry returns `cost_usd: null`, not fabricated $0.
- Added regression cases for all four issues. **20/20 operations/reporting checks** passed in an isolated JavaScript harness; **19/19 task engine checks** passed with a deterministic mock for WebCrypto. These are partial validations, not a Node CI or real browser acceptance certificate.
- Preview was rebuilt and uploaded to **`theorg-intelligence-lab`**, verified Cloudflare account `theorgnet@gmail.com` / `8c3498934294713cb33f436ff86fc361`. Cloudflare last confirmed preview deployment `248c1a11-9039-49d1-a4de-89a56fee4d1f` at 100%. Live URL: https://theorg-intelligence-lab.theorgnet.workers.dev/operations
- Original Worker `theorg-intelligence` remains unchanged on deployment `883b1621-25cd-4314-9a0b-7055f1dfdcc6`.
- The latest GitHub site run `43447118854` and minimal runner run `43447118587` still failed; the diagnostic job exposes no steps or job logs. Actual runner/account root cause is not confirmed. PR #25 remains draft, unmerged; automatic merging/production deployment are **not activated**.

## Local task-to-report integration batch — 2026-11-13
- Added authenticated `GET /v1/export` to the operator-opt-in `local-task-runtime.py`. It exports up to 100 company-scoped SQLite task summaries and up to 500 matching immutable audit events; no network synchronization.
- Added `local-report-cli.mjs`: the owner can turn a local export JSON bundle into eight draft output files (two report types × HTML/CSV/JSON/Markdown), retaining `verified_business_sources: 0`. Caller-claimed local acceptance is **not** trustworthy evidence of source provenance.
- Added `local-report-cli.test.mjs` and extended `test_local_task_runtime.py` for cross-company and audit-event export validation.
- Added `local-e2e.py`: a synthetic create→executive approve→bounded calculate→independent local QA→SQLite export→Node report generation acceptance run, without an external API/model or paid service. Wired into GitHub site CI.
- Added `operations.html` opt-in **Local task execution & QA** dashboard. It reads a local JSON file in the browser, bounds file size and record count, shows scoped task metrics and marks all business source evidence unverified. It does not send data to a remote server.
- Added `operations-ui.verify.mjs` and wired it into CI. Local module syntax and a synthetic export→report transformation were checked in an isolated JavaScript harness, including eight generated output variants and rejection of invalid cross-task references. **The full Python/Node integration suite remains blocked by GitHub Actions.**
- Updated separate Cloudflare preview `theorg-intelligence-lab`, deployment ID `8d7da7e9-b5b6-49f4-872d-6df807600768` verified at **100%**. The existing main Worker still has deployment `883b1621-25cd-4314-9a0b-7055f1dfdcc6`.
- See `LOCAL_PILOT_RUNBOOK.md` for a Windows pilot with independently authorized roles and how to run all tests. Never import confidential customer records into the unauthenticated public preview.
- GitHub minimal runner diagnostic and site checks remain failed with no step logs; no production merge, automatic release activation, actual Windows execution, model inference, tenant D1 provisioning or authenticated cloud sync occurred.
