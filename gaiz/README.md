# GAIZ Core — experimental development candidate

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
