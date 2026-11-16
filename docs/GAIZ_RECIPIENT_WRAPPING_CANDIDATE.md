# GAIZ v1 recipient wrapping candidate — NOT AN ACTIVE WIRE FORMAT

Date: 2026-11-16. Status: experimental and detached. The existing
`GAIZ1\n` producer in `gaiz/core.mjs` still writes exactly five
envelope fields: `manifest,nonce,tag,ciphertext,signature`. No wrapping
field is currently signed or included. This candidate must **not** be
used as live recipient authorization or key custody.

## Candidate primitive implemented

`gaiz/recipient-wrap-candidate.mjs` provides two offline functions:
`wrapGaizDekCandidate` and `unwrapGaizDekCandidate`.

- Per-wrap ephemeral X25519 key agreement against the recipient public key.
- Fresh 32-byte HKDF-SHA256 salt and 12-byte AES-256-GCM nonce.
- Domain-separated HKDF info and AEAD AAD:
  `JSON.stringify(["GAIZ_DEK_WRAP_V1",tenantScope,artifactId,recipientKeyId])`.
- The envelope includes `version=1`,
  `algorithm="X25519-HKDF-SHA256-AES256GCM"`, the scope fields, encoded
  ephemeral X25519 SPKI DER key, salt, nonce, 16-byte GCM tag and 32-byte
  encrypted DEK. Encodings are canonical base64url.
- Unwrap verifies the exact expected recipient key ID, tenant and artifact
  supplied by **trusted backend policy**, not claimed by the uploaded file.
  Invalid type, algorithm, lengths, authentication tags or context fail closed.
- This primitive does not authenticate the producer, grant entitlement,
  authorize tenant access, persist a DEK or perform a KMS operation.

## Security-critical unresolved contract

**Detached wrapping is insufficient.** The current signed GAIZ1 bytes
authenticate only `manifest,nonce,tag,ciphertext`, not these recipient-wrap
fields. An attacker may replace a detached wrapping envelope without
invalidating the GAIZ1 producer signature. Do NOT attach this candidate to
an import or release a key based solely on its possession.

Before any live release, TO must design a **new explicitly versioned
container** or a producer-signed recipient manifest that authenticates:

1. The ciphertext digest and exact GAIZ artifact ID and tenant scope.
2. Recipient key ID, recipient-wrapping suite, ephemeral public key, salt,
   nonce, tag, encrypted DEK and canonical encoding.
3. The issuer identity/key ID and key rotation/revocation policy.
4. The recipient entitlement policy and issuance/expiry where applicable.
5. Rules for adding/removing recipients **without accidentally invalidating
   producer signatures or permitting unilateral recipient injection**.

Do not silently extend `GAIZ1` in a way that existing readers interpret
as the prior version. Require explicit algorithm/version negotiation and
reject unknown versions, unauthenticated recipients and mixed-version data.
Use a well-reviewed key-custody service to release a DEK only after verifying
signature, ownership, tenant entitlement, object digest and replay policy.

## Test and release status

`gaiz/recipient-wrap-candidate.test.mjs` covers successful synthetic
roundtrip, wrong recipient, scope substitutions, altered AEAD fields and
unsupported formats. It is **not claimed to have executed in CI**. No
production credentials, private keys, customer files or deployment are used.

TEBE consumer engineering: https://github.com/2029TEBE/TEBE/pull/507.
TEFE product contract: https://github.com/2029TEFE/TEFE/pull/41.
