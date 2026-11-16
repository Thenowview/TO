import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,writeFileSync,openSync,closeSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createGaiz2,verifyGaiz2} from './v2.mjs';
import {inspectViaDisposableCustodian} from './custodian-process.mjs';

const issuer=generateKeyPairSync('ed25519');
const receiver=generateKeyPairSync('rsa',{modulusLength:3072});
const wrong=generateKeyPairSync('rsa',{modulusLength:3072});
const m={version:2,schemaVersion:1,artifactId:'disposable-test',issuerId:'issuer-test',
 tenantScope:'synthetic-tenant',contentType:'application/vnd.orgaiz.report+json',
 createdAt:'2026-11-16T00:00:00.000Z'};
const artifact=createGaiz2({report:{title:'Secret synthetic report',summary:'Test only',metrics:{ok:1}},
 manifest:m,recipients:[{keyId:'customer-one',publicKey:receiver.publicKey}],issuerPrivateKey:issuer.privateKey});
const issuerPem=issuer.publicKey.export({type:'spki',format:'pem'});
const receipt=verifyGaiz2(artifact,{trustedIssuerPublicKey:issuer.publicKey,
 expectedIssuerId:m.issuerId,expectedTenantScope:m.tenantScope}).receipt;
const request={tenantScope:m.tenantScope,actorId:'review-operator',artifactId:m.artifactId,
 issuerId:m.issuerId,recipientKeyId:'customer-one',artifactReceipt:receipt,
 review:{reviewId:'review-01',requesterId:'user-01',reviewerId:'user-02',
 status:'approved',tenantScope:m.tenantScope,sha256:receipt.sha256,
 expiresAt:'2099-01-01T00:00:00.000Z'},
 recipientRecord:{status:'active',tenantScope:m.tenantScope,keyId:'customer-one',
 ownerType:'customer',algorithm:'RSA-OAEP-SHA256',
 activeFrom:'2020-01-01T00:00:00.000Z',activeUntil:'2099-01-01T00:00:00.000Z'}};
async function withKey(key,cb){
 const dir=mkdtempSync(join(tmpdir(),'gaiz-disposable-'));
 const path=join(dir,'synthetic-only.pem');
 let fd;
 try {
  writeFileSync(path,key.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});
  fd=openSync(path,'r');
  return await cb(fd);
 } finally{
  if(fd!==undefined)closeSync(fd);
  rmSync(dir,{recursive:true,force:true});
 }
}
async function run(key,opts={}){return withKey(key,fd=>inspectViaDisposableCustodian({
 artifact,request,trustedIssuerPublicKeyPem:issuerPem,customerKeyFd:fd,
 audit:async event=>{if(opts.denyAudit)throw Error('Audit store down');opts.events?.push(event);},
 maxDurationMs:10000,
}));}
test('child process returns only an authenticated, plaintext-free receipt',async()=>{
 const prev=process.env.GAIZ_LOCAL_CUSTODY_TEST;
 process.env.GAIZ_LOCAL_CUSTODY_TEST='true';
 try {
  const events=[];
  const result=await run(receiver.privateKey,{events});
  assert.equal(result.importAllowed,false);
  assert.equal(result.plaintextReleased,false);
  assert.equal(result.quarantinePassed,true);
  assert.equal(events.length,2);
  assert.doesNotMatch(JSON.stringify(result)+JSON.stringify(events),/Secret synthetic report|Test only/);
 } finally{if(prev===undefined)delete process.env.GAIZ_LOCAL_CUSTODY_TEST;else process.env.GAIZ_LOCAL_CUSTODY_TEST=prev;}
});
test('wrong key or denied append-only audit refuses success',async()=>{
 const prev=process.env.GAIZ_LOCAL_CUSTODY_TEST;
 process.env.GAIZ_LOCAL_CUSTODY_TEST='true';
 try {
  await assert.rejects(()=>run(wrong.privateKey));
  await assert.rejects(()=>run(receiver.privateKey,{denyAudit:true}),/audit/i);
 } finally{if(prev===undefined)delete process.env.GAIZ_LOCAL_CUSTODY_TEST;else process.env.GAIZ_LOCAL_CUSTODY_TEST=prev;}
});
test('external custodian is off without explicit local development flag',async()=>{
 const prev=process.env.GAIZ_LOCAL_CUSTODY_TEST;
 delete process.env.GAIZ_LOCAL_CUSTODY_TEST;
 try{await assert.rejects(()=>run(receiver.privateKey),/disabled/);}
 finally{if(prev!==undefined)process.env.GAIZ_LOCAL_CUSTODY_TEST=prev;}
});
