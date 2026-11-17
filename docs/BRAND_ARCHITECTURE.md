# Orgaiz brand, product and repository ownership (decision record)
**Decision date:** 2026-11-14
**Status:** Approved product direction; documentation only. No domain migration, rename, deployment or release is implied by this decision.
**Scope:** `faisalwrokksa-hub/TO`, `2029TEFE/TEFE`, `2029TEBE/TEBE`.

## Approved AI brand addendum — 17 November 2026
- **GIZE AI** is the official AI product identity. Use **Powered by GIZE AI** for customer-facing intelligence and decision-support experiences.
- Use **ORGANIZATION** and **STRATEGIZE** as the approved capability names; their integrated architecture is **ORGANIZATION + STRATEGIZE** — Integrated Organization and Strategy Management.
- The previous `GAIZ` term remains only where required to identify experimental protocol bytes, filenames, paths, endpoints or documented technical history. Do not silently rename the `.gaiz` extension or `GAIZ1`/`GAIZ2` cryptographic markers.
- This addendum does not authorize new websites, domain changes, identity migrations, production deployments or substitution of THEEPMO's authorized commercial identity.

## Non-negotiable product decision
- **ORGAIZ / Orgaiz.com is the one public-facing master brand.** Orgaiz is the new commercial name for the former "TheOrg" concept, including its AI tools, report offerings, local/browser agents, secure API connections and proposed encrypted-file functionality.
- **THEEPMO is an Orgaiz product, not another independent company or marketing brand.** Preserve THEEPMO's substantive enterprise governance, strategy, portfolio/project, approval and reporting capabilities.
- **Exactly two customer-facing web experiences are planned:** (1) the Orgaiz public website and tools entry point; (2) the authenticated THEEPMO application under the Orgaiz brand. Background APIs, browser extensions, Windows apps and required subdomains do not constitute additional marketing websites.
- **No third website and no stand-alone TheOrg marketing identity.** "TheOrg", `TO`, `TEFE` and `TEBE` may still occur as historical or technical names until an approved migration updates dependencies safely.
- **`.gaiz` (lowercase) is the only approved proposed encrypted-file extension.** Do not substitute `.qaiz` or change its spelling/case in customer-facing product copy.

## Repository ownership and boundaries
| Repository | Owns | Does not own |
| --- | --- | --- |
| [faisalwrokksa-hub/TO](https://github.com/faisalwrokksa-hub/TO) | Legacy TheOrg local-first Chrome/Windows supervisor, agents, reports, and the future **Orgaiz** AI-tools capability; own code rebranding and future integration work | THEEPMO authentication/database or unreviewed live Cloudflare deployment |
| [2029TEFE/TEFE](https://github.com/2029TEFE/TEFE) | Existing public THEEPMO marketing frontend; source to **consolidate into Orgaiz.com** without creating another public site | Authenticated THEEPMO `apps/web`, NestJS API, database, real customer data |
| [2029TEBE/TEBE](https://github.com/2029TEBE/TEBE) | THEEPMO authenticated web application (`apps/web`), NestJS API (`apps/api`), contracts and PostgreSQL data/RLS | Another independent marketing site or a second credential manager |

**Important:** The TO repository is currently a local-first Chrome extension + Windows bridge candidate, not an already deployed Orgaiz SaaS website. Do not erase, rename, or claim those runtime capabilities are production-ready merely to implement branding. Assign any public Orgaiz frontend to an explicitly reviewed ownership/migration plan using the existing frontend where sensible. A domain name or website decision is not permission to replace application architecture.

## Shared account and API model (planned, not implemented)
- Support (A) **Bring Your Own API** where the customer pays their chosen provider, and (B) **Orgaiz-managed API access** through a platform-issued token with platform billing and enforceable quotas. A provider-hosted OAuth/delegated connection may be added only when officially supported.
- Identity and tenant authorization must govern all calls between Orgaiz and THEEPMO. Shared sign-in does not imply shared access to a tenant's documents.
- Treat provider credentials as secrets: server-side ingestion only, encrypted at rest with controlled keys, strict per-tenant ownership, least privilege, zero raw-secret exposure to browser/logs/analytics, rotation and revocation.
- A platform token is **not** a provider key. Do not expose, resell or distribute upstream provider API keys. Verify each provider's contractual terms before launch.
- Managed API must enforce user/tenant hard cost caps, explicit quotas, and safe handling of charge failures; merely showing an alert is insufficient.
- Prompts, documents and `.gaiz` file contents are excluded from telemetry by default; never decrypt customer files for processing without explicit authorized user action and a reviewed security model.

## Naming and navigation rules
- Public website header, footer, onboarding and legal/product copy: **Orgaiz**.
- Product navigation: **THEEPMO**, labeled as an enterprise product of Orgaiz. Preserve existing THEEPMO features rather than inventing a new product.
- Old name **TheOrg** appears only when needed for technical history, changelog, migration and legacy build references. Do not introduce it as a third menu, brand, DNS site or paid plan.
- Maintain reviewed accessibility, RTL and localizations. Do not present placeholder translations as verified.
- Distinguish proposed features from shipped capabilities. Do not claim `.gaiz` encryption, managed billing, SSO or provider connection is operational without release and security evidence.

## Safe migration sequence (requires separately approved implementation)
1. Inventory website assets, UI routes, accounts, domains, GitHub references, CI, DNS, backend dependencies and deployment/rollback owners; record current production behavior.
2. Decide final Orgaiz frontend ownership, canonical URLs and THEEPMO app address; inventory SEO/i18n redirects and content before altering live hostnames.
3. Prepare rebranded copy, navigation and design in preview using synthetic data; preserve TO local execution capabilities, TEBE auth/roles/licensing/RLS and existing TEFE rollback assets.
4. Implement shared SSO/authorization and secure API connections behind feature flags and security tests; do not expose BYOAPI secrets or enable unapproved paid services.
5. Perform CI, functional, mobile/desktop, localization, accessibility, security, billing and tenant-isolation acceptance. Verify live destination and rollback before any redirect or domain retirement.
6. Only after explicit release authorization: publish Orgaiz.com, validate THEEPMO login routing, then plan/execute theepmo.com redirects and legacy site retirement. Rename repositories/packages only after external references and build systems are updated.

## Operational restrictions for this documentation change
- Do not change DNS, Cloudflare accounts/routes, domains, CI release workflows, runners, GitHub repository names, secrets, production billing, database migrations, RLS, production data or user permissions.
- Preserve the current release boundaries and existing production hosts until verified migration and distinct user approval.
- No paid integrations or third-party subscriptions are enabled by this decision. Use synthetic data in demonstrations.
- Make any later code migration as reviewable PRs with acceptance evidence and explicit release gates.

## Definition of done for a later implementation
- One official Orgaiz public website, one authenticated THEEPMO web experience, no additional public TheOrg property.
- Consistent brand/menu terminology across both, without regressing existing THEEPMO functions or TO local agent functions.
- Correct `.gaiz` spelling and security claims supported by actual tests.
- All customer API connections tenant-isolated, revocable, permission-scoped, and charge-safe.
- Redirects, SEO, localization, rollback, release history and live endpoint verification documented.

## Legacy naming compatibility: GAIZ = GIZE

**GAIZ is the legacy name of GIZE, not a separate product.** The customer-facing AI product brand is **GIZE AI**. All applicable new user-facing names, navigation, descriptions and translations must say GIZE / GIZE AI, not GAIZ. The historical `GAIZ`, `GAIZ1`, `GAIZ2` and `.gaiz` identifiers may still appear only in explicit legacy compatibility instructions, immutable signed data, protocol versions, file extensions, existing API paths, persisted references and migration/audit records. Existing GAIZ artifacts and clients must continue to work under the GIZE brand; never rewrite encrypted wire bytes, silently rename extensions, invalidate signatures, or change endpoints without versioned aliases, migration tests and coordinated release approval.
