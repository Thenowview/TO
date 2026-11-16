# GAIZ2 conformance handoff — 2026-11-16

**Status:** Independent Node.js producer → Python consumer tests pass on TO PR #30. This is a development conformance suite, not a security certification or proof of TEBE/TEFE integration.

## Reproducible test
```sh
python -m pip install 'cryptography==46.0.3'
fixture_dir="$(mktemp -d)"
node gaiz/conformance/generate.mjs "$fixture_dir"
python gaiz/conformance/verify_python.py "$fixture_dir"
rm -rf "$fixture_dir"
```

The generator uses fresh synthetic Ed25519 and RSA-3072 keypairs and creates `valid.gaiz`, `tampered.gaiz`, `wrong-magic.gaiz`, `issuer-public.pem`, `recipient-private.pem` and `expected.json` **in a temporary directory**. These keys and artifacts are never committed. Run the command only in a private disposable environment; temporary recipient private keys must be destroyed immediately after the test.

## Verified by this suite
- Node.js emits the GAIZ2 magic, canonical JSON envelope, AES-256-GCM ciphertext with manifest AAD, Ed25519 signature and RSA-OAEP SHA-256 key envelope.
- Python independently verifies the Ed25519 signature using a separately supplied issuer public key, unwraps the recipient DEK, authenticates/decrypts AES-GCM and compares the canonical JSON report.
- Synthetic report includes non-ASCII text; reference SHA-256 digest agrees between runtimes.
- Wrong-tenant, tampered manifest and wrong-magic artifacts are rejected.

## Coverage limitations (required next)
- The Python reader is a *fixture-limited* independent verifier: it assumes ASCII property names and does not implement the entire GAIZ2 Unicode/key ordering profile, full parser limits, key trust registry or revocation. **Do not use it to validate arbitrary customer uploads**.
- Add fixed immutable versioned fixtures plus corpus digests after contract review. Dynamic generation is a smoke test, not an immutable compatibility oracle.
- Add independent .NET consumer tests for TO's Windows artifact bridge.
- TEBE's currently drafted verifier accepts GAIZ1 only. It needs a GAIZ2 read-only adapter, separately trusted issuer key configuration and actual TO-generated fixture test.
- TEFE's inspector accepts GAIZ1 only. It needs GAIZ2 recognition while continuing to label metadata unverified and refusing to claim decryption or enterprise authorization.
- Fuzzing, duplicate-key parsing ambiguity, Unicode ordering outside ASCII field names, key lifecycle, replay controls and authorization reviews are release blockers.

## Pinning and security
Do not fetch `main` or a mutable branch at runtime as the format authority. Pin the reviewed TO commit and independently verify a distributed contract/fixture digest. Never place signing keys in TEFE, share TEBE database credentials with TO or make signature verification equal approval.

## Required release gate
CI green for the *latest* relevant commit, independent TO→TEBE fixture comparison and explicit authorized import review must precede any production claim.
