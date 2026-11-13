# TheOrg — Commercial Site, Quick Wins & Premium Reports
**Status:** Buildable commercial storefront + 22 bounded tool previews; payment and member services intentionally disabled until explicit acceptance.

## Commercial thesis
**TheOrg: Business intelligence on demand.** Free, short Quick Wins create qualified intent; one-off custom reports monetize immediate needs; authenticated advanced and scheduled reporting supports recurring revenue. Where the customer needs ongoing governance and portfolio management, show an **optional** relevant link to THEEPMO. TheOrg must retain standalone value.

**Do not present a demo report as a completed AI investigation.** Current 22 workflows are calculators or structured drafts based on client inputs, and an optional consent-gated loopback Ollama narrative adapter. No verified source retrieval, live hosted model, checkout, user accounts or production paid fulfillment exists.

## Website information architecture
| Public path | Planned role | Current state |
|---|---|---|
| `/` | Eventually public commercial home after acceptance | Existing synthetic executive home retained on review branch |
| `/marketplace` | Commercial positioning, catalog, free assessments, proposed pricing, EPMO referral | Implemented static interactive preview |
| `/quick-wins` | SEO entry path for free tool examples | Routes to marketplace in review build |
| `/reports` | Report categories, bundles and pricing | Routes to marketplace in review build |
| `/tools/{slug}` | Individually useful SEO page with descriptions, samples and limitations | Planned, not yet shipped; **do not fake 22 published SEO pages** |
| `/sample-reports` | Source-labeled real examples with no proprietary company data | Planned |
| `/pricing` | One-off vs. advanced vs. recurring packages | In marketplace section |
| `/how-it-works` | Customer steps, source limitations, policy links | In marketplace section |
| `/privacy`, `/terms` | Privacy, retention, legal seller, restrictions, refund policies | Draft/review required before commerce |
| `/account`, `/my-reports` | Authentication, saved reports and entitlements | Not implemented / must remain disabled |
| `/checkout` | Hosted provider checkout with verified server-side events | Not implemented / no payment link on public preview |
| `/operations` | Existing task-first synthetic intelligence demo | Already present; not a customer account portal |

The public homepage should be promoted to the marketplace only after review. The executive app should then live under a separate authenticated app path/domain; no raw customer report data may be placed in a public Worker.

## Products built as reusable source definitions
- **5 free Quick Wins:** Project Health Check, KPI Performance Analyzer, Risk Assessment, PMO Maturity Snapshot and Executive Decision Brief.
- **3 one-off preview products:** Milestone Delay, Resource Capacity and SWOT Snapshot.
- **14 advanced report preview products:** Portfolio Performance, Financial Variance, Strategic Alignment, Benefits Realization, Compliance Evidence, Portfolio Prioritization, Forecast Scenario, Root Cause, Lessons Learned, Executive Report, Task QA, Board Pack, Knowledge Research and Market Research.
- Every tool has explicit input fields, examples, bounded calculations/checklists/structured drafts, possible findings, suggested actions, report type, price hypothesis, EPMO fit flag and no paid or source verification claims.
- `commercial-ai-cli.mjs` is opt-in locally installed Ollama narrative assistance only, not hosted or approved execution.
- `commercial-tools.test.mjs` validates each workflow with examples and rejects invalid values, fake paid state and falsely verified outputs.

## Proposed price experiments (NOT live offers)
- Free: short result, self-reported sample export.
- One-off: USD $9–$19 per purchased report; intended guest checkout.
- Advanced: USD $39–$99; intended signup when file uploads, revisions or saved reports are offered.
- Recurring Business: USD $49–$149 monthly **after** repeat demand is measured.
These are hypotheses; unit economics, inference costs, labor, jurisdiction, refunds, taxes and merchant eligibility must be checked.

## Funnel and EPMO transfer
1. Helpful public tool landing page + concise problem statement.
2. Visitor completes basic assessment in-browser without creating an account.
3. Present immediate score, source limitations, honest sample draft and one proposed next step.
4. Offer paid upgrade **only after checkout, legal and fulfillment are verified**. Until then, a paid description must not mimic a payment screen or claim an order.
5. For recurring reporting needs, introduce TheOrg workspace after authentication and privacy safeguards are ready.
6. For project/portfolio governance needs, show an optional THEEPMO link with campaign tags. Do not auto-transfer data or create accounts.
7. Measure anonymous, consent-aware stage conversion (visit → tool start → tool completion → pricing interest → verified purchase → delivery → referral). Never log raw input values to analytics.

## Execution, data and security contract
- **Static free tier:** browser-only first-party JS. CSP `connect-src 'none'`; no external analytics or payment links and no user-entered records sent to TheOrg servers in the preview.
- **Paid tier (future):** server creates order; approved payment provider confirms through signed authenticated webhook; fulfillment only then may run. Idempotent order token, no secret or access token in browser, expiration and refund handling.
- **Source privacy:** implement classified input handling, upload limits, encrypted private storage, report TTL/retention, deletion and clear subprocessor disclosures before supporting customer documents.
- **AI results:** deterministic calculations are not model inference. Local model advisory outputs require opt-in and independent factual validation. Inference and tool execution must be bounded and permissioned.
- **Report integrity:** paid/generated output must state source provenance, method, assumptions, QA and review state. Only an authenticated approval service may mark reports verified.
- **THEEPMO independence:** transfer governance patterns only, never modify THEEPMO production or copy its proprietary/customer data.

## 90-day delivery gates
**Days 1–15 — Baseline.** Restore GitHub CI, resolve Cloudflare preview upload failures, run browser acceptance, establish product unit costs and legal seller/payment eligibility. Acceptance: reproducible green release candidate and one source-grounded report pipeline.

**Days 16–30 — Free Quick Wins.** Publish marketplace, individual high-quality tools, sample reports, accessibility, mobile UX, user feedback and privacy. Acceptance: five free tools produce correct outcomes without accounts or external network requests.

**Days 31–60 — Controlled first sales.** Hosted checkout, server-side payment verification, guest delivery links, customer support/refunds, private storage and report QA. Acceptance: 20 accurately fulfilled and legally compliant paid pilot orders, if payment eligibility is confirmed.

**Days 61–90 — Retention + referrals.** Saved accounts, recurring reporting where useful, improved SEO, marketing campaigns and consent-aware THEEPMO referrals. Acceptance: measured repeat purchase, conversion, gross margin, refund rate and qualified lead rate.

## Dashboards for TheOrg owners
- Commercial funnel, traffic and drop-offs (no raw inputs).
- Tool conversion and completion, free-to-paid interest, top products.
- Verified paid orders, revenue, processor fees, refunds and gross margin **once live**.
- Report reliability, source/QA completion, failed fulfillment.
- EPMO referral attribution and qualified leads only with consent.
- Model/tool quality and cost, infrastructure status, rejected requests.

## Release reality and owner actions
The source-only PR is draft while GitHub hosted-runner checks are failing before steps. Separate Cloudflare preview uploads previously returned API 500 error 10013. Do not claim public release, signed orders, real account creation or automated AI execution before those are implemented and verified. Promote a separate preview first, then switch the commercial root after release approval.

## Implementation / live preview record — November 13, 2026
- Public commercial preview implemented in `marketplace.html`, with brand positioning, five free assessments, a 22-product catalog, pricing hypotheses, standalone draft report exports, repeat-visit path and THEEPMO context referral. No customer data is transferred through a backend in this preview.
- Reusable `commercial-tools.mjs`: **22 distinct bounded workflows** (5 free, 3 smaller one-off, 14 advanced) with validated inputs, deterministic calculations or structured drafts, actionable outputs, report type, tier and explicit non-verification labels.
- `commercial-ai-cli.mjs`: optional *separate* loopback Ollama narrative adapter for all 22, requiring per-invocation user consent; deliberately omitted from the public Worker. No real installed model/inference was certified.
- Dedicated `build-commerce-worker.mjs` and `verify-commerce-worker.mjs` package a standalone *noindex* Worker with `/`, `/marketplace`, `/quick-wins`, `/reports`, `/pricing`, 22 specific `/tools/{id}` links, health/robots and 2 static JS assets.
- Source-level checks in isolated JavaScript: 12/12 commercial engine regression tests, 4/4 local model mock boundary tests, and **31/31** smoke routes in a simulated Worker environment. These do not replace real live browser or GitHub-hosted CI acceptance.
- Cloudflare account was verified as `theorgnet@gmail.com` (account `8c3498934294713cb33f436ff86fc361`). New, separate `theorg-commerce-lab` Worker was uploaded successfully; Cloudflare reports deployment `004c7a5c-bfa5-439d-8578-b95c367035d0` at **100%**, and its workers.dev subdomain is enabled.
- **Preview URL:** https://theorg-commerce-lab.theorgnet.workers.dev/ . External web retrieval from the model environment was inconclusive; platform deployment metadata is confirmed, browser-rendering acceptance is **not**.
- Original TheOrg public Worker remains on deployment `883b1621-25cd-4314-9a0b-7055f1dfdcc6`; previous intelligence lab Worker was not touched in this commercial preview upload.
- `x-robots-tag: noindex, nofollow` and `/robots.txt` disallow crawling until terms, payment, product QA, analytics privacy and launch approval are ready. No paid orders or registrations can be taken by this build.

**Remaining launch gates:** full Node/Python and browser CI; merchant selection and eligible legal seller; privacy/terms/refund policies; transactional hosted checkout with verified server-side events; secure customer accounts and private paid report storage; real source provenance, review and user support; production domain choice; and independently validated, opt-in model execution. Keep PR draft until these are resolved.

## Commercial readiness implementation batch — 13 Nov 2026
- Searchable 22-tool public catalog, five synthetic sample report examples, contextual THEEPMO referral CTA after eligible results, and honest customer paths: `/privacy`, `/terms`, `/refunds`, `/sample-reports`, `/how-it-works`, `/my-reports`, `/account`, `/checkout`. Policy, account and checkout pages are explicitly draft/unavailable.
- First-party Worker provides read-only `/api/commercial-status` indicating payments, accounts, provider connections, private report storage, live AI and approved legal policies are disabled.
- Server-side-only order state machine, signed Stripe-compatible raw webhook verification, exact amount/tenant/order binding, replay rejection, report QA gate and private delivery reference. It is NOT reachable from the public Worker or configured to an active merchant.
- `commerce-private-schema.sql` provides additive D1 tables and append-only audit constructs for independent TheOrg storage; **not migrated to Cloudflare**.
- Commercial launch checks: `commercial-release-gates.json`, `commercial-readiness.mjs`. Production readiness is false until 13 essential gates have independently inspected evidence.
- Added automated source checks for payment verification, legal drafts, synthetic samples, multi-route Worker and private schema. See `COMMERCE_FULFILLMENT_RUNBOOK.md`.
- Updated isolated `theorg-commerce-lab` preview on Theorgnet; deployment `7e7e74f0-e8ab-4e7c-96a4-81b7c9280b70` confirmed at 100%. Main TheOrg Worker and THEEPMO infrastructure unchanged.
- **Outstanding:** GitHub Actions pre-step runner failures; native Node/Python/real-browser acceptance, live merchant eligibility, approved final legal policies, customer auth, private D1/R2, model/source evidence validation, chargebacks/refunds and actual purchase-to-delivery remain blocked.
