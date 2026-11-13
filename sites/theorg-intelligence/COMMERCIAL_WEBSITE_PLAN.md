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
