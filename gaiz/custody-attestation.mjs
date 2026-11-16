// Signed *metadata* receipt for an isolated custodian; no decryption rights.
// TO development profile, not yet ratified. Sign key MUST be independent
// of customer decryption keys and held by the external custodian.
import { sign,verify,createPublicKey,createPrivateKey } from 'node:crypto';
const DOMAIN='GAIZ2-CUSTODY-RECEIPT\n';
const HASH=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function validate(r){
 if(!r || Object.getPrototypeOf(r)!==Object.prototype)throw Error('Invalid custodian receipt');
 const names=['artifactId','artifactSha256','keyId','recipientTenant','reportSha256','reviewId','timestamp','validation'];
 if(Object.keys(r).sort().join('|')!==names.sort().join('|'))throw Error('Unsupported receipt fields');
 for(const k of ['artifactId','keyId','recipientTenant','reviewId'])
   if(typeof r[k]!=='string'||!ID.test(r[k]))throw Error('Invalid receipt identity');
 if(!HASH.test(r.artifactSha256)||!HASH.test(r.reportSha256))throw Error('Invalid receipt digest');
 if(r.validation!=='schema-validated-no-import')throw Error('Invalid receipt capability');
 if(typeof r.timestamp!=='string'||!Number.isFinite(Date.parse(r.timestamp))||
   new Date(r.timestamp).toISOString()!==r.timestamp)throw Error('Invalid receipt time');
 return r;
}
function msg(r){
 const v=validate(r);
 return Buffer.from(DOMAIN+JSON.stringify(Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]]))),'utf8');
}
export function signLocalCustodyReceipt(receipt,{custodianSigningPrivateKey}={}){
 const key=custodianSigningPrivateKey?.type==='private' ?
   custodianSigningPrivateKey:createPrivateKey(custodianSigningPrivateKey);
 if(key.asymmetricKeyType!=='ed25519')throw Error('Dedicated custodian Ed25519 signing key required');
 const payload=validate(receipt);
 return Object.freeze({payload:Object.freeze({...payload}),signature:sign(null,msg(payload),key).toString('base64url')});
}
export function verifyLocalCustodyReceipt({payload,signature},{trustedCustodianPublicKey,expectedTenant,expectedArtifactSha256,expectedReviewId,maxAgeMs=300000,now=Date.now()}={}){
 if(!trustedCustodianPublicKey||typeof signature!=='string'||!/^[A-Za-z0-9_-]+$/.test(signature))
   throw Error('Trusted custodian signer required');
 const pub=trustedCustodianPublicKey?.type==='public'?trustedCustodianPublicKey:createPublicKey(trustedCustodianPublicKey);
 if(pub.asymmetricKeyType!=='ed25519')throw Error('Wrong custodian signing algorithm');
 const sig=Buffer.from(signature,'base64url');
 if(sig.length!==64||sig.toString('base64url')!==signature||
    !verify(null,msg(payload),pub,sig))throw Error('Custodian receipt signature denied');
 if(payload.recipientTenant!==expectedTenant||payload.artifactSha256!==expectedArtifactSha256||
    payload.reviewId!==expectedReviewId)throw Error('Custodian receipt policy mismatch');
 const age=now-Date.parse(payload.timestamp);
 if(!Number.isFinite(maxAgeMs)||maxAgeMs<0||age<0||age>Math.min(300000,maxAgeMs))
   throw Error('Custodian receipt expired');
 return Object.freeze({verified:true,importAllowed:false,plaintextReleased:false,
   artifactSha256:payload.artifactSha256,reportSha256:payload.reportSha256});
}
