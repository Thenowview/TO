# TheOrg — production release acceptance and deployment handoff

**Audit date:** 2026-11-10
**Release decision:** **NO-GO**, until supported by independently reviewed evidence.
**Platform:** Local Windows/Chrome developer preview, not a hosted production service.
**Production destination:** Not configured.
**Change scope:** This handoff and fail-closed readiness checks do not deploy anything, change permissions, or approve production.

## Confirmed development baseline

- TheOrg repo: `faisalwrokksa-hub/TO`, `main`.
- CI run for earlier main revision `573ef0d9c38605cfd4721b1ccd94bfb93b73d7b7`: https://github.com/faisalwrokksa-hub/TO/actions/runs/42827782620; completed successfully for both jobs.
- Existing Windows tests cover offline bridge compilation, deterministic controller and Native Messaging tests, unsigned installer creation, silent install/uninstall and a synthetic Chrome extension ID manifest/registry check.
- Existing Supervisor tests use a simulated Chrome API; they do not prove real Chrome Stable or live AI integration.
- No signed production installer or verified target is present. GitHub Actions preview artifacts are temporary build outputs, not a deployed product.

## Outstanding release requirements and evidence owners

| Requirement | Current evidence | Needed before approval |
| --- | --- | --- |
| Original `TheOrg(2).zip` and `Theorg's.zip` source integration | Archives found in owner's Library, **not yet extracted, inspected, imported or compared against repo** | Safe archive inventory, malware/secret/license scan, SHA-256 manifest, isolated sanitized source reconciliation, old sidebar and workflows regression |
| Real Chrome Stable ↔ native host | Windows CI synthetic checks | Windows 11 physical/VM acceptance: install, load extension, register actual extension ID, restart Chrome, check bridge, verify company boundary |
| Authorized AI-provider work | Manual AI-chat handoffs only | Permitted integration with verified responses, failure handling and tool permissions |
| Independent business QA | Advisory prompt and deterministic verification only | Cross-check true semantic outcomes, claims and original acceptance criteria with separate reviewer |
| Artifact safety | Format/integrity checks | Malware scanning, quarantine/sandbox, and safe previews before opening third-party content |
| Multi-tenant security | Limited company scoping test | Independent authentication, storage isolation, secret management, permission and privacy review |
| Production signing | Unsigned installer | Verified publisher identity, signing key governance, signed binary and signature verification |
| Distribution or hosting | No target configured | Explicit authorized target, release URL/channel, deployment identity, environment and health/read-back |
| Rollback and continuity | No target-specific test | Backups, rehearsed rollback, recovery point and post-rollback verification |

## Bulk deployment procedure once requirements are proven

1. Identify release category: signed Windows app distribution vs. cloud service. Never treat a GitHub build artifact as production deployment.
2. Select a real target and verify authorization, access, release channel, endpoint identity and backups.
3. Reconcile legacy original sources in a quarantined workspace; preserve originals. Scan secrets, licenses, binaries and threats before committing sanitized source.
4. Complete authorized agent/provider integration, semantic QA, account security, safe artifact isolation and real Windows/Chrome acceptance.
5. Record immutable SHA-256 provenance, release commit, target identity, test reports, reviewer signoff and rollback plan in evidence.
6. Update `config/release-gates.json` only after independent evidence; every required gate must pass, `releaseChannel` must be `production`, destination must be HTTPS and configured with verified deployment workflow, and `evidenceCommit` must match the built source.
7. Execute fail-closed checker `GITHUB_SHA=<release-commit> node tools/check-release-readiness.cjs --production --json` before release.
8. Deploy only via a separately audited release workflow, verify signed distribution, real installation/health, tenant isolation and acceptance. Roll back on failure; preserve audit logs.
9. Publish release report with what changed, exact result, evidence and remaining exceptions. Do not mark production GO based on model claims or manually toggled JSON alone.

## Operational boundaries

- User's instruction authorizes routine release engineering and merges after passing CI; it does **not** supply absent infrastructure or substitute for independent security/acceptance evidence.
- `tools/check-release-readiness.cjs` validates declarations and metadata **not the truth** of evidence. Independent evidence and execution permissions remain mandatory.
- Never enable automatic paid wallet top-ups, bypass site authentication/quotas, expose stored secrets, or ship unsigned binaries as trusted production.
- Until all above checks pass, the published outcome is only **developer-preview source merged and CI-tested**, not a live production deployment.
