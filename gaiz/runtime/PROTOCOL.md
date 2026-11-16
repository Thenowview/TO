# TO → TEBE trusted execution contract, profile 1

Technical interface: `gaiz-execution/1`. This completes the executable engineering
handoff; it is not independent cryptographic approval or permission to deploy.
GAIZ2 encrypted-file bytes remain the separate proposed `CONTRACT-v2.md` profile.
Public TEFE/browser/extension surfaces never receive signing or decryption keys.

## Authority and sequence

1. TEBE derives actor/tenant/capabilities from its existing authenticated context.
   In one tenant-local transaction it locks the approved import authorization,
   original independently approved staging review, validated custody attempt,
   approved mapping profile, actual target, current issuer/recipient/custodian
   trust records and any explicit platform-recipient import consent.
2. TEBE signs a grant with its separate broker Ed25519 key and persists the grant,
   digest, nonce and issuance audit atomically. One grant per authorization.
3. The pinned TO worker verifies the grant with an independently provisioned
   broker public key. It checks artifact hash and target snapshot fingerprint,
   reloads current TEBE-selected public policy, durably claims the nonce, verifies
   the GAIZ2 issuer signature, then unwraps only the named recipient's DEK through
   managed custody. No private key is exported. AES-GCM authentication, canonical
   report parsing, schema/quarantine and the approved preview digest must pass.
4. TO returns only the one approved field patch in a custodian-signed result.
   The complete plaintext report remains inside the trusted worker. The patch is
   sensitive: authenticated private worker-to-TEBE transport only, never telemetry,
   job logs, TEFE, prompts, browser storage or a public preview API.
5. TEBE locks and rechecks all authoritative rows, current key trust/consent and
   expiry, verifies both signatures and recomputes the approved preview digest
   independently from the locked old value and proposed field value. It uses a
   tenant+target+revision CAS and, in the SAME transaction, consumes the grant and
   appends a hash-only audit event. Any error rolls back all three. Revision
   triggers cover ordinary non-GAIZ updates too. Replayed results are rejected.

## Exact wire schema

`protocol.mjs` is the executable schema and canonicalization authority. The copy
in TEBE must remain byte-identical; the cross-repository acceptance test checks it.
Objects reject unknown fields, prototype keys, unsafe numbers and invalid Unicode.
Canonical UTF-8 JSON sorts object keys; arrays preserve order. No normalization.

Both signed envelopes contain exactly `payload` and `signature`. Signatures use
Ed25519, unpadded canonical base64url, exactly 64 decoded bytes. Signing input:

- grant: UTF-8 `GAIZ2-EXECUTION-GRANT\n` + canonical payload
- result: UTF-8 `GAIZ2-EXECUTION-RESULT\n` + canonical payload

Grant payload contains exactly the exported `grantFields`:
`protocol,tenantId,actorId,authorizationId,stagingReviewId,custodyAttemptId,
artifactSha256,reportSha256,issuerId,recipientKeyId,custodianId,targetKind,targetId,
revision,targetSnapshotSha256,mappingProfileId,previewSha256,nonce,issuedAt,
expiresAt,purpose`.

`purpose` is `approved-field-import`; `protocol` is `gaiz-execution/1`. Tenant,
actor, authorization, stage, custody attempt, target and nonce are UUIDs. Hashes
are lowercase SHA-256 hex. IDs are bounded opaque identifiers. Timestamps are
canonical ISO UTC; the grant lifetime is at most 300 seconds, future and expired
grants fail closed. Revision is an integer in [0,2147483646].

Result payload contains exactly `grant,grantSha256,patch,executedAt`; grantSha256
hashes canonical grant payload. The embedded grant must equal the stored signed
grant's digest. Patch contains exactly `field,value` and is restricted to:

| Target | Patch field | Report source | Bound |
| --- | --- | --- | --- |
| project | project.name | title | 160 UTF-16 code units |
| portfolio | portfolio.description | summary | 4000 UTF-16 code units |

Executable markup, links, control/bidi characters, unknown fields and empty values
are rejected. Budgets, status, progress, health and governance decisions cannot
be inferred or written. Preview digest calculation is the existing
`gaiz-mapping-preview.mjs` profile; TEBE's independent `approved-patch.mjs`
reconstructs it without receiving the complete report. Snapshot hash is over
exactly `{id,tenantId,kind,revision,fields}` from the locked real row.

## Custody and trust provisioning

Vault Transit adapter pins an HTTPS origin, mount, key name, numeric key version,
algorithm and SPKI SHA-256 fingerprint. It rejects redirects, oversized responses,
unavailable/rotated keys, exported-key configurations and plaintext backups.
RSA-OAEP uses SHA-256; the managed recipient is RSA-3072. GAIZ2 may contain other
RSA-3072+ recipients, but this specific adapter supports 3072 only.
The adapter signs Ed25519 messages without prehashing. DEKs are per artifact;
mutable DEK and plaintext buffers are cleared in finally blocks. JavaScript
strings/objects are not a forensic zeroization boundary.

Separate short-lived workload tokens/ACLs are mandatory:

- TEBE broker: read broker public metadata; sign only broker grants.
- TO worker: read its recipient/custodian public metadata; decrypt only its
  recipient key and sign only custodian results. It cannot sign broker grants.
- TO producer: separate issuer-signing credential, never the custodian key.

`workloadTokenProvider` reads a private owner-only regular file, refuses symlinks
and permissive modes, and re-reads for credential rotation. No raw token value
belongs in environment variables, command arguments, source or logs. Vault refs
come from server configuration mapped to the tenant registry's public fingerprint.
No key, Vault URL, credential, SQL callback or principal is accepted from a grant,
artifact or HTTP request. An issuer public key cannot also be the custodian key.

The existing `custodian-validation-only` platform recovery consent CANNOT
release an import patch. Execution requires a distinct, unexpired, dual-reviewed
`approved-field-import` consent. Customer-owned recipient keys do not imply a
platform recovery right. Offline copies cannot be retroactively revoked.

## Integration and failure recovery

TEBE `createGaizRuntimeComposition` binds the real tenant transaction adapter,
registry policy store, separately authenticated broker/worker Vault clients,
pinned TO runtime and durable replay ledger. `GaizExecutorService` exposes only
internal authenticated methods, is disabled unless `GAIZ_EXECUTOR_ENABLED=true`,
and has no public execution controller. Configure once in trusted server bootstrap.

The default file ledger is for ONE isolated POSIX worker with a private persistent
volume. It uses atomic directory creation, exclusive records and fsync. Do not
use an ephemeral directory or independent replicas. Multi-worker deployment needs
a globally atomic shared ledger. A claimed nonce stays spent after worker failure;
no automatic decrypt retry or fallback key is allowed. Operator investigation and
a new independently approved authorization/artifact are needed after failure.
TEBE rejects duplicate mutations even if a worker response is delivered twice.

Migrations 0020–0027 are draft and unapplied to existing databases. Migration
0027 preserves read-only app access to key/consent registries: two fixed,
tenant-checked, SECURITY DEFINER functions acquire row locks without granting
registry UPDATE. Function ownership/EXECUTE ACLs require deployment review;
PUBLIC execute is revoked. No migration, production feature flag, network service,
Vault account, billing setting or live key is provisioned by these source changes.

## Verified evidence and remaining release gates

Local acceptance uses real Node crypto, encrypted synthetic bytes and disposable
PostgreSQL-WASM/PGlite with restricted-role FORCE RLS, transactions, revision
triggers and rollback. It is not multi-connection production PostgreSQL concurrency
acceptance. The Vault live test uses an explicitly disposable local TLS Vault
1.20.4 with non-exportable keys; it verifies real signing and unwrap compatibility.
No customer keys or reports are used. Hosted CI remains postponed, not waived.

Remaining operational gates: provision reviewed workload identities and tenant
key routes; independently establish customer consent authority; pin both repository
artifacts; run full application build and real PostgreSQL/RLS/concurrency acceptance;
harden worker/container isolation and memory controls; review cryptography and
SECURITY DEFINER ownership; approve staging migrations and release separately.

References: https://developer.hashicorp.com/vault/api-docs/secret/transit
and https://developer.hashicorp.com/vault/docs/secrets/transit .
