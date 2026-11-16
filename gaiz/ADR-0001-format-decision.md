# GAIZ format decision — ADR-0001
**Date:** 2026-11-16  
**Status:** Accepted for cross-repository development; production specification NOT frozen  
**Owner:** TO (format) · Consumers: TEBE (enterprise policy), TEFE (public inspection)

## Decision
1. The canonical **development target** is the `GAIZ2\n` envelope specified in [CONTRACT-v2.md](./CONTRACT-v2.md), not GAIZ1. The extension remains **`.gaiz`**, lowercase.
2. GAIZ1 remains an **experimental legacy candidate** used by existing TEBE and TEFE branches. Do not reinterpret, relabel, silently migrate, downgrade, or delete GAIZ1 content.
3. A GAIZ2 reader MUST reject GAIZ1 input; GAIZ1 consumers MUST reject GAIZ2 input. Migration means an authorized, explicit decrypt → validate → re-encrypt/re-sign operation with a new artifact ID and audit receipt. Renaming is not migration.
4. TO owns signed-encrypted file serialization and conformance vectors. TEBE owns authentication, tenant authorization, approvals, audit and import writes. TEFE displays untrusted metadata by default and must not store server signing/decryption secrets.
5. Cryptographic **signature verification is not permission to decrypt or import**. A GAIZ2 verification receipt must report `authorizationGranted: false` and `importAllowed: false` unless an independently trusted application makes and records those decisions.
6. A release-tagged GAIZ v1.0 specification **cannot yet be declared stable**: format-level security review, cross-language exact byte fixtures, nonce/key custody lifecycle, issuer trust and revocation, replay controls, bounded malformed-input testing, independent recipient verification and approved TEBE import workflow are outstanding.

## Compatibility matrix
| Producer | Reader | Status | Behavior |
|---|---|---|---|
| TO GAIZ1 (experimental) | TO GAIZ1 | Test candidate | Separate legacy format |
| TO GAIZ1 | TEBE GAIZ1 draft verifier | Code exists on feature branch; end-to-end fixtures unverified | Signature and expected tenant only; no import |
| TO GAIZ1 | TEFE GAIZ1 inspector | Format recognition only | Metadata explicitly untrusted |
| TO GAIZ2 (development target) | TO GAIZ2 | Node CI tests passing as of development PR #30 | Signature verify; local recipient decrypt |
| TO GAIZ2 | TEBE current GAIZ1 draft | **Incompatible** | Reject until version-specific adapter is implemented |
| TO GAIZ2 | TEFE current GAIZ1 inspector | **Incompatible** | Reject until version-specific inspector is implemented |
| TO GAIZ2 | Python/.NET independent crypto reader | Not implemented | No interoperability claim |

## Wire-profile decision (development only)
- Magic `47 41 49 5a 32 0a`, or ASCII `GAIZ2` followed by a single LF.
- Canonical UTF-8 JSON envelope with no BOM or trailing bytes. Max 8 MiB.
- AES-256-GCM, fresh 256-bit data key and fresh 96-bit nonce per artifact; AAD is canonical manifest.
- Ed25519 signs magic + unsigned canonical envelope; verifier uses out-of-band trusted issuer public key.
- RSA-OAEP SHA-256 recipient wrapping with RSA-3072+ public keys is **provisional**, pending review of standardized HPKE alternatives.
- Manifest metadata is public and potentially sensitive: identifiers must be opaque and must not contain secrets.
- No private keys, platform-owner universal decryptor or client-side root secrets.

## Unresolved specification defects / release blockers
1. **Node-side serialization tightened:** object keys are ordered by UTF-16 code units, recipient key IDs use ordinal ASCII comparison, lone surrogate code units are rejected, finite safe integers only (excluding -0) are permitted, and invalid canonical calendar timestamps are rejected. Cross-language byte-for-byte comparison is still required before ratification.
2. **Canonical parser guard implemented for the Node candidate:** strict fatal UTF-8 decoding followed by canonical byte-for-byte JSON comparison rejects duplicate keys, whitespace and alternate number spellings; unpaired surrogates and unsafe values are rejected. An independent parser audit, fuzzing and evaluation of standard JCS/RFC 8785 are still required.
3. Define key ID allocation, issuer key rotation/revocation and authenticated recipient directory.
4. Define exact manifest timestamp and producer clock policy, artifact digest identifiers, replay/idempotency requirements and tenant approval integration.
5. Define private key custody, legitimate platform-owned recovery, customer key loss, nonce lifecycle and ability to audit signed operations.
6. Add portable fixtures (positive and negative) and independently verify in TEBE before declaring interoperable.
7. Validate existing Windows bridge and standalone offline application test coverage.

## Release gate
Do **not** merge PR #30 solely on this document. Do not deploy or advertise the development envelope as production GAIZ Shield. Final stable v1 must be ratified by all three repository owners and pass mandatory CI/security acceptance.

## Next responsibilities
- **TO:** publish immutable fixtures and resolve format security defects, then pin a reviewed contract digest/version.
- **TEBE:** implement a read-only GAIZ2 consumer against the pinned fixtures and separately enforce tenant rights and approval.
- **TEFE:** recognize GAIZ2 in developer-preview inspector, showing only untrusted data until independent issuer verification.
