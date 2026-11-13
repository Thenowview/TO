# TheOrg — Task-First AI Tool Platform

## Product direction
TheOrg is a **company-controlled platform for building individual AI tools that perform bounded, repeatable tasks**, coordinated through one Supervisor. Each task produces a structured outcome, evidence/QA state, and task-specific analytics. Executive dashboards aggregate only accepted, traceable results.

THEEPMO daily operations supply **examples and patterns**, not live data or a backend dependency. THEEPMO remains a separate product and is not modified.

## Task lifecycle
1. **Tool Studio** — create a versioned tool specification (name, input schema, output contract, permitted actions, data sources, trigger, review rules, success criteria, KPI mapping). No code execution from free-text instructions.
2. **Task Creation** — select an approved tool, define company/project scope, owner, goal and bounded inputs. Create a durable work order.
3. **Supervisor Planning** — compose a plan, select scoped agents and dependencies, estimate complexity, request consent where required.
4. **Approval** — only a real authenticated user with role permissions may authorize consequential actions. Never treat model prose or demo controls as approval.
5. **Tool Execution** — run inside a separately authorized local worker with explicit capability leases, controlled OS/browser scopes, deadline/cancellation and event journaling.
6. **Independent QA** — inspect real deliverables, provenance and evidence; failed checks return work to revision rather than marking completion.
7. **Task Analysis** — for each task: objective, tool version, input/provenance, start/end, actual cost, elapsed time, steps completed, outputs, exceptions, reviewer decision, evidence references and KPIs. Missing data must say **not verified**, never guessed.
8. **Executive Dashboard** — aggregate only verified results across tasks, departments and companies; explain the source of each KPI.

## First five EPMO-inspired tool templates
| Tool | Tasks | Result/dashboard |
|---|---|---|
| Project status analyst | Review milestones and blockers | Delivery health and decision brief |
| Risk register analyst | Identify risks, owners, mitigations | Risk exposure and unresolved blockers |
| Approval gate reviewer | Check criteria, evidence, approval status | Gate readiness and pending decisions |
| Resource capacity analyst | Compare capacity, allocation and demand | Utilization and reassignment needs |
| Knowledge curator | Extract lessons and seek independent review | Evidence completeness and knowledge quality |

## Platform components (target)
- Tool Registry: per-company, versioned tools with schemas, constraints, lifecycle, permissions, triggers, tests.
- Skills/Plugins Gateway: explicit user-authorized connectors to supported applications; no credential scraping or unreviewed plugin execution.
- Supervisor Orchestrator: create tasks and route specialist work, reusable flows, dependencies, retries and resumption.
- Local Runtime Adapter: no inbound public local API; outbound opt-in pairing only after identity and device verification.
- Durable Task/Event Store: scoped and append-only events; idempotent transitions; source and output hashes.
- QA and Policy Engine: owner approval, independent reviewer, severity-based checks, evidence.
- Analytics Engine: metric definitions, aggregation, report generation, provenance and verifiable missing-data indicators.
- Dashboard: task details, agent/tool operations, company and executive summaries; accessible responsive UI.

## What this batch actually implements
- Two new standalone site tabs: **AI Tool Studio** and **Task Analytics**.
- Define and locally persist individual tool *specifications* (max 25), with action categories and 2–8 workflow steps.
- Five synthetic EPMO-inspired tool templates; no THEEPMO data fetched.
- Create and locally persist task plans (max 50) using selected tools; review simulated plans; inspect step-by-step workflow and export JSON.
- Separate pure module `tool-platform.mjs` with tool/task validators and deterministic task summaries, plus Node tests.
- Explicit unverified/zero-execution metrics in the dashboard. **No agent or model has executed work.**
- All data is browser-local synthetic demonstration. Do not enter confidential company data.
- Full site remains isolated from THEEPMO frontend/backend, database, API and deployment.

## What is still required for the real platform
1. Fix GitHub Actions runner availability; existing minimal diagnostic fails before steps and logs are unavailable.
2. Finish TheOrg's Windows Supervisor integration and independently validate hardware/model execution.
3. Provision independent company identity, membership, D1/SQLite sync and signed device pairing; configure Cloudflare Access.
4. Implement tool registry storage, versioning and real schema-based input/output validation.
5. Implement bound tool invocation and real authenticated approvals, separate service-account scopes, cancellation and audited event receipts.
6. Run unit, integration, browser and adversarial cross-company tests, then permit limited pilot executions.
7. Enable evidence-backed performance dashboards, not only simulation metrics.
8. Verify deployment source parity and configure account-scoped GitHub Actions auto-deploy after successful checks.

## Safety requirements
- Never connect to THEEPMO's production environment or use real customer data as a development fixture.
- No unrestricted AI-generated shell commands, secrets, credentials, billing, email or deployment permissions.
- Separate the roles **propose**, **approve**, **execute** and **verify**.
- Treat AI output as untrusted until independently reviewed.
- Record status transitions and their evidence transactionally in a company-scoped store.

## Governance and bounded runtime implementation — November 13, 2026

Reviewed THEEPMO `2029TEBE/TEBE` sources: `README.md`, `packages/db/sql/rls.sql`, `apps/api/src/audit/audit.service.ts`, `apps/api/src/main.ts`, and shared contracts. Adapted **patterns only**, with independent TheOrg code and no changes to THEEPMO:

- **Tenant company boundary:** every task action requires matching tenant/company context, modeled after THEEPMO's fail-closed RLS. This is not PostgreSQL RLS, and production database authorization still requires audited bindings.
- **Evidence stage gates:** explicit executive approval, bounded task run, evidence-backed output, independent reviewer and verified digest before accepting a task. No arbitrary status override.
- **Append-only audit pattern:** `task-schema.sql` stores task/tool definitions and task events, with D1 triggers rejecting updates and deletions. The schema is source-only, not applied.
- **Task contracts and analytics:** versioned tool identities, bounded arguments, task status and step receipts, cross-company filtering, actual verified-only counts and evidence-report templates.
- **First implemented offline capability:** KPI variance calculator. Only exactly supported arithmetic workflow steps can run; the other five EPMO-inspired examples refuse execution until real adapters exist. The calculator performs bounded arithmetic on caller-supplied rows, uses WebCrypto SHA-256 receipt generation and requires an independent reviewer to verify evidence. It is NOT AI inference or verification of source truth.
- `task-engine.mjs` and `task-engine.test.mjs` provide this source-level execution contract and regression cases.
- Current public website remains an older synthetic demo; tool platform UI and offline engine are GitHub review-branch source, not yet deployed or paired to Windows.

**Release blockers:** GitHub-hosted runner smoke diagnostic and site checks fail before logs/steps; no confirmed green tests or browser/Windows integration. Secure Access, D1 provisioning, durable event transactions, real AI provider invocation, signed-device pairing, and actual approved local runtime remain pending.

**QA distinction:** A SHA-256 digest establishes content integrity, not authenticity of the underlying business evidence. An independent reviewer must verify the actual source/provenance. Never equate a local demo approval with authenticated owner consent.
