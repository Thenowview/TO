// Vault Transit adapter. Only TLS, exact configured origin/mount/key/version;
// no redirects, private key export, provisioning, environment-token fallback or retries.
import {createHash,createPublicKey} from 'node:crypto';
const deny=()=>{throw Error('GAIZ key custody unavailable')};
const component=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(x);
function b64(s,size){if(typeof s!=='string'||s.length>size*2)deny();const b=Buffer.from(s,'base64');if(b.length!==size||b.toString('base64')!==s)deny();return b;}
export function createVaultTransit({origin,mount='transit',tokenProvider,fetchImpl=fetch,timeoutMs=5000}={}){
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!component(mount)||typeof tokenProvider!=='function'||typeof fetchImpl!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)deny();
 async function call(method,path,body){
  try{
   const token=await tokenProvider();if(typeof token!=='string'||!token||token.length>8192||/[\r\n]/.test(token))deny();
   const response=await fetchImpl(url.origin+'/v1/'+mount+'/'+path,{method,headers:{'X-Vault-Token':token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
   if(!response.ok||!response.body)deny();
   const chunks=[];let total=0;
   for await(const chunk of response.body){total+=chunk.length;if(total>32768){await response.body.cancel?.().catch(()=>{});deny();}chunks.push(Buffer.from(chunk));}
   const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!data.data||data.errors?.length)deny();return data.data;
  }catch{deny();}
 }
 async function check(record,kind){
  if(!record||!component(record.name)||!Number.isSafeInteger(record.version)||record.version<1||!/^[a-f0-9]{64}$/.test(record.spkiSha256))deny();
  const meta=await call('GET','keys/'+record.name);
  if(meta.exportable!==false||meta.allow_plaintext_backup!==false||meta.derived!==false||meta.type!==(kind==='sign'?'ed25519':'rsa-3072')||record.version<(meta.min_decryption_version??0)||record.version>(meta.latest_version??0))deny();
  const key=meta.keys?.[String(record.version)];if(!key||typeof key.public_key!=='string')deny();
  let pub;
  if(kind==='sign'){
   const raw=b64(key.public_key,32);pub=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),raw]),format:'der',type:'spki'});
  }else pub=createPublicKey(key.public_key);
  if(pub.asymmetricKeyType!==(kind==='sign'?'ed25519':'rsa')||(kind==='unwrap'&&pub.asymmetricKeyDetails?.modulusLength!==3072)||createHash('sha256').update(pub.export({type:'spki',format:'der'})).digest('hex')!==record.spkiSha256)deny();
  return pub;
 }
 return Object.freeze({
  async sign(bytes,record){
   if(!Buffer.isBuffer(bytes)||bytes.length>8*1024*1024)deny();await check(record,'sign');
   const r=await call('POST','sign/'+record.name,{input:bytes.toString('base64'),key_version:record.version,prehashed:false});
   const prefix='vault:v'+record.version+':';if(typeof r.signature!=='string'||!r.signature.startsWith(prefix))deny();return b64(r.signature.slice(prefix.length),64);
  },
  async unwrap(bytes,record){
   if(!Buffer.isBuffer(bytes)||bytes.length!==384)deny();await check(record,'unwrap');
   const r=await call('POST','decrypt/'+record.name,{ciphertext:'vault:v'+record.version+':'+bytes.toString('base64'),padding_scheme:'oaep',hash_algorithm:'sha2-256'});
   return b64(r.plaintext,32);
  },
 });
}
