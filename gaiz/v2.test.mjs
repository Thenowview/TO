import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createGaiz2,verifyGaiz2,openGaiz2} from './v2.mjs';

const issuer=generateKeyPairSync('ed25519');
const receiver=generateKeyPairSync('rsa',{modulusLength:3072});
const other=generateKeyPairSync('rsa',{modulusLength:3072});
const manifest={version:2,schemaVersion:1,artifactId:'synthetic-0001',issuerId:'synthetic-issuer',tenantScope:'synthetic-a',contentType:'application/vnd.orgaiz.report+json',createdAt:'2026-11-16T00:00:00.000Z'};
const make=(m=manifest)=>createGaiz2({report:{title:'Synthetic governance report',findings:[{id:1,description:'Demo only'}]},manifest:m,recipients:[{keyId:'user-a',publicKey:receiver.publicKey}],issuerPrivateKey:issuer.privateKey});
const policy={trustedIssuerPublicKey:issuer.publicKey,expectedIssuerId:'synthetic-issuer',expectedTenantScope:'synthetic-a'};
test('round-trip with independent trusted signature and RSA-OAEP recipient',()=>{
 const f=make(),r=verifyGaiz2(f,policy),opened=openGaiz2(f,{...policy,recipientKeyId:'user-a',recipientPrivateKey:receiver.privateKey});
 assert.equal(r.receipt.signatureVerified,true);
 assert.equal(r.receipt.authorizationGranted,false);
 assert.equal(r.receipt.importAllowed,false);
 assert.equal(opened.report.title,'Synthetic governance report');
 assert.notDeepEqual(make(),f); // random DEK and nonce
});
test('wrong tenant/issuer/key rejected',()=>{
 const f=make();
 assert.throws(()=>verifyGaiz2(f,{...policy,expectedTenantScope:'synthetic-b'}),/Tenant denied/);
 assert.throws(()=>verifyGaiz2(f,{...policy,expectedIssuerId:'another'}),/Issuer denied/);
 assert.throws(()=>verifyGaiz2(f,{...policy,trustedIssuerPublicKey:generateKeyPairSync('ed25519').publicKey}),/signature/);
 assert.throws(()=>openGaiz2(f,{...policy,recipientKeyId:'user-a',recipientPrivateKey:other.privateKey}));
 assert.throws(()=>openGaiz2(f,{...policy,recipientKeyId:'missing',recipientPrivateKey:receiver.privateKey}),/Recipient/);
});
test('tampering, malformed encoding, noncanonical and versions rejected',()=>{
 const f=make();
 const body=JSON.parse(f.toString().slice(6));
 for(const mutate of [
  d=>{d.manifest.artifactId='forged';},
  d=>{d.ciphertext=d.ciphertext.slice(0,-1)+(d.ciphertext.endsWith('A')?'B':'A');},
  d=>{d.recipients[0].keyId='forged';}
 ]) {
  const d=structuredClone(body);mutate(d);
  assert.throws(()=>verifyGaiz2(Buffer.from('GAIZ2\n'+JSON.stringify(d)),policy));
 }
 assert.throws(()=>verifyGaiz2(Buffer.from('GAIZ2\n'+JSON.stringify(body)+' '),policy),/Noncanonical/);
 assert.throws(()=>verifyGaiz2(Buffer.from('GAIZ2\n'+JSON.stringify({...body,unexpected:true})),policy));
 assert.throws(()=>createGaiz2({report:{ok:true},manifest:{...manifest,version:3},recipients:[{keyId:'user-a',publicKey:receiver.publicKey}],issuerPrivateKey:issuer.privateKey}),/version/);
 assert.throws(()=>verifyGaiz2(Buffer.alloc(8*1024*1024+1),policy));
});
test('envelope tampering and duplicate recipients are rejected',()=>{
 assert.throws(()=>createGaiz2({report:{},manifest,recipients:[{keyId:'same',publicKey:receiver.publicKey},{keyId:'same',publicKey:receiver.publicKey}],issuerPrivateKey:issuer.privateKey}),/Duplicate/);
 const d=JSON.parse(make().toString().slice(6));d.recipients.push(d.recipients[0]);
 assert.throws(()=>verifyGaiz2(Buffer.from('GAIZ2\n'+JSON.stringify(d)),policy));
});
