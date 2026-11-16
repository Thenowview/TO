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

test('serialization rejects unpaired surrogates, negative zero, invalid calendar dates and unsafe values',()=>{
 const gen=(report,m=manifest)=>createGaiz2({report,manifest:m,recipients:[{keyId:'user-a',publicKey:receiver.publicKey}],issuerPrivateKey:issuer.privateKey});
 assert.throws(()=>gen({value:String.fromCharCode(0xD800)}),/Unpaired Unicode/);
 assert.throws(()=>gen({[String.fromCharCode(0xDC00)]:1}),/Unpaired Unicode/);
 assert.throws(()=>gen({value:-0}),/Unsupported JSON value/);
 assert.throws(()=>gen({value:1.5}),/Unsupported JSON value/);
 assert.throws(()=>gen({value:BigInt(1)}),/Unsupported JSON value/);
 assert.throws(()=>gen({ok:true},{...manifest,createdAt:'2026-02-30T00:00:00.000Z'}),/Invalid creation time/);
 assert.equal(openGaiz2(gen({nonAscii:'مرحبا 😃',table:{z:1,ä:2,a:3}}),{...policy,recipientKeyId:'user-a',recipientPrivateKey:receiver.privateKey}).report.nonAscii,'مرحبا 😃');
});
test('canonical decoding rejects duplicate keys and noncanonical numeric forms',()=>{
 const file=make().toString();
 const raw=file.slice(6);
 assert.throws(()=>verifyGaiz2(Buffer.from('GAIZ2\\n'+raw.replace('"version":2','"version":2,"version":2')),policy));
 assert.throws(()=>verifyGaiz2(Buffer.from('GAIZ2\\n'+raw.replace('"version":2','"version":2.0')),policy));
 assert.throws(()=>verifyGaiz2(Buffer.from('GAIZ2\\n'+raw.replace('"version":2','"version":-0')),policy));
 assert.throws(()=>verifyGaiz2(Buffer.concat([Buffer.from('GAIZ2\\n'),Buffer.from([0xff])]),policy));
});


test('GAIZ2 rejects noncanonical recipient ordering before signature verification',()=>{
 const file=createGaiz2({
  report:{synthetic:true},manifest,
  recipients:[{keyId:'z-recipient',publicKey:receiver.publicKey},{keyId:'a-recipient',publicKey:other.publicKey}],
  issuerPrivateKey:issuer.privateKey
 });
 const body=JSON.parse(file.subarray(6).toString('utf8'));
 assert.deepEqual(body.recipients.map(x=>x.keyId),['a-recipient','z-recipient']);
 body.recipients.reverse();
 const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
 assert.throws(()=>verifyGaiz2(Buffer.concat([file.subarray(0,6),Buffer.from(canonical(body))]),policy),/noncanonical recipient order/i);
});
