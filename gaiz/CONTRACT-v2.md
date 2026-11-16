# GAIZ2 wire contract — DRAFT, incompatible with GAIZ1

**Status:** Proposed v2, for test-only interoperability. Owners: TO format implementation, TEBE enterprise authorization, TEFE public UI.

## Bytes
\`\`\`
ASCII bytes 47 41 49 5a 32 0a  ("GAIZ2\n")
UTF-8 canonical JSON document, no BOM, no trailing bytes
\`\`\`

Top-level keys exactly: \`ciphertext,manifest,nonce,recipients,signature,tag\`.
Nested \`manifest\` keys exactly:
\`artifactId,contentType,createdAt,issuerId,schemaVersion,tenantScope,version\`.
\`version=2\`, \`schemaVersion=1\`, \`contentType="application/vnd.orgaiz.report+json"\`.
\`createdAt\` must be a UTC timestamp of form \`YYYY-MM-DDTHH:mm:ss.sssZ\`. Validation of clock trust, future timestamps and expiration is a consumer policy.

Recipient entries contain exactly \`keyId,wrappedKey\`. 1–8 unique recipients.

Canonical serialization for this test profile: recursively sort object property names by UTF-16 code units; no spaces; arrays preserve order; JSON.stringify escaping; safe integers only; null/booleans/strings supported; max depth 24 and max 1024 properties/items per container; reject keys \`__proto__\`, \`constructor\`, \`prototype\`. No user-controlled normalization is performed. Serialized envelope must byte-for-byte equal canonical JSON; this rejects duplicate keys and noncanonical whitespace. Treat these restrictions as required for cross-language interoperability; do not assume generic RFC 8785/JCS equivalence.

Binary values: unpadded canonical base64url. \`nonce\` exactly 12 bytes; \`tag\` exactly 16 bytes; \`signature\` exactly 64 bytes. Envelope max 8 MiB.

## Protection
1. Create a **fresh random 256-bit DEK and 96-bit nonce per artifact** using a CSPRNG.
2. Canonicalize report JSON; AES-256-GCM encrypt it using AAD equal to UTF-8 canonical manifest.
3. For each authorized recipient: RSA-OAEP SHA-256 wrap the DEK to an RSA-3072+ public key; order recipients canonically.
4. Ed25519 sign UTF-8 \`GAIZ2\n\` + canonical JSON of exactly \`{ciphertext,manifest,nonce,recipients,tag}\`.
5. Emit canonical envelope including \`signature\`.

Verifier checks structure/bounds, expected issuer and tenant, cryptographic signature using **out-of-band trusted issuer public key** before any decryption. Unwrap only when local authorization permits and an independently supplied recipient private key is available. AES-GCM authentication and canonical report JSON must both succeed.

## Metadata classification
Only manifest metadata and recipient key IDs are public and can reveal tenant or project identifiers; producers MUST use opaque values and avoid sensitive names. Everything in the report is encrypted. Do not place access tokens, browser session secrets, AI prompts with credentials or passwords in either public manifest or output.

## Key policy and recovery
No universal owner decryption key. Platform-owned artifacts may name an audited platform-controlled recipient only when legally permitted and documented. Customer-controlled keys remain customer-controlled. Losing recipient private keys means permanent inability to decrypt unless an authorized recipient envelope exists. Revocation of previously delivered offline copies is technically impossible to guarantee.

## Contract change gates
Any change to magic, serialization, envelope fields, signing input or algorithms requires new version and multi-runtime test vectors. GAIZ1 support is explicitly separate and must not be silently promoted or downgraded.

## Consumer expectations
TEBE: signature verification is NOT a tenant role or import approval; authenticated import workflow, replay store, approval and audit remain mandatory. TEFE: metadata alone is untrusted and should never be presented as verified. TO: no agent may sign using a root private key without approved key custody and human authorization.
