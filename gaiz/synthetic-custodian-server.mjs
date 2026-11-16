// Development-only mTLS listener for synthetic GAIZ2 validation receipts.
// Never deploy as production. No customer keys or encrypted artifact inputs.
// Provision certificates and a preverified synthetic fixture Map OUTSIDE code.
import https from 'node:https';
import {createSyntheticCustodianHandler} from './synthetic-custodian-provider.mjs';
function deny(){throw Error('Synthetic GAIZ mTLS server disabled');}
export function createSyntheticCustodianServer({
 tlsServerIdentity,clientCA,fixtures,custodianId,signingKey,
 authorizeClient,audit,host='127.0.0.1',port=0,
}={}){
 if(process.env.NODE_ENV!=='development'||process.env.GAIZ_SYNTHETIC_PROVIDER_TEST!=='true')
  deny();
 if(host!=='127.0.0.1'||!Number.isSafeInteger(port)||port<0||port>65535||
    !tlsServerIdentity?.key||!tlsServerIdentity?.cert||!clientCA)
  deny();
 const handler=createSyntheticCustodianHandler({
  fixtures,custodianId,signingKey,authorizeClient,audit,
 });
 const server=https.createServer({
  key:tlsServerIdentity.key,cert:tlsServerIdentity.cert,
  ca:clientCA,requestCert:true,rejectUnauthorized:true,
  minVersion:'TLSv1.3',maxVersion:'TLSv1.3',
 },async(req,res)=>{
  const respond=(code,text)=>{
   res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});
   res.end(JSON.stringify({error:text}));
  };
  if(req.method!=='POST'||req.url!=='/v1/gaiz/validate'||
     !req.socket.authorized||!req.socket.getPeerCertificate()?.raw||
     !/^application\/json(?:;|$)/i.test(String(req.headers['content-type']??''))||
     req.headers['transfer-encoding']||
     !/^\d+$/.test(String(req.headers['content-length']??''))||
     Number(req.headers['content-length'])>4096) {
    respond(403,'denied');return;
  }
  const chunks=[];let size=0;
  try{
   for await (const chunk of req){
    size+=chunk.length;
    if(size>4096)throw Error('size limit');
    chunks.push(chunk);
   }
   if(size!==Number(req.headers['content-length']))throw Error('size mismatch');
   const claim=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   const peer=req.socket.getPeerCertificate();
   // The authorization callback must verify this client identity against a
   // separately maintained client-tenant trust registry. TLS alone is not
   // proof of enterprise authorization.
   const identity={subject:peer.subject,fingerprint256:peer.fingerprint256};
   const receipt=await handler({claim,peerIdentity:identity});
   res.writeHead(200,{'content-type':'application/json',
    'cache-control':'no-store','content-security-policy':"default-src 'none'"});
   res.end(JSON.stringify(receipt));
  }catch{respond(403,'denied');}
 });
 return Object.freeze({
  server,
  async listen(){
   return await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(port,host,()=>{
     server.off('error',reject);
     resolve(server.address());
    });
   });
  },
  close(){return new Promise((resolve,reject)=>{
   server.close(err=>err?reject(err):resolve());
  });},
 });
}
