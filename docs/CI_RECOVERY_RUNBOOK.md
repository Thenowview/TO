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
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Test-TheOrg-Source-Local.ps1 -CheckOnly
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Test-TheOrg-Source-Local.ps1
~~~

If the repository was already cloned, do not clone again; update the existing local branch. The process-only ExecutionPolicy override does not change system policy; run only scripts you have reviewed in a trusted clone. Tests require no external model, GitHub Actions quota, deployment credentials, installation or Python package download. Results go to out\source-verification\source-results.json. A source check is NOT a production release verification.

For the full unsigned Windows candidate, separately use the existing builder on the Windows host after source checks:

~~~powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-TheOrg-Windows-Local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-TheOrg-Windows-Local.ps1 -CheckOnly
~~~

The full build may fetch pinned dependencies; it does not merge or deploy. Inspect the output and test on a clean machine before any distribution.

## Gating pushes, merges and deployment
- You can push to review branches with repository write permission: this does not need a GitHub-hosted runner.
- PRs #20, #21, #22, #23 are stacked in that order and still drafts. Fix tests, verify critical integration, then mark ready for review and merge in dependency order. Do not turn off required checks to force merges.
- Signing, release artifact publication and production deployment are separate, permission-scoped, explicitly approved workflows, not consequences of a successful source check.
- GitHub Actions concurrency in this PR cancels superseded runs for the same PR/workflow to limit redundant charges; it does not waive checks or fix the current runner allocation problem. Seven different workflows may still cost compute once runners work.


## Official free self-hosted Windows runner

GitHub lists self-hosted runners as free, separate from the monthly included compute allowance: https://docs.github.com/en/billing/concepts/product-billing/github-actions. An existing Windows PC still incurs local electricity and maintenance costs. Keep the GitHub Actions budget at $0; no need to make this private repository public.

### Operator installation (GitHub registration is owner-only)

1. Use a trusted, ideally dedicated Windows 10/11 x64 PC or VM. Run under a non-administrator account with no production secrets. No inbound port forwarding is necessary: the runner connects outbound to GitHub over HTTPS.
2. Open https://github.com/faisalwrokksa-hub/TO/settings/actions/runners and click New self-hosted runner. Select Windows and x64. Follow GitHub's current official download, verification, extraction and registration commands; do not use an outdated fixed runner version.
3. Place the runner in a folder such as C:\actions-runner. During config.cmd registration, add the custom label theorg-win, retaining default self-hosted, Windows, and X64 labels. The registration token is time limited and must not be shared in chat.
4. Start run.cmd as the dedicated user. Confirm that the runner shows Online / Idle at GitHub Settings > Actions > Runners. Keep the machine powered on during jobs.
5. For the source checks install Python 3.12+ x64 and Node.js 20+. For optional unsigned Windows builds, install the .NET 8 SDK and other build-machine prerequisites required by tools/Build-TheOrg-Windows-Local.ps1. Use official, trusted installers.
6. Do not run untrusted pull requests, unknown branches, production credentials, or privileged commands on a persistent self-hosted machine. Keep the host and runner updated.

### Launch the manual-only workflow

TheOrg's existing bridge-ci.yml is already registered on main, so you can manually dispatch it using the review branch code without merging that branch first.

Open GitHub Actions > TheOrg Chrome and Windows Bridge CI > Run workflow. Select the branch feat/agent-execution-handoffs-independent-qa and enable confirm_self_hosted. Leave build_unsigned_windows_candidate disabled for the first run. If the web UI does not display branch-specific inputs, the official GitHub CLI alternative is:

~~~powershell
gh workflow run bridge-ci.yml --repo faisalwrokksa-hub/TO --ref feat/agent-execution-handoffs-independent-qa -f confirm_self_hosted=true -f build_unsigned_windows_candidate=false
~~~

On manual dispatch, existing GitHub-hosted jobs are skipped. The only intended job uses labels self-hosted + windows + x64 + theorg-win, checks source locally and never uploads artifacts or deploys. The optional build flag only creates an unsigned local candidate and may download build dependencies; it does not publish or sign a release.

**Important**: The other seven pull-request-triggered workflows still target GitHub-hosted runners. A manual self-hosted check does not automatically satisfy every required status check. Avoid bypassing branch protections or merging untested work; migrate/replace those checks through reviewed PR changes when the self-hosted runner is proven reliable.
