// GAIZ2 experimental reference implementation; NOT a deployed key service.
// Node.js >= 20 built-in crypto. This format is intentionally separate from GAIZ1.
import { randomBytes, createCipheriv, createDecipheriv, publicEncrypt, privateDecrypt,
  constants, sign, verify, createHash, createPublicKey, createPrivateKey } from 'node:crypto';

const MAGIC = 'GAIZ2\n';
const MAX = 8 * 1024 * 1024;
const MAX_RECIPIENTS = 8;
const MAX_DEPTH = 24;
const MAX_KEYS = 1024;
const enc = (v) => Buffer.from(v, 'utf8');
const b64 = (v) => Buffer.from(v).toString('base64url');
function decoded(s, max) {
  if(typeof s !== 'string' || !/^[A-Za-z0-9_-]+$/.test(s) || s.length > max * 2) throw Error('Invalid base64url');
  const b = Buffer.from(s, 'base64url');
  if (b.length > max || b64(b) !== s) throw Error('Noncanonical base64url');
  return b;
}
function assertId(s) {
  if(typeof s !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(s)) throw Error('Invalid identifier');
  return s;
}
function validUnicode(s) {
  // Reject unpaired UTF-16 surrogates rather than silently replacing them on UTF-8 output.
  for (let i=0;i<s.length;i++) {
    const u=s.charCodeAt(i);
    if(u>=0xD800 && u<=0xDBFF) {
      const next=s.charCodeAt(++i);
      if(!(next>=0xDC00 && next<=0xDFFF)) throw Error('Unpaired Unicode surrogate');
    } else if(u>=0xDC00 && u<=0xDFFF) throw Error('Unpaired Unicode surrogate');
  }
  return s;
}
function canonical(v, depth = 0) {
  if(depth > MAX_DEPTH) throw Error('JSON depth limit');
  if(v === null || typeof v === 'boolean') return JSON.stringify(v);
  if(typeof v === 'string') return JSON.stringify(validUnicode(v));
  if(typeof v === 'number' && Number.isSafeInteger(v) && !Object.is(v,-0)) return JSON.stringify(v);
  if(Array.isArray(v)) {
    if(v.length > MAX_KEYS) throw Error('JSON array limit');
    return '[' + v.map(x => canonical(x,depth+1)).join(',') + ']';
  }
  if(v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    const ks = Object.keys(v);
    if(ks.length > MAX_KEYS || ks.some(k => ['__proto__','constructor','prototype'].includes(k))) throw Error('JSON object keys rejected');
    ks.forEach(validUnicode);
    return '{' + ks.sort().map(k => JSON.stringify(k)+':'+canonical(v[k],depth+1)).join(',') + '}';
  }
  throw Error('Unsupported JSON value');
}
function exact(o, names) {
  if(!o || typeof o !== 'object' || Array.isArray(o) || Object.keys(o).sort().join(',') !== names.slice().sort().join(',')) throw Error('Unsupported GAIZ structure');
}
function validateManifest(m) {
  exact(m,['artifactId','contentType','createdAt','issuerId','schemaVersion','tenantScope','version']);
  if(m.version !== 2 || m.schemaVersion !== 1 || m.contentType !== 'application/vnd.orgaiz.report+json') throw Error('Unsupported GAIZ version/schema');
  for(const k of ['artifactId','issuerId','tenantScope']) assertId(m[k]);
  if(typeof m.createdAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(m.createdAt) ||
    !Number.isFinite(Date.parse(m.createdAt)) || new Date(m.createdAt).toISOString() !== m.createdAt) throw Error('Invalid creation time');
}
const wrapping = {padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'};
function unsigned(doc) { return {ciphertext:doc.ciphertext,manifest:doc.manifest,nonce:doc.nonce,recipients:doc.recipients,tag:doc.tag}; }
function encode(doc) { return Buffer.concat([enc(MAGIC),enc(canonical(doc))]); }
function parse(input) {
  const bytes=Buffer.from(input);
  if(bytes.length > MAX || bytes.length < MAGIC.length || !bytes.subarray(0,MAGIC.length).equals(enc(MAGIC))) throw Error('Invalid GAIZ2 header/size');
  const body=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(MAGIC.length));
  // Parse only within the input-size bound, then demand exact canonical byte equality.
  // This also rejects duplicate JSON keys, extraneous whitespace, and alternate number forms.
  const doc=JSON.parse(body);
  if(canonical(doc) !== body) throw Error('Noncanonical GAIZ2 envelope');
  exact(doc,['ciphertext','manifest','nonce','recipients','signature','tag']);
  validateManifest(doc.manifest);
  if(decoded(doc.nonce,12).length !== 12 || decoded(doc.tag,16).length !== 16 || decoded(doc.signature,64).length !== 64) throw Error('Invalid cryptographic fields');
  decoded(doc.ciphertext,MAX);
  if(!Array.isArray(doc.recipients) || doc.recipients.length < 1 || doc.recipients.length > MAX_RECIPIENTS) throw Error('Invalid recipient count');
  const names=new Set();let previous='';
  for(const r of doc.recipients) {
    exact(r,['keyId','wrappedKey']);
    assertId(r.keyId);
    if(names.has(r.keyId)||r.keyId<=previous) throw Error('Duplicate or noncanonical recipient order');
    previous=r.keyId;
    names.add(r.keyId);
    if(decoded(r.wrappedKey,1024).length < 384) throw Error('Invalid recipient envelope');
  }
  return {bytes,doc};
}
/** Caller controls issuer, owner-approved recipient public keys and audit identity.
 * Each call creates a fresh random AES DEK and nonce; never supply a platform master secret. */
function sealGaiz2({report, manifest, recipients}) {
  validateManifest(manifest);
  if(!Array.isArray(recipients) || recipients.length < 1 || recipients.length > MAX_RECIPIENTS) throw Error('Issuer/recipients required');
  const plaintext=enc(canonical(report));
  if(plaintext.length > MAX / 2) throw Error('Report too large');
  const ids=new Set(), dek=randomBytes(32), nonce=randomBytes(12);
  try {
    const keys=recipients.map(r=>{
      assertId(r.keyId);
      if(ids.has(r.keyId)) throw Error('Duplicate recipient');
      ids.add(r.keyId);
      const pub=r.publicKey?.type === 'public' ? r.publicKey : createPublicKey(r.publicKey);
      if(pub.asymmetricKeyType !== 'rsa' || pub.asymmetricKeyDetails?.modulusLength < 3072) throw Error('RSA-3072+ recipient key required');
      return {keyId:r.keyId,wrappedKey:b64(publicEncrypt({...wrapping,key:pub},dek))};
    }).sort((a,b)=>a.keyId < b.keyId ? -1 : a.keyId > b.keyId ? 1 : 0);
    const cipher=createCipheriv('aes-256-gcm',dek,nonce);
    cipher.setAAD(enc(canonical(manifest)));
    const ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);
    const doc={manifest,nonce:b64(nonce),tag:b64(cipher.getAuthTag()),ciphertext:b64(ciphertext),recipients:keys};
    return doc;
  } finally {dek.fill(0);plaintext.fill(0);}
}
function finishGaiz2(doc,signature){
 if(!Buffer.isBuffer(signature)||signature.length!==64)throw Error('Ed25519 signature required');
 doc.signature=b64(signature);
 const output=encode(doc);if(output.length>MAX)throw Error('Artifact exceeds maximum');return output;
}
export function createGaiz2(args){
 const doc=sealGaiz2(args);
 return finishGaiz2(doc,sign(null,enc(MAGIC+canonical(unsigned(doc))),args.issuerPrivateKey));
}
export async function createGaiz2WithSigner(args){
 if(typeof args?.signer!=='function')throw Error('Managed issuer signer required');
 const doc=sealGaiz2(args);
 return finishGaiz2(doc,await args.signer(enc(MAGIC+canonical(unsigned(doc)))));
}
/** Signature is checked against an independently provisioned issuer key, never an embedded one. */
export function verifyGaiz2(input,{trustedIssuerPublicKey,expectedIssuerId,expectedTenantScope}) {
  if(!trustedIssuerPublicKey || !expectedIssuerId || !expectedTenantScope) throw Error('Trusted verification policy required');
  const {bytes,doc}=parse(input);
  if(doc.manifest.issuerId !== expectedIssuerId) throw Error('Issuer denied');
  if(doc.manifest.tenantScope !== expectedTenantScope) throw Error('Tenant denied');
  const pub=trustedIssuerPublicKey?.type === 'public' ? trustedIssuerPublicKey : createPublicKey(trustedIssuerPublicKey);
  if(pub.asymmetricKeyType !== 'ed25519' || !verify(null,enc(MAGIC+canonical(unsigned(doc))),pub,decoded(doc.signature,64))) throw Error('Untrusted signature');
  const receipt=Object.freeze({format:'GAIZ2',artifactId:doc.manifest.artifactId,issuerId:doc.manifest.issuerId,tenantScope:doc.manifest.tenantScope,sha256:createHash('sha256').update(bytes).digest('hex'),signatureVerified:true,authorizationGranted:false,importAllowed:false});
  return {manifest:Object.freeze({...doc.manifest}),receipt};
}
/** Signature verification is necessary, not sufficient, for user/tenant authorization. */
export function openGaiz2(input,{trustedIssuerPublicKey,expectedIssuerId,expectedTenantScope,recipientKeyId,recipientPrivateKey}) {
  const verified=verifyGaiz2(input,{trustedIssuerPublicKey,expectedIssuerId,expectedTenantScope});
  assertId(recipientKeyId);
  const {doc}=parse(input);
  const envelope=doc.recipients.find(r=>r.keyId===recipientKeyId);
  if(!envelope) throw Error('Recipient not found');
  const key=recipientPrivateKey?.type === 'private' ? recipientPrivateKey : createPrivateKey(recipientPrivateKey);
  if(key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails?.modulusLength < 3072) throw Error('Unsupported recipient key');
  const dek=privateDecrypt({...wrapping,key},decoded(envelope.wrappedKey,1024));
  let plaintext;
  try {
    if(dek.length !== 32) throw Error('Invalid data key');
    const decipher=createDecipheriv('aes-256-gcm',dek,decoded(doc.nonce,12));
    decipher.setAAD(enc(canonical(doc.manifest)));
    decipher.setAuthTag(decoded(doc.tag,16));
    plaintext=Buffer.concat([decipher.update(decoded(doc.ciphertext,MAX)),decipher.final()]);
    if(plaintext.length > MAX / 2) throw Error('Decrypted content too large');
    const reportText=new TextDecoder('utf-8',{fatal:true}).decode(plaintext);
    const report=JSON.parse(reportText);
    if(canonical(report) !== reportText) throw Error('Noncanonical report');
    return {report,verification:verified.receipt};
  } finally {
    plaintext?.fill(0);
    dek.fill(0);
  }
}
export const GAIZ2_VERSION='2.0-experimental';

/** Managed-custody reader: RSA private material never enters this process.
 * The provider releases only a per-artifact DEK to the trusted worker. */
export async function openGaiz2WithCustodian(input,policy) {
  const verified=verifyGaiz2(input,policy);
  assertId(policy.recipientKeyId);
  if(typeof policy.unwrap!=='function')throw Error('Managed unwrap provider required');
  const {doc}=parse(input);
  const envelope=doc.recipients.find(r=>r.keyId===policy.recipientKeyId);
  if(!envelope)throw Error('Recipient not found');
  let dek,plaintext;
  try {
    dek=await policy.unwrap(decoded(envelope.wrappedKey,1024));
    if(!Buffer.isBuffer(dek)||dek.length!==32)throw Error('Invalid managed data key');
    const decipher=createDecipheriv('aes-256-gcm',dek,decoded(doc.nonce,12));
    decipher.setAAD(enc(canonical(doc.manifest)));
    decipher.setAuthTag(decoded(doc.tag,16));
    plaintext=Buffer.concat([decipher.update(decoded(doc.ciphertext,MAX)),decipher.final()]);
    if(plaintext.length>MAX/2)throw Error('Decrypted content too large');
    const text=new TextDecoder('utf-8',{fatal:true}).decode(plaintext),report=JSON.parse(text);
    if(canonical(report)!==text)throw Error('Noncanonical report');
    return {report,verification:verified.receipt};
  } finally {if(Buffer.isBuffer(dek))dek.fill(0);plaintext?.fill(0);}
}
