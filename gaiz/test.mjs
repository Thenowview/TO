import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import { createGaiz, verifyGaiz, decryptGaiz } from './core.mjs';
test('GAIZ round-trip, signature, tampering and tenant rejection', () => {
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const key=randomBytes(32);
  const file=createGaiz({payload:{report:'synthetic',value:1},manifest:{version:1,artifactId:'demo-001',tenantScope:'synthetic-a'},key,privateKey});
  assert.equal(verifyGaiz(file,publicKey).manifest.artifactId,'demo-001');
  assert.deepEqual(decryptGaiz(file,{key,publicKey,tenantScope:'synthetic-a'}),{report:'synthetic',value:1});
  assert.throws(()=>decryptGaiz(file,{key,publicKey,tenantScope:'synthetic-b'}),/denied/);
  assert.throws(()=>decryptGaiz(file,{key:randomBytes(32),publicKey,tenantScope:'synthetic-a'}));
  const altered=Buffer.from(file.toString().replace('demo-001','demo-002'));
  assert.throws(()=>verifyGaiz(altered,publicKey),/signature/);
});
