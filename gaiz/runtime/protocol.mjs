// TO→TEBE execution profile 1. No HTTP body may provide trust keys or provider ports.
import {createHash,createPublicKey,verify} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/,HASH=/^[a-f0-9]{64}$/;
export const grantFields=Object.freeze(['protocol','tenantId','actorId','authorizationId','stagingReviewId','custodyAttemptId','artifactSha256','reportSha256','issuerId','recipientKeyId','custodianId','targetKind','targetId','revision','targetSnapshotSha256','mappingProfileId','previewSha256','nonce','issuedAt','expiresAt','purpose']);
const deny=()=>{throw Error('GAIZ execution protocol denied')};
export function canonical(v,depth=0){
 if(depth>16)deny();
 if(v===null||typeof v==='boolean')return JSON.stringify(v);
 if(typeof v==='number'&&Number.isSafeInteger(v)&&!Object.is(v,-0))return JSON.stringify(v);
 if(typeof v==='string'){
  if(v.length>65536||/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v))deny();
  return JSON.stringify(v);
 }
 if(Array.isArray(v)&&v.length<=100)return '['+v.map(x=>canonical(x,depth+1)).join(',')+']';
 if(v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length<=100){
  const ks=Object.keys(v).sort();if(ks.some(k=>['__proto__','constructor','prototype'].includes(k)))deny();
  return '{'+ks.map(k=>canonical(k)+':'+canonical(v[k],depth+1)).join(',')+'}';
 }deny();
}
export const digest=v=>createHash('sha256').update(canonical(v)).digest('hex');
function exact(v,fields){if(!v||Object.getPrototypeOf(v)!==Object.prototype||Object.keys(v).sort().join('|')!==fields.slice().sort().join('|'))deny();}
export function validateGrant(p,now=Date.now()){
 exact(p,grantFields);
 if(p.protocol!=='gaiz-execution/1'||p.purpose!=='approved-field-import'||!Number.isFinite(now))deny();
 for(const k of ['tenantId','actorId','authorizationId','stagingReviewId','custodyAttemptId','targetId','nonce'])if(typeof p[k]!=='string'||!UUID.test(p[k]))deny();
 for(const k of ['artifactSha256','reportSha256','targetSnapshotSha256','previewSha256'])if(typeof p[k]!=='string'||!HASH.test(p[k]))deny();
 for(const k of ['issuerId','recipientKeyId','custodianId','mappingProfileId'])if(typeof p[k]!=='string'||!ID.test(p[k]))deny();
 if(!['project','portfolio'].includes(p.targetKind)||!Number.isSafeInteger(p.revision)||p.revision<0||p.revision>=2147483647)deny();
 const a=Date.parse(p.issuedAt),b=Date.parse(p.expiresAt);
 if(!Number.isFinite(a)||!Number.isFinite(b)||new Date(a).toISOString()!==p.issuedAt||new Date(b).toISOString()!==p.expiresAt||b<=a||b-a>300000||now<a||now>=b)deny();
 return p;
}
export function safePatch(p,kind){
 exact(p,['field','value']);const field=kind==='project'?'project.name':'portfolio.description';
 if(p.field!==field||typeof p.value!=='string'||!p.value.trim()||p.value.length>(kind==='project'?160:4000)||/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]|<\/?[a-z][^>]*>|(?:javascript|vbscript|file)\s*:|https?:\/\/|www\./iu.test(p.value))deny();
 canonical(p);return p;
}
export function signingBytes(kind,p){
 if(!['grant','result'].includes(kind))deny();
 return Buffer.from('GAIZ2-EXECUTION-'+kind.toUpperCase()+'\n'+canonical(p));
}
export async function signEnvelope(kind,p,signer){
 if(kind==='grant')validateGrant(p);else validateResult(p);
 if(typeof signer!=='function')deny();
 const payload=JSON.parse(canonical(p));
 const signature=await signer(signingBytes(kind,payload));
 if(!Buffer.isBuffer(signature)||signature.length!==64)deny();
 return {payload,signature:signature.toString('base64url')};
}
function validateResult(p,now=Date.now()){
 exact(p,['grant','grantSha256','patch','executedAt']);validateGrant(p.grant,now);
 if(p.grantSha256!==digest(p.grant))deny();safePatch(p.patch,p.grant.targetKind);
 const at=Date.parse(p.executedAt);
 if(!Number.isFinite(at)||new Date(at).toISOString()!==p.executedAt||at<Date.parse(p.grant.issuedAt)||at>now)deny();
 return p;
}
export function verifyEnvelope(kind,envelope,key,now=Date.now()){
 exact(envelope,['payload','signature']);
 if(kind==='grant')validateGrant(envelope.payload,now);else if(kind==='result')validateResult(envelope.payload,now);else deny();
 if(typeof envelope.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(envelope.signature))deny();
 const pub=key?.type==='public'?key:createPublicKey(key),sig=Buffer.from(envelope.signature,'base64url');
 if(pub.asymmetricKeyType!=='ed25519'||sig.length!==64||sig.toString('base64url')!==envelope.signature||!verify(null,signingBytes(kind,envelope.payload),pub,sig))deny();
 return JSON.parse(canonical(envelope.payload));
}
