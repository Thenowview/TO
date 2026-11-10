# TheOrg live development status — feature branch

**Branch:** `feat/chrome-windows-native-bridge` — draft PR #2 into `chore/source-import-foundation`.

This feature branch supersedes the earlier foundation-only state below. The original ZIP archives remain **unimported** and cannot yet be claimed as fully preserved or audited.

## Verified development activities

- Chrome MV3 Supervisor home, AI chat provider directory, task-scoped agent tabs and manual adviser handoffs committed.
- 12 fixed agent profiles and plugin target registry committed as definitions, not live third-party connections.
- Windows native host compiled, with local company-scoped order and artifact storage.
- Agent file import, versions, SHA-256 verification and format-structure checks implemented.
- Recoverable host-process chunk uploads and hash-verified downloads up to 32 MiB committed.
- Repeatable Node simulated-Chrome tests and Windows .NET self-tests added.
- Unsigned installer and per-user Chrome registration scripts committed.
- GitHub CI runs verify compilation, self-tests and bundle/installer packaging when green; check each latest run before certification.

## Unresolved acceptance gates

- Import, secrets-audit, and map both owner ZIP archives and existing sidebar source.
- Test the actual Chrome extension and Native Messaging registration on the owner's Windows device.
- Verify live AI provider sessions through approved integrations.
- Complete independent semantic QA, separate malware scanning and safe previews.
- Prove full Chrome-restart transfer recovery and production-grade tenant permissions.
- Publish signed, production-ready installer only after Windows acceptance and security review.

**Auto-approval boundary:** local source changes and draft PR creation are authorized. External account connections, production deployments, DNS modifications, email sending, license changes and merging to main remain separately gated.

---

# Migration audit — current evidence

**Repository:** `faisalwrokksa-hub/TO`  
**Working branch:** `chore/source-import-foundation`  
**Status:** Import tooling prepared; legacy source NOT YET COMMITTED.

## What is actually completed

- Private repository connection and write permission verified.
- Initial README committed to the default branch.
- Review branch created to isolate the migration.
- Credential/profile-excluding `.gitignore` created.
- Windows source-import helper created for `TheOrg(2).zip` and `Theorg's.zip`.
- Import instructions and SHA-256 manifest procedure documented.

## What is not complete

- The two original archives have **not** been extracted and committed to this repository.
- No file-by-file source inventory has been verified here.
- Existing sidebar behavior has **not** been inspected from the new upload.
- Chrome-to-Windows Native Messaging is **not** integrated.
- No signed Windows installer or verified live AI-provider workflow exists.
- No tests from the original archives have been run during this setup.

## Acceptance gates for the next migration phase

| Gate | Required evidence |
| --- | --- |
| Source import | Reviewed extracted source committed on this branch |
| Provenance | Manifest listing filename, size and SHA-256, with excluded files logged |
| Secrets audit | Human review plus secret-scanner report |
| Reuse mapping | KEEP / EXTEND / REFACTOR / REPLACE / RETIRE per existing module |
| Baseline | Recorded tests and runtime from imported code |
| Chrome bridge | Extension ID, registered host manifest, validated typed messaging |
| Offline workspace | Local controller and SQLite continue without internet |
| Windows build | Clean VM installer / startup / uninstall logs |
| Live AI workflow | Authorized supervisor → agents → verifiable file results |

**Do not merge this working branch into main before the source import and audit.** No business production systems or external accounts should be affected.
