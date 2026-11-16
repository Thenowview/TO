// Generate ephemeral synthetic interoperability fixtures for independent runtimes.
// Private keys are created into a CI temp directory and MUST NOT be committed.
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {createGaiz2} from '../v2.mjs';
const root=process.argv[2] || mkdtempSync(join(tmpdir(),'gaiz-conformance-'));
const issuer=generateKeyPairSync('ed25519');
const recipient=generateKeyPairSync('rsa',{modulusLength:3072});
const manifest={version:2,schemaVersion:1,artifactId:'synthetic-interop-01',issuerId:'test-issuer',tenantScope:'synthetic-tenant',contentType:'application/vnd.orgaiz.report+json',createdAt:'2026-11-16T00:00:00.000Z'};
const report={title:'Synthetic governance report',summary:'مرحبا — demo 😃',metrics:{completed:3,pending:1}};
const file=createGaiz2({report,manifest,recipients:[{keyId:'test-recipient',publicKey:recipient.publicKey}],issuerPrivateKey:issuer.privateKey});
const write=(name,buf)=>writeFileSync(join(root,name),buf,{flag:'wx',mode:0o600});
write('valid.gaiz',file);
write('issuer-public.pem',issuer.publicKey.export({type:'spki',format:'pem'}));
write('recipient-private.pem',recipient.privateKey.export({type:'pkcs8',format:'pem'}));
write('expected.json',JSON.stringify({manifest,report,sha256:createHash('sha256').update(file).digest('hex')}));
const altered=JSON.parse(file.subarray(6).toString('utf8'));
altered.manifest.artifactId='tampered';
write('tampered.gaiz',Buffer.from('GAIZ2\n'+JSON.stringify(altered)));
write('wrong-magic.gaiz',Buffer.concat([Buffer.from('GAIZ1\n'),file.subarray(6)]));
process.stdout.write('Created synthetic fixtures in '+root+'\n');
