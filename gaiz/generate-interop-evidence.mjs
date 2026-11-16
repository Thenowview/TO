// Development-only interoperability evidence generator.
// Generates fresh synthetic keys in memory; writes only PUBLIC verification material.
// Output bytes intentionally vary: each artifact has a fresh DEK and nonce.
// Do not mistake this reproducible *test procedure* for frozen conformance vectors.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { createGaiz2, verifyGaiz2, openGaiz2 } from './v2.mjs';

const dir = resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6) || mkdtempSync(join(tmpdir(),'gaiz2-evidence-')));
mkdirSync(dir,{recursive:true});
const issuer=generateKeyPairSync('ed25519');
const recipient=generateKeyPairSync('rsa',{modulusLength:3072});
const other=generateKeyPairSync('ed25519');
const manifest={version:2,schemaVersion:1,artifactId:'synthetic-interop-1',issuerId:'synthetic-issuer',tenantScope:'synthetic-a',contentType:'application/vnd.orgaiz.report+json',createdAt:'2026-11-16T00:00:00.000Z'};
const report={title:'Synthetic interop report',items:[{id:1,approved:false}]};
const signed=createGaiz2({report,manifest,recipients:[{keyId:'synthetic-recipient',publicKey:recipient.publicKey}],issuerPrivateKey:issuer.privateKey});
const issuerPublic=issuer.publicKey.export({type:'spki',format:'pem'}).toString();
const policy={trustedIssuerPublicKey:issuer.publicKey,expectedIssuerId:manifest.issuerId,expectedTenantScope:manifest.tenantScope};
const verified=verifyGaiz2(signed,policy);
if(verified.receipt.authorizationGranted || verified.receipt.importAllowed || !verified.receipt.signatureVerified)throw Error('Unsafe verification receipt');
const opened=openGaiz2(signed,{...policy,recipientKeyId:'synthetic-recipient',recipientPrivateKey:recipient.privateKey}).report;
if(opened.title!==report.title || opened.items?.length!==1 || opened.items[0].id!==1 || opened.items[0].approved!==false)throw Error('Round trip mismatch');
const forged=Buffer.from(signed);
const pos=forged.indexOf(Buffer.from('synthetic-interop-1'));
if(pos<0)throw Error('Synthetic artifact ID missing');
forged[pos]=forged[pos]===115?116:115;
const scenarios=[
  ['valid','accept',signed,policy],
  ['tampered','reject',forged,policy],
  ['wrong-issuer','reject',signed,{...policy,trustedIssuerPublicKey:other.publicKey}],
  ['wrong-tenant','reject',signed,{...policy,expectedTenantScope:'synthetic-b'}],
  ['unknown-version','reject',Buffer.from('GAIZ3\\n{}'.replace('\\n','\n')),policy],
  ['corrupted-json','reject',Buffer.from('GAIZ2\\n{'.replace('\\n','\n')),policy],
  ['oversized','reject',Buffer.alloc(8*1024*1024+1),policy],
];
const results=[];
for(const [name,expected,bytes,check] of scenarios){
 let outcome='accept';try{verifyGaiz2(bytes,check)}catch{outcome='reject'}
 if(outcome!==expected)throw Error('Unexpected '+name+': '+outcome);
 if(bytes.length<=32*1024)writeFileSync(join(dir,name+'.gaiz.b64'),bytes.toString('base64')+'\n');
 results.push({name,expected,outcome,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,artifactFile:bytes.length<=32*1024?name+'.gaiz.b64':null});
}
writeFileSync(join(dir,'trusted-issuer-public.pem'),issuerPublic);
writeFileSync(join(dir,'receipt.json'),JSON.stringify({format:'GAIZ2',testOnly:true,issuerKeyProvenance:'synthetic runtime-generated',issuerId:manifest.issuerId,tenantScope:manifest.tenantScope,manifest,results,authorizationGranted:false,importAllowed:false},null,2)+'\n');
console.log(JSON.stringify({directory:dir,scenarioCount:results.length,passed:results.every(x=>x.outcome===x.expected)},null,2));
