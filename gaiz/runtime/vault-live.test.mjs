// Run only against an explicitly disposable local TLS Vault dev instance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicKey,createHash} from 'node:crypto';
import {createVaultTransit} from './vault-transit.mjs';
import {createGaiz2WithSigner,openGaiz2WithCustodian} from '../v2.mjs';
const origin=process.env.GAIZ_TEST_VAULT_ORIGIN;
if(origin!=='https://127.0.0.1:18200')throw Error('Disposable local TLS Vault required');
const token='synthetic-local-test-only';
async function api(path,body){const r=await fetch(origin+'/v1/'+path,{method:body===undefined?'GET':'POST',headers:{'X-Vault-Token':token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.ok(r.ok,'Vault request '+path+' status '+r.status);return r.status===204?{}:r.json();}
function pub(record,type){const raw=record.keys['1'].public_key;return type==='ed25519'?createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(raw,'base64')]),format:'der',type:'spki'}):createPublicKey(raw);}
const fingerprint=k=>createHash('sha256').update(k.export({type:'spki',format:'der'})).digest('hex');
test('real Vault non-exportable Ed25519 signing and RSA-OAEP-3072 unwrap interoperate with TO',async()=>{
 await api('sys/mounts/transit',{type:'transit'});
 for(const [name,type]of [['gaiz-issuer','ed25519'],['gaiz-recipient','rsa-3072']])await api('transit/keys/'+name,{type,exportable:false,allow_plaintext_backup:false});
 const signing=await api('transit/keys/gaiz-issuer'),recipient=await api('transit/keys/gaiz-recipient');
 const issuerKey=pub(signing.data,'ed25519'),recipientKey=pub(recipient.data,'rsa');
 const issuerRef={name:'gaiz-issuer',version:1,spkiSha256:fingerprint(issuerKey)},recipientRef={name:'gaiz-recipient',version:1,spkiSha256:fingerprint(recipientKey)};
 const custody=createVaultTransit({origin,tokenProvider:async()=>token});
 const report={title:'Vault synthetic report',summary:'مرحبا — synthetic only'};
 const bytes=await createGaiz2WithSigner({report,manifest:{version:2,schemaVersion:1,artifactId:'vault-synthetic-01',issuerId:'issuer-01',tenantScope:'synthetic-tenant',contentType:'application/vnd.orgaiz.report+json',createdAt:new Date().toISOString()},recipients:[{keyId:'recipient-01',publicKey:recipientKey}],signer:b=>custody.sign(b,issuerRef)});
 const opened=await openGaiz2WithCustodian(bytes,{trustedIssuerPublicKey:issuerKey,expectedIssuerId:'issuer-01',expectedTenantScope:'synthetic-tenant',recipientKeyId:'recipient-01',unwrap:b=>custody.unwrap(b,recipientRef)});
 assert.deepEqual(opened.report,report);
 await assert.rejects(custody.sign(Buffer.from('test'),{...issuerRef,spkiSha256:'0'.repeat(64)}));
 // Vault policy forbids exporting either private key.
 for(const name of ['gaiz-issuer','gaiz-recipient']){
  const r=await fetch(origin+'/v1/transit/export/signing-key/'+name,{headers:{'X-Vault-Token':token}});assert.equal(r.ok,false);
 }
});
