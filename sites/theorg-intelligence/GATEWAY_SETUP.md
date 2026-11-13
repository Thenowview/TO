# TheOrg Intelligence Enterprise Gateway — Source-Only Preparation

**Status:** The secure gateway is **not deployed** and is not linked to the public website. The existing Cloudflare Worker remains a synthetic-only demonstration. This project has no dependency on THEEPMO frontend/backend, hosting, database or credentials.

## Implemented source
- `schema.sql`: separate D1 tables for companies, memberships, KPI records, proposals and audit events. All business data access is tenant- and company-scoped.
- `intelligence-rules.mjs`: validated KPI input and higher-/lower-is-better variance calculations. Explicit executive approval, independent reviewer role and `sha256:` evidence-digest gate for future closure workflows.
- `enterprise-gateway.mjs`: read-only KPI/proposal list plus proposal creation, with verified Cloudflare Access RS256 JWTs, validated audience/issuer/time, explicit company-membership check, bounded request body, no CORS authorizations, no generic execution endpoint.
- `enterprise.test.mjs`: Node built-in test cases for deterministic calculations, state transitions, isolation preconditions and fail-closed behavior.
- `.github/workflows/theorg-intelligence-deploy.yml`: manual-only, confirmation-gated website deployment from reviewed source, pinned to Theorgnet Cloudflare account. Requires the `THEORG_CF_TOKEN` GitHub secret (not set by this code). Not automatic.

## Required owner/provider configuration BEFORE enabling enterprise API
1. Create a dedicated **Cloudflare Access** application protecting the enterprise API Worker or route, with appropriate identity provider and policy.
2. Record the *actual* team domain (e.g. `example.cloudflareaccess.com`) and the application's Audience tag in Worker environment bindings `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`. Do not guess them. Source rejects missing or malformed settings.
3. Create a new **D1 database in Theorgnet account** for this project only, apply `schema.sql`, and bind it as `DB` to the new **gateway** Worker. Do not reuse THEEPMO data.
4. Provision company/member rows through an audited owner-only migration. **No default members, admin bypass or demo account are provisioned** in source. All business routes return 403 without an explicit membership.
5. Deploy the enterprise gateway as a **separate** Access-protected Worker with its imported `intelligence-rules.mjs`. Never replace the current public synthetic website with an unaudited gateway.
6. Run real Access-token tests (valid/invalid signature, expired, incorrect audience, wrong tenant, missing membership, cross-company access, large payload), D1 atomicity tests and rate-limit tests before enabling writes.
7. Only later build an outbound-first opt-in device connector. Never create a public Cloudflare Tunnel to TheOrg's Native Messaging bridge or local Python API.

## Cloud API contract in the staged source
- `GET /api/health` — readiness only, always reports `execution_enabled: false`.
- `GET /api/v1/kpis?tenant=...&company=...` — authenticated, membership-scoped KPI list and deterministic variance.
- `GET /api/v1/proposals?tenant=...&company=...` — authenticated, membership-scoped proposal list.
- `POST /api/v1/proposals?tenant=...&company=...` — analyst/executive can submit a reviewed objective referencing an existing KPI. Creates a `proposed` work item with an audit event. **No tool dispatch**.
- No `approve`, `review`, `close`, `execute` or desktop remote-action endpoint. Additional transaction-safe authorization and independently verified QA must be developed before such routes are published.

## Known gaps
- No Cloudflare Access app, D1 resource or `THEORG_CF_TOKEN` secret was provisioned during this batch; therefore API is not live and deploy workflow is not usable yet.
- No local Windows agent pairing or synchronization has been implemented.
- Site-specific and unrelated Windows CI jobs fail before steps/logs are available. Minimal `TheOrg Runner Diagnostic` also fails before steps; treat runner/billing/policy/organization settings as the next external diagnostic, **not a verified application regression**.
- The GitHub draft PR must stay review-only until CI and real browser/Windows tests pass.
- The public website remains the previously deployed synthetic demo. **No THEEPMO files, services, DNS, databases, or credentials were touched.**

Useful reference: [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).
