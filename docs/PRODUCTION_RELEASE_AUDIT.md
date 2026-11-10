# TheOrg Production Release Audit — 10 November 2026

**Owner instruction:** audit and merge the development work in bulk, and deploy to production without further confirmation. Routine build and review work is approved.

**Release decision:** **NO-GO for production** until the explicit missing technical gates below are satisfied. This is a factual status, **not** a request for further permission. The approved code may be merged as a clearly labeled **developer preview**; merging source into `main` does not by itself deploy a Windows application.

## Verified evidence

- GitHub PR #2: https://github.com/faisalwrokksa-hub/TO/pull/2
- Verified Actions run (before final release-audit changes): https://github.com/faisalwrokksa-hub/TO/actions/runs/42820116069
- Windows native controller, stdio framing, synthetic artifact integrity and company-scoped read-back: tests passed.
- Node simulated Chrome Supervisor, specialist SOP, file handoff, tab recovery and UI-contract tests: passed.
- NSIS unsigned installer: compiled, installed silently, self-tested and uninstalled in a GitHub-hosted Windows runner.
- Artifact downloads were available as GitHub Actions workflow artifacts, not a signed production distribution.
- Critical source security spot-check: no obvious hard-coded API keys, AWS credentials, GitHub tokens or private-key PEM blocks in the 14 examined executable/configuration source files. This is **not** a comprehensive secret scan, penetration test or malware audit.

## Production blockers

| Gate | Current finding | Required evidence to clear |
| --- | --- | --- |
| Production destination | No destination URL, endpoint, GitHub release deployment, updater, deployment workflow or production environment was established in the repository | Explicit, testable production destination and deployment credentials |
| Original source preservation | The historical 260 MB TheOrg archives and sidebar archive remain outside this repository | Sanitized source inventory, hashes, license check, migration and functional regression |
| Real AI provider execution | Provider selection is a manual browser handoff | Permitted provider adapters and live test logs; never reuse ChatGPT private plugin tokens |
| Windows Chrome Native Messaging on real device | CI checks a synthetic stdio client and Windows install; not the user's Chrome Stable session | Actual extension install, registration, session/restart, permissions and result checks |
| Independent QA | Manual criterion records have unverified reviewer identity | Authenticated reviewer, substantive checks of actual artifacts, read-back and owner acceptance |
| Malware/unsafe file controls | Byte integrity and limited structural checks, not an independent scanner | Safe file quarantine, sandboxed previews and independent scanning |
| Security/tenant controls | Local company IDs, file boundaries and tests; not a complete commercial isolation/security review | Authenticated tenant identity, policy review, structured secret storage, failure injection |
| Signing and updates | The Windows developer-preview installer is unsigned, without an auto-update/revocation mechanism | Distribution identity, signing, rollback and update verification |
| Production post-deploy verification | No target exists for post-deploy health checks | Measured install/start/login/artifact roundtrip/rollback proof |

## Merge vs deployment

A source merge may be performed when the **developer preview** jobs pass. It does **not** authorize representing the release as commercially ready or claiming a live deployment. The GitHub Actions workflow now also runs on pushes to `main` and uploads an **unsigned** installer and SHA-256 manifest for review.

Production eligibility is intentionally modeled by `config/release-gates.json` and checked with:

```bash
node tools/check-release-readiness.cjs --production
```

This command exits nonzero while required evidence is missing. Update the gate statuses **only based on real evidence**. A PR merged into `main` and a passing unit test are not evidence that website-chat automation, account authorization, signed binaries, or production infrastructure exists.

## Release labels

- `DEVELOPMENT SOURCE MERGED` — source is merged; still subject to the declared limitations.
- `UNSIGNED DEVELOPER PREVIEW BUILT` — Actions artifact is available for technical review only.
- `PRODUCTION DEPLOYED` — **do not use** unless an actual, identified target was deployed and read-back checked.
- `INDEPENDENTLY AUDITED COMPLETE` — **do not use** until required live functional/security acceptance gates pass.

**Data protection:** no production data, email, deployment secrets or unrelated repositories should be changed to simulate a successful rollout.
