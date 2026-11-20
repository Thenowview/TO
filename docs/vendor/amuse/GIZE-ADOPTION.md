# Amuse reference intake and GIZE adoption

Status: inspected reference; selected OT policy hardening implemented; Amuse runtime integration NOT implemented.

The owner supplied `amuse-main.zip` (8,039,132 bytes), SHA-256
`849f5ea2463afd80175dff6eb3ca137cd24c9a7655ba2224bb55ee087ebdcec7`.
Archive CRC validation passed. `source-manifest.json` pins the seven selected,
unmodified files. This is the uploaded snapshot, not a claim that current upstream
`replit/amuse` is byte-identical. Preserve Apache-2.0 and third-party notices.
The files under `upstream/` are reference material, excluded from runtime imports.

## Fit with existing ownership

| Surface | Useful pattern | Required adaptation |
| --- | --- | --- |
| OT Chrome | Approval cards, visible task state, stop/takeover | MV3 CSP, existing Native Messaging identity; no remote code |
| OT Windows | Durable workflow and credential surrogate concepts | Existing SQLite journal, closed tool catalog and OS-managed key protection |
| TEBE | Central policy decisions and destination-bound credentials | Authenticated principal, tenant/RLS, entitlements, audit and cost enforcement |
| TEFE | Explain connection and review states | Public presentation only; no credential, execution or desktop endpoint |

## Encryption decision

Amuse's vault derives an AES-256-GCM key from a local secret and stores credential
ciphertext. This is a credential vault, not the GIZE artifact protocol. Do not
replace `.gize`, legacy `.gaiz` reads, GAIZ1/GAIZ2 bytes, signatures or key custody.
Never copy `.env`, `.data/secret.key`, browser profiles or live credential records.
Any future surrogate resolver must bind principal + tenant + exact HTTPS origin,
substitute only at the approved egress boundary, reject cross-origin redirects,
and keep plaintext out of model prompts, UI storage, logs and telemetry. Offline
decryption still requires authorized local keys and independent acceptance.

Amuse is a one-person loopback service with no login. Its PostgreSQL/OpenAI stack,
background scheduler and browser process must not be exposed as an enterprise
service or installed automatically. OpenAI calls are online and may cost money;
they do not meet OT's offline inference requirement. The Docker browser's sandbox
fallback is not an accepted Windows browser isolation policy.

## Implemented in this candidate

`src/ao-policy.mjs` now requires literal boolean authorization flags and array
allowlists, and validates HTTPS MCP URL syntax without embedded credentials,
fragments, whitespace or backslashes. This remains a policy prototype, not a
production executor, credential broker, DNS/SSRF check or an execution grant.
TEBE's native discovery parser separately rejects accessor and malformed replies.

Local validation: 28 targeted Node tests pass across OT policy and TEBE discovery;
six regression cases failed against the original code. No provider calls used.
No Windows native/Chrome hardware acceptance or signing result is inferred.

## Remaining integration acceptance

- Implement and test a tenant-bound surrogate broker using existing key custody.
- Wire approved task/status UI to the existing durable native execution protocol.
- Test changed scope, revoked access, restart, cancellation and uncertain outcomes.
- Verify model readiness and deterministic workflows without internet access.
- Test the exact reviewed Windows build in Chrome Stable, record binary SHA-256,
  extension identity, native-host registration and actual delivery/recovery results.
- Verify `.gize` round trip, legacy `.gaiz` reads, tampering and wrong-key rejection.
- Sign binaries with the owner's trusted signing configuration and validate the
  signature; an unsigned or self-signed candidate does not satisfy release signing.

Track progress in issue #71. The older TheOrg Workspace 2 installation observed
on the owner's PC is superseded and must never be used to accept the current build.
