// Development-only signed GAIZ2 mapping preview receipt. No key or plaintext.
// Only a separately authenticated, isolated custody process may issue this.
import {sign,createPrivateKey} from 'node:crypto';
const DOMAIN='GAIZ2-MAPPING-PREVIEW\n';
const H=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS=['tenantId','stagingReviewId','artifactSha256','reportSha256',
 'targetId','targetKind','targetSnapshotSha256','revision','mappingProfileId',
 'previewSha256','custodianId','issuedAt','expiresAt','purpose'];
function encode(p){
 if(!p||Object.getPrototypeOf(p)!==Object.prototype||
    Object.keys(p).sort().join('|')!==FIELDS.slice().sort().join('|'))
    throw Error('Unsupported mapping receipt fields');
 for(const k of ['tenantId','stagingReviewId','targetId'])
   if(typeof p[k]!=='string'||!UUID.test(p[k]))throw Error('Invalid mapping identity');
 for(const k of ['artifactSha256','reportSha256','targetSnapshotSha256','previewSha256'])
   if(typeof p[k]!=='string'||!H.test(p[k]))throw Error('Invalid mapping hash');
 for(const k of ['mappingProfileId','custodianId'])
   if(typeof p[k]!=='string'||!ID.test(p[k]))throw Error('Invalid directory key');
 if(!['project','portfolio'].includes(p.targetKind)||!Number.isSafeInteger(p.revision)||p.revision<0||
    p.purpose!=='metadata-preview-only')throw Error('Forbidden mapping purpose');
 const issued=Date.parse(p.issuedAt),expiry=Date.parse(p.expiresAt);
 if(!Number.isFinite(issued)||!Number.isFinite(expiry)||
    new Date(issued).toISOString()!==p.issuedAt||
    new Date(expiry).toISOString()!==p.expiresAt||
    expiry<=issued||expiry-issued>300000)throw Error('Invalid mapping window');
 return Buffer.from(DOMAIN+JSON.stringify(Object.fromEntries(Object.keys(p).sort().map(k=>[k,p[k]]))));
}
export function signMappingPreviewReceipt(payload,{custodianSigningPrivateKey}={}){
 if(process.env.NODE_ENV==='production'||process.env.GAIZ_LOCAL_CUSTODY_TEST!=='true')
  throw Error('Local mapping receipt signer disabled');
 if(!custodianSigningPrivateKey)throw Error('Independent Ed25519 signer required');
 const key=custodianSigningPrivateKey?.type==='private'?
   custodianSigningPrivateKey:createPrivateKey(custodianSigningPrivateKey);
 if(key.asymmetricKeyType!=='ed25519')throw Error('Custodian must use Ed25519');
 return Object.freeze({payload:Object.freeze({...payload}),
  signature:sign(null,encode(payload),key).toString('base64url')});
}
