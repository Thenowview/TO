// GAIZ2 customer custody policy boundary. No keys, tokens or plaintext are stored here.
// All input decisions MUST originate from an authenticated trusted service; this
// library only checks cross-field consistency and cannot authenticate callers.
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function id(v,name){if(typeof v!=='string'||!ID.test(v))throw Error('Invalid '+name);return v;}
function time(s){if(typeof s!=='string'||!Number.isFinite(Date.parse(s))||new Date(s).toISOString()!==s)throw Error('Invalid policy time');return Date.parse(s);}
function approvedReview(review,tenantScope,artifactSha256,now){
 if(!review||review.status!=='approved'||review.tenantScope!==tenantScope||
    review.sha256!==artifactSha256||!id(review.requesterId,'requester')||
    !id(review.reviewerId,'reviewer')||review.requesterId===review.reviewerId||
    !id(review.reviewId,'review')||time(review.expiresAt)<=now)
   throw Error('Distinct, current, tenant-bound approval required');
}
/** Produces a non-secret decision for a separately authenticated custodian.
 * Does not authorize import, send keys to an AI agent, or perform decryption. */
export function evaluateCustodyRequest({tenantScope,actorId,artifactReceipt,review,recipientRecord,operation,now=Date.now()}){
 id(tenantScope,'tenant');id(actorId,'actor');
 if(operation!=='decrypt-for-approved-preview')throw Error('Operation not permitted');
 if(!artifactReceipt||artifactReceipt.signatureVerified!==true||
    artifactReceipt.tenantScope!==tenantScope||
    typeof artifactReceipt.sha256!=='string'||!/^[a-f0-9]{64}$/.test(artifactReceipt.sha256))
   throw Error('Verified artifact receipt required');
 approvedReview(review,tenantScope,artifactReceipt.sha256,now);
 if(!recipientRecord||recipientRecord.status!=='active'||recipientRecord.tenantScope!==tenantScope||
    recipientRecord.algorithm!=='RSA-OAEP-SHA256'||!id(recipientRecord.keyId,'key')||
    !['customer','approved-platform-recipient'].includes(recipientRecord.ownerType)||
    time(recipientRecord.activeFrom)>now||time(recipientRecord.activeUntil)<=now)
   throw Error('Recipient key unavailable');
 if(recipientRecord.ownerType==='approved-platform-recipient'&&
    (!review.customerRecoveryConsent||!id(review.customerConsentRef,'consent')))
   throw Error('Customer recovery consent required');
 // Independent actor-level permissions, consent attestation and external HSM
 // authorization are mandatory; this result is NEVER itself a decryption grant.
 return Object.freeze({status:'eligible-for-external-authorization',tenantScope,
   actorId,artifactSha256:artifactReceipt.sha256,keyId:recipientRecord.keyId,
   operation,approvedReviewId:review.reviewId,
   custodyAuthorized:false,plaintextReleased:false,importAllowed:false});
}
/** Explicit port shape; no default backend or fallback private key. */
export function assertCustodianPort(port){
 if(!port||typeof port.authorize!=='function'||typeof port.decryptWithinBoundary!=='function'||
    typeof port.audit!=='function')throw Error('External custodian with authorization/decrypt/audit required');
 return port;
}
/** The actual decrypt call is intentionally NOT implemented or dispatched.
 * A production custodian must independently validate session, approval,
 * issuer key, recipient residency and audit transaction before it can operate. */
export async function requestCustodyPreflight(args,{custodian}={}){
 const result=evaluateCustodyRequest(args);
 const port=assertCustodianPort(custodian);
 const decision=await port.authorize(result);
 if(!decision||decision.allowed!==true||decision.tenantScope!==result.tenantScope||
    decision.artifactSha256!==result.artifactSha256||
    decision.keyId!==result.keyId||
    decision.operation!==result.operation)
   throw Error('External custodian declined or altered request');
 await port.audit({event:'gaiz.custody.preflight',tenantScope:result.tenantScope,
   actorId:result.actorId,artifactSha256:result.artifactSha256,keyId:result.keyId});
 return Object.freeze({...result,externalPreflightPassed:true,custodyAuthorized:false});
}
