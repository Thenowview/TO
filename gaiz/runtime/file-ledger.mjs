// Durable local worker replay ledger. Provision a private, non-shared POSIX
// directory owned by the worker; do not garbage-collect live execution records.
import {open,mkdir,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function createFileExecutionLedger(root){
 const dir=resolve(root),s=await stat(dir);
 if(!s.isDirectory()||(s.mode&0o077)!==0||s.uid!==process.getuid?.())throw Error('Private worker ledger directory required');
 async function syncDir(path){const h=await open(path,'r');try{await h.sync();}finally{await h.close();}}
 function path(p){if(!UUID.test(p.tenantId)||!UUID.test(p.nonce)||!/^[a-f0-9]{64}$/.test(p.grantSha256))throw Error('Invalid replay identity');return join(dir,p.tenantId+'-'+p.nonce);}
 async function record(file,p){const h=await open(file,'wx',0o600);try{await h.writeFile(JSON.stringify(p)+'\n');await h.sync();}finally{await h.close();}}
 return Object.freeze({
  async claim(p){const d=path(p);await mkdir(d,{mode:0o700});await syncDir(dir);await record(join(d,'claimed.json'),p);await syncDir(d);},
  async complete(p){const d=path(p);await record(join(d,'completed.json'),p);await syncDir(d);},
 });
}
