# TheOrg — Zero GitHub-hosted compute acceptance plan

**Status (12 Nov 2026):** GitHub Actions budget is $0 and marked 100% usage blocked, according to the repository owner. Hosted Ubuntu and Windows CI jobs failed before any runner was assigned. This does **not** establish failing source code.

## What is now changed in the PR #23 review branch

- Seven existing workflow files target only `[self-hosted, windows, x64, theorg-win]`. They require the owner to select **Run workflow**, set `confirm_self_hosted=true`, and choose the trusted review branch; no pull_request or push triggers are enabled in these branch versions.
- This is **manual release acceptance**, not automatic continuous CI. The change prevents unreviewed PR code from automatically running on a persistent private PC. It does **not** make required checks pass or bypass branch protection.
- The primary entry point is the existing **TheOrg Chrome and Windows Bridge CI** workflow, whose original workflow file also exists on `main`. The review-branch version runs `tools/Test-TheOrg-Source-Local.ps1`, with an optional `build_unsigned_windows_candidate` flag.
- The other six workflows remain as separate opt-in source/package checks. Existing test/build commands are retained; Linux-only Bash steps were converted to Windows PowerShell where necessary. Build dependencies must be installed on the local runner.
- No workflows upload artifacts into GitHub Actions artifact storage, helping preserve the $0 Actions storage budget. Candidate archives, test evidence and signed-off receipts (if created) remain **only in the local runner's workspace**. GitHub run summaries are not release artifacts.
- No workflow merges, deploys, changes billing, uses a write-scoped GITHUB_TOKEN, or certifies live provider/model acceptance.

## Owner action: register a free Windows x64 self-hosted runner

1. On a **dedicated, isolated** Windows x64 PC or disposable Windows VM, open https://github.com/faisalwrokksa-hub/TO/settings/actions/runners and select **New self-hosted runner**. Follow GitHub's *currently displayed* official commands for Windows x64 download, checksum verification and registration. Do not share the short-lived registration token.
2. Register the additional label **theorg-win**, retaining defaults **self-hosted**, **Windows**, **X64**. Run GitHub's `run.cmd` as a restricted nonadministrator account and verify status **Online / Idle**. Keep the PC powered on during tests. The runner initiates outbound HTTPS; don't expose an inbound runner service to the Internet.
3. For source tests install Python 3.12+, Node.js 20+, Git, and required repo prerequisites. For Windows builds install .NET 8 SDK, NSIS (legacy installer workflows), and any build-machine dependencies documented in `tools/Build-TheOrg-Windows-Local.ps1`. Windows PowerShell is supported by the migrated workflows.
4. Only run code you reviewed. A persistent self-hosted runner can be compromised by malicious PR code, including in private repositories. Do not run this from your personal admin account, or give the runner production cloud tokens, payment credentials or customer data.

GitHub's self-hosted runner compute is free of GitHub-hosted compute charges, independent of included monthly compute; local electricity, bandwidth and hardware still belong to the operator:
https://docs.github.com/en/billing/concepts/product-billing/github-actions
https://docs.github.com/en/actions/reference/security/secure-use

## One-command local preflight and safe start

Run these commands in Windows PowerShell after downloading and registering the **official** GitHub self-hosted runner (using the installation commands shown in your account). The scripts do not register the runner, request or store registration tokens, install software, or expose secrets.

~~~powershell
git fetch origin
git switch feat/agent-execution-handoffs-independent-qa
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Test-TheOrg-Runner-Preflight.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Test-TheOrg-Runner-Preflight.ps1 -RequireBuildTools
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Start-TheOrg-SelfHosted-Runner.ps1 -ConfirmStart -RunnerDirectory 'C:\actions-runner'
~~~

- The first check requires Windows x64, Python 3.12+ x64, Node.js 20+, and Git.
- The optional build-tools check additionally requires the .NET 8 SDK; it warns if NSIS is unavailable for older installers.
- The starter checks that the official installation and `.runner` registration file exist and launches `run.cmd` in the foreground. Change `-RunnerDirectory` if your official runner is installed elsewhere.
- Before starting, confirm this is a **trusted, isolated Windows user or VM** without production credentials; the runner executes commands from manually dispatched workflows.
- Run a source-only dispatch first; only after it passes should you opt into Windows binary packaging.
- All build evidence stays local on the Windows machine because GitHub artifact uploads are deliberately disabled at the $0 budget.

## First run — no EXE build

Open **Actions → TheOrg Chrome and Windows Bridge CI → Run workflow**.
Select `feat/agent-execution-handoffs-independent-qa`.
Set `confirm_self_hosted=true`.
Keep `build_unsigned_windows_candidate=false`.
Then inspect the resulting source test run. If the web dropdown doesn't expose the branch-specific inputs, use the installed GitHub CLI from a GitHub-authenticated PC:

~~~powershell
gh workflow run bridge-ci.yml --repo faisalwrokksa-hub/TO --ref feat/agent-execution-handoffs-independent-qa -f confirm_self_hosted=true -f build_unsigned_windows_candidate=false
~~~

The workflow is on `main`, allowing manual selection of the updated branch. A job left queued means no matching runner is online. A red result *with steps executed* is the first real test failure to investigate.

## Second run — optional unsigned Windows build

Only after source tests succeed and build dependencies are installed, rerun the same workflow with `build_unsigned_windows_candidate=true`. This invokes the existing local build and verify scripts. They may download upstream pinned dependencies and create an unsigned archive under `out/full-oneapp/`; they do not upload or deploy it. No clean machine or external AI service execution is proved by a passing build alone.

## Offline source verification without Actions

In PowerShell inside a trusted clone of the review branch:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Test-TheOrg-Source-Local.ps1 -CheckOnly
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Test-TheOrg-Source-Local.ps1
~~~

Source result: `out/source-verification/source-results.json` with actual pass/fail. The output folder is gitignored. If source tests fail, do not label the application as verified.

## Remaining release acceptance

- Validate actual native bridge, Chrome integration, supervisor agent execution, source-edit permissions, dependency handoffs, separate QA acceptance, cancellations, and independent model/provider security boundaries.
- Verify an actual Windows EXE on a clean Windows machine. Confirm no embedded secrets or personal profile data.
- The current stacked draft PR sequence is #20 → #21 → #22 → #23. Earlier PR branch versions may still contain hosted-runner workflows until they are separately updated or retargeted. Do not declare those PR checks green based on this branch alone.
- Only after test evidence and independent review may the owner separately authorize merges in dependency order, artifact signing, distribution and deployment. Avoid bypassing branch protection or claiming test success from a job that never ran.
