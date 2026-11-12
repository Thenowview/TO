# TheOrg Full OneApp — Windows build and acceptance (review-only)

**State:** source and builder candidate, **not** a released or independently tested Windows executable.

## Actual build blocker observed on 2026-11-12

The GitHub Actions workflow [Full OneApp run 43190109507](https://github.com/faisalwrokksa-hub/TO/actions/runs/43190109507) exited in approximately three seconds.
Its oneapp-windows job had runner_id 0, an empty runner name and **zero recorded steps**. Other Windows jobs showed the same pattern. Therefore neither Python nor .NET compilation ran. This is a runner/account-side blocker; the exact annotation must be read in the GitHub Actions UI. Do not call this a failed compiler/test outcome.

Possible causes include Actions billing/spending budget, Actions account restrictions, or GitHub runner provisioning; check the **actual job annotation** rather than assuming one.

1. Open the run link and expand the top-level job warning/annotation.
2. Check repository Actions settings and the account's Billing and licensing → Actions usage/budgets. Do not add a paid plan or budget without owner approval.
3. If billing is healthy, check [GitHub Status](https://www.githubstatus.com/) and contact GitHub Support with the run ID and annotation.
4. Retest after an Actions runner is assigned. A green source-only test does **not** certify a Windows app.

## Build locally on Windows instead of waiting for CI

Use a trusted local checkout of the draft PR #22 branch:

- Repo: https://github.com/faisalwrokksa-hub/TO
- Branch: feat/full-oneapp-windows-release-20261112
- No merging required. Do not put access tokens or credentials in script arguments.

Build-machine prerequisites: Windows 10/11 x64, **full** Python 3.12+ x64 with pip, Node.js 22, .NET 8 **SDK**, internet access to fetch pinned build tools. These are *build-machine* dependencies only, **not required on the final Windows target**. The Python **embeddable ZIP** in Google Drive is for embedding/extraction, not a replacement for the full compiler environment.

In PowerShell, from the repository root:

~~~powershell
# First verify that your checkout is on the draft PR branch.
git branch --show-current
# Preflight + compile + self-tests + checksum + optional unsigned candidate ZIP.
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-TheOrg-Windows-Local.ps1
# Later, validate a previously completed local build without rebuilding:
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-TheOrg-Windows-Local.ps1 -CheckOnly
~~~

Expected output if **all real build operations succeed**:

- out\full-oneapp\TheOrg\START THEORG.cmd
- out\full-oneapp\TheOrg\TheOrg.exe (Python bundled by PyInstaller)
- out\full-oneapp\TheOrg\TheOrg.Bridge.exe (self-contained .NET 8)
- out\full-oneapp\TheOrg\chrome-extension\
- out\full-oneapp\TheOrg\SHA256SUMS.txt
- out\full-oneapp\TheOrg\BUILD-RECEIPT.json
- out\full-oneapp\TheOrg-Full-OneApp-Windows-UNSIGNED.zip if no individual input file is >=2 GiB
- out\full-oneapp-local-build.log (troubleshooting transcript; review before sharing)

Do not use -SkipSourceTests for acceptance. It is only for diagnosis.

### Where runtime data lives

On first launch, the launcher sets environment paths so neither the distributed ZIP nor the read-only application folder needs to contain user data:

- %LOCALAPPDATA%\TheOrg\EngineData — local SQLite database, private access token and engine logs
- %LOCALAPPDATA%\TheOrg\workspace — user and company workspaces, output files
- %LOCALAPPDATA%\TheOrg\models — imported local model files
- %LOCALAPPDATA%\TheOrg\ChromeProfile — isolated browser profile
- %LOCALAPPDATA%\TheOrg\NativeMessaging — user-scoped bridge registration

Both build-time and verification-time Python self-tests run with temporary data paths outside the distributable folder and remove their generated data afterward. The build must fail if the staged package contains .theorg, access-token.txt or theorg.sqlite3.

### Optional browser and GGUF (not required for first build)

Your Drive already separates runtimes and models. **Do not** automatically bundle a user-supplied browser ZIP or GGUF until provenance, checksum and relevant licensing are independently verified.

~~~powershell
# Example: use a Chrome ZIP only after independently establishing the hash
$chrome = "C:\Path\chrome-win64.zip"
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $chrome).Hash
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-TheOrg-Windows-Local.ps1 -ChromeArchive $chrome -ChromeSha256 $hash
~~~

The model ZIP may be staged with -ModelArchive and -ConfirmModelRights **only when usage and redistribution rights are clear**. It remains inactive until explicitly imported in the Models UI and real inference passes. A 5+GB model archive results in a **folder candidate**, not a compressed ZIP from Compress-Archive (2 GiB individual-file limitation). Never treat simply copying MODEL.zip as verified local-model functionality.

## Acceptance requirements, to be recorded on actual Windows

- [ ] Build succeeds on Windows x64 and produces executables with matching receipts.
- [ ] Start-TheOrg-Full.ps1 -CheckOnly verifies every SHA-256 receipt entry; altered file must fail.
- [ ] Both binaries pass --self-test in the actual staged application.
- [ ] Start on a **clean Windows machine without Python or .NET SDK**; dashboard loads on 127.0.0.1.
- [ ] With -SkipSupervisor, default browser opens dashboard **without** Chrome extension loading or native host registration.
- [ ] With Supervisor enabled, Chrome uses TheOrg-only profile and **Check connection** succeeds.
- [ ] Create an order, select appropriate agents, verify no more than four provider jobs concurrently.
- [ ] Save one synthetic output file; verify exact saved file location and SHA-256.
- [ ] Close/restart app; previous jobs persist, unsafe interrupted jobs do not auto-repeat.
- [ ] Test actual GGUF inference and model controls separately, only after rights and hardware readiness.
- [ ] Validate ChatGPT and Claude DOM automation on signed-in test accounts without bypassing access controls.
- [ ] Verify independent QA, permissions, task cancellation, error states and uninstall without deleting user data.
- [ ] Record log/commit SHA, checksums, environment and reviewer. Do not sign or deploy before all mandatory checks pass.

No main merge, production deployment, API-key upload, release signing, or external account action is authorized by this build script.
