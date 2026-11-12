# TheOrg — CI recovery, no unexpected charges

Status as of 2026-11-12: on GitHub-hosted Actions, both Ubuntu and Windows jobs failed before runner assignment, with zero executed steps. This is not a proven Python/Node/PowerShell failure.

## Verified run evidence
- PR #23: https://github.com/faisalwrokksa-hub/TO/pull/23
- Windows OneApp: https://github.com/faisalwrokksa-hub/TO/actions/runs/43206508146 (attempt 2 also failed before any steps)
- Ubuntu and Windows: https://github.com/faisalwrokksa-hub/TO/actions/runs/43206508148 (both runner IDs zero)
- Jobs are rejected before checkout. A code or YAML change cannot unblock billing/runner allocation restrictions.

## Owner-only account actions
1. Open https://github.com/settings/billing and inspect Actions Usage, Budgets and alerts, budget stop rules, unpaid invoices or payment restrictions. Gross usage is not necessarily paid expenditure. Do not raise spending or register a card unless intentionally authorizing it.
2. Open https://github.com/faisalwrokksa-hub/TO/settings/actions and allow external official actions/reusable workflows, with default GITHUB_TOKEN permissions limited to read repository contents and packages. Do not enable blanket write permissions.
3. Open the failed Windows run link above and copy the exact banner/error annotation. If billing and Actions settings are healthy but jobs still start with runner ID zero, contact https://support.github.com with both run IDs.
4. Once account settings are repaired, rerun a small source CI check first. Only launch Windows packaging after source checks and spending approvals.

## Local source-only verification (no GitHub hosted runner)
Run from PowerShell on an authorized Windows developer PC with Python 3.12+ and Node.js installed:

~~~powershell
git clone https://github.com/faisalwrokksa-hub/TO.git
cd TO
git fetch origin feat/agent-execution-handoffs-independent-qa
git switch feat/agent-execution-handoffs-independent-qa
powershell -NoProfile -File .\tools\Test-TheOrg-Source-Local.ps1 -CheckOnly
powershell -NoProfile -File .\tools\Test-TheOrg-Source-Local.ps1
~~~

If the repository was already cloned, do not clone again; update the existing local branch. Tests require no external model, GitHub Actions quota, deployment credentials, installation or Python package download. Results go to out\source-verification\source-results.json. A source check is NOT a production release verification.

For the full unsigned Windows candidate, separately use the existing builder on the Windows host after source checks:

~~~powershell
powershell -NoProfile -File .\tools\Build-TheOrg-Windows-Local.ps1
powershell -NoProfile -File .\tools\Build-TheOrg-Windows-Local.ps1 -CheckOnly
~~~

The full build may fetch pinned dependencies; it does not merge or deploy. Inspect the output and test on a clean machine before any distribution.

## Gating pushes, merges and deployment
- You can push to review branches with repository write permission: this does not need a GitHub-hosted runner.
- PRs #20, #21, #22, #23 are stacked in that order and still drafts. Fix tests, verify critical integration, then mark ready for review and merge in dependency order. Do not turn off required checks to force merges.
- Signing, release artifact publication and production deployment are separate, permission-scoped, explicitly approved workflows, not consequences of a successful source check.
- GitHub Actions concurrency in this PR cancels superseded runs for the same PR/workflow to limit redundant charges; it does not waive checks or fix the current runner allocation problem. Seven different workflows may still cost compute once runners work.
