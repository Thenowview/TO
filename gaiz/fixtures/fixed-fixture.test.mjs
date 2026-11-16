import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join,dirname } from 'node:path';
import { verifyGaiz2 } from '../v2.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const root=join(here,'v2-fixed-001');
const expected=JSON.parse(readFileSync(join(root,'expected.json'),'utf8'));
const publicKey=readFileSync(join(root,'issuer-public.pem'),'utf8');
const bytes=Buffer.from(readFileSync(join(root,'valid.gaiz.b64'),'utf8').trim(),'base64');
const policy={trustedIssuerPublicKey:publicKey,expectedIssuerId:expected.manifest.issuerId,expectedTenantScope:expected.manifest.tenantScope};
test('fixed independent Python GAIZ2 artifact matches pinned hash, signed bytes, and fail-closed receipt',()=>{
 assert.equal(bytes.length,expected.size);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256);
 const {manifest,receipt}=verifyGaiz2(bytes,policy);
 assert.deepEqual(manifest,expected.manifest);
 assert.equal(receipt.sha256,expected.sha256);
 assert.equal(receipt.signatureVerified,true);
 assert.equal(receipt.authorizationGranted,false);
 assert.equal(receipt.importAllowed,false);
});
test('fixed artifact rejects wrong trusted issuer and tenant; untrusted manifest cannot grant access',()=>{
 assert.throws(()=>verifyGaiz2(bytes,{...policy,expectedIssuerId:'another-issuer'}));
 assert.throws(()=>verifyGaiz2(bytes,{...policy,expectedTenantScope:'another-tenant'}));
 assert.throws(()=>verifyGaiz2(bytes,{...policy,trustedIssuerPublicKey:null}));
 assert.throws(()=>verifyGaiz2(bytes,{...policy,trustedIssuerPublicKey:readFileSync(join(root,'issuer-public.pem'),'utf8').replace('ASKC','AAAA')}));
});
test('fixed artifact rejects modified header, ciphertext, signature, truncated and oversized input',()=>{
 const wrongHeader=Buffer.from(bytes);wrongHeader[4]=49;
 assert.throws(()=>verifyGaiz2(wrongHeader,policy));
 const doc=JSON.parse(bytes.subarray(6).toString('utf8'));
 for(const field of ['ciphertext','signature']){
   const altered=structuredClone(doc);
   altered[field]=(altered[field][0]==='A'?'B':'A')+altered[field].slice(1);
   assert.throws(()=>verifyGaiz2(Buffer.from('GAIZ2\n'+JSON.stringify(altered)),policy));
 }
 assert.throws(()=>verifyGaiz2(bytes.subarray(0,bytes.length-1),policy));
 assert.throws(()=>verifyGaiz2(Buffer.alloc(8*1024*1024+1),policy));
});
