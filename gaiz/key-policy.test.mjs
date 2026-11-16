import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createGaiz2} from './v2.mjs';
import {resolveAuthorizedRecipients,verifyGaiz2WithIssuerRecord} from './key-policy.mjs';

const signing=generateKeyPairSync('ed25519'),recipient=generateKeyPairSync('rsa',{modulusLength:3072});
const now=Date.parse('2026-11-16T00:00:00.000Z');
const range={activeFrom:'2026-01-01T00:00:00.000Z',activeUntil:'2027-01-01T00:00:00.000Z',status:'active',tenantScope:'synthetic-a'};
const registry=[{...range,keyId:'customer-01',algorithm:'RSA-OAEP-SHA256',ownerType:'customer',publicKeyPem:recipient.publicKey.export({type:'spki',format:'pem'})}];
const approval={tenantScope:'synthetic-a',approvalId:'approval-01',actorId:'reviewer-01',status:'approved'};
test('approved customer-key recipient policy issues compatible GAIZ2 envelope',()=>{
 const recipients=resolveAuthorizedRecipients({tenantScope:'synthetic-a',recipientIds:['customer-01'],registry,authorization:approval,now});
 const manifest={version:2,schemaVersion:1,artifactId:'demo-01',issuerId:'issuer-01',tenantScope:'synthetic-a',contentType:'application/vnd.orgaiz.report+json',createdAt:'2026-11-16T00:00:00.000Z'};
 const bytes=createGaiz2({report:{title:'Synthetic report',summary:'Demo only'},manifest,recipients,issuerPrivateKey:signing.privateKey});
 const result=verifyGaiz2WithIssuerRecord(bytes,{record:{...range,issuerId:'issuer-01',algorithm:'Ed25519',publicKeyPem:signing.publicKey.export({type:'spki',format:'pem'})},tenantScope:'synthetic-a',now});
 assert.equal(result.receipt.signatureVerified,true);
 assert.equal(result.receipt.importAllowed,false);
});
test('cross-tenant, revoked and expired keys and unconsented recovery are denied',()=>{
 const options={tenantScope:'synthetic-a',recipientIds:['customer-01'],registry,authorization:approval,now};
 assert.throws(()=>resolveAuthorizedRecipients({...options,tenantScope:'synthetic-b'}));
 assert.throws(()=>resolveAuthorizedRecipients({...options,registry:[{...registry[0],status:'revoked'}]}));
 assert.throws(()=>resolveAuthorizedRecipients({...options,now:Date.parse('2028-01-01T00:00:00.000Z')}));
 assert.throws(()=>resolveAuthorizedRecipients({...options,registry:[{...registry[0],ownerType:'approved-platform-recipient'}]}));
 assert.throws(()=>resolveAuthorizedRecipients({...options,authorization:{...approval,status:'pending'}}));
 assert.throws(()=>resolveAuthorizedRecipients({...options,recipientIds:['customer-01','customer-01']}));
});
