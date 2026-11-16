# GAIZ Shield — Architecture, Owner Recovery, Licensing and Migration Plan

**Status:** PROPOSAL / documentation only — no feature enabled, keys issued, customer data accessed, infrastructure provisioned, or production deployment authorized.
**Version:** 0.3 (canonical GAIZ branding) | **Date:** 2026-11-14
**Applies to:** ORGAIZ (proposed marketplace at `orgaiz.com`), TheOrg local-first tools, THE EPMO applications, future GAIZ Shield file service.
**Working hostnames:** `vault.orgaiz.com` and `api.vault.orgaiz.com` are **proposals**. Do not create DNS, routes, storage, or billing resources until ownership and release checks pass.
**Naming decision:** GAIZ is the proposed format and brand used by the marketing homepage. The alternate four-letter spelling used in drafts was not a deployed file format. Do not accept, auto-convert, or mislabel legacy files without an explicit compatibility specification.
**Purpose:** Reorient current development toward reusable encrypted business artifacts, commercial online/offline tool licensing, safe EPMO draft import, and controlled platform-owner recovery. Preserve working services and existing security boundaries.

## 0. Decisions and non-negotiable constraints

1. **GAIZ is a planned format, not an existing standard.** `.gaiz` is the encrypted business report/data container; printable PDF/HTML is an independent purchased deliverable where the product promises one. Proposed `.gaizlic` offline license and `.gaizpkg` signed tool package names remain provisional, with extension-conflict review required.
2. **TheOrg/ORGAIZ sales are not an automatic THE EPMO subscription.** A standalone report stays useful without an EPMO license; premium editing/import actions have separately disclosed entitlements.
3. **An owner-admin recovery function is scoped and auditable, never a universal backdoor.** Platform-owned tools/templates may be recovered using a designated recovery route. Tenant/customer files must NOT be silently decrypted by the platform owner. Require customer consent and a lawful, documented recovery basis, or respect customer-managed/zero-knowledge keys as unrecoverable by the operator.
4. **Nothing in an AI prompt, agent role, browser session, file metadata, or marketing frontend can grant decryption or licensing privileges.** Trusted services verify exact signed capabilities and role/workspace scope.
5. **No production change, automatic merge, DNS migration, destructive reset, secret rotation, paid feature activation, or live tenant data operation** is authorized by this planning document.
6. Use strong **envelope encryption** and authenticated signatures. Do not invent cryptography, store private signing keys in GitHub, embed platform KEKs in downloadable clients, or deploy a hard-coded admin override.
7. Prefer free-tier infrastructure but **do not claim guaranteed $0**. R2 can charge for consumption exceeding included allowances; external AI/Power BI licensing and domain costs remain separate.

## 1. Product boundaries

| Surface | Owns / is authoritative for | May request from GAIZ Shield | Must NOT do |
| --- | --- | --- | --- |
| ORGAIZ marketplace (future) | Tool catalogue, purchases, standalone exports, customer reports, entitlements UX | Issue/import `.gaiz`, protected download, optional viewer | Store global decrypt keys in JS; claim EPMO access was purchased |
| THE EPMO authenticated app (`2029TEBE/TEBE`) | Identity/session and tenant roles *as currently implemented*, workspace, business records, approvals, audit/RLS | Verify origin/signature; authorize import and progress feedback; view licensed package | Bypass tenant RLS; write direct from AI recommendations |
| THE EPMO public marketing (`2029TEFE/TEFE`) | Static pages, product information, synthetic demos | Link to official sign-in; display non-sensitive format documentation | Embed private keys, customer content, live paid dashboards, premium libraries in public assets |
| TheOrg desktop/agent source (`faisalwrokksa-hub/TO`) | Local-first task/artifact handling, approved tools, local offline execution | Verify offline signatures and signed licenses; import/export GAIZ in separate adapter | Treat local file intake as trusted; claim a live ORGAIZ marketplace exists |
| GAIZ Shield gateway (proposed third site/service) | File metadata, ciphertext storage gateway, trust policy, feature permissions, signing orchestration | Reusable APIs and audit receipts | Be a hidden global super-admin decryption service; be a second source of EPMO tenant truth |

**Identity**: shared OIDC identity is a *target state*, not a proven live integration. Prefer a well-reviewed issuer, per-application audiences and scopes, PKCE, short-lived access tokens, rotated/revocable refresh tokens, service identity for server-to-server operations. EPMO remains authoritative for workspace membership; cross-site identity alone never proves tenant access.

## 2. Threat model and trust classification

Assets: proprietary algorithms and templates; model prompts/weights; licensed binaries; encrypted customer data; PDF/HTML reports; Power BI references; billing and entitlement decisions; signing and wrapping keys; backups; trust policies.

Threats: unauthorized paid use, AI-assisted reverse engineering, tampered offline licenses/packages, prompt injection seeking privileged tool calls, public-source disclosure, malicious HTML, forged `.gaiz`, replay/tenant substitution, privileged insider, compromised owner account, lost recovery key, malicious build or poisoned dependency, denial-of-service/free-tier exhaustion, copied screenshots.

Trust tiers:
- **PUBLIC:** marketing code and truly public demos; nothing secret; no promise of non-copyability.
- **LICENSED:** tool executable, protected template, reports; paid access, signed entitlements, watermark/audit where feasible.
- **TENANT PRIVATE:** reports/projects/attachments; scoped tenant identity and storage; customer-controlled disclosures.
- **PLATFORM ROOT:** signing keys, KEKs, recovery escrow, CI credentials; separate operations, restricted break-glass handling.

Avoid the claim that a downloaded or rendered website is impossible to copy. Keep core algorithms and sensitive data behind authorized APIs where possible; encrypt files at rest/in transit and control key release.

## 3. GAIZ file v1 — proposed interoperability contract

```text
.gaiz  = fixed header (magic "GAIZ", major/minor version, algorithm IDs, manifest length)
       + canonical signed public manifest (issuer, artifact_id, tenant_scope, product_id,
          content types, created_at, schema version, payload hash, key envelope IDs,
          declared offline/online mode, permitted operations; no confidential data)
       + AES-256-GCM ciphertext payload (structured report JSON, sanitized HTML/assets,
          chart specifications, snapshots, Power BI references without permanent tokens)
       + issuer Ed25519 signature over canonical header/manifest/ciphertext digest
```

Design review must decide whether to sign ciphertext directly or its immutable canonical digest, and document byte-for-byte serialization and algorithm agility. Generate a fresh random data-encryption key (DEK) and fresh valid nonce per encryption; wrap DEK to authorized recipient/public key or service-managed KEK with **associated data** binding artifact ID, tenant, version and entitlement. No shared global plaintext master key and no reused nonce under a DEK.

Rules:
- A renamed PDF/ZIP/HTML is not a GAIZ document. Check magic/version, bounded sizes, verified signature, AEAD tag and structured schema; reject unknown critical fields and downgrade attempts.
- HTML lives inside a sandboxed isolated viewer; disallow arbitrary JavaScript, external URL fetches, active Office macros and executable attachments by default. Charts use reviewed native renderers; no blanket `eval`.
- Power BI holds references and filters only; embed tokens are short-lived and generated separately under Microsoft authorization. Online embeds are not an offline Power BI engine.
- `plan.pdf` remains readable/shareable per license; `plan.gaiz` has separately declared permissions and EPMO draft-import semantics.
- Preserve import schema version, provenance and lineage so recommendations can be re-run/reconciled without duplicate projects.
- Use deterministic export manifests, replay-resistant import receipt IDs, maximum decompression ratios/bytes, malware scanning/quarantine before unsafe preview, and secure MIME sniffing.

## 4. Owner-admin recovery and decryption policy — critical P0

**Clarification:** "Owner admin may decrypt tools/websites when needed" means the platform proprietor can recover **assets it owns and legitimately controls** (for restoration, support, migration, rekeying, legal requirements or loss of a production key). It does NOT grant invisible access to customer-owned encrypted contents, tenant data, or customer-managed keys.

### 4.1 Ownership classes and recovery eligibility

| Class | Recovery by platform owner | Conditions |
| --- | --- | --- |
| Proprietary ORGAIZ tool package/template/website source controlled by company | **Yes, controlled** | Active platform-owner role, phishing-resistant MFA, emergency reason, asset scope, time-limited operation, separate recovery key or escrow; complete audit |
| Platform-managed customer artifact with explicit **opt-in** to managed recovery | **Only when authorized** | Customer-approved incident ticket, purpose/asset scope, owner + independent security approval, notification, retained audit |
| Customer-managed key / end-to-end or zero-knowledge artifact | **No** | The platform cannot recover plaintext without customer key; recovery UI must explain irrevocable loss risk |
| EPMO tenant business records outside GAIZ | **Never via GAIZ Shield** | Continue existing authenticated API and PostgreSQL RLS; use existing tenant admin and lawful data processes |
| Public website HTML/CSS already sent to visitors | "Decrypt" not meaningful | Public bytes are accessible; protect unpublished source/templates and backend-generated premium content instead |

### 4.2 Emergency recovery workflow

1. A human opens **GAIZ Shield Owner Console → Recovery Request** from a registered administrator device; no AI tool or service account may start or approve it.
2. Require phishing-resistant MFA/passkey and recent reauthentication; independent physical recovery factor or escrow share not stored beside normal runtime secrets.
3. Create immutable ticket: legal basis, classification, requesting identity, exact artifact IDs, tenant scope, purpose, requested operation, expiry (e.g., <=15 minutes), maximum count/bytes, expected output destination. NO wildcard/decrypt-all.
4. Validate policy and authorization. For any customer-owned recoverable content, require explicit customer or legally mandated authorization and a second independent security approver. **A sole platform owner cannot self-approve access to other tenants' data**; if no second approver exists, require a separately held independent escrow/custodian and customer consent.
5. Obtain narrowly scoped, one-time recovery capability, bound to requester, device, artifact, operation, destination and expiry; server verifies not just UI display. A time-limited capability is not an unrestricted key.
6. Perform rewrap of the DEK to an approved recovery principal whenever feasible rather than returning master/private wrapping keys. Decrypt only the minimum necessary content in a short-lived isolated process. Never log plaintext or key bytes.
7. Store results only in an approved temporary encrypted recovery location; default to read-only. Purge temporary plaintext promptly; ensure backups/cache/logs do not retain copies accidentally.
8. Record tamper-evident audit before and after: request, approval, key use, files accessed, hashes, outcome, revocation and notifications. Synchronize with THE EPMO audit policies without granting direct RLS bypass.
9. Automatically expire credentials and close the session. Rotate/revoke affected KEKs on suspected compromise; review exceptions and notify affected customers according to policy.

Break-glass **may not** disable: object ownership checks, logging, tenant isolation, signatures, immutable evidence, cryptographic integrity, or customer key sovereignty. There is no "universal decrypt all" or permanent admin bypass endpoint.

### 4.3 Safer emergency actions (separate from decryption)

- **Suspend/disable a licensed tool**: signed policy/entitlement revocation; no decrypt needed.
- **Reissue purchased access**: rewrap DEK for a verified replacement device/account; leave ciphertext unchanged.
- **Restore company templates/website designs**: from source control/versioned encrypted backups, not by reversing files that have reached browsers.
- **Recover from an infrastructure outage**: offline, signed-license verification continues; file key release remains denied unless keys already lawfully cached by a licensed device.
- **Rekey**: migrate DEK envelopes and rotate wrapping keys with an approved scope and evidence; do not decrypt every artifact if rewrap is sufficient.
- **Customer account loss**: use published tenant recovery consent flow, never owner impersonation.

## 5. Technical design and endpoints (ALL PROPOSED)

```text
POST /v1/artifacts           [authenticated issuer; upload metadata/signed intent]
POST /v1/artifacts/:id/access [identity + license + tenant/operation policy -> scoped access]
GET  /v1/artifacts/:id       [ciphertext metadata or time-limited encrypted download]
POST /v1/imports/preview     [EPMO validates signature/schema/tenant; no writes]
POST /v1/imports/:id/approve [EPMO human approval; idempotent draft creation only]
POST /v1/licenses/activate   [issue signed device-bound claim; authorization required]
POST /v1/recovery/requests   [human-only owner console; no AI scopes]
POST /v1/recovery/:id/approve [independent approval; policy engine]
POST /v1/recovery/:id/execute [one-time scoped capability; tamper-evident audit]
GET  /v1/recovery/:id/audit  [restricted compliance/auditor view]
```

Require explicit OpenAPI/Zod contracts, issuer/audience checks, request size caps, authorization on *every* path, idempotency keys and expiry/replay protection. All recovery endpoints deny agent credentials, public-browser-only sessions, and service identities lacking a dedicated recovery scope. CORS/CSRF controls and rate limiting are additive, never substitutes for authorization.

**Identity authority:** if EPMO already has an IdP/auth system, use a brokered integration rather than silently replacing production auth. A platform operator has no implicit cross-tenant read access. Treat generated recommendations as **drafts** until the destination workspace's authorized human approves.

## 6. Encryption, signing and offline licensing

- Envelope encryption: AES-256-GCM for data; separate tenant/platform KEKs and independent Ed25519 signatures. Use audited cryptographic libraries and versioned key IDs. Data/confidentiality keys and release-signing keys have different custody and rotation.
- An online origin may encrypt once on an authorized server or client and upload only ciphertext to private storage. Gateway must not return cached plaintext or log decrypted bodies.
- A locally installed licensed tool verifies a signed `.gaizlic` claim against a built-in public verification key (product/module, device binding where available, issue/expiry, signed offline grace policy). Its private signing key is never distributed.
- TPM/OS keystore may raise reverse-engineering cost, but cannot guarantee an offline client is uncrackable. Source code, prompt libraries, locally rendered charts and screenshots may still be copied once accessible.
- Offline licenses cannot be immediately revoked while disconnected. Use finite lease windows only when clearly disclosed; allow a perpetual viewer for lawfully purchased readable reports where promised.
- Do not place platform-controlled **recovery private keys** in offline packages or in the public website. Tenant BYOK/E2EE artifacts with no escrow must remain unrecoverable by GAIZ Shield.

## 7. Lowest-cost infrastructure and fail-safe behavior

| Component | Proposed hosting | Cost and failure rule |
| --- | --- | --- |
| Public gateway website/documentation | Cloudflare static assets/Pages or existing Worker Static Assets | Free static tier where supported; must not publish `docs/`, source maps, secrets or private templates |
| License check, metadata and short policy decisions | Small Cloudflare Worker | Workers Free has finite daily request + CPU limits; **fail closed** for protected operations |
| Encrypted file objects | Private Cloudflare R2 Standard, optional direct ciphertext downloads via short expiry URLs | Free allowances are finite, extra use may bill; set app quotas, uploads caps, quotas monitoring |
| Artifact and license metadata | D1 Free if small/isolated; otherwise reuse application-owned trusted database | Daily row limits may stop operations; no duplicate authority for EPMO workspace rights |
| Signing root, recovery escrow, long-lived KEKs | Existing trusted backend plus separated offline custodian or reviewed managed HSM/KMS when funded | **Do not assume** Cloudflare environment secrets or free Worker storage are HSM-grade key escrow |
| Heavy AI inference, large HTML/PDF render, Power BI refresh | Customer device or existing approved job runner / Microsoft service | Not free merely because routed through Cloudflare; disabled without budget/entitlement |
| Audit/backup | Append-only audit ledger plus separate encrypted tested backup | Avoid dependence on same account/key as primary storage |

Maintenance: one shared schema/tooling repository **only if** future ownership structure supports it, shared contracts in each consumer, CI schema conformance, version pinning, automatic dependency alerts, scoped credentials, least-privilege admin, minimal new services. Start at `vault.orgaiz.com` on existing domain; no paid third domain required.

Cloudflare Free quota exhaustion must never expose plaintext, silently bypass a security Worker (fail-open), or cause an automatic paid upgrade. Public static pages may remain visible; new paid file access may temporarily return 429/503, with a clear retry message. An application-level upload cap is not an authoritative cloud billing hard-stop, especially for R2. Monitor usage and configure separate account-level financial controls when supported.

## 8. Implementation roadmap and sequence (do not treat as completed)

### A — P0 inventory and security freeze (design-only, no production changes)
- [ ] Verify canonical owner, branch, current deployed SHA and account routing for TEBE, TEFE, TO, Cloudflare and existing VPS.
- [ ] Audit current auth, entitlement guards, RLS, file upload/download/exports, artifact manager, scripts/CI publishing and publicly exposed assets; document actual gaps with code refs.
- [ ] Classify every file/asset and define customer opt-in recovery policy and retention/erasure terms.
- [ ] Confirm data and encryption-regulatory requirements for deployment markets; engage security/legal review for customer consent and recovery.
- [ ] Record chosen product brand/extension and domain/trademark/file-extension collision checks.

### B — P0 shared format and permission contracts
- [ ] Write versioned GAIZ binary/json canonicalization specification, schema, fixture set, signatures and crypto test vectors.
- [ ] Build producer/verifier libraries with hostile-input tests, tenant-bound AAD, key rotation and signature verification.
- [ ] Write OIDC, service-to-service, license, identity, workspace and import contracts; map EPMO existing module guard/RLS; no weakening.
- [ ] Build signed append-only recovery ticket schema, dual approval and segregated escrow strategy **before** implementing any recovery decrypt operation.
- [ ] Decide clear GDPR/privacy/local legal basis and customer opt-in/opt-out for recoverability (not default all customers).

### C — P1 first safe service / proof of concept
- [ ] Stand up isolated **test-only** Worker/R2/D1 with synthetic data within free quotas, explicit cost monitoring and no customer migrations.
- [ ] Add private ciphertext storage, bounded signed links, policy checks, observability and fail-closed outage handling.
- [ ] Implement viewer with sanitized HTML and native charts; test malicious bundles, XSS, huge archives and Power BI boundary.
- [ ] Implement human-only recovery console, 2-person approval, tamper-evident receipts, limited rewrap, expiry and restore rehearsal with synthetic assets.

### D — P1 integrations and sales
- [ ] ORGAIZ: separate purchases, native `.gaiz` exports, standalone PDF/HTML deliverable, license inventory, no forced EPMO purchase.
- [ ] THE EPMO: preview-only import -> explicit human approval -> idempotent draft creation -> optional EPMO progress feedback with consent.
- [ ] TheOrg local: keep original artifact manager and task queue; add format adapter, offline signed-license verification, limited local viewer, optional connected sync with user consent.
- [ ] TEFE: documentation and safe links only; no customer data or private viewer runtime bundled into marketing.

### E — P2 verification and launch gates
- [ ] Crypto independent review: wrong keys, reused/nonces, invalid tags/signatures, wrong tenant, revoked credentials, offline clock rollback, recovery-key loss.
- [ ] Cross-tenant negative tests, shared-auth flow, roles, dual approval, agent denial, idempotency, import revocation and restricted Power BI token issuance.
- [ ] Fail-closed free-tier exhaustion, R2 storage budget, backup restore and log retention tests; security headers/CSP and malicious HTML tests.
- [ ] Real Windows installer signing/desktop hardware tests; staged deployment/rollback; evidence-backed signoff before any main merge or production publication.

## 9. Repository-specific change map

**TEBE:** keep `apps/api/src/auth`, `tenancy`, `platform/module.guard.ts`, `audit`, `apps/api/src/exports`, `apps/api/src/microsoft`, `packages/contracts` and `packages/db` boundaries. Proposed *new* GAIZ integration module under `apps/api/src/gaiz` after design approval; contracts in `packages/contracts`; private DB migration ledger, RLS proofs, audit hooks. Do not change stage gates or initialize billing as part of this plan.

**TEFE:** preserve static-only marketing and `.assetsignore`; only public description, demo and links. No server-side secrets, live customer data or premium encrypted source in the public bundle.

**TO:** keep current Chrome MV3 + .NET Native Messaging bridge, local `ArtifactStore` and Python offline runtime tracks separate until independently reconciled. GAIZ intake is initially **untrusted file format**; do not auto-execute HTML or model-supplied tools. Add an adapter only after canonical format/security tests and hardware acceptance. Preserve owner approvals, task journals and production NO-GO gates.

## 10. Acceptance matrix

| Scenario | Expected evidence |
| --- | --- |
| Owner recovers own platform template after losing standard access | Verified MFA + independent escrow, approved scoped ticket, time limit, audit trail, restored encrypted output |
| Owner attempts decrypting arbitrary tenant report | **DENY**, no key/plaintext, audit unauthorized attempt |
| Customer authorizes managed recovery | Explicit customer approval + independent security approver, exact file scope, notice and recorded outcome |
| Customer uses true BYOK/zero-knowledge package | Platform owner **cannot** decrypt; app gives truthful recovery limit |
| AI agent attempts recovery or grants self-license | **DENY** at API/tool gateway regardless of prompt |
| Third-party modifies a `.gaiz` package or substitutes tenant | Reject at signature/AEAD/tenant-policy verification |
| Online Worker exceeds quota | Sensitive API **fail closed**; no bypass or automatic paid compute |
| Offline license valid while disconnected | Permitted purchased features work; no online superkey required |
| ORGAIZ-only paid report imported into EPMO | Customer may buy report alone; signed import preview, human approves drafts, no automatic paid EPMO entitlements |
| Marketing deployment | Docs, keys, maps and private assets never included in deployed static output |

## 11. Risk register

| Risk | Severity | Mitigation / owner |
| --- | --- | --- |
| Owner account compromise converts recovery into mass disclosure | **Critical** | No wildcard recovery; MFA + physical escrow, independent approval, scoped key operations, immediate alerts; Security Owner |
| "Convenient" shared master key in Worker/client | **Critical** | Separate keys per artifact/tenant, envelope encryption, offline escrow; Crypto Owner |
| Cross-tenant import or owner bypass of RLS | **Critical** | Server-side tenant resolution, RLS unchanged, isolated tests; EPMO Backend |
| AI-generated HTML or prompt injection executes privileged actions | **High** | Viewer sandbox, no arbitrary JS, untrusted input, denial of recovery scopes to AI; Viewer/Agent Leads |
| Offline executable tampering / copied license | **High** | Public-key signed licenses, code signing, device-bound optional checks, clear piracy limitation; Desktop Lead |
| Lost escrow keys create permanent data loss | **High** | Offline dual-location encrypted backup, rehearsed recovery, versioned rotation; Security Owner |
| Cloudflare Free quota or R2 charges | **Medium/High** | Quotas, size limits, separate service meters and billing alerts, no paid auto-upgrade; Ops |
| Power BI or purchased content misrepresented as offline | **Medium** | Snapshot/render fallback, separate licensed online embed; Product |
| Unreviewed repo edits alter active deployments | **High** | Docs-only PRs, mandatory CI + approvals, no automatic merge/deploy; Maintainers |
| Customer rights conflict with platform recovery policy | **Critical** | Consent, contract/data processing terms, customer-managed key mode, legal review; Product/Legal |

## 12. Evidence, constraints and external references

- TEBE `README.md`: RLS tenant isolation, route-enforced module guards, append-only audit; runtime deployment cannot be inferred from a merged SHA.
- TO `README.md`, `docs/ARTIFACT_MANAGER_IMPLEMENTATION.md`, `docs/PRODUCTION_READINESS_HANDOFF_2026-11-10.md`: local preview artifacts, untrusted intake, no production-ready signed desktop release.
- TEFE `README.md` and `.assetsignore`: marketing-only hosting, exclusion of private docs and code.
- OWASP Key Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html
- OWASP Cryptographic Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- NIST SP 800-57 Part 1 Rev 5: https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final
- Cloudflare Workers Free limits and fail behavior: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1 quota enforcement: https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/

**Release decision: NO-GO for active owner-decrypt, marketplace licensing and tenant import until contracts, consent, escrow custody, tests and independent review exist.** This document is a change plan, not an implementation certificate.


## TO implementation ordering and non-regression gates

1. TheOrg is currently local-first Chrome/Windows/Python developer-preview tracks, **not** a live ORGAIZ ecommerce platform. Treat ORGAIZ as a proposed additional product layer.
2. Preserve `ArtifactStore.cs`, `ArtifactInspection.cs`, `ArtifactTransfers.cs` and the approval/verification process. A `.gaiz` parser is a new untrusted input surface, never an executed plugin.
3. Only implement offline public-key license verification and local report viewer after compatibility review; no connection to central escrow keys from local agents. AI tools cannot approve recovery actions.
4. All advanced recovery is controlled by a separate online owner console with independent factor/escrow. Local offline app may export an authenticated support request but must never hold a universal recovery private key.
5. Keep unsigned preview installer, agent gateway and model validation at existing NO-GO until actual Windows Chrome/bridge and device tests pass.


## Cross-repository GAIZ v1 engineering handoff — November 16, 2026

Related engineering draft:
https://github.com/2029TEBE/TEBE/pull/507
and TEFE presentation contract:
https://github.com/2029TEFE/TEFE/pull/41

### Protocol owner deliverable before activation

TO must freeze and publish a GAIZ1 interoperability contract, including:

- Exact canonical signed-byte serialization and Unicode/duplicate-key rules.
- Ed25519 issuer key IDs, authenticity/rotation/revocation semantics, trust
  anchor and key selection rules (from trusted backend policy).
- AES-256-GCM nonce/tag/AAD, actual recipient DEK wrapping and key-custody
  responsibilities. Never embed raw persistent production DEKs in fixtures.
- Versioned structured governance report schema. The current TO example
  `{report,value}` differs from TEBE's strict proposal
  `{schemaVersion,title,summary}`; these are **not interchangeable**.
- Signed positive/negative conformance vectors with bytes, expected results,
  tenant scope, malformed/duplicate-key/ciphertext-tamper cases and expiry.
- Explicit backward-incompatible version rejection and a policy for retired
  issuers; no silent conversion of untrusted artifacts.

### Current delivery boundary

TEBE contains disconnected signed-assignment validation, a proposed one-time
database claim, tenant-bound job/receipt schema and draft-import transaction
candidates. It **does not have** a deployed trusted worker, approved migration,
production key custody, operational imports, or passing end-to-end acceptance.
TEFE remains a public-facing documentation/marketing surface only.

Implementation may proceed in draft branches while GitHub Actions startup is
blocked, but a security-sensitive live release still requires reviewed issuer
policy, independent worker identity, PostgreSQL isolation/replay evidence,
normal CI, human approver and independent security signoff. This handoff
does not authorize merge or deployment.
