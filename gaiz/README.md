# GIZE AI — experimental protected artifact compatibility

**Official AI product brand: `GIZE AI`.** GAIZ2 is a legacy technical format identifier for GIZE, not a separate customer-facing product. The proposed `.GAZE` format name is a separate experimental artifact-format designation, not the AI product brand. Existing source names, CLI APIs, `.gaiz` filenames and signed magic bytes `GAIZ1\\n` / `GAIZ2\\n` are **legacy experimental identifiers**, not a second product named GAIZ2. Do not rename encrypted bytes or treat a renamed `.GAZE` file as a valid new wire format.

**Migration gate:** TO owns the formal `.GAZE` wire contract. Introduce a new versioned magic/header, stable conformance fixtures, extension handling and parser compatibility only after cross-repository protocol review with TEBE and TEFE. Existing `.gaiz` data must remain readable through explicit legacy detection; no silent conversion and no production decrypt approval.

## Legacy implementation details (compatibility only)

TO is the canonical format owner. This implementation is **not production security infrastructure**. It does not operate a managed vault, signing service, key escrow, license enforcement, payment service, online exchange or enterprise import.

## Version selection / compatibility

- **GAIZ1**: existing experimental \`GAIZ1\n\` JSON format, implemented in \`core.mjs\`. Supplied raw 32-byte DEK; **no key envelopes**. Kept unchanged for candidate TEBE/TEFE adapters.
- **GAIZ2**: separate experimental \`GAIZ2\n\` canonical JSON format in \`v2.mjs\`, with a new random AES-256-GCM key per report, 96-bit nonce, Ed25519 signature and RSA-OAEP-SHA256 wrapping to each explicitly designated RSA-3072+ recipient. No implicit conversion.
- Production must freeze *one* interoperable release contract with TEBE and TEFE after review. GAIZ1 and GAIZ2 MUST NOT be called interchangeable.

## Offline API

\`createGaiz2({report,manifest,recipients,issuerPrivateKey})\` returns an encrypted signed Buffer.

\`verifyGaiz2(buffer,{trustedIssuerPublicKey,expectedIssuerId,expectedTenantScope})\` returns a manifest and hash receipt with \`authorizationGranted:false\` and \`importAllowed:false\`.

\`openGaiz2(buffer,{trustedIssuerPublicKey,expectedIssuerId,expectedTenantScope,recipientKeyId,recipientPrivateKey})\` verifies signature, unwraps recipient DEK, validates AES-GCM and parses canonical JSON.

No online service required. All trusted keys and expected issuer/tenant policy are supplied independently, not taken from files.

## Local operator workflow (not agent-autonomous)

Provision issuer Ed25519 and recipient RSA-3072+ keys outside the repository, using a suitable trusted key management process. Public keys may be distributed independently. **Never commit private keys**.

Example command pattern (replace placeholders with operator-controlled local paths):

\`\`\`sh
node gaiz/cli.mjs export --confirm-local-export --report report.json --issuer-private ./issuer-private.pem --issuer orgaiz-test --tenant synthetic-a --artifact-id demo-1 --recipient-id reviewer-1 --recipient-public ./reviewer-public.pem --output ./report.gaiz
node gaiz/cli.mjs verify --input ./report.gaiz --issuer orgaiz-test --tenant synthetic-a --trusted-issuer-public ./issuer-public.pem
node gaiz/cli.mjs open --confirm-local-open --input ./report.gaiz --issuer orgaiz-test --tenant synthetic-a --trusted-issuer-public ./issuer-public.pem --recipient-id reviewer-1 --recipient-private ./reviewer-private.pem --output ./opened-report.json
\`\`\`

These commands do **not** transmit data to TEBE. The recipient must be trusted through a separately authenticated policy and must satisfy real-world data/tenant authorization.

## JSON report schema v1 (application-defined synthetic example)

Reports are canonical JSON objects or arrays containing integers, strings, booleans, null or nested equivalent values. No floats, executable HTML, macros, embedded URLs or arbitrary script execution. Additional business-level report schema validation must be applied by the consuming product; crypto alone does not validate business facts. Standalone PDF/HTML generation is left to existing approved exporters and is not automatically produced by this module.

## Validation

\`\`\`sh
node --test gaiz/test.mjs gaiz/v2.test.mjs
node --check gaiz/cli.mjs
\`\`\`

## Not yet production-ready

- RSA-OAEP wrapping is a **candidate**, not a final protocol choice; security review may replace it with a standardized HPKE profile and version-bump the format.
- This implementation does not provide recipient revocation of already-received offline ciphertext, online issuer revocation, anti-replay storage, trusted timestamping, true tenant authorization, user consent, per-operation licensing, safe HTML rendering, or recovery escrow.
- Signatures prove control of an issuer key, **not authorization, factual correctness, or safe content**.
- A verification receipt is local evidence only; authoritative audit events require a signed or authenticated backend record.
- Keys supplied as PEM are handled only in process memory by CLI; secure system key stores/HSM integration is not implemented.
- Cross-language conformance, browser and TEBE GAIZ2 consumers remain pending.
- Fuzzing, external cryptographic assessment, algorithm upgrade/downgrade policy and production key lifecycle are hard release gates.


## GIZE AI cross-repository acceptance contract (legacy GAIZ2 protocol) — November 2026

The signing/encryption **protocol owner is TO**, not TEBE or public TEFE.
TEBE consumes GAIZ2 with a deliberately independent verifier:
[TEBE PR #507](https://github.com/2029TEBE/TEBE/pull/507).
The separate [TO PR #33](https://github.com/faisalwrokksa-hub/TO/pull/33)
is a review-only, independent fixed-vector branch currently stacked
on this experimental GAIZ2 producer branch. Its 1,123-byte synthetic
artifact has SHA-256
`14e8a1f6ccc4dd0cf021dfd78a6d03f43f4124ea7854767b1052bcc6c01b5aef`
and only a synthetic issuer **public** verification key.

TEBE's versioned verifier checks that exact SHA and issuer signature.
**Import, decryption, tenant entitlement, KMS key release and customer
authorization remain DENIED.** The fixed fixture does not carry a
recipient private key and is not proof of independently operated custody.

Before freezing GAIZ2 for customers, TO and TEBE must jointly review
and version the canonical signed bytes, recipient sorting/duplication,
AEAD AAD, algorithm IDs, issuer trust/revocation, recipient-key
ownership and rotation, tenant-scope encoding, payload mapping and
cross-runtime negative vectors. A **signed report mapping policy** must
be distinct from the envelope signature; the latter grants no import right.

TEBE currently has unregistered GAIZ worker mTLS identity candidates,
short-lived signed workload credentials, challenge issuance, PostgreSQL
replay-claim proposals and draft worker transactions. These are
**not deployed**. The independent trusted issuer/key directory, real
least-privilege DB roles and KMS recipient-authorized unwrap must be
security-reviewed before any local TO producer artifact is delivered
into an operational TEBE import workflow. TEFE remains a documentation
and marketing frontend until those service endpoints are approved.

Automation policy: low-risk source checks, test evidence collection
and merge queuing can run after required CI success. It must not
auto-approve a high-risk cryptographic protocol change, human import
decision, KMS release, or production release. Keep this branch in
draft until a separate reviewer signs off.

## Canonical .gize filenames (OT development branch)

For **new encrypted CLI exports**, use lowercase `.gize`. When `--output` is omitted, the CLI generates `gize-<sanitized-artifact-id>.gize` without overwriting existing files. The export command now rejects other output suffixes before loading report data or key files. A legacy `.gaiz` export remains possible only with an explicit `--allow-legacy-extension` flag for controlled compatibility testing.

```sh
node gaiz/cli.mjs export --confirm-local-export --report report.json --issuer-private ./issuer-private.pem --issuer orgaiz-test --tenant synthetic-a --artifact-id demo-1 --recipient-id reviewer-1 --recipient-public ./reviewer-public.pem --output ./report.gize
```

The new filename **does not change** the experimental signed wire envelope, which still starts with `GAIZ2\\n`. Verification and decryption inspect the bytes, enforce independently supplied issuer/tenant/recipient policy, and do not trust a file suffix for authorization. Existing `.gaiz` input can still be verified or opened with the existing explicit operator flags. This is naming compatibility work, **not** production cryptographic certification, a new on-disk format, or approval for cloud import.

Test the filename policy separately with `node --test gaiz/file-extension.test.mjs`.
