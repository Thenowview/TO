# TheOrg: Auto-merge, Auto-push and Cloudflare Auto-deploy

**Status (13 Nov 2026):** Automation source is prepared on PR #25, **not yet active in main**. No merge, code approval, secret creation, or production deployment was performed by these workflow commits.

## Policy and scope

- Automatic merging is limited to non-draft, same-repository PRs whose **entire changed-file list** is under `sites/theorg-intelligence/`.
- Merge candidates must carry the opt-in label `automerge-theorg-site` and have a **successful matching** `TheOrg Intelligence site checks` workflow result.
- GitHub's branch protection, required reviews and checks remain authoritative. The bot must not submit fake APPROVE reviews, override failures or force-push main.
- Workflows, Windows/agent-engine source, secrets, infrastructure code and THEEPMO changes are **never auto-merged** by this workflow.
- Auto-deploy is triggered by a **push to main** only when the standalone site or its deployment workflow changes. It rebuilds/retests and deploys only the `theorg-intelligence` Worker in Cloudflare account `8c3498934294713cb33f436ff86fc361`. There is no automatic code-generation or uncontrolled push.
- Site PRs should be made from a dedicated branch. Push to a development branch triggers validation, not deployment.
- The Cloudflare Worker is a synthetic demo; no AI, native Windows execution or THEEPMO data are connected.

## Required GitHub settings (not accessible through currently connected GitHub actions)

1. Repository <https://github.com/faisalwrokksa-hub/TO/settings> → **Pull Requests** → enable **Allow auto-merge** (where the plan supports it). Current repository API reports `allow_auto_merge = false`.
2. Repository <https://github.com/faisalwrokksa-hub/TO/settings/branches> → protect `main` using a branch protection rule or ruleset. Require PRs, the `site-acceptance` status for this site's PRs, and appropriate independent review for sensitive changes. Avoid applying a path-filtered site-only check as a universally required check for unrelated changes.
3. Repository <https://github.com/faisalwrokksa-hub/TO/settings/actions> → ensure Actions is enabled, GitHub-hosted runners are permitted and workflow token can obtain its declared `contents: write` and `pull-requests: write` permissions. Do **not** enable action-bot review approval as a shortcut to human review.
4. GitHub account <https://github.com/settings/billing> → check Actions spending limits, payment or allowance state for private repositories and any spending restrictions. Do not enable paid capacity or increase budgets without the owner's separate approval.
5. Repository <https://github.com/faisalwrokksa-hub/TO/settings/secrets/actions> → add **THEORG_CF_TOKEN** with minimum required Cloudflare Workers Scripts permissions, scoped to Theorgnet's Cloudflare account. This secret is required for upload; it was **not created** here. Never copy it into repo source or chat.
6. After repairing CI, merge PR #25 through ordinary review; both new auto-merge and auto-deploy workflow files become operational **only when they exist on the repository default branch**.
7. For later site-only PRs, add `automerge-theorg-site` if reviewed policy permits. The workflow will ask GitHub to queue auto-merge only after actual site CI succeeds. The deploy workflow then runs on the resulting main push.

## CI runner blocker observed

- Multiple workflows, including the independent **TheOrg Runner Diagnostic** (only echo + Node version, no checkout, no dependency), failed before emitting any job step summaries.
- The connector returned no steps and GitHub job logs responded with 404 `BlobNotFound`.
- A rerun of failed diagnostic jobs also failed before steps. This cannot be attributed to the site tests alone; **root cause unknown**.
- Review the failing run on GitHub and check the **run-level annotation/banner**, account Actions availability, organization/repository policies, spending and runner availability.
- Do not weaken checks or deploy on failure. A new GitHub-hosted runner or a properly configured self-hosted runner must execute a minimal diagnostic and yield real step logs before claiming CI repaired.

## Acceptance and audit

1. `TheOrg Runner Diagnostic` executes with logs, and the site workflow is green on the same head commit.
2. Branch protection and repository auto-merge settings checked using GitHub UI/API.
3. A new, opt-in site-only non-draft PR auto-merges **after all required checks/reviews pass**. An unrelated or workflow-changing PR is not auto-merged.
4. `main` push automatically builds and uploads to Theorgnet only, with successful Cloudflare deployment metadata and an external browser smoke test.
5. Verify failures stop the pipeline, secrets are redacted, and rollback is possible.

This setup does not touch THEEPMO code or infrastructure.
