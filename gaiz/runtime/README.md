# Trusted GAIZ runtime

See [PROTOCOL.md](PROTOCOL.md) for the complete TO/TEBE contract and launch gates.

- `trusted-runtime.mjs`: signed grant → verified GAIZ2 → managed unwrap → quarantine
  → exact approved field patch → managed custodian signature.
- `vault-transit.mjs`: concrete HTTPS Vault Transit client; pinned non-exportable
  key metadata/version/fingerprint. No private-key export or secret fallback.
- `file-ledger.mjs`: persistent single-worker replay/audit records.
- `workload-token.mjs`: owner-only rotating credential-file reader.
- `protocol.mjs`: strict signed grant/result schemas and domain separation.
- `mapping-preview.mjs`: pinned copy of TEBE's existing deterministic preview.

Local tests: `node --test gaiz/runtime/runtime.test.mjs gaiz/test.mjs gaiz/*.test.mjs gaiz/conformance/*.test.mjs`.
For real Vault acceptance, start a disposable TLS Vault at `https://127.0.0.1:18200`
with the TEST-ONLY token declared by `vault-live.test.mjs`, set `NODE_EXTRA_CA_CERTS`
to its dev CA and `GAIZ_TEST_VAULT_ORIGIN` to that exact URL, then run
`node --test gaiz/runtime/vault-live.test.mjs`. Never use that dev server or token
outside this synthetic test.
