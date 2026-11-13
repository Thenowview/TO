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
