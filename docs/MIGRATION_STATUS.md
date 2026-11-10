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
