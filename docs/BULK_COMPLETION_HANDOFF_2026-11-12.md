# TheOrg — bulk development handoff (2026-11-12)

**Repository:** https://github.com/faisalwrokksa-hub/TO  
**Active review PR:** https://github.com/faisalwrokksa-hub/TO/pull/23  
**PR #23 base:** `feat/full-oneapp-windows-release-20261112` (draft PR #22)  
**Active branch:** `feat/agent-execution-handoffs-independent-qa`

## Source completed in this batch

1. Rule-based, no-provider-call owner instruction preview creates an editable 3- or 4-step company-agent plan without executing or saving a work order. Owner creation and each external dispatch remain separate actions.
2. Accepted dependent agent jobs inherit exact verified staged source from an approved predecessor, not only text notes. Divergent parallel branches are blocked pending manual reconciliation; downstream dispatch requires permission again.
3. Agent reports retain source-lineage SHA-256 and root project snapshot SHA-256. Promoting a developer result to Code Studio computes cumulative changes against the original project and rejects stale original source. Plans are review-only; apply, local test and commit remain separate authorizations.
4. OpenCode V2 adapter: version preflight, ordered deny-by-default tool permissions, private `run --standalone` invocation, separate source snapshots, pre-transfer source-hash checks, read-only enforcement, explicit model selection, bounded transcript, structured error inspection, process-tree cancellation/timeout best effort.
5. Restart recovery handles both running agent jobs and independently running AI QA reviews; no automatic retry or false 'completed' status.
6. Dashboard includes agent-plan preview, acceptance lineage, changed-path/hash inspection and a truthful running cancellation request.
7. Optional V2 Windows CLI ZIP bundling checks independently supplied SHA-256 and CLI major version, stores the version in the unsigned package receipt. An optional GGUF archive still requires explicit rights confirmation and is NOT automatically activated.
8. Synthetic Python regressions and JS UI contract checks were added/extended. These are **source tests**, not production acceptance.

## Verification status

- GitHub Actions jobs on latest observed PR #23 commits fail **before any steps execute**. Example: [run 43205948532](https://github.com/faisalwrokksa-hub/TO/actions/runs/43205948532), Windows job reports zero steps. Logs returned unavailable from GitHub. Cause is **not diagnosed**; do not label it a compiler/test failure.
- Dashboard and static UI-contract JS parsed in the development environment. No real OpenCode Windows execution, GGUF inference, native Chrome handoff, installer, or clean-device acceptance has passed.
- The PR is draft and unmerged. No production deployment, model-provider login, paid usage, or source-repo push performed by the app.

## Windows build fallback (only on an authorized Windows x64 build PC)

Prerequisites: trusted source clone from the branch above, full Python 3.12 x64 with pip and PyInstaller, Node.js 22, .NET 8 SDK, and (for actual source integration) separately installed compatible OpenCode V2. Optional browser archive, CLI ZIP, and GGUF model archives need independent origin/license/hash verification.

Open PowerShell in the checked-out branch, then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-TheOrg-Windows-Local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-TheOrg-Windows-Local.ps1 -CheckOnly
```

If successful, inspect the SHA-256 receipt and launch `out\full-oneapp\TheOrg\START THEORG.cmd`. Do **not** distribute an unsigned untested build as verified.

## Remaining acceptance gates

1. Diagnose GitHub Actions failure before runner steps start, or execute the local builder on an authorized Windows host; verify unsigned package integrity and native .NET bridge.
2. Confirm installed OpenCode V2 actually enforces the intended permission rules and runs in a private standalone session with an explicit model.
3. Run a synthetic 4-agent workflow: planner (read only) → developer (isolated edit) → QA auditor → security officer; independently accept dependencies, verify inherited source, inspect cumulative Code Studio diff and original-project hashes.
4. Run interrupted job/QA restart recovery, cancellation of a real CLI process tree, four-slot saturation, unsafe source modification and parallel branch conflict tests.
5. Verify local GGUF with real inference, optional Chrome native messaging, launcher, browser controls and external-provider consent boundaries.
6. Perform final full Windows clean-install security, license, regression and accessibility acceptance. Only then decide whether to sign/merge/release.

**Non-negotiable boundaries:** No unconditional auto-approval, no unseen provider billing, no imports of unlicensed proprietary components, no arbitrary source execution, no production merge/deploy, no claims of tests passing without evidence.
