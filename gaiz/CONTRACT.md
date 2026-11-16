# GAIZ candidate interoperability contract v1 (experimental)
This is **not** the final production format or service. The canonical owner is TO. TEBE and TEFE use separately reviewed adapters.

- File bytes: ASCII `GAIZ1\\n` followed by UTF-8 JSON object with exactly `manifest,nonce,tag,ciphertext,signature`.
- Manifest contains `version:1`, a nonempty `artifactId` and `tenantScope` (public metadata, never secret information).
- Nonce: fresh random 12-byte value; ciphertext: AES-256-GCM of UTF-8 JSON; authentication associated data: canonical manifest.
- Signature: Ed25519 of the prefix followed by canonical JSON of `{manifest,nonce,tag,ciphertext}`.
- Canonical JSON: object keys sorted recursively lexicographically; no whitespace; arrays retain order. All binary values are canonical base64url without padding.
- 8 MiB maximum serialized envelope. Unknown top-level fields rejected. The signature must be checked using an independently trusted issuer key.
- Recipient key handling is **not implemented**: callers provide a unique 32-byte DEK per artifact through a trusted key-distribution mechanism.
- No token, network, database, tenant authorization or import write is enabled by this package.
- TEFE may only show untrusted public metadata until a trusted server validates the signature.
- TEBE must not convert verification into tenant import permission. Import requires authenticated role checks, tenant enforcement and explicit approval.
- Production gate: format review, conformance fixtures across languages, key wrapping, nonce and key lifecycle, replay defenses, issuer trust and adverse-input testing.
Run: `node --test gaiz/test.mjs`.
