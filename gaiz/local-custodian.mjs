// Local customer-held GAIZ2 decryption compartment (DEVELOPMENT ONLY).
// Trusted application must authenticate review, issuer, actor, recipient and
// consent using authoritative records BEFORE calling this module. This module
// is neither an HSM nor a production customer-vault implementation.
import { openGaiz2, verifyGaiz2 } from './v2.mjs';
import { quarantineGovernanceReport } from './quarantine.mjs';
import { evaluateCustodyRequest } from './custody.mjs';

function deny(message){throw Error(message);}
function eligible(args, bytes, trustedIssuerPublicKey){
 const independentlyVerified=verifyGaiz2(bytes,{
   trustedIssuerPublicKey,
   expectedIssuerId:args.issuerId,
   expectedTenantScope:args.tenantScope,
 }).receipt;
 if(independentlyVerified.sha256!==args.artifactReceipt?.sha256 ||
    independentlyVerified.artifactId!==args.artifactId ||
    independentlyVerified.issuerId!==args.issuerId)
   deny('Artifact or issuer identity mismatch');
 const decision=evaluateCustodyRequest({
   ...args,artifactReceipt:independentlyVerified,
   operation:'decrypt-for-approved-preview',
 });
 if(args.recipientKeyId!==decision.keyId)deny('Recipient identity mismatch');
 return { independentlyVerified,decision };
}
/** The caller provides a customer-owned KeyObject in process memory for a
 * single explicit local operation. No private key is read from environment
 * variables, browser content, HTTP requests, GitHub, AI prompts or source.
 * No decrypted document or DEK is returned, stored, or logged.
 *
 * The audit sink is mandatory; if its pre-operation record cannot be written,
 * the decryption attempt is refused. A second receipt may be recorded on
 * success; lack of that receipt is a control failure to investigate.
 */
export async function inspectWithinLocalCustody(bytes,{
  trustedIssuerPublicKey,customerPrivateKey,request,audit,
}={}){
 if(process.env.NODE_ENV==='production'||process.env.GAIZ_LOCAL_CUSTODY_TEST!=='true')
   deny('Local custody fixture mode disabled');
 if(!Buffer.isBuffer(bytes)||bytes.length>8*1024*1024||bytes.length<8)
   deny('Invalid artifact size');
 if(typeof audit!=='function')deny('Independent append-only audit adapter required');
 if(!customerPrivateKey||customerPrivateKey.type!=='private'||
    customerPrivateKey.asymmetricKeyType!=='rsa'||
    (customerPrivateKey.asymmetricKeyDetails?.modulusLength??0)<3072)
   deny('Customer RSA-3072 private KeyObject required');
 if(!request||!trustedIssuerPublicKey)deny('Verified request and independent issuer key required');
 const {independentlyVerified,decision}=eligible(request,bytes,trustedIssuerPublicKey);
 // Fail closed: the audit event must be durable before key use.
 await audit(Object.freeze({event:'gaiz.local-custody.attempt',
   artifactSha256:decision.artifactSha256,tenantScope:decision.tenantScope,
   approvedReviewId:decision.approvedReviewId,recipientKeyId:decision.keyId,
   actorId:decision.actorId}));
 const {report}=openGaiz2(bytes,{
   trustedIssuerPublicKey,expectedIssuerId:request.issuerId,
   expectedTenantScope:request.tenantScope,
   recipientKeyId:decision.keyId,recipientPrivateKey:customerPrivateKey,
 });
 // A plaintext-free receipt only. JSON serialization is canonical for this
 // current schema, and hash is intended solely as a local comparison identity.
 const quarantine=quarantineGovernanceReport(report);
 const result=Object.freeze({
   status:'locally-decrypted-and-validated',format:'GAIZ2',
   artifactSha256:independentlyVerified.sha256,
   tenantScope:decision.tenantScope,artifactId:request.artifactId,
   reportSha256:quarantine.reportSha256,
   fieldCount:quarantine.fieldCount,metricsCount:quarantine.metricsCount,
   findingsCount:quarantine.findingsCount,quarantinePassed:true,
   plaintextReleased:false,importAllowed:false,authorizationGranted:false,
 });
 await audit(Object.freeze({event:'gaiz.local-custody.validated',
   artifactSha256:result.artifactSha256,reportSha256:result.reportSha256,
   approvedReviewId:decision.approvedReviewId,recipientKeyId:decision.keyId}));
 return result;
}
