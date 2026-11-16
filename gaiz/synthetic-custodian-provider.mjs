// Development-only synthetic GAIZ2 custodian endpoint core. Not a KMS,
// real customer custody or remote decrypt implementation. No artifact bytes,
// secret decryption material or user-controlled report content is accepted.
import {signLocalCustodyReceipt} from './custody-attestation.mjs';
const SHA=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS=['tenantId','reviewId','artifactSha256','recipientKeyId','actorId','operation','custodianId','attemptId'];
function deny(){throw Error('Synthetic custody request refused');}
function strictClaim(c){
 if(!c||Object.getPrototypeOf(c)!==Object.prototype||
    Object.keys(c).sort().join('|')!==FIELDS.slice().sort().join('|'))deny();
 for(const k of ['tenantId','reviewId','actorId','attemptId'])
  if(typeof c[k]!=='string'||!UUID.test(c[k]))deny();
 for(const k of ['recipientKeyId','custodianId'])
  if(typeof c[k]!=='string'||!ID.test(c[k]))deny();
 if(typeof c.artifactSha256!=='string'||!SHA.test(c.artifactSha256)||
    c.operation!=='validate-only-no-import')deny();
 return c;
}
/**
 * The issuer must independently preload signed synthetic validation evidence
 * from a controlled fixture run. No request can supply or override this proof.
 * In-memory replay tracking is for synthetic tests only; never production.
 */
export function createSyntheticCustodianHandler({
 fixtures,custodianId,signingKey,authorizeClient,audit,now=()=>Date.now(),
}={}){
 if(process.env.NODE_ENV!=='development'||process.env.GAIZ_SYNTHETIC_PROVIDER_TEST!=='true')
  deny();
 if(!(fixtures instanceof Map)||!ID.test(custodianId)||!signingKey||
    typeof authorizeClient!=='function'||typeof audit!=='function')deny();
 const used=new Set();
 return async ({claim,peerIdentity}={})=>{
  const c=strictClaim(claim);
  if(c.custodianId!==custodianId)deny();
  if(!(await authorizeClient({peerIdentity,tenantId:c.tenantId,actorId:c.actorId})))deny();
  const identity=[c.tenantId,c.reviewId,c.attemptId].join('|');
  if(used.has(identity))deny();
  // Burn synthetic attempt prior to any signing/audit. Fail closed.
  used.add(identity);
  const fixture=fixtures.get(c.artifactSha256);
  if(!fixture||fixture.synthetic!==true||fixture.tenantId!==c.tenantId||
     fixture.reviewId!==c.reviewId||fixture.recipientKeyId!==c.recipientKeyId||
     !ID.test(fixture.artifactId)||!SHA.test(fixture.reportSha256)||
     fixture.verified!==true||fixture.quarantinePassed!==true)deny();
  await audit(Object.freeze({kind:'synthetic-gaiz-custody-attempt',
    attemptId:c.attemptId,tenantId:c.tenantId,reviewId:c.reviewId,
    artifactSha256:c.artifactSha256,client:peerIdentity}));
  const receipt=signLocalCustodyReceipt({
    artifactId:fixture.artifactId,artifactSha256:c.artifactSha256,
    keyId:c.recipientKeyId,recipientTenant:c.tenantId,
    reportSha256:fixture.reportSha256,reviewId:c.reviewId,
    timestamp:new Date(now()).toISOString(),validation:'schema-validated-no-import',
  },{custodianSigningPrivateKey:signingKey});
  await audit(Object.freeze({kind:'synthetic-gaiz-custody-receipt',
    attemptId:c.attemptId,tenantId:c.tenantId,artifactSha256:c.artifactSha256}));
  return receipt;
 };
}
