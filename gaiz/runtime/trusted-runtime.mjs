// Dedicated TO worker only. Never register in TEFE, extension or public API.
import {createHash,createPublicKey} from 'node:crypto';
import {openGaiz2WithCustodian} from '../v2.mjs';
import {quarantineGovernanceReport} from '../quarantine.mjs';
import {verifyEnvelope,signEnvelope,digest} from './protocol.mjs';
import {previewGaizFieldMapping} from './mapping-preview.mjs';
const deny=()=>{throw Error('GAIZ trusted execution denied')};
function active(r,tenant,now){
 if(!r||r.tenantId!==tenant||r.status!=='active'||!Number.isFinite(now)||!Number.isFinite(Date.parse(r.validFrom))||!Number.isFinite(Date.parse(r.validUntil))||now<Date.parse(r.validFrom)||now>=Date.parse(r.validUntil))deny();
}
function publicKey(r){const key=createPublicKey(r.publicKeyPem);if(key.asymmetricKeyType!=='ed25519'||createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex')!==r.spkiSha256)deny();return key;}
export function createTrustedGaizRuntime({grantPublicKey,policyStore,custody,ledger,clock=Date.now}={}){
 if(!grantPublicKey||typeof policyStore?.load!=='function'||typeof custody?.unwrap!=='function'||typeof custody?.sign!=='function'||typeof ledger?.claim!=='function'||typeof ledger?.complete!=='function')deny();
 // Pin the grant signing key at construction; no per-request key overrides.
 const trustedGrantKey=grantPublicKey.type==='public'?grantPublicKey:createPublicKey(grantPublicKey);
 if(trustedGrantKey.asymmetricKeyType!=='ed25519')deny();
 return Object.freeze({async execute({grant:envelope,artifact,snapshot}={}){
  const grant=verifyEnvelope('grant',envelope,trustedGrantKey,clock());
  if(!Buffer.isBuffer(artifact)||artifact.length>8*1024*1024||createHash('sha256').update(artifact).digest('hex')!==grant.artifactSha256)deny();
  // Snapshot is signed indirectly by the grant fingerprint and exact revision.
  if(digest(snapshot)!==grant.targetSnapshotSha256||snapshot.tenantId!==grant.tenantId||snapshot.id!==grant.targetId||snapshot.kind!==grant.targetKind||snapshot.revision!==grant.revision)deny();
  const p=await policyStore.load({tenantId:grant.tenantId,issuerId:grant.issuerId,recipientKeyId:grant.recipientKeyId,custodianId:grant.custodianId});
  for(const r of [p?.issuer,p?.recipient,p?.custodian])active(r,grant.tenantId,clock());
  if(p.issuer.keyId!==grant.issuerId||p.recipient.keyId!==grant.recipientKeyId||p.custodian.keyId!==grant.custodianId||p.recipient.algorithm!=='RSA-OAEP-SHA256'||p.custodian.algorithm!=='Ed25519'||p.issuer.algorithm!=='Ed25519')deny();
  if(p.recipient.ownerType==='platform'){
   const c=p.consent;
   if(!c||c.tenantId!==grant.tenantId||c.recipientKeyId!==grant.recipientKeyId||c.status!=='approved'||c.purpose!=='approved-field-import'||!c.approvedBy||c.approvedBy===c.requestedBy||!Number.isFinite(Date.parse(c.expiresAt))||Date.parse(c.expiresAt)<=clock())deny();
  }else if(p.recipient.ownerType!=='customer')deny();
  const issuerKey=publicKey(p.issuer),custodianKey=publicKey(p.custodian);
  // Must be durable, atomic and single-use BEFORE key use; failures consume nonce.
  await ledger.claim({tenantId:grant.tenantId,nonce:grant.nonce,grantSha256:digest(grant)});
  const {report}=await openGaiz2WithCustodian(artifact,{
   trustedIssuerPublicKey:issuerKey,expectedIssuerId:grant.issuerId,expectedTenantScope:grant.tenantId,
   recipientKeyId:grant.recipientKeyId,unwrap:bytes=>custody.unwrap(bytes,p.recipient.custodyRef),
  });
  const quarantine=quarantineGovernanceReport(report);
  if(quarantine.reportSha256!==grant.reportSha256)deny();
  const preview=previewGaizFieldMapping({tenantId:grant.tenantId,report,snapshot,
   custodyReceipt:{reportSha256:grant.reportSha256,artifactSha256:grant.artifactSha256,tenantId:grant.tenantId,validated:true},
   mappingProfile:{profileId:grant.mappingProfileId,tenantId:grant.tenantId,targetKind:grant.targetKind,approved:true,fieldMappings:[grant.targetKind==='project'?'project.name':'portfolio.description']}});
  if(preview.previewSha256!==grant.previewSha256)deny();
  // The patch goes only over the authenticated server-to-server boundary.
  const result={grant,grantSha256:digest(grant),patch:{field:grant.targetKind==='project'?'project.name':'portfolio.description',value:grant.targetKind==='project'?report.title:report.summary},executedAt:new Date(clock()).toISOString()};
  // Re-read policy immediately before attestation; revoked/expired keys fail closed.
  const current=await policyStore.load({tenantId:grant.tenantId,issuerId:grant.issuerId,recipientKeyId:grant.recipientKeyId,custodianId:grant.custodianId});
  if(digest(current)!==digest(p))deny();
  for(const r of [current.issuer,current.recipient,current.custodian])active(r,grant.tenantId,clock());
  const signed=await signEnvelope('result',result,bytes=>custody.sign(bytes,p.custodian.custodyRef));
  verifyEnvelope('result',signed,custodianKey,clock());
  await ledger.complete({tenantId:grant.tenantId,nonce:grant.nonce,grantSha256:digest(grant)});
  return signed;
 }});
}
