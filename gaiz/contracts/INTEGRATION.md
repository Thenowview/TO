# GAIZ2 integration contract — Release boundaries

This is **not** a production GAIZ standard. Canonical source: TO PR #30 and `CONTRACT-v2.md`.

## Artifact compatibility
- `.gaiz` is the lowercase extension.
- GAIZ2 is the development target; GAIZ1 remains a separate incompatible legacy candidate.
- Fixed synthetic fixture: `gaiz/conformance/fixtures/gaiz2-synthetic-v1.json`. It contains **only a public signing key**, encrypted synthetic bytes, expected report and SHA-256 hash. No signing/decryption private keys are committed.
- TO reference Node and Python interoperability smoke tests: `node --test gaiz/conformance/pinned.test.mjs` and `gaiz/conformance/verify_python.py` on ephemeral fixture data.
- TEBE draft verifier: `2029TEBE/TEBE` PR #504. It must compare the **same fixed fixture** and refuse wrong tenant.
- TEFE browser verifier: `2029TEFE/TEFE` PR #43. It verifies locally, obtains trust anchors out of band and performs no server upload.

## Report content
`report-v1.schema.json` describes a **synthetic governance sample**: title, summary, optional metrics and findings. This is not authorization to map any values into the live TEBE database. Sanitized PDF/HTML is a separate deliverable.

## APIs
`gaiz-preview.openapi.yml` documents only the disabled-by-default TEBE read-only test endpoint. It accepts at most 64 KiB of decoded GAIZ bytes (stricter than GAIZ2's 8 MiB envelope limit). It requires existing authenticated tenant session, entitlement and capability. No upload storage, import, export, decryption, payment or customer vault exists.

## Required production design work
1. Review canonicalization, Ed25519 verification, RSA-OAEP recipient wrapping versus a standardized HPKE profile, crypto misuse and key lifetime.
2. Implement audited issuer registry, revocation/rotation, protected key custody and per-recipient approval/consent.
3. Implement replay-proof idempotent staging and approval using tenant-scoped persistence, preserving RLS and consent.
4. Validate decrypted business data through a reviewed schema, sanitize renderable output, retain provenance and audit transactions.
5. Implement authorized service endpoints, signed receipts, robust quotas, offline/key-loss recovery guidance and rollback.
6. Complete byte-identical TO→TEBE and TO→TEFE fixture tests and negative/fuzz tests.
7. Independently confirm Windows/.NET packaging and device behavior.
8. Pass all mandatory local and hosted CI/security checks before merge or production activation.

**Never mistake signature validity for tenant permission or customer-approved import.**
