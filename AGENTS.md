# Agent instructions — Orgaiz (legacy TO repository)
Read [Orgaiz brand and repository architecture](docs/BRAND_ARCHITECTURE.md) before planning or changing branding, product architecture, API connection flows, billing or hosting.

## Product direction
- **Orgaiz / Orgaiz.com** is the single corporate/public brand. "TheOrg" is a *legacy internal* project/name, not an additional customer-facing website or product.
- Exactly **two customer-facing web experiences** are planned: Orgaiz public/tools and THEEPMO authenticated enterprise application under the Orgaiz brand. THEEPMO is a product, not a separate marketing company.
- Current owner decision: new encrypted exports use **`.gize`** (lowercase); legacy **`.gaiz`** remains readable. Preserve GAIZ1/GAIZ2 wire identifiers. See [current implementation baseline](docs/CURRENT_IMPLEMENTATION_BASELINE.md); do not claim migration is complete without tests.
- This repo currently contains a **Chrome extension + native Windows bridge/local-first agents**; do not assume it is already the deployed Orgaiz.com frontend. Preserve working local functionality and historical build names until an explicitly reviewed migration.

## Ownership
- This repository owns Orgaiz AI-agent/report/local-execution capability and related future product integration.
- Public website source is presently [TEFE](https://github.com/2029TEFE/TEFE); enterprise authenticated app/API/database remain [TEBE](https://github.com/2029TEBE/TEBE).
- Plan cross-repo changes explicitly; do not create a third public front end or copy tenant data across applications.

## Mandatory security and change gates
- BYOAPI secrets must never reach client storage, logs or Git. Plan tenant-bound encrypted storage, key rotation/revocation and provider-term checks before implementation.
- Managed access requires platform-issued tokens, strict quotas, cost hard stops, and separate provider credentials; never share upstream provider keys.
- Treat `.gaiz` encryption as a proposed feature pending security review and test evidence.
- Documentation-only work cannot change CI, DNS, Cloudflare routing, database/RLS, production user data, paid services, repo names or deployments. Use reviewable PRs and synthetic data; release requires separate authorization.

## Modern Web Guidance — Orgaiz browser and extension surfaces

Before modifying the Chrome MV3 Supervisor HTML/CSS/side panel/extension UI or browser-facing JavaScript, consult [the repo-local Modern Web Guidance skill](.agents/skills/modern-web-guidance/SKILL.md). Respect Chrome Manifest V3, strict extension Content Security Policy, least privilege and existing Native Messaging consent. Never fetch or execute remote JavaScript in the extension, and never assume that optional browser built-in AI APIs are installed or permitted. Keep existing local Windows bridge/SQLite functionality and distinguish current legacy names from future Orgaiz branding. Do not apply the guide to native .NET backend, installer, repo automation or SQL-only changes. The upstream CLI is not installed or run automatically.
