# GAIZ2 interoperability and trust decision record — review candidate

**Status: draft, NOT approved for production.** Prepared for TO PR #30, TEFE #42 and subsequent TEBE interface review.

## Version decision to review
Recommend **GAIZ2 only as the next interoperability test candidate**; retain experimental GAIZ1 as a separate compatibility reader until consumers are migrated. This is a recommendation, NOT a frozen release decision. No GAIZ2 migration/downgrade is implicit.

Candidate source: `gaiz/CONTRACT-v2.md`, `gaiz/v2.mjs`, `gaiz/v2.test.mjs`. Exact header, canonicalization, field list, RSA-OAEP-3072+ SHA256, Ed25519, AES-256-GCM, sizes and strict errors are specified there. Changes to wire bytes, algorithms, signed data or serialization require a version bump plus new fixtures.

## Evidence produced by this PR
`node gaiz/generate-interop-evidence.mjs --out=/tmp/gaiz2-evidence` generates a synthetic positive, tampered, wrong-issuer, wrong-tenant, unsupported-version, malformed and oversize rejection evidence set, writing artifact bytes as base64 where bounded, a **runtime-generated public issuer key** and an expected-outcome receipt. Uses ephemeral local private keys only and never writes private keys.

**Note:** This is a fixture *generation procedure*, not pinned deterministic cross-language reference fixtures. Random fresh encryption keys and nonces deliberately produce different bytes each run. A designated format maintainer must generate, review, version and publish a fixed set of public test artifacts and results, retaining private issuer/recipient keys outside public repositories. Cross-language consumers must import the fixed artifact bytes rather than generating their own.

## Trusted issuer key policy — approval required
- Production trust comes only from a separately administered HTTPS trust-distribution channel or pinned application-managed configuration; NEVER from `.gaiz` content, a query string, or developer/demo files.
- Each issuer has a stable `issuerId`, explicit trusted key ID, algorithm and verification key, scoped validity period, authorized product/tenant trust domain, rotation schedule, revocation status and accountable operator. GAIZ2 manifest has `issuerId` but **no key ID**, so multi-key rotation/ambiguous issuer IDs require a reviewed policy or new wire version before production.
- Distinguish signature authenticity from identity, authorization, subscription, tenant access, content safety and import permission. Invalid/revoked/unknown trust state fails closed.
- Public Ed25519 keys can be published in a signed/versioned trust bundle under a separate operational release process; never publish signing or recovery private keys. A certificate or trust bundle alone does not authorize a report to be decrypted.
- The operator owns issuer key issuance, custody (KMS/HSM where appropriate), audits, revocation, compromise response and rollback. No universal master customer decryption or platform-owner bypass.
- `createdAt` and replay constraints require an authenticated service clock/replay store; local signature verification does not prove timestamp or nonce uniqueness across artifacts.

## Final format acceptance gates
1. TO technical and independent security reviewers approve one version, exact canonical byte profile, key wrapping, bounds, adverse-input rejection and key lifecycle.
2. Pin versioned public synthetic positive/negative vectors: signed valid, bit-flipped payload, signature changed, wrong key, wrong tenant, unknown version, noncanonical UTF-8/JSON, duplicate keys, bad recipient, oversize, and clock/revocation cases.
3. TEBE verifies exact fixture bytes, independently configured issuer trust and tenant/role/approval separation; no database access by TEFE/TO.
4. TEFE browser verifier uses approved public-key trust input, checks signature and wire bounds, safely renders reviewed report formats, and never treats local verification as permission.
5. Document evidence for browser/Node/Windows runtime conformance; CI and security acceptance green; human sign-off and release/rollback plan recorded.

## Deployment restrictions
No production endpoints, DNS, KMS resources, service credentials, payments, GAIZ authorization, merge or deployment are enabled by this work. TEFE's current GAIZ1 local inspector remains explicitly unverified.
