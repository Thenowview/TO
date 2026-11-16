import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {createFileExecutionLedger} from './file-ledger.mjs';
import {workloadTokenProvider} from './workload-token.mjs';
import {signEnvelope,verifyEnvelope,digest,safePatch} from './protocol.mjs';
const pair=generateKeyPairSync('ed25519');
function grant(){const now=Date.now();return {protocol:'gaiz-execution/1',purpose:'approved-field-import',tenantId:randomUUID(),actorId:randomUUID(),authorizationId:randomUUID(),stagingReviewId:randomUUID(),custodyAttemptId:randomUUID(),artifactSha256:'a'.repeat(64),reportSha256:'b'.repeat(64),issuerId:'issuer-1',recipientKeyId:'recipient-1',custodianId:'custodian-1',targetKind:'project',targetId:randomUUID(),revision:0,targetSnapshotSha256:'c'.repeat(64),mappingProfileId:'profile-1',previewSha256:'d'.repeat(64),nonce:randomUUID(),issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+60000).toISOString()};}
test('signed grants reject tampering, wrong keys, overlong TTL, expiration, unknown claims and unsafe patches',async()=>{
 const g=grant(),envelope=await signEnvelope('grant',g,async b=>sign(null,b,pair.privateKey));
 assert.equal(digest(verifyEnvelope('grant',envelope,pair.publicKey)),digest(g));
 assert.throws(()=>verifyEnvelope('grant',envelope,generateKeyPairSync('ed25519').publicKey));
 assert.throws(()=>verifyEnvelope('grant',envelope,pair.publicKey,Date.parse(g.expiresAt)));
 for(const patch of [{tenantId:randomUUID()},{revision:1},{extra:true}])assert.throws(()=>verifyEnvelope('grant',{...envelope,payload:{...g,...patch}},pair.publicKey));
 await assert.rejects(signEnvelope('grant',{...g,expiresAt:new Date(Date.now()+600001).toISOString()},async b=>sign(null,b,pair.privateKey)));
 for(const value of ['<script>x</script>','https://evil.invalid','\u202Ehidden','x'.repeat(161)])assert.throws(()=>safePatch({field:'project.name',value},'project'));
 assert.throws(()=>safePatch({field:'project.budget',value:'1'},'project'));
});
test('file ledger durably rejects concurrent claim and process-restart replay',async()=>{
 const root=await mkdtemp(join(tmpdir(),'gaiz-ledger-'));try{
  const ledger=await createFileExecutionLedger(root),p={tenantId:randomUUID(),nonce:randomUUID(),grantSha256:'a'.repeat(64)};
  const claims=await Promise.allSettled([ledger.claim(p),ledger.claim(p)]);
  assert.equal(claims.filter(x=>x.status==='fulfilled').length,1);
  await assert.rejects((await createFileExecutionLedger(root)).claim(p));
  await ledger.complete(p);await assert.rejects(ledger.complete(p));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('workload token reader rejects unsafe permissions and symlinks, supports rotation',async()=>{
 const root=await mkdtemp(join(tmpdir(),'gaiz-token-'));try{
  const file=join(root,'token');await writeFile(file,'synthetic-token-1\n',{mode:0o600});const read=workloadTokenProvider(file);
  assert.equal(await read(),'synthetic-token-1');await writeFile(file,'synthetic-token-2\n');assert.equal(await read(),'synthetic-token-2');
  await symlink(file,join(root,'link'));await assert.rejects(workloadTokenProvider(join(root,'link'))());
  await writeFile(join(root,'public'),'synthetic',{mode:0o644});await assert.rejects(workloadTokenProvider(join(root,'public'))());
 }finally{await rm(root,{recursive:true,force:true});}
});
