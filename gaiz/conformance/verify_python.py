"""Independent GAIZ2 synthetic conformance reader, NOT a production validator.
Requires cryptography (pinned by CI). No network and no enterprise data.
"""
from __future__ import annotations
import base64
import hashlib
import json
import pathlib
import sys

from cryptography.hazmat.primitives.asymmetric import padding, ed25519, rsa
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"GAIZ2\n"
MAX_BYTES = 8 * 1024 * 1024

def canonical(value):
    # This test fixture uses ASCII-only JSON property names; a full UTF-16
    # comparator and strict duplicate-aware parser remain release blockers.
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")

def b64(value):
    if not isinstance(value, str) or not value or any(ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" for ch in value):
        raise ValueError("invalid base64url")
    result = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    if base64.urlsafe_b64encode(result).rstrip(b"=").decode() != value:
        raise ValueError("noncanonical base64url")
    return result

def verify_and_open(blob, issuer_pem, recipient_pem, expected_issuer, expected_tenant):
    if not isinstance(blob, bytes) or len(blob) > MAX_BYTES or not blob.startswith(MAGIC):
        raise ValueError("invalid magic/bounds")
    raw = blob[len(MAGIC):]
    envelope = json.loads(raw.decode("utf-8", errors="strict"))
    if canonical(envelope) != raw:
        raise ValueError("noncanonical envelope")
    if set(envelope) != {"ciphertext", "manifest", "nonce", "recipients", "signature", "tag"}:
        raise ValueError("unexpected fields")
    m = envelope["manifest"]
    if m.get("version") != 2 or m.get("issuerId") != expected_issuer or m.get("tenantScope") != expected_tenant:
        raise ValueError("version/issuer/tenant mismatch")
    unsigned = {k:envelope[k] for k in ("ciphertext", "manifest", "nonce", "recipients", "tag")}
    pub = serialization.load_pem_public_key(issuer_pem)
    if not isinstance(pub, ed25519.Ed25519PublicKey):
        raise ValueError("issuer key type")
    pub.verify(b64(envelope["signature"]), MAGIC + canonical(unsigned))
    recipient = next((x for x in envelope["recipients"] if x.get("keyId") == "test-recipient"), None)
    if recipient is None:
        raise ValueError("recipient missing")
    private_key = serialization.load_pem_private_key(recipient_pem, password=None)
    if not isinstance(private_key, rsa.RSAPrivateKey) or private_key.key_size < 3072:
        raise ValueError("recipient key type")
    dek = private_key.decrypt(b64(recipient["wrappedKey"]),padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),algorithm=hashes.SHA256(),label=None))
    if len(dek) != 32:
        raise ValueError("invalid DEK")
    plaintext = AESGCM(dek).decrypt(b64(envelope["nonce"]), b64(envelope["ciphertext"]) + b64(envelope["tag"]), canonical(m))
    report = json.loads(plaintext.decode("utf-8", errors="strict"))
    if canonical(report) != plaintext:
        raise ValueError("noncanonical report")
    return report

def main(root):
    root=pathlib.Path(root)
    blob=(root/"valid.gaiz").read_bytes()
    issuer=(root/"issuer-public.pem").read_bytes()
    receiver=(root/"recipient-private.pem").read_bytes()
    expected=json.loads((root/"expected.json").read_text())
    report=verify_and_open(blob,issuer,receiver,"test-issuer","synthetic-tenant")
    assert report == expected["report"]
    assert hashlib.sha256(blob).hexdigest() == expected["sha256"]
    for name in ("tampered.gaiz","wrong-magic.gaiz"):
        try:
            verify_and_open((root/name).read_bytes(),issuer,receiver,"test-issuer","synthetic-tenant")
        except (ValueError,TypeError,KeyError,UnicodeDecodeError):
            pass
        except Exception as exc:
            # cryptography raises InvalidSignature or InvalidTag.
            if type(exc).__name__ not in ("InvalidSignature","InvalidTag"):
                raise
        else:
            raise AssertionError("unsafe fixture accepted: "+name)
    try:
        verify_and_open(blob,issuer,receiver,"test-issuer","different-tenant")
    except ValueError:
        pass
    else:
        raise AssertionError("wrong tenant accepted")
    print("GAIZ2 Node->Python encrypted and signed fixture: PASS (positive + negative cases)")

if __name__=="__main__":
    if len(sys.argv)!=2:
        raise SystemExit("usage: python gaiz/conformance/verify_python.py <fixture-dir>")
    main(sys.argv[1])
