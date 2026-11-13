# TheOrg Intelligence — standalone Cloudflare website

This is a **standalone design-preview application**, derived from the TheOrg product direction and the fictional Executive Intelligence scenario. It is not THEEPMO and does not depend on THEEPMO frontend, backend, API, Cloudflare account, or database.

## Contents

- `index.html` — responsive zero-dependency static executive dashboard.
- Executive Overview, AI Supervisor, Strategy & Portfolio, Risk & Compliance, Decision Cockpit, and Knowledge.
- Accessible keyboard navigation, export-to-print, deterministic sample metrics and task-draft preview.

## Security and capability boundaries

- All KPI data is synthetic; sample outlooks are *not* model predictions.
- Does not invoke an AI provider, connect to the TheOrg local runtime, submit tasks, authorize decisions, persist data, or change any user system.
- No credentials, API keys, cookies, or external frontend/backend dependencies are embedded.
- The design preview is intentionally isolated from existing TheOrg application files and all THEEPMO repositories.
- Before adding live execution: implement authenticated API contracts, least-privilege scoped approvals, tenant isolation, integrity validation, independent QA, auditable event state, and user consent.

## Cloudflare deployment plan

**Target account:** Theorgnet@gmail.com (`8c3498934294713cb33f436ff86fc361`), not any other Cloudflare account.

**Project/service:** `theorg-intelligence`; **source:** `TO/sites/theorg-intelligence`.

Cloudflare recommends Workers with static assets for new sites. Once connected with the target account, deploy this directory using its supported Workers Static Assets workflow or connect the repository to Cloudflare's managed build system. Deploy *only* this subdirectory. Preserve all existing Workers, Pages projects, DNS and routes.

No Cloudflare deployment configuration or account resource has been created by this commit. Do not use credentials connected to a different Cloudflare account. Do not attach a production domain without explicit verification.

## Suggested acceptance

1. Preview opens on desktop and mobile and shows six navigable workspaces.
2. All sample indicators and trends are labeled synthetic.
3. KPI inspection, local work-order draft, decision brief preview, and print export work.
4. No requests to THEEPMO services or AI providers; no external business actions.
5. Preview hosted in the correct Cloudflare account and unique project.
6. Final preview URL, deployment ID, repository commit, and test outcome recorded.

## Future extension

Connect approved TheOrg agent-service interfaces only after the existing Windows/runtime and approval-control work has been independently verified. Preserve the source application's local-first architecture; never expose its private native messaging bridge directly to the public Internet.
