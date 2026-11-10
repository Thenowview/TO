# Import the existing TheOrg and sidebar source

**Repository:** `faisalwrokksa-hub/TO` (private)  
**Working branch:** `chore/source-import-foundation`  
**Owner archives:** `TheOrg(2).zip` (~260 MB) and `Theorg's.zip` (~1.25 MB)

## Non-negotiable safety rules

Do **not** commit the two ZIPs directly, and do not upload Chrome profiles, account sessions, authentication cookies, HAR files, passwords, OAuth tokens, private keys, local customer records, local SQLite databases, node_modules, .venv, caches, executables or installers. Do not include a plaintext `.env`. Inspect configuration files for embedded credentials even if their filenames look harmless.

Keep the two original archives unchanged as backups.

## Recommended: GitHub Desktop on Windows

1. Install **GitHub Desktop** from its official website if you have not installed it.
2. Sign into the GitHub account that owns the private repository.
3. Choose **File → Clone repository** and select `faisalwrokksa-hub/TO`. Confirm the clone destination.
4. Switch the current branch to `chore/source-import-foundation`. The existing `main` branch remains untouched.
5. Locate your original archives in Windows Explorer. In PowerShell in the cloned repository, run the included filtered importer:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\import-source.ps1 `
     -TheOrgZip "C:\PATH\TO\TheOrg(2).zip" `
     -SidebarZip "C:\PATH\TO\Theorg's.zip"
   ```

   Replace both file paths with the real file locations. The script extracts a filtered, size-bounded source snapshot into `legacy/imported-theorg/` and `legacy/original-sidebar/`, produces a manifest at `docs/source-import-manifest.csv`, and does **not** commit or upload anything.

6. **Inspect all changed files in GitHub Desktop**, including `.json`, `.yaml`, `.py`, `.js` and `.md`, for sensitive content. The filtering rules are not a guarantee against embedded secrets. Delete any accidental confidential files before publishing.
7. Commit the reviewed source as `import: add reviewed TheOrg and sidebar sources`.
8. Click **Push origin**. This updates only the working branch.
9. Open a **draft pull request** to `main`, but do not merge it until the file inventory and tests have been checked.

## Alternative: GitHub website

If you prefer to upload using the website, extract the archives locally, manually select only clean source folders, and open:

[Upload to working branch](https://github.com/faisalwrokksa-hub/TO/upload/chore/source-import-foundation)

The web interface has file and batch limits; for a project of this size, GitHub Desktop is safer and more convenient.

## Audit after import

The technical review must classify every imported module as KEEP, EXTEND, REFACTOR, REPLACE or RETIRE. Preserve existing Chrome sidebar behavior, work orders, SQLite storage, task approvals, local file-generation tools and tests. Compare code to the previously documented v0.6 functionality; do not treat the older test report as new evidence.

**No merge, deployment, account connection or external action is authorized by this import.**
