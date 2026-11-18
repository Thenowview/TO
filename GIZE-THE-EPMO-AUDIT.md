# GIZE THE EPMO — Master Cross-Repository Audit

**Chat command:** `gize the epmo`

## Authoritative references
| Workstream | Instructions | Progress |
|---|---|---|
| TEFE frontend | [GIZE-CHECK.md](https://github.com/2029TEFE/TEFE/blob/main/GIZE-CHECK.md) | [Issue #75](https://github.com/2029TEFE/TEFE/issues/75) |
| TEBE backend | [GIZE-CHECK.md](https://github.com/2029TEBE/TEBE/blob/main/GIZE-CHECK.md) | [Issue #642](https://github.com/2029TEBE/TEBE/issues/642) |
| OT Windows/GIZE runtime (TO repository) | [GIZE-CHECK.md](https://github.com/faisalwrokksa-hub/TO/blob/main/GIZE-CHECK.md) | [Issue #71](https://github.com/faisalwrokksa-hub/TO/issues/71) |

## Mandatory audit on each check
1. Fetch current instructions, task lists, repository source files, linked issues and latest expert comments, open/merged PRs, workflow runs, security findings and deployment evidence across all three.
2. Locate the canonical requirement package, immutable storage URL, checksum, manifest and source-file-to-task map. **The uploaded `execute fully.zip` has not yet been transferred into GitHub**; if absent, explicitly flag SOURCE BLOCKED and don't claim a full requirements reconciliation.
3. Reconcile every applicable requirement with implementation and acceptance criteria. Record source path, requirement ID, owning repo, code path, PR/commit, CI run, deployment version, UTC checked time.
4. Categorize VERIFIED, IMPLEMENTED UNVERIFIED, IN PROGRESS, BLOCKED, NOT STARTED, NOT ASSESSED. Present a **full checkbox checklist** per repository, not just a summary. Do not call unchecked tasks missing implementations until inspected.
5. Identify cross-repository blockers, mismatched API contracts, multilingual/UI versus API differences, auth/tenancy/security, Windows compatibility, GIZE terminology and encrypted format compatibility.
6. Flag every failed test or security check with exact evidence, severity, likely root cause, suggested fix and safe bulk-fix group. Do not auto-approve bypass of failed checks.
7. With standing authorization, execute safe fixes on branches; run routine tests and security scans; request or enable auto-merge only after repository protections pass; deploy through verified pipeline; verify deployed SHA; safely remove only merged unprotected branches with no unique work.
8. Update each repository's status checklist and progress issue with fresh UTC timestamp, evidence URLs, done/remaining/blocked and next action. Aggregate in TO master issue.

## Executive output: paying-customer readiness
- All three repository verified completion counts; percentage only after source requirements and applicability have been enumerated.
- End-to-end signup, authorization, billing (when in scope), onboarding, customer journeys, tenant isolation, localization, auditability, backup/recovery, monitoring, accessibility, and production rollback checks.
- Release blockers P0/P1 and evidence-based go/no-go decision.
- Next prioritized actions for each expert; no speculative release confidence.

## Important limitations
This Markdown is a **runbook and prompt reference**, not a self-executing script. Automatic periodic checks require actual CI workflows or scheduled agents. A source ZIP around 430 MB cannot be committed through GitHub's standard text-file contents interface; host its vetted source artifacts using appropriate durable storage and register a SHA-256 manifest.
