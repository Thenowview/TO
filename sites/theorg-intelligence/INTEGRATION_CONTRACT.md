# TheOrg Intelligence — Batch 2 integration contract (2026-11-13)

## Current operational boundary
- Hosted standalone Cloudflare Worker in account `theorgnet@gmail.com`: `theorg-intelligence`.
- The site is a **fictional-data interactive demonstration** only. KPI workbench recalculates locally; a bounded browser-local work-order journal records a simulated draft -> approved -> qa-reviewed -> closed/rejected flow.
- The demo does **not** connect to any live company data, TheOrg's localhost engine, OpenCode, THEEPMO, AI providers, or company databases.
- Demo status clicks do not represent authenticated owner approvals, QA execution, remote tool calls or verified business outcomes.
- The runtime provides `GET /api/health`, reporting the integration boundaries. All other paths besides `/` and `/index.html` are 404.
- Strict worker CSP forbids network requests from browser JS, framing and external assets. No tokens are embedded.
- THEEPMO repositories and infrastructure are explicitly out of scope.

## Next safe integration (not implemented)
The TheOrg engine is local-first: native Chrome messaging to Windows/.NET/Python/SQLite. Do **not** expose its localhost APIs publicly, forward a native bridge through a Cloudflare Tunnel or bundle local credentials into a web app.

Implement an independently authenticated, outbound-initiated opt-in connector **only after Windows runtime verification**:
1. User pairs a **single company and device** using a one-time login-bound code; short-lived tokens and asymmetric device signing. No long-lived browser secrets.
2. The Windows connector polls an authenticated queue or establishes an authenticated outbound channel; cloud service cannot reach arbitrary local resources.
3. Message contract is versioned, tenant and company scoped, idempotent, replay protected, expiring and signed. Validate actor, capability, arguments and source evidence.
4. Server-side roles authorize create/draft, approve/reject and read results independently. AI outputs can propose but never approve. Privileged tool scopes require fresh owner consent in the local runtime.
5. Job states include proposed, awaiting-approval, queued, running, awaiting-review, accepted, failed, cancelled and blocked, plus immutable event IDs and timestamps.
6. Independent QA and signed evidence receipts precede publication of KPI modifications, and calculations stay deterministic.
7. Apply per-tenant quotas, rate limits, revocation and audit logs. Securely test malicious prompts, cross-tenant data access, replay, cancellation, offline/restart recovery and corrupted results.

## Suggested event envelope
```json
{
  "schema_version": "1.0",
  "event_id": "uuid",
  "tenant_id": "tenant-id",
  "company_id": "company-id",
  "correlation_id": "uuid",
  "event_type": "intelligence.intervention.proposed",
  "created_at": "2026-11-13T00:00:00Z",
  "expires_at": "2026-11-14T00:00:00Z",
  "source": "theorg-intelligence",
  "data_classification": "internal",
  "kpi": {
    "metric_id": "strategy_execution",
    "actual": 83,
    "target": 90,
    "unit": "percent",
    "direction": "higher_is_better",
    "period": "2026-Q3",
    "provenance_refs": [],
    "data_status": "synthetic"
  },
  "proposal": {
    "objective": "Investigate execution gap",
    "approval_status": "proposed",
    "execution_authorized": false
  }
}
```

## Measured acceptance vs claims
- Static checks: site includes deterministic calculations, bounded local journal, HTML escaping, no third-party script links, synthetic labels and separated THEEPMO scope.
- Cloudflare API upload succeeded; check deployment record and account.
- Independent browser HTTP checks, real authentication, native Windows connection and real-model integration remain **not verified/not implemented**.
- GitHub source branch is independent from `main` and from THEEPMO. Hosted Worker was updated manually from the branch; **no GitHub CI auto-deploy**.

## Deployment workflow design
For durable automation, add a dedicated website-only workflow with independent checks, an account-scoped API token, Cloudflare account ID locked to `8c3498934294713cb33f436ff86fc361`, and concurrency control. It should deploy **only** `sites/theorg-intelligence` after approval and successful tests. Token must be stored in GitHub Secrets and never written to logs or published assets. Do not reuse THEEPMO credentials.
