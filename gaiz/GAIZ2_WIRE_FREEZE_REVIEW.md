# GAIZ2 wire-format freeze review (candidate, NOT approved)

**Status:** Review candidate only, 2026-11-16. This document neither freezes a production standard nor authorizes deployment. Canonical implementation review base: `feat/gaiz-interoperability-v1-20261116` at `af8637efac598f48026c3aecfd92ea5cb5370e7d`. Read alongside `CONTRACT-v2.md` and `v2.mjs`.

## Proposed freeze scope

| Area | Candidate bytes / rule |
| --- | --- |
| Magic | First six bytes ASCII `GAIZ2\\n` (`47 41 49 5a 32 0a`) |
| Body | Valid UTF-8 canonical JSON, no BOM or trailing content; full envelope <= 8 MiB |
| Exact top-level keys | `ciphertext,manifest,nonce,recipients,signature,tag` |
| Manifest | Exact `artifactId,contentType,createdAt,issuerId,schemaVersion,tenantScope,version` |
| Manifest fixed values | `version=2`; `schemaVersion=1`; `contentType=application/vnd.orgaiz.report+json` |
| Identity | `artifactId`, `issuerId`, `tenantScope`: ASCII `[A-Za-z0-9][A-Za-z0-9._:-]{0,127}` |
| Time | `createdAt`: valid, exact millisecond UTC ISO string `YYYY-MM-DDTHH:mm:ss.sssZ` |
| Recipient entries | 1–8 entries, exact `keyId,wrappedKey` keys; unique ID regex above; producer sorts `keyId` ascending by UTF-16 code-unit order |
| Cipher | Fresh random 256-bit DEK and fresh 96-bit nonce **per artifact**; AES-256-GCM, 16-byte authentication tag |
| Encryption AAD | UTF-8 bytes of canonical `manifest` JSON |
| Key wrapping | RSA-OAEP-SHA256, RSA >= 3072-bit recipient key; each wrapped DEK addressed by a recipient `keyId` |
| Signature | Ed25519 of UTF-8 bytes `GAIZ2\\n` || canonical JSON of exactly `{ciphertext,manifest,nonce,recipients,tag}` (omits signature field) |
| Base64 | Canonical unpadded base64url of binary data; nonce 12 B, tag 16 B, signature 64 B |
| JSON grammar | UTF-16 code-unit key sorting, no whitespace, JSON.stringify escaping, no normalization, safe integers only (no -0 or floats), strings with valid surrogate pairs; max nesting depth 24; max 1024 entries/container |
| Dangerous keys | Reject `__proto__`, `constructor`, `prototype` at all nested object levels |
| Signature policy | Independently provisioned trusted Ed25519 public key **and** expected issuer ID and tenant scope; signature success does not authorize access or import |
| Report payload | Canonical JSON only; no executable HTML or external code; business schemas require separate validation |

### Rejection requirements

Fail closed for wrong magic/version, extra/missing keys, malformed UTF-8, duplicate JSON object keys, noncanonical whitespace/number forms, unpaired surrogates, unsafe keys, excessive nesting/count/length, noncanonical base64url, repeated recipient IDs, wrong tenant/issuer, invalid signature, wrong recipient private key, AEAD tag failure, invalid or noncanonical decrypted report. Do not attempt GAIZ1 fallback after GAIZ2 fails.

### Non-equivalence and known open decisions

1. **Wire draft vs production standard:** this document is a review baseline. `GAIZ1` is incompatible and remains experimental. Altering signing input, serialization, algorithm, header or key-wrapping requires a new explicit major wire version; no silent downgrade or conversion.
2. **Issuer key identification:** GAIZ2 only carries `issuerId`; it has no `issuerKeyId`. Need an approved multi-key rotation and revocation policy before production; whether to add explicit key ID is a wire compatibility decision.
3. **Trust distribution:** pinned or independently authenticated versioned public trust bundle, with operator, trust domain, validity, revocation and audit. Never accept signing keys from the artifact itself. No production signing or recovery private key in a client or repository.
4. **Authorization:** recipient possession/signature verification is NOT a TEBE role, tenant membership, license, report delivery or import approval. Verification receipts remain `authorizationGranted:false`, `importAllowed:false`.
5. **Key lifecycle:** approve secure issuance, custody, rotation, compromise response and documented consent; no global owner decryption shortcut. Offline already-delivered artifacts cannot be reliably revoked.
6. **Clock and replay:** current local verification cannot establish trusted creation time, revocation at time of opening or prior import state; authenticated service policies must do so.
7. **Canonical cross-runtime behavior:** require tests across Node, browser and Windows/.NET for UTF-16 sorting, Unicode, JSON grammar, canonical binary encoding, byte-by-byte signature input, RSA key handling and maximum bounds.
8. **RSA recipient-order conformance:** producer sorts, but verifier currently does not enforce ascending recipient order as a separate rule. Canonical JSON alone does not impose array sorting. Review whether order must be enforced on read and add a negative fixture if so.
9. **Size-limited parsing:** serialized input is limited to 8 MiB; reviewers should assess parse CPU/memory exhaustion on adversarial JSON before a public-facing verifier is enabled.

## Required fixed conformance vector set

A designated reviewer should pin immutable artifact **bytes**, SHA-256 checksums, independent public test issuer key, expected manifest/verification result and rejection reason for:
- valid GAIZ2 (single recipient and eight recipients), safe Unicode and canonical ordering;
- bit-flipped ciphertext and signature; wrong trusted issuer; wrong expected tenant; absent trusted key;
- wrong recipient key, malformed wrapped key, incorrect AEAD tag;
- alternate version, extra field, duplicate key, whitespace or numeric form, malformed UTF-8, unpaired surrogate, unsafe object keys;
- malformed base64url, noncanonical recipients, oversized envelope and excess recursion/container entries;
- clock/revocation/replay policies under separate authenticated service tests (not provable by offline signature verification).

The existing `generate-interop-evidence.mjs` produces **fresh random synthetic artifacts each run** and is not a frozen byte-for-byte fixture corpus. Do not publish a production issuer public key as if it were a test key.

## Sign-off checklist (all required, none presumed)

- [ ] TO format maintainer approves exact byte-level contract and version identifiers.
- [ ] Independent cryptography/security reviewer approves algorithm profile and trust/key lifecycle.
- [ ] Fixed versioned test vectors pinned, reviewed, and verified in independent runtimes.
- [ ] TEBE owner approves authenticated tenant/role/import separation and replay policy.
- [ ] TEFE owner verifies trusted-key provisioning, strict parser, safe rendering and localization.
- [ ] Release owner records commit hash, deployment provenance, rollback, incident response and customer-facing claims.

**Until all checks are evidenced:** GAIZ2 is test-only. No merge to production, DNS update, payment activation, secret provisioning or permission bypass.
