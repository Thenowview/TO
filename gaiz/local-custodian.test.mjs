import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createGaiz2,verifyGaiz2 } from './v2.mjs';
import { inspectWithinLocalCustody } from './local-custodian.mjs';

const issuer=generateKeyPairSync('ed25519');
const recipient=generateKeyPairSync('rsa',{modulusLength:3072});
const other=generateKeyPairSync('rsa',{modulusLength:3072});
const manifest={artifactId:'fixture-local-01',issuerId:'synthetic-issuer',
 tenantScope:'synthetic-tenant',contentType:'application/vnd.orgaiz.report+json',
 createdAt:'2026-11-16T12:00:00.000Z',schemaVersion:1,version:2};
const report={title:'Synthetic board report',summary:'Synthetic only',metrics:{a:1},findings:[{id:1,description:'Synthetic'}]};
const bytes=createGaiz2({manifest,report,issuerPrivateKey:issuer.privateKey,
 recipients:[{keyId:'customer-rsa',publicKey:recipient.publicKey}]});
const receipt=verifyGaiz2(bytes,{trustedIssuerPublicKey:issuer.publicKey,
 expectedIssuerId:manifest.issuerId,expectedTenantScope:manifest.tenantScope}).receipt;
const args={
 tenantScope:manifest.tenantScope,issuerId:manifest.issuerId,artifactId:manifest.artifactId,
 actorId:'review-operator',operation:'decrypt-for-approved-preview',
 recipientKeyId:'customer-rsa',artifactReceipt:receipt,
 review:{status:'approved',tenantScope:manifest.tenantScope,sha256:receipt.sha256,
  reviewId:'approval-01',requesterId:'initiator',reviewerId:'reviewer',
  expiresAt:'2027-01-01T00:00:00.000Z'},
 recipientRecord:{status:'active',tenantScope:manifest.tenantScope,
  keyId:'customer-rsa',ownerType:'customer',algorithm:'RSA-OAEP-SHA256',
  activeFrom:'2026-01-01T00:00:00.000Z',activeUntil:'2027-01-01T00:00:00.000Z'},
 now:Date.parse('2026-11-16T13:00:00.000Z'),
};
const options=()=>({request:args,trustedIssuerPublicKey:issuer.publicKey,
 customerPrivateKey:recipient.privateKey,audit:async()=>{}});
test('local customer-held decrypt returns validated hash/shape only, no plaintext',async()=>{
 const orig=process.env.GAIZ_LOCAL_CUSTODY_TEST;
 process.env.GAIZ_LOCAL_CUSTODY_TEST='true';
 try{
  const events=[];
  const result=await inspectWithinLocalCustody(bytes,{...options(),audit:async x=>events.push(x)});
  assert.equal(result.status,'locally-decrypted-and-validated');
  assert.equal(result.importAllowed,false);
  assert.equal(result.plaintextReleased,false);
  assert.equal(result.findingsCount,1);
  assert.equal(events.length,2);
  assert.doesNotMatch(JSON.stringify(result)+JSON.stringify(events),/Synthetic board report|Synthetic only/);
 }finally{if(orig===undefined)delete process.env.GAIZ_LOCAL_CUSTODY_TEST;else process.env.GAIZ_LOCAL_CUSTODY_TEST=orig;}
});
test('wrong key, wrong tenant, bad hash, expired request, absent audit deny',async()=>{
 const orig=process.env.GAIZ_LOCAL_CUSTODY_TEST;
 process.env.GAIZ_LOCAL_CUSTODY_TEST='true';
 try{
  const reject=async o=>assert.rejects(()=>inspectWithinLocalCustody(bytes,{...options(),...o}));
  await reject({customerPrivateKey:other.privateKey});
  await reject({request:{...args,tenantScope:'other'}});
  await reject({request:{...args,artifactReceipt:{...receipt,sha256:'a'.repeat(64)}}});
  await reject({request:{...args,review:{...args.review,status:'pending'}}});
  await reject({audit:async()=>{throw Error('audit offline')}});
  await reject({audit:undefined});
 }finally{if(orig===undefined)delete process.env.GAIZ_LOCAL_CUSTODY_TEST;else process.env.GAIZ_LOCAL_CUSTODY_TEST=orig;}
});
test('local custodian is disabled by default',async()=>{
 const orig=process.env.GAIZ_LOCAL_CUSTODY_TEST;
 delete process.env.GAIZ_LOCAL_CUSTODY_TEST;
 try{await assert.rejects(()=>inspectWithinLocalCustody(bytes,options()),/disabled/);}
 finally{if(orig!==undefined)process.env.GAIZ_LOCAL_CUSTODY_TEST=orig;}
});
