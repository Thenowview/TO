// GAIZ2 key *policy* adapter. No secret storage, key generation or universal recovery.
// A trusted caller must supply its own authenticated, tenant-bound public-key records.
import { createPublicKey } from 'node:crypto';
import { verifyGaiz2 } from './v2.mjs';

const id=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function identifier(s) { if(typeof s!=='string'||!id.test(s))throw Error('Invalid key policy identifier'); return s; }
function policyDate(s) {
 if(typeof s!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString()!==s)throw Error('Invalid key policy time');
 return Date.parse(s);
}
function activeRecord(record, tenantScope, now) {
 if(!record||record.status!=='active'||record.tenantScope!==tenantScope)throw Error('Key not trusted for tenant');
 if(policyDate(record.activeFrom)>now||policyDate(record.activeUntil)<=now)throw Error('Key outside validity interval');
}
export function resolveAuthorizedRecipients({tenantScope,recipientIds,registry,authorization,now=Date.now()}) {
 identifier(tenantScope);
 if(!authorization||authorization.tenantScope!==tenantScope||authorization.status!=='approved'||
    !identifier(authorization.approvalId)||!identifier(authorization.actorId)||
    !Array.isArray(recipientIds)||recipientIds.length<1||recipientIds.length>8||
    !Array.isArray(registry))throw Error('Explicit tenant approval and recipient directory required');
 const unique=new Set();
 return recipientIds.map(keyId=>{
  identifier(keyId);
  if(unique.has(keyId))throw Error('Duplicate recipient');
  unique.add(keyId);
  const entry=registry.find(r=>r.keyId===keyId);
  activeRecord(entry,tenantScope,now);
  if(entry.algorithm!=='RSA-OAEP-SHA256'||!['customer','approved-platform-recipient'].includes(entry.ownerType))
    throw Error('Unsupported recipient key policy');
  if(entry.ownerType==='approved-platform-recipient' &&
     (!authorization.allowPlatformRecovery||!identifier(entry.customerConsentRef)))
    throw Error('Platform recovery requires explicit customer consent');
  const publicKey=createPublicKey(entry.publicKeyPem);
  if(publicKey.asymmetricKeyType!=='rsa'||publicKey.asymmetricKeyDetails?.modulusLength<3072)
    throw Error('Recipient RSA-3072+ key required');
  return {keyId,publicKey};
 });
}
export function verifyGaiz2WithIssuerRecord(bytes,{record,tenantScope,now=Date.now()}) {
 identifier(tenantScope);
 activeRecord(record,tenantScope,now);
 if(record.algorithm!=='Ed25519')throw Error('Unsupported issuer signing algorithm');
 identifier(record.issuerId);
 const key=createPublicKey(record.publicKeyPem);
 if(key.asymmetricKeyType!=='ed25519')throw Error('Issuer key algorithm mismatch');
 return verifyGaiz2(bytes,{trustedIssuerPublicKey:key,expectedIssuerId:record.issuerId,expectedTenantScope:tenantScope});
}
// Revocation can stop *new* online trust decisions, never invalidate already
// decrypted/offline content or retroactively remove an authorized recipient.
