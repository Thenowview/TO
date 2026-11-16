import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createGaiz2} from './v2.mjs';
import {createSyntheticCustodianHandler,buildVerifiedSyntheticFixture} from './synthetic-custodian-provider.mjs';
import {verifyLocalCustodyReceipt} from './custody-attestation.mjs';
const tenantId='11111111-1111-4111-8111-111111111111';
const reviewId='22222222-2222-4222-8222-222222222222';
const actorId='33333333-3333-4333-8333-333333333333';
const attemptId='44444444-4444-4444-8444-444444444444';
const issuer=generateKeyPairSync('ed25519');
const recipient=generateKeyPairSync('rsa',{modulusLength:3072});
const signer=generateKeyPairSync('ed25519');
const manifest={version:2,schemaVersion:1,artifactId:'fixture-only',
 issuerId:'synthetic-issuer',tenantScope:tenantId,contentType:'application/vnd.orgaiz.report+json',
 createdAt:'2026-11-16T13:00:00.000Z'};
const artifact=createGaiz2({
 manifest,report:{title:'Synthetic report',summary:'No customer content',metrics:{ok:1}},
 issuerPrivateKey:issuer.privateKey,
 recipients:[{keyId:'test-recipient',publicKey:recipient.publicKey}],
});
const claim={tenantId,reviewId,artifactSha256:null,recipientKeyId:'test-recipient',actorId,
 operation:'validate-only-no-import',custodianId:'synthetic-custodian',attemptId};
async function withFlag(run){
 const prev=process.env.GAIZ_SYNTHETIC_PROVIDER_TEST,mode=process.env.NODE_ENV;
 process.env.NODE_ENV='development';process.env.GAIZ_SYNTHETIC_PROVIDER_TEST='true';
 try{return await run();}finally{
  if(prev===undefined)delete process.env.GAIZ_SYNTHETIC_PROVIDER_TEST;else process.env.GAIZ_SYNTHETIC_PROVIDER_TEST=prev;
  if(mode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=mode;
 }
}
test('validated fixture signs metadata-only receipt, refuses replay',()=>withFlag(async()=>{
 const fixture=buildVerifiedSyntheticFixture({artifact,tenantId,reviewId,issuerId:manifest.issuerId,
 recipientKeyId:'test-recipient',recipientPrivateKey:recipient.privateKey,
 trustedIssuerPublicKey:issuer.publicKey});
 const events=[];
 const handler=createSyntheticCustodianHandler({
  fixtures:new Map([[fixture.artifactSha256,fixture]]),
  custodianId:'synthetic-custodian',signingKey:signer.privateKey,
  authorizeClient:async({peerIdentity})=>peerIdentity==='synthetic-client',
  audit:async event=>events.push(event),now:()=>Date.parse('2026-11-16T13:02:00.000Z'),
 });
 const req={...claim,artifactSha256:fixture.artifactSha256};
 const receipt=await handler({claim:req,peerIdentity:'synthetic-client'});
 const verified=verifyLocalCustodyReceipt(receipt,{
   trustedCustodianPublicKey:signer.publicKey,expectedTenant:tenantId,
   expectedArtifactSha256:fixture.artifactSha256,expectedReviewId:reviewId,
   now:Date.parse('2026-11-16T13:02:01.000Z'),
 });
 assert.equal(verified.importAllowed,false);
 assert.equal(verified.plaintextReleased,false);
 assert.equal(events.length,2);
 assert.doesNotMatch(JSON.stringify(receipt),/Synthetic report|No customer content/);
 await assert.rejects(()=>handler({claim:req,peerIdentity:'synthetic-client'}),/refused/);
 await assert.rejects(()=>handler({claim:{...req,attemptId:'55555555-5555-4555-8555-555555555555'},peerIdentity:'attacker'}),/refused/);
 await assert.rejects(()=>handler({claim:{...req,attemptId:'66666666-6666-4666-8666-666666666666',tenantId:'77777777-7777-4777-8777-777777777777'},peerIdentity:'synthetic-client'}),/refused/);
}));
test('audit denial refuses signature and burns synthetic attempt',()=>withFlag(async()=>{
 const fixture=buildVerifiedSyntheticFixture({artifact,tenantId,reviewId,issuerId:manifest.issuerId,
 recipientKeyId:'test-recipient',recipientPrivateKey:recipient.privateKey,
 trustedIssuerPublicKey:issuer.publicKey});
 const handler=createSyntheticCustodianHandler({fixtures:new Map([[fixture.artifactSha256,fixture]]),
  custodianId:'synthetic-custodian',signingKey:signer.privateKey,
  authorizeClient:async()=>true,audit:async()=>{throw Error('audit unavailable');}});
 const req={...claim,artifactSha256:fixture.artifactSha256};
 await assert.rejects(()=>handler({claim:req,peerIdentity:'synthetic-client'}),/audit unavailable/);
 await assert.rejects(()=>handler({claim:req,peerIdentity:'synthetic-client'}),/refused/);
}));
test('provider disabled without explicit development flag',async()=>{
 const previous=process.env.GAIZ_SYNTHETIC_PROVIDER_TEST;
 delete process.env.GAIZ_SYNTHETIC_PROVIDER_TEST;
 try{assert.throws(()=>createSyntheticCustodianHandler({}),/refused/);}
 finally{if(previous!==undefined)process.env.GAIZ_SYNTHETIC_PROVIDER_TEST=previous;}
});
