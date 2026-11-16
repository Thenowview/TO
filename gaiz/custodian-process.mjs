// Parent-side proof-of-concept launcher; no private-key bytes cross IPC.
// Requires a pre-opened local customer key FD, rather than any browser/API key.
// Does not provide OS isolation, attestation, chroot, seccomp or durable audits.
import {fork} from 'node:child_process';
const WORKER=new URL('./custodian-worker.mjs',import.meta.url);
export async function inspectViaDisposableCustodian({
  artifact,request,trustedIssuerPublicKeyPem,customerKeyFd,audit,
  maxDurationMs=15000,
}={}){
 if(process.env.NODE_ENV!=='development'||process.env.GAIZ_LOCAL_CUSTODY_TEST!=='true')
  throw Error('Disposable custodian is disabled');
 if(!Buffer.isBuffer(artifact)||artifact.length>768*1024||artifact.length<8||
    !Number.isInteger(customerKeyFd)||customerKeyFd<3||
    typeof trustedIssuerPublicKeyPem!=='string'||typeof audit!=='function'||
    !Number.isSafeInteger(maxDurationMs)||maxDurationMs<100||maxDurationMs>30000)
  throw Error('Invalid disposable custodian request');
 return await new Promise((resolve,reject)=>{
  const child=fork(WORKER,[],{
   stdio:['ignore','ignore','ignore','ipc',customerKeyFd],
   env:{NODE_ENV:'development',GAIZ_LOCAL_CUSTODY_TEST:'true'},
   execArgv:[],
  });
  let settled=false,ackPending=false;
  const finish=(error,result)=>{
   if(settled)return;
   settled=true;clearTimeout(timer);
   child.kill();
   error?reject(error):resolve(result);
  };
  const timer=setTimeout(()=>finish(Error('Custodian deadline exceeded')),maxDurationMs);
  child.on('error',()=>finish(Error('Custodian startup failed')));
  child.on('exit',()=>finish(Error('Custodian exited without receipt')));
  child.on('message',async msg=>{
   if(settled)return;
   if(msg?.kind==='audit'){
    if(ackPending||!Number.isSafeInteger(msg.sequence)||msg.sequence<1||msg.sequence>2)
      return finish(Error('Invalid audit sequence'));
    ackPending=true;
    let ok=false;
    try {await audit(msg.event);ok=true;} catch {}
    ackPending=false;
    if(!settled)child.send({kind:'audit-ack',sequence:msg.sequence,ok});
    if(!ok)finish(Error('Custodian audit failed'));
   }else if(msg?.kind==='result'){
    if(msg.receipt?.importAllowed!==false||msg.receipt?.plaintextReleased!==false||
       msg.receipt?.quarantinePassed!==true)
      return finish(Error('Invalid custodian receipt'));
    finish(null,Object.freeze({...msg.receipt}));
   }else finish(Error('Custodian rejected request'));
  });
  child.send({kind:'inspect',artifactBase64url:artifact.toString('base64url'),
    trustedIssuerPublicKeyPem,request});
 });
}
