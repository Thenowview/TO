# GIZE — THE EPMO: implementation and customer-readiness audit

**Snapshot:** 2026-11-18. **Status:** NOT CERTIFIED. This file is an actionable checklist, not evidence that runtime tests, deployment or production acceptance have passed.

## Operating rules
- Each completed task must link to commit/PR, test run, and relevant source file or deployment evidence; update this file in the same PR.
- Keep statuses `TODO`, `BLOCKED`, `IN REVIEW`, or `VERIFIED`. Mark `VERIFIED` only with independently reproducible proof.
- Automatically propose safe bulk fixes; do not bypass security checks, branch protection, tenancy, signature checks, or release gates. Flag failures and propose fixes.
- Merge only after required checks and explicit release requirements pass; deploy and verify environment; delete only merged branches once confirmed safe.
- Canonical naming: Orgaiz = commercial brand, THEEPMO = enterprise product, GIZE AI = AI; new exports use `.gize`, legacy `.gaiz` reads remain; preserve GAIZ1/GAIZ2 wire identifiers.
- Languages: verify every supported locale end-to-end, not only English/Arabic; fallback is not a pass.
- Dependencies on other repositories must state owner, contract, test evidence, and blocker; do not silently claim completion.
- Stripe payments are postponed for overall GIZE integration readiness, but must pass before accepting paying customers. No mail service subscription required.

## Cross-repository acceptance checklist
- [ ] Source archives and permanent references available and integrity checked — BLOCKED pending evidence
- [ ] 150 requirement IDs reconciled to implementation paths and acceptance criteria — TODO
- [ ] TEFE ↔ TEBE routes, session, API and locale propagation verified — TODO
- [ ] TEBE ↔ TO GIZE protocol, key custody, offline authorization and encrypted artifacts verified — TODO
- [ ] Objective → demand → business case → prioritization → capacity/budget → scenarios → approval → delivery/change → benefits/rebalancing end-to-end tested — TODO
- [ ] Supported locale registry audited: website, enterprise app, Windows runtime and generated customer content — TODO
- [ ] Auth, RBAC, tenant isolation, secrets, signatures, dependency and supply-chain gates passed — TODO
- [ ] CI, cross-platform regression, negative security and integration tests passed — TODO
- [ ] Merge/release workflow and deployment provenance verified — TODO
- [ ] Production smoke tests, rollback, monitoring and billing readiness verified — TODO
- [ ] Paying-customer release explicitly approved only after proof of all critical acceptance gates — TODO

## Change log
| Date | Change | Evidence | Status |
|---|---|---|---|
| 2026-11-18 | Created initial GIZE bulk coordination audit on review branch | Repository baseline `docs/CURRENT_IMPLEMENTATION_BASELINE.md` | IN REVIEW |

## Expert instructions
Every expert: after a task, update checklist item, owner, evidence links, test output, and remaining blockers; report to master coordinator. User may reprioritize at any time; retain an auditable change history.

## Repository-specific audit — faisalwrokksa-hub/TO
**Ownership:** Windows/local runtime and GIZE format

### Pending review PRs at snapshot
72 .gize/.gaiz intake compatibility

### Mandatory verification
- [ ] Verify signed and encrypted file interoperability, trusted verifier/executor, offline decryption, key storage, Windows installers, language parity and runtime tests.
- [ ] Inspect active PR checks and merge conflicts; do not assume a passing status.
- [ ] Validate staging and production against currently deployed commit.
- [ ] Record per-requirement implementation and file references below.

| Requirement ID | File(s)/route | Test evidence | Status | Blocker |
|---|---|---|---|---|
| To be mapped | Pending source trace | None yet | TODO | Requires implementation trace |
