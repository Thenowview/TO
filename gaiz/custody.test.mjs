import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCustodyRequest,requestCustodyPreflight} from './custody.mjs';
const now=Date.parse('2026-11-16T12:00:00.000Z');
const args={
 tenantScope:'synthetic-a',actorId:'operator-a',operation:'decrypt-for-approved-preview',now,
 artifactReceipt:{signatureVerified:true,sha256:'a'.repeat(64),tenantScope:'synthetic-a'},
 review:{reviewId:'review-1',requesterId:'requester-a',reviewerId:'reviewer-b',
  status:'approved',tenantScope:'synthetic-a',sha256:'a'.repeat(64),expiresAt:'2026-11-17T12:00:00.000Z'},
 recipientRecord:{keyId:'customer-key-1',ownerType:'customer',status:'active',
  tenantScope:'synthetic-a',algorithm:'RSA-OAEP-SHA256',
  activeFrom:'2026-01-01T00:00:00.000Z',activeUntil:'2027-01-01T00:00:00.000Z'}
};
test('eligible policy never grants decryption, import or plaintext release',()=>{
 const x=evaluateCustodyRequest(args);
 assert.equal(x.custodyAuthorized,false);
 assert.equal(x.plaintextReleased,false);
 assert.equal(x.importAllowed,false);
});
test('tenant, signature, reviewer, expiry, key revocation, consent deny',()=>{
 const bad=[
  {tenantScope:'other'},
  {artifactReceipt:{...args.artifactReceipt,signatureVerified:false}},
  {review:{...args.review,requesterId:'reviewer-b'}},
  {review:{...args.review,expiresAt:'2025-01-01T00:00:00.000Z'}},
  {recipientRecord:{...args.recipientRecord,status:'revoked'}},
  {recipientRecord:{...args.recipientRecord,tenantScope:'other'}},
  {recipientRecord:{...args.recipientRecord,ownerType:'approved-platform-recipient'}},
  {operation:'import-to-enterprise'}
 ];
 for(const override of bad)assert.throws(()=>evaluateCustodyRequest({...args,...override}));
});
test('external custodian preflight is separate and refuses mismatched attestations',async()=>{
 let audited=0;
 const custodian={
  authorize:async x=>({allowed:true,tenantScope:x.tenantScope,
    artifactSha256:x.artifactSha256,keyId:x.keyId,operation:x.operation}),
  decryptWithinBoundary:()=>{throw Error('must not be called')},
  audit:async ()=>{audited++;}
 };
 const result=await requestCustodyPreflight(args,{custodian});
 assert.equal(result.externalPreflightPassed,true);
 assert.equal(result.custodyAuthorized,false);
 assert.equal(audited,1);
 await assert.rejects(()=>requestCustodyPreflight(args,{
  custodian:{...custodian,authorize:async()=>({allowed:true,tenantScope:'other'})}
 }));
});
