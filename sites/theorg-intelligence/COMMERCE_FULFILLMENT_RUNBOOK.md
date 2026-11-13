# TheOrg — Commercial Fulfillment Handoff (draft / closed to production)

## Present implementation
TheOrg commercial lab Worker serves **only** first-party, browser-local report calculations and static information. It contains no backend payment, login, storage or AI model credentials and cannot create live orders. Live checkout, subscriptions, refunds, authenticated customer downloads, uploaded business data and paid AI processing remain disabled.

**Preview:** https://theorg-commerce-lab.theorgnet.workers.dev/
**Protected repository branch:** `feat/theorg-executive-intelligence-site-20261113` (draft PR #25)
**Isolation:** Never change THEEPMO production code, domain, database or account to activate TheOrg.

## What this batch adds
- `commerce-fulfillment.mjs` (Node server-only): product quote from allowlisted catalog, tenant/customer-scoped order state transitions, Stripe-compatible signed RAW webhook validation, replay detection, exact amount/currency/order/Checkout Session matching, report drafting, independent reviewer acceptance, private delivery reference and customer entitlement checks. It does **not** create Stripe Checkout Sessions or authenticate customer accounts.
- `commerce-private-schema.sql`: source-only additive D1 tables for orders, immutable events, webhook receipts and private report metadata. **Not applied.** Requires private D1 and R2 bindings with verified per-company auth.
- `commerce-fulfillment.test.mjs`: synthetic signed webhook and payment/failure/QA/report access checks.
- `test_commerce_schema.py`: local SQLite cross-tenant, replay, immutable event and private pointer tests.
- `commerce-pages.mjs`: draft privacy, terms and refund pages, synthetic sample report page, how-it-works and honest disabled account/checkout pages.
- `commercial-readiness.mjs` + `commercial-release-gates.json`: evidence-backed go-live assessment. `--require-ready` exits nonzero until every critical release gate has a documented, independently verified pass.

## Proposed production service interfaces — NOT LIVE
| Endpoint | Allowed principal | Contract |
|---|---|---|
| POST /api/v1/quotes | Signed-in customer or bounded guest | Server calculates current immutable USD price from catalog + validated tool inputs; returns quote ID and expiry |
| POST /api/v1/checkout-sessions | Authenticated customer / guest session token | Server creates provider Checkout Session; persists exact order/session reference; returns ONLY provider-hosted URL |
| POST /api/v1/provider-webhook | Provider-signed raw body | Verifies timestamp/signature and expected paid amount/currency/session; atomically inserts unique event and transitions order state |
| GET /api/v1/my-reports | Authenticated customer, tenant-bound | Lists only their orders and non-sensitive report metadata |
| GET /api/v1/my-reports/:id/download | Authenticated customer, tenant-bound | Checks order delivered and report owner, issues short-lived authorized delivery or streams private object; no public bucket |
| POST /api/v1/reviews/:id | Authorized independent reviewer | Compares report evidence/hash and records a reviewed-but-source-unverified result, or rejects it |
| GET /api/v1/admin/fulfillment | Privileged authorized staff | Aggregated report quality, stuck orders, costs, refunds and operational health; no cross-tenant leakage |

All of these are **future protected backend endpoints**. The static public Worker does not implement them, and must return no functional payment or account controls.

## Required sequence for one real paid order
1. **Legal and eligibility:** Confirm selling entity, payment-provider eligibility, tax/consumer obligations, support contact, published refund/retention terms and allowed processing jurisdiction. Do not invent merchant credentials.
2. **Identity:** Choose an authentication provider, verify signed server-side identity, bind `tenant_id` and `subject_id` from trusted claims, and set guest-session expiration policy. Never trust tenant IDs supplied by a browser.
3. **Storage:** Provision an independent TheOrg D1 database and a private R2 bucket. Test owner-only reads, data deletion/expiry, backups, and secure download expiry before connecting customers. Apply schema through reviewed migrations, not ad hoc live SQL.
4. **Checkout:** Create order and Checkout Session on the server, persist session ID and expected total. Do not trust client-submitted prices or a checkout success-page redirect as payment proof.
5. **Webhooks:** Use the provider's configured signing secret to verify the **raw** request body and timestamp. Check status `paid`, `complete`, currency, amount, session ID and internal order reference. Reject cross-order or duplicate event IDs. Process state + event atomically with D1 prepared statements and a unique event ID. Keep provider secrets out of logs.
6. **Fulfillment:** Run a bounded report engine after trusted payment confirmation. Store output only in private R2. Retain input/provenance hashes and method. Do not label self-reported inputs as source-verified.
7. **QA:** Independent reviewer checks report evidence, document integrity and customer scope. Release a clearly labeled report, not a fabricated certified assurance.
8. **Delivery:** Authorized customer obtains their own report through a short-lived, rate-limited private delivery service. Never reveal internal R2 object keys or raw business inputs in public APIs.
9. **Exceptions:** Before launch implement idempotent webhook retries, refund/chargeback handling, reconciliation, stalled-job recovery, failed generation, customer contact and deletion requests.
10. **Monitoring:** Alert on payment/provider failures, orphaned orders, repeated webhooks, high report failures, QA backlogs, rate-limit violations, privacy incidents and anomalous spending. Emit redacted operational metrics only.

**Payment provider:** The source currently provides a Stripe-compatible HMAC verifier as a *candidate*. That is NOT proof of merchant eligibility, active Stripe checkout, a verified live webhook endpoint or subscription capability. Another payment provider may be selected before live launch.

**Atomic D1 implementation:** Prefer `prepare().bind()` and `batch()` for related state/event writes; D1 batch transactions roll back on failure. A real concurrency/replay test with multiple simultaneous webhook deliveries is required.

## Developer verification commands
```sh
node --test sites/theorg-intelligence/commercial-tools.test.mjs
node --test sites/theorg-intelligence/commerce-fulfillment.test.mjs
node --test sites/theorg-intelligence/commerce-pages.test.mjs
python3 -m unittest discover -s sites/theorg-intelligence -p 'test_commerce_schema.py' -v
node sites/theorg-intelligence/build-commerce-worker.mjs
node sites/theorg-intelligence/verify-commerce-worker.mjs
node --test sites/theorg-intelligence/commercial-readiness.test.mjs
node sites/theorg-intelligence/commercial-readiness.mjs --require-ready
```
The last command **must currently fail** because production merchant/auth/QA gates are not verified. Failure is the intended safe state.

## What was verified in this development batch
- Isolated JavaScript: 10/10 payment state-machine checks with deterministic cryptographic stubs (not native Node HMAC), five policy/content checks and 40/40 static Worker route checks.
- Cloudflare API: isolated `theorg-commerce-lab` Worker uploaded successfully and deployed at 100% (see PR for current deployment ID). Primary TheOrg Worker and intelligence lab remain unchanged.
- **Not verified:** real GitHub Node/Python acceptance (runner failures), full live external-browser availability, D1 migration in Cloudflare, real Stripe webhooks, actual payments, model inference, document fulfillment or customer-authenticated download.

## Remaining owner approvals
Confirm the **legal selling entity and jurisdiction**, payment-provider account/eligibility, support mailbox and refund policy, data retention/deletion policy, authentication choice, budget for external providers and intended production domain. TheOrg must remain a useful free tool site even if those approvals are delayed.
