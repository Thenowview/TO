// GAIZ interoperability candidate v1. NOT production key-management or entitlement infrastructure.
// Format: ASCII "GAIZ1\n" + UTF-8 JSON. Node 20+ built-in cryptography only.
import { createCipheriv, createDecipheriv, randomBytes, sign, verify, createHash } from 'node:crypto';
const PREFIX = 'GAIZ1\n';
const MAX_FILE = 8 * 1024 * 1024;
const b64 = (x) => Buffer.from(x).toString('base64url');
const unb64 = (s) => {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]+$/.test(s) || s.length > MAX_FILE * 2) throw Error('Invalid encoding');
  const x = Buffer.from(s, 'base64url');
  if (b64(x) !== s) throw Error('Noncanonical encoding');
  return x;
};
const canonical = (v) => {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k)+':'+canonical(v[k])).join(',') + '}';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) return JSON.stringify(v);
  throw Error('Unsupported manifest value');
};
const signedBytes = (doc) => Buffer.from(PREFIX + canonical({ manifest:doc.manifest, nonce:doc.nonce, tag:doc.tag, ciphertext:doc.ciphertext }));
export function createGaiz({ payload, manifest, key, privateKey }) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw Error('A unique 32-byte per-artifact encryption key is required');
  if (!privateKey || !manifest || manifest.version !== 1 || typeof manifest.artifactId !== 'string' || !manifest.artifactId || typeof manifest.tenantScope !== 'string' || !manifest.tenantScope) throw Error('Invalid manifest');
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  if (plaintext.length > MAX_FILE / 2) throw Error('Payload too large');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const aad = Buffer.from(canonical(manifest));
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const doc = {manifest, nonce:b64(nonce), tag:b64(cipher.getAuthTag()), ciphertext:b64(ciphertext)};
  doc.signature = b64(sign(null, signedBytes(doc), privateKey));
  return Buffer.from(PREFIX + JSON.stringify(doc), 'utf8');
}
export function verifyGaiz(input, publicKey) {
  const bytes = Buffer.from(input);
  if (bytes.length > MAX_FILE || bytes.length < PREFIX.length || bytes.subarray(0,PREFIX.length).toString() !== PREFIX) throw Error('Invalid GAIZ header or file size');
  const doc = JSON.parse(bytes.subarray(PREFIX.length).toString('utf8'));
  if (!doc || Object.keys(doc).sort().join(',') !== 'ciphertext,manifest,nonce,signature,tag' ||
      !doc.manifest || doc.manifest.version !== 1 || typeof doc.manifest.artifactId !== 'string' || !doc.manifest.artifactId ||
      typeof doc.manifest.tenantScope !== 'string' || !doc.manifest.tenantScope ||
      unb64(doc.nonce).length !== 12 || unb64(doc.tag).length !== 16 || unb64(doc.signature).length !== 64) throw Error('Invalid GAIZ structure');
  if (!verify(null, signedBytes(doc), publicKey, unb64(doc.signature))) throw Error('Invalid GAIZ signature');
  return doc;
}
export function decryptGaiz(input, {key, publicKey, tenantScope}) {
  const doc = verifyGaiz(input,publicKey);
  if (!tenantScope || doc.manifest.tenantScope !== tenantScope) throw Error('Tenant scope denied');
  if (!Buffer.isBuffer(key) || key.length !== 32) throw Error('Invalid recipient key');
  const decipher = createDecipheriv('aes-256-gcm', key, unb64(doc.nonce));
  decipher.setAAD(Buffer.from(canonical(doc.manifest)));
  decipher.setAuthTag(unb64(doc.tag));
  return JSON.parse(Buffer.concat([decipher.update(unb64(doc.ciphertext)),decipher.final()]).toString('utf8'));
}
// Identity, entitlement, trusted public-key distribution, per-recipient key wrapping,
// replay prevention and enterprise import approval MUST be enforced by a separate trusted service.
