// Read a short-lived workload token from an operator-provisioned private file.
// No token in argv, browser, environment values, source, error text or telemetry.
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
export function workloadTokenProvider(path){
 if(typeof path!=='string'||!path.startsWith('/'))throw Error('Absolute workload token path required');
 return async()=>{
  let h;
  try{
   h=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
   const s=await h.stat();
   if(!s.isFile()||(s.mode&0o077)!==0||s.uid!==process.getuid?.()||s.size<1||s.size>8192)throw Error();
   const b=Buffer.alloc(8193);try{
    const {bytesRead}=await h.read(b,0,b.length,0);
    if(bytesRead<1||bytesRead>8192)throw Error();
    const token=b.subarray(0,bytesRead).toString('utf8').trim();if(!token||/[\r\n\s]/.test(token))throw Error();return token;
   }finally{b.fill(0);}
  }catch{throw Error('Workload identity unavailable');}finally{await h?.close();}
 };
}
