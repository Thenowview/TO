# TheOrg — Chrome-native AI operating workspace

**Status:** Source migration in progress. This repository is a private development workspace; it is not yet a verified Windows release.

## Product objective

TheOrg is a local-first Windows application coordinated from Chrome Stable. The user gives one order, a supervisor obtains a plan from an authorized AI session, specialist agents perform bounded tasks with approved browser/desktop tools, and TheOrg verifies resulting files before delivery.

**Architecture:** dedicated Chrome profile → Manifest V3 extension (side panel and full tab) → authenticated Native Messaging bridge → bundled Windows execution engine → SQLite and per-company file workspaces. Online storage/email/calendar integrations remain optional and permission-scoped. Local tasks must remain usable offline.

## Source preservation

The historical sources **TheOrg(2).zip** and **Theorg's.zip** are owner-supplied archives and **have not yet been imported into this repository**. Preserve the original sidebar and existing Python workflow, storage, document tools, and tests before refactoring. Do not claim that the archives were audited from this repository until their extracted source is committed and inventoried.

Recommended directories after migration:

- `legacy/original-sidebar/` — original sidebar source, unmodified; only after security review
- `legacy/theorg-v0.6/` — existing local app modules, when identified and safely extracted
- `apps/chrome-extension/` — Chrome UI and permissions
- `apps/office-workspace/` — supervisor/employee/deliveries UI
- `engine/` — local Windows bridge, supervisor and execution
- `connectors/` — Google and Microsoft integrations
- `skills/` — approved, versioned procedures
- `tests/` — regression and integration tests
- `docs/` — architecture, inventory and release evidence

This tree is a target, **not** a statement that its modules already exist.

## First action

Follow [docs/IMPORT_EXISTING_SOURCE.md](docs/IMPORT_EXISTING_SOURCE.md) to import *extracted, sanitized source* from both owner archives. Do not upload the original 260 MB ZIP, browser profiles, tokens, secrets, binary artifacts or dependency caches.

## Required acceptance checks

1. Complete source inventory and SHA-256 checksums.
2. Existing v0.6 functionality retained; historical test record is not a new pass.
3. Chrome extension exchanges verified messages with a registered Windows native host.
4. Real supervisor → specialist → file workflow, with permitted provider integration and evidence.
5. Offline task recovery, file integrity and permission controls.
6. Clean Windows 11 installation, restart and uninstall; release status based on actual test results.

**Security:** Never automate unauthorized AI-provider access or bypass CAPTCHAs, login protections or message quotas. Human approval is mandatory for consequential actions. No production operations are authorized by this repository setup.
