import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyGaiz2} from '../v2.mjs';

const vector=JSON.parse(readFileSync(new URL('./fixtures/gaiz2-synthetic-v1.json',import.meta.url),'utf8'));
const bytes=Buffer.from(vector.artifactBase64,'base64url');
const policy={trustedIssuerPublicKey:vector.issuerPublicKeyPem,expectedIssuerId:vector.expectedManifest.issuerId,expectedTenantScope:vector.expectedManifest.tenantScope};
test('independently produced pinned GAIZ2 bytes verify in TO',()=>{
  assert.equal(createHash('sha256').update(bytes).digest('hex'),vector.sha256);
  const result=verifyGaiz2(bytes,policy);
  assert.deepEqual(result.manifest,vector.expectedManifest);
  assert.equal(result.receipt.signatureVerified,true);
  assert.equal(result.receipt.importAllowed,false);
});
test('pinned fixture tampering and wrong-tenant denial',()=>{
  assert.throws(()=>verifyGaiz2(bytes,{...policy,expectedTenantScope:'other'}),/Tenant denied/);
  const altered=Buffer.from(bytes);
  altered[altered.length-10]^=1;
  assert.throws(()=>verifyGaiz2(altered,policy));
});
