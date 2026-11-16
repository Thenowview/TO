# GAIZ2 key-custody and recovery decision (development draft)
**Owner:** TO GAIZ Core. **Status:** policy adapter implemented; operational KMS/HSM, trust registry and issuer-signing service **not deployed**.

## Separation of responsibility

TO defines cryptographic bytes and local authorization contracts. It does not act as a universal custodian of customer keys. TEBE authenticates enterprise users and decides if a trusted artifact may be staged, reviewed, decrypted or mapped to governed records. TEFE is a browser UI and must never receive enterprise private keys.

## Encryption lifecycle

1. The originator requests approved recipients from a trusted, tenant-specific key registry. Each recipient record has `keyId`, tenant scope, issuer-bound provenance, `activeFrom`, `activeUntil`, status, algorithm and public key. Tenant scope and approved recipient IDs must be independently authenticated.
2. `resolveAuthorizedRecipients` rejects missing approvals, cross-tenant, revoked, expired, duplicate or non-RSA-3072 candidate public keys.
3. New artifacts use fresh random AES-256-GCM 32-byte DEK and 12-byte nonce. No shared per-tenant DEK is allowed.
4. DEK is wrapped for each designated recipient using RSA-OAEP-SHA256 in the current **provisional** GAIZ2 profile.
5. Ed25519 signs the artifact using a separately managed authorized signing component; the current `createGaiz2` lower-level API still accepts an in-process signing key, so **HSM custody is not implemented**.
6. Local verification uses out-of-band trusted issuer records. Valid signature alone is neither entitlement, customer consent nor import authorization.

## Rotation and revocation

Rotate by issuing a new `keyId` and distributing new public verification/wrapping keys out of band. Use `activeFrom`, `activeUntil`, status and customer-owned trust policy to reject old keys for **new** operations. Offline copies previously delivered may remain decryptable even after key revocation; do not promise retroactive access removal.

## Customer-managed vs platform-managed recovery

Customer-managed zero-knowledge artifacts cannot be recovered if every authorized recipient private key is lost. The platform may be a recipient **only** where the customer has made a legally authorized, documented choice with explicit `customerConsentRef`; `authorization.allowPlatformRecovery=true` alone is insufficient. No universal owner decryption key, hidden recovery recipient, shared HSM master key or master escrow.

## Audit / release gates

A production issuer trust registry must record actor, tenant, key ID, fingerprint, certificate provenance, consent, rotation/revocation reason and audit event. Use a well-reviewed KMS/HSM for private signing operations, strong tenant isolation and a hardware-backed policy when appropriate. Do not place PEM private keys or a universal service key in GitHub, browser builds, logs or AI agent prompts.

The `gaiz/key-policy.mjs` module validates public-key *policy* only. It does not provision keys, maintain a durable trust store, perform customer identity verification or authorize TEBE writes. It is for synthetic development until independently reviewed. 

## Cross-repository consumer handoff

TEBE PR #504 stages artifact **metadata only**, with tenant-scoped replay protection, separate-person approval and RLS draft migrations not yet applied. TEFE PR #43 verifies signature locally only. Production release requires cross-language conformance, independent security review, audited issuer directory, key recovery policy and validation of all mandatory tests.

## Customer custody preflight module (new)

`gaiz/custody.mjs` exposes `evaluateCustodyRequest` and `requestCustodyPreflight`. It validates receipt/tenant/hash consistency, reviewed-by-another-person and unexpired approval, recipient validity, and explicit platform-recovery consent. It can invoke an externally supplied `authorize` and `audit` port but **never calls** its decrypt method or yields a data key, recipient private key, or plaintext.

Even an eligible request returns `custodyAuthorized:false` and `importAllowed:false`. These functions **do not themselves authenticate a user or prove that a provided review originated from a trusted database**. They must only receive records from separately authenticated authoritative services. Their callbacks are not a production HSM adapter, and a malicious callback is outside this module's trust boundary.

TEBE `apps/api/src/gaiz/gaiz-custody-policy.mjs` mirrors eligibility for tenant-scoped reviews as a separate, pure contract gate. No production key custody service, persistent key registry, or business data import has been created. The UI cannot invoke a decrypt operation.

Test commands:
```sh
node --test gaiz/custody.test.mjs gaiz/key-policy.test.mjs
```

## Step 2: local, customer-held decryption verification (development only)

`gaiz/local-custodian.mjs` implements a **deliberately restricted, in-process proof of concept**. To enable on a disposable test machine, set `GAIZ_LOCAL_CUSTODY_TEST=true` while keeping `NODE_ENV` other than `production`. It accepts an RSA-3072+ customer private `KeyObject` supplied *in memory* by an authorized local operator. It never loads a hard-coded private key, service environment secret or global master key.

The operation:
1. Re-verifies GAIZ2 bytes using an independently provisioned Ed25519 issuer key and checks the artifact ID, SHA-256 digest and issuer against the approval.
2. Checks a current, distinct-person, tenant-matched review, active customer recipient identity, and recovery consent policy.
3. Requires a caller-provided append-only audit adapter to acknowledge a pre-decryption event **before** private-key use.
4. Decrypts with the customer-held key via the existing GAIZ2 authenticated envelope and validates the report schema entirely in process.
5. Returns only a report hash, field/metric/finding counts and the immutable `importAllowed:false` / `plaintextReleased:false` flags. Never returns plaintext or a data key. A second audit event records completion.

`node --test gaiz/local-custodian.test.mjs` includes denial cases for wrong recipient key, wrong tenant, invalid digest, unapproved review, missing/failed audit sink and disabled mode.

**Limits:** This is NOT sandbox isolation, a production key vault, an authenticated enterprise custodian, a hardware-backed signing operation, or a forensic guarantee of zero plaintext memory remnants. The calling process temporarily holds decrypted JSON; do not use for live customer artifacts. A real production custodian requires separately reviewed key custody, process isolation, no-swap/limited-memory controls, durable attestation and tenant authorization from a trusted source. TEBE must not import the module into its web-facing API or accept the returned object from an arbitrary browser as proof of authorization.

## Custodian-signed validation receipt — cross-repository draft

`gaiz/custody-attestation.mjs` signs a **metadata-only** validation receipt using a separately managed Ed25519 custodian signing key. It binds GAIZ artifact identity, signed artifact hash, local report digest, tenant, recipient key ID, approved review ID, operation timestamp and the exact capability string `schema-validated-no-import`. Verification requires an independently trusted custodian public key, expected tenant, expected artifact hash, expected review ID and a five-minute maximum age.

The wire signature has explicit domain separation `GAIZ2-CUSTODY-RECEIPT\\n` and exact canonicalized field ordering. This draft attestation is **not** a production PKI or issuer registry. Never reuse the GAIZ issuer signing key as the custodian attestation key. The signing helper is intentionally separate from the in-memory local decryption proof of concept; it does not imply that the customer decryption process has a secure attestation key.

TEBE now contains an independent `gaiz-custody-attestation.mjs` verifier with wrong tenant, forged digest, wrong signer and stale receipt tests. No API endpoint consumes these attestation records; a signed receipt does **not** activate import or write permission. Production implementation must reject replay durably, authenticate the custodian machine, ensure a consented purpose, establish trusted key rotation and record a durable audit trail.

## Bulk hardening — quarantine gate

The local custodian now calls the independent `gaiz/quarantine.mjs` gate **after authenticated decryption and before emitting a validation receipt**. It rejects active HTML/XML tags, script-like URL schemes, external links, bidirectional override controls, C0/C1 controls, unsupported schema fields and content over the 64 KiB gate. It computes a deterministic report SHA-256 for the current canonical JSON subset. This does not remove the need for malware inspection or true process isolation.

`gaiz/quarantine.test.mjs` and `gaiz/local-custodian.test.mjs` cover normal Arabic/Unicode reports and a *validly signed but unsafe* report. Invalid reports must not receive the success audit event. The gate does not return plaintext and does not authorize imports.

## Disposable child-process custody experiment (additional step)

`gaiz/custodian-process.mjs` and `gaiz/custodian-worker.mjs` add a **local-development-only child process**. A trusted local launcher supplies a pre-opened customer private-key file descriptor in the worker's inherited descriptor 4. The worker independently verifies the artifact and approved review, requires each audit event to be acknowledged through parent IPC, decrypts, quarantines, and returns only the metadata receipt. A bounded timeout kills a worker that does not complete. Node IPC never includes the key, DEK or report plaintext, and worker stdout/stderr are suppressed.

`gaiz/custodian-process.test.mjs` uses **fresh synthetic test keys only**, held in a disposable file, to check success, wrong-key refusal, audit failure and default-off behavior. This experiment is not attached to a TEBE route, customer workspace, or production deployment. No long-running daemon, private key vault or universal recovery recipient has been introduced.

**This is process separation, NOT a security boundary against a compromised same-user parent, kernel, or host.** The parent may be able to access the file descriptor, key file or child memory; a child process does not provide HSM-grade non-exportability, hardened sandboxing, or guaranteed wiping of plaintext from memory. A production custodian needs a separate privileged identity, OS restrictions, external trusted authorization/attestation and preferably non-exportable customer-managed keys, with a review of the chosen crypto provider. Even successful test results cannot satisfy these release gates.

## Signed hash-only mapping preview handoff (new, draft)

The TO development module gaiz/mapping-attestation.mjs signs a short-lived, domain-separated metadata receipt with a separately supplied Ed25519 custodian key. It binds tenant, staging review, encrypted artifact digest, report digest, target entity and revision, mapping-profile ID, target fingerprint, preview fingerprint, custodian ID and a five-minute maximum issuance window.

TEBE independently checks this format in apps/api/src/gaiz/gaiz-mapping-attestation.mjs and requires an approved tenant mapping profile when requesting a second review. Signatures are **metadata validation only** and do not transfer plaintext or grant import permission.

The signing function is not wired into the disposable decryption worker or a real customer-held KMS/HSM. An issuer/custodian trust directory, production signer identity, mapping plaintext isolation and protected human-readable review remain required before activation. Do not put the signing key or decrypted reports in an HTTP request or AI prompt.
