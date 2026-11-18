import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync, writeFileSync, readFileSync, copyFileSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const script=resolve(new URL('./cli.mjs',import.meta.url).pathname);
function run(args,cwd){
  return spawnSync(process.execPath,[script,...args],{cwd,encoding:'utf8',timeout:30000});
}
test('local GIZE export defaults to .gize; renamed .gaiz remains readable and explicit legacy export works',()=>{
  const dir=mkdtempSync(join(tmpdir(),'gize-cli-test-'));
  try {
    const issuer=generateKeyPairSync('ed25519');
    const recipient=generateKeyPairSync('rsa',{modulusLength:3072});
    writeFileSync(join(dir,'report.json'),JSON.stringify({title:'Synthetic board report',summary:'Demo only'}));
    writeFileSync(join(dir,'issuer.pem'),issuer.privateKey.export({type:'pkcs8',format:'pem'}));
    writeFileSync(join(dir,'issuer-public.pem'),issuer.publicKey.export({type:'spki',format:'pem'}));
    writeFileSync(join(dir,'recipient-public.pem'),recipient.publicKey.export({type:'spki',format:'pem'}));
    writeFileSync(join(dir,'recipient.pem'),recipient.privateKey.export({type:'pkcs8',format:'pem'}));
    const base=['export','--confirm-local-export','--report','report.json','--issuer-private','issuer.pem','--issuer','synthetic-issuer','--tenant','synthetic-a','--artifact-id','synthetic:001','--recipient-id','recipient-a','--recipient-public','recipient-public.pem'];
    let p=run(base,dir);
    assert.equal(p.status,0,p.stderr);
    const result=JSON.parse(p.stdout);
    assert.equal(result.path,'gize-synthetic_001.gize');
    assert.ok(existsSync(join(dir,result.path)));
    assert.equal(readFileSync(join(dir,result.path)).subarray(0,6).toString(),'GAIZ2\n');
    const verify=['verify','--issuer','synthetic-issuer','--tenant','synthetic-a','--trusted-issuer-public','issuer-public.pem'];
    for(const input of [result.path,'legacy.gaiz']){
      if(input==='legacy.gaiz')copyFileSync(join(dir,result.path),join(dir,input));
      const check=run([...verify,'--input',input],dir);
      assert.equal(check.status,0,check.stderr);
      assert.equal(JSON.parse(check.stdout).signatureVerified,true);
    }
    const opened=run(['open','--confirm-local-open','--input','legacy.gaiz','--issuer','synthetic-issuer','--tenant','synthetic-a','--trusted-issuer-public','issuer-public.pem','--recipient-id','recipient-a','--recipient-private','recipient.pem','--output','opened.json'],dir);
    assert.equal(opened.status,0,opened.stderr);
    assert.equal(JSON.parse(readFileSync(join(dir,'opened.json'),'utf8')).title,'Synthetic board report');
    const unapprovedLegacy=run([...base,'--artifact-id','another','--output','legacy-export.gaiz'],dir);
    assert.notEqual(unapprovedLegacy.status,0,'Legacy export requires explicit opt-in');
    const legacy=run([...base,'--artifact-id','another','--output','legacy-export.gaiz','--allow-legacy-extension'],dir);
    assert.equal(legacy.status,0,legacy.stderr);
    assert.ok(existsSync(join(dir,'legacy-export.gaiz')));
    const overwrite=run(base,dir);
    assert.notEqual(overwrite.status,0,'Must not overwrite existing encrypted output');
  } finally {rmSync(dir,{recursive:true,force:true});}
});
