import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {signLocalCustodyReceipt,verifyLocalCustodyReceipt} from './custody-attestation.mjs';
const pair=generateKeyPairSync('ed25519');
const now=Date.parse('2026-11-16T12:00:00.000Z');
const data={artifactId:'fixture-1',artifactSha256:'a'.repeat(64),keyId:'customer-1',
 recipientTenant:'tenant-a',reportSha256:'b'.repeat(64),reviewId:'review-a',
 timestamp:'2026-11-16T12:00:00.000Z',validation:'schema-validated-no-import'};
const policy={trustedCustodianPublicKey:pair.publicKey,expectedTenant:'tenant-a',
 expectedArtifactSha256:data.artifactSha256,expectedReviewId:'review-a',now};
test('signed metadata receipt verifies without authorizing import',()=>{
 const receipt=signLocalCustodyReceipt(data,{custodianSigningPrivateKey:pair.privateKey});
 const result=verifyLocalCustodyReceipt(receipt,policy);
 assert.equal(result.verified,true);assert.equal(result.importAllowed,false);
 assert.equal(result.plaintextReleased,false);
});
test('mismatched tenant, tampered report, key and expired receipts denied',()=>{
 const receipt=signLocalCustodyReceipt(data,{custodianSigningPrivateKey:pair.privateKey});
 assert.throws(()=>verifyLocalCustodyReceipt(receipt,{...policy,expectedTenant:'tenant-b'}));
 assert.throws(()=>verifyLocalCustodyReceipt(receipt,{...policy,now:now+300001}));
 assert.throws(()=>verifyLocalCustodyReceipt({...receipt,payload:{...receipt.payload,reportSha256:'c'.repeat(64)}},policy));
 assert.throws(()=>verifyLocalCustodyReceipt(receipt,{...policy,trustedCustodianPublicKey:generateKeyPairSync('ed25519').publicKey}));
});
