# GAIZ2 fixed synthetic verification fixture 001

**Development-only fixed interoperability oracle; not an approved production trust anchor.**

This 1123-byte GAIZ2 artifact was generated once by an **independent Python cryptography 46.0.4 producer** using fresh synthetic Ed25519 and RSA-3072 key pairs and AES-256-GCM. Only the signed encrypted artifact, public Ed25519 issuer verification key and expected receipt are checked in. The issuer signing private key and recipient private key are NOT distributed or retained in this repository. This fixture is intentionally verification-only; it cannot be used to test recipient decryption.

Expected SHA-256: `14e8a1f6ccc4dd0cf021dfd78a6d03f43f4124ea7854767b1052bcc6c01b5aef`.

- Artifact: `valid.gaiz.b64` (base64 text of exact GAIZ2 bytes; decode before parsing)
- Independent **synthetic test** issuer key: `issuer-public.pem`
- Expected manifest, byte count, receipt status: `expected.json`
- Node TO acceptance/rejection tests: `../fixed-fixture.test.mjs`

Run: `node --test gaiz/fixtures/fixed-fixture.test.mjs`.

**Trust warning:** The public key provided in this directory is accepted ONLY for this known synthetic fixture. It MUST NOT be a general production trust store, nor may a reader obtain its issuer trust anchor from the artifact itself. Passing verification does not authorize download, decryption, tenant import, licensing, or customer use.

**Cross-runtime handoff:** TEFE and TEBE must pin the exact same artifact SHA-256 and test issuer public key in their own test-only fixture configurations; do not hardcode an issuer trust key into production frontend code. GAIZ1 consumers must reject this GAIZ2 fixture. The recipient private key is unavailable, so a separate **locally generated** fixture with an approved test recipient key is required for decryption conformance.
