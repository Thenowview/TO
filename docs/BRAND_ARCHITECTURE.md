# Official naming and compatibility policy — 2026-11-17

**Supersedes the ORGAIZ and .GAZE branding decisions dated 2026-11-14.**

| Previous name | Approved name | Meaning |
| --- | --- | --- |
| ORGNZION | **ORGANIZATION** | Organizational Design and Governance |
| STRATGIZE | **STRATEGIZE** | Strategic Planning and Execution |
| ORGGIZE | **ORGANIZATION + STRATEGIZE** | Integrated Organization and Strategy Management |
| GAIZ | **GIZE** | AI-Powered Enterprise Intelligence |
| GAIZ AI | **GIZE AI** | AI-Powered Intelligence and Decision Support |

**GIZE AI** is the official AI product brand, in all supported languages. Translate descriptions but not the brand. The recommended attribution is **Powered by GIZE AI**. **ORGANIZATION + STRATEGIZE** describes the integrated organization and strategy platform. Preserve **THE EPMO** where it remains the authorized commercial identity.

## Repository boundaries
- **TO** owns its local-first Chrome extension/Windows bridge, agents and legacy protected-artifact format implementation.
- **TEFE** owns THE EPMO public marketing source.
- **TEBE** owns THE EPMO authenticated application, API, contract, auth and tenant data.

## Compatibility exceptions — not new brands
- Keep technical `.gaiz`, `GAIZ1`, `GAIZ2`, signed bytes, format strings, fixtures, encoders/decoders, URLs, imports, API endpoints, keys, hooks and persisted settings unchanged until reviewed versioned migration.
- Keep `TheOrg` identifiers required by installed native hosts, browser extension integration, Windows installers and local storage. User-facing labels can use GIZE AI without altering underlying compatibility keys.
- Historical documentation can record ORGAIZ, TheOrg and .GAZE as superseded decisions.
- Do not change production domains, tenancy, authentication, payment subscriptions, webhooks, RLS or secrets as part of branding.

## Release gate
Audit active strings, translations, icons, metadata, accessibility, email and notification templates in all three repositories. Classify remaining legacy names (historical, backward-compatible, technical, pending migration, unresolved). Run relevant build, protocol, browser accessibility, localization and regression tests before merge. Track code merge and production deployment independently.