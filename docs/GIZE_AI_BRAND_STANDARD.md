# GIZE AI cross-repository branding standard and migration gate

**Decision:** 2026-11-17  
**Scope:** TEBE, TEFE, TO  
**State:** Approved naming; implementation and production verification tracked separately.

## Canonical user-facing terminology

| Retired visible label | Approved label | Description |
| --- | --- | --- |
| ORGNZION | ORGANIZATION | Organizational Design and Governance |
| STRATGIZE | STRATEGIZE | Strategic Planning and Execution |
| ORGGIZE | ORGANIZATION + STRATEGIZE | Integrated Organization and Strategy Management |
| GAIZ | GIZE | AI-Powered Enterprise Intelligence |
| GAIZ AI | GIZE AI | AI-Powered Intelligence and Decision Support |

**Brand hierarchy:** Orgaiz (master brand) → THEEPMO (authorized enterprise product) → ORGANIZATION + STRATEGIZE (integrated operating model) → **Powered by GIZE AI** (AI product). “AI Intelligence” is descriptive only, never the brand replacement.

## Repo-specific implementation checklist

- **TEFE:** all public pages, site/header/footer, product copy, SEO titles and descriptions, hreflang and translations, icons/logos and alt text, email/onboarding links.
- **TEBE:** authenticated app headings, dashboard/nav, assistant labels, configuration display labels, email/notification templates, onboarding, API docs, translated UI copy, generated reports, accessibility labels.
- **TO:** Chrome extension surfaces, local supervisor, Windows installer/display names, generated reports and documentation, visual assets, accessibility labels, localized display copy.
- **All:** case-insensitive searches for `gaiz`, `gaiz ai`, `gaiz-powered`, `gaiz assistant`, `gaiz intelligence`, `orgnzion`, `stratgize`, `orggize`; inspect concatenated names, filenames, SVG metadata, CSS class names, generated artifacts and translations as appropriate.
- Preserve THEEPMO branding wherever it remains authorized; do not create a third public website.

## Technical compatibility: no blind renaming

The established technical extension **`.gaiz`** and technical identifiers are *not* automatically renamed by a marketing rebrand. An extension change to `.gize` is **not authorized by this addendum**: it needs a separate explicit file-format compatibility decision, format-version design, old-file opening tests, MIME/OS associations, import/export transitions, migration strategy and security review. New user-facing AI product names must say **GIZE AI**; technical `gaiz` strings may remain only when justified and documented.

Retain existing database schema, endpoints, auth IDs, keys, environment variables, webhooks, tenant settings and billing/subscription IDs unless a reviewed backward-compatible migration and rollback are supplied. Do not claim that renaming provides encryption or security.

## Required verification and evidence

1. Record baseline file inventory and case-insensitive match locations for each repository (including visible strings inside image assets and email templates).
2. Apply human-reviewed visible label changes and supply matching GIZE assets for light/dark, desktop/mobile and RTL.
3. Re-run searches and classify every old match: **historical reference**, **backward compatibility**, **technical identifier**, **pending migration** or **unresolved inconsistency**.
4. Run build/lint/type checks and relevant unit, integration, translation, accessibility and security regressions. Validate API aliases and sample legacy file round trips if touched.
5. Verify actual rendered pages and Chrome/Windows UI where available. Report code completion, merged PRs and production deployment **separately**.
6. Keep branch protection, security approvals and deployment authorization intact. Do not modify CI, DNS, RLS or production data as part of a naming-only change.

## Evidence register (not a claim of implementation)

| Requirement | TEBE | TEFE | TO |
| --- | --- | --- | --- |
| GAIZ → GIZE | Unverified | Unverified | Unverified |
| GAIZ AI → GIZE AI | Unverified | Unverified | Unverified |
| ORGANIZATION terminology | Unverified | Unverified | Unverified |
| STRATEGIZE terminology | Unverified | Unverified | Unverified |
| Previous brand references | Unverified | Unverified | Unverified |
| Logos and visual assets | Unverified | Unverified | Unverified |
| Navigation and dashboards | Unverified | Unverified | Unverified |
| SEO and metadata | Unverified | Unverified | Unverified |
| Email and notification templates | Unverified | Unverified | Unverified |
| Localization | Unverified | Unverified | Unverified |
| Technical compatibility | Unverified | Unverified | Unverified |
| Regression testing | Unverified | Unverified | Unverified |

Update each cell only with actual evidence. Any unavailable repository or missing code-search index must be reported as unverified rather than “no obsolete references.”
