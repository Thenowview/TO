// Disposable local-only subprocess. This is NOT a security sandbox or KMS.
// Worker receives the customer-held key through dedicated inherited fd 4;
// it never places the private key, DEK or decrypted report on IPC/stdout.
import {readFileSync} from 'node:fs';
import {createPrivateKey,createPublicKey} from 'node:crypto';
import {inspectWithinLocalCustody} from './local-custodian.mjs';
const deny=()=>{process.send?.({kind:'failed'},()=>process.exit(1));};
if(process.env.NODE_ENV!=='development'||process.env.GAIZ_LOCAL_CUSTODY_TEST!=='true'||!process.send)
 throw Error('Isolated local custody worker unavailable');
let active=false,sequence=0,resolveAudit;
process.on('message',async message=>{
 if(message?.kind==='audit-ack'&&resolveAudit){
  const fn=resolveAudit;resolveAudit=null;
  fn(message.sequence===sequence&&message.ok===true);
  return;
 }
 if(active||message?.kind!=='inspect')return deny();
 active=true;
 try {
  if(typeof message.artifactBase64url!=='string'||message.artifactBase64url.length>1048576)
    throw Error('Artifact too large');
  const bytes=Buffer.from(message.artifactBase64url,'base64url');
  if(bytes.toString('base64url')!==message.artifactBase64url)throw Error('Invalid input');
  // File descriptor 4 is established by the trusted local launcher, never
  // selected by the untrusted artifact or JSON request.
  const keyPem=readFileSync(4,{encoding:'utf8'});
  if(keyPem.length>16384)throw Error('Key input too large');
  const customerPrivateKey=createPrivateKey(keyPem);
  const trustedIssuerPublicKey=createPublicKey(message.trustedIssuerPublicKeyPem);
  const audit=event=>new Promise((resolve,reject)=>{
   sequence+=1;
   resolveAudit=ok=>ok?resolve():reject(Error('Audit denied'));
   process.send({kind:'audit',sequence,event});
  });
  const result=await inspectWithinLocalCustody(bytes,{
   customerPrivateKey,trustedIssuerPublicKey,request:message.request,audit
  });
  process.send({kind:'result',receipt:result},()=>process.exit(0));
 }catch{
  deny();
 }
});
