# TheOrg — Release and deployment audit (2026-11-10)

## Decision

- **Development source integration: GO for merging to `main` as a developer-preview baseline only.**
- **Production deployment: NO-GO.** There is no verified production destination, no production deploy workflow, no code signing, no live provider automation, no original-archive migration, and no independent semantic/security acceptance.
- **Product positioning:** An unsigned Windows developer preview with local Supervisor, company-scoped Native Messaging, manual AI-chat handoffs and a bounded artifact workflow. It is not a production-grade autonomous AI operating company.

## Verified evidence

- GitHub Actions: https://github.com/faisalwrokksa-hub/TO/actions/runs/42821732298
- Commit: `a66d051b1776b5a58f3e74f5f248d04ef8f81942` (pre-release-audit documentation)
- Both `js-syntax` and `windows-bridge` succeeded.
- Windows job successfully compiled the .NET bridge, ran controller regression tests, exercised framed Native Messaging and tenant isolation, published the self-contained candidate, built an NSIS installer, installed it silently, ran the installed binary self-test, uninstalled it silently and uploaded both build artifacts.
- JS job passed static UI contracts, simulated Chrome workflow regressions, schema parsing and the **fail-closed release checker**.
- Static review of 14 release-critical source/configuration files detected no common private-key/API-token patterns; the MV3 manifest has `nativeMessaging` but no cross-site `host_permissions`. This is **not** a complete credential scan or independent security assessment.
- Source remains private; no production URL is recorded or verified.

## Verified shortcomings and gates

| Gate | State | Production effect |
| --- | --- | --- |
| Original `TheOrg.zip` and sidebar source imported/reconciled | BLOCKED | Cannot assert previous code/functionality preserved |
| Windows 11 + real Chrome Stable live extension ID and Native Messaging | UNVERIFIED | Browser-to-host user acceptance not complete |
| Live authorized AI website chat automation | NOT CONNECTED | Manual copy/paste handoffs remain |
| Authenticated independent QA and real-world semantic completion | NOT IMPLEMENTED | Model/agent or manual QA assertions cannot certify results |
| Malware scanning and safe preview sandbox | NOT IMPLEMENTED | Imported files remain untrusted |
| Credential storage, tenant authentication and security review | NOT VERIFIED | Production-grade multi-user data security unproven |
| Installer code signing and publisher identity | NOT CONFIGURED | Installer remains unsigned |
| Production runtime/hosting destination | NOT CONFIGURED | There is nowhere verified to deploy |
| Production deployment workflow and health checks | NOT CONFIGURED | Cannot claim release or online availability |
| Backup/rollback and disaster recovery in the target environment | NOT TESTED | Cannot establish safe rollback |

## Deployment structure

TheOrg currently builds a **local Windows app + Chrome extension**, not a hosted website. Publishing a GitHub installer artifact, merging to `main`, or registering a native host locally is **not equivalent to deploying a production cloud service**. A future release needs a signed Windows installer/distribution channel, an extension deployment strategy, a separately authorized plugin gateway, and real Windows/Chrome acceptance evidence.

## Safe bulk release sequence

1. Merge the passing development branch to `main` **as developer-preview source**, preserving the conservative `NO_GO` production gate.
2. Check the resulting `main` commit and its CI; rerun tests if the merge introduces new state.
3. Distribute **only** explicitly labeled unsigned preview artifacts to trusted testers; no automatic website deployment or external AI-account connections.
4. Import and audit legacy owner archives; compare the old sidebar and document generators against the new modules.
5. Complete remaining security, provider integration, code signing, sandbox, and real end-user QA gates.
6. Set a concrete production destination, implement an audited deployment workflow with read-back checks and a rollback path.
7. Only then change `config/release-gates.json` to `productionReady:true` after independent evidence; do not auto-approve such evidence from model outputs.

### Audit limits

The CI checks are genuine for their stated scope. No real end-user installation or Chrome provider session was executed in this audit. There is no available production destination in this repository, and the existing user-supplied ZIPs have not yet been extracted and matched against this branch. Therefore, a production deploy should not be reported or attempted as if it succeeded.


## Follow-up verification — 2026-11-10 (SOP v2 and Chrome registration)

This section supersedes the earlier snapshot only for the listed development-source checks. It **does not** change the production decision.

- PR #3 merged into `main` at `08b7fda44651ed6f6122e81ab4a836c433816ccf`. CI run https://github.com/faisalwrokksa-hub/TO/actions/runs/42825659663 passed both JavaScript and Windows jobs. Its additional synthetic-extension-ID registration test checked the installed Native Messaging host manifest, registry path, executable, and single permitted Chrome origin.
- PR #4 merged into `main` at `a8fb54a0eb4e2618608051e8fe77e2d970209883`. SOP v2 introduces goal contracts, dependency-aware planning, observe–act–verify cycles, checkpoints, bounded idempotent retries and evidence-based independent QA instructions to all twelve profiles. This is prompt-level training only, not model weight training, autonomous tool connectivity, or a substitute for independent evaluation.
- Pre-merge CI https://github.com/faisalwrokksa-hub/TO/actions/runs/42827035293 passed both jobs. Post-merge main-branch CI https://github.com/faisalwrokksa-hub/TO/actions/runs/42827391960 also completed successfully for JavaScript tests, Windows controller, Native Messaging, unsigned installer build and smoke test, and artifact upload.
- Developer-preview deliverables are stored as run artifacts, **not** distributed as a signed production application.

**Production decision: NO_GO.** `config/release-gates.json` remains fail-closed. No configured production target, deployment workflow, authenticated Chrome/Windows end-user acceptance, live authorized AI-provider execution, completed legacy source reconciliation, independent semantic/security review, file scanning, code signing, or proven rollback/read-back are available. No production deployment occurred. Owner approval does not substitute for those requirements.

**Next acceptance actions:** reconcile sanitized original archives; implement and verify allowed provider execution; complete independent QA and file-safety controls; test the owner Windows/Chrome installation; configure signed distribution, release destination and audited rollback; then independently verify all gates before revisiting GO/NO_GO.

## Release-gate follow-up — 2026-11-10

- The source state on `main` at `573ef0d9c38605cfd4721b1ccd94bfb93b73d7b7` passed both CI jobs: https://github.com/faisalwrokksa-hub/TO/actions/runs/42827782620.
- Original archive filenames `TheOrg(2).zip` and `Theorg's.zip` were located in the owner's file Library, but are **not** present in the repo and have not been reconciled or certified. Availability of an archive alone does not clear any migration gate.
- The release checker now treats missing required gates as blockers, rejects invalid destination URLs/identities and checks whether the evidence commit matches the current build. This is defense-in-depth against accidental checklist drift, not independent truth verification.
- See [production acceptance and deployment handoff](PRODUCTION_READINESS_HANDOFF_2026-11-10.md) for the target-specific steps and unresolved acceptance evidence.

**Decision unchanged: NO-GO for production deployment.** There is still no verified production destination, signed distributor, real Windows/Chrome acceptance, provider integration or complete independent security acceptance. No production deployment is represented as complete.
