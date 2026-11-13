import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const read=name=>readFileSync(join(root,name),'utf8');
const home=read('index.html');
const operations=read('operations.html');
const analytics=read('operations-analytics.mjs');
const reporting=read('report-engine.mjs');
if(!home.includes('Synthetic data')||!home.includes('No connection to THEEPMO systems'))throw new Error('Unsafe or unlabeled dashboard payload');
if(!operations.includes('No THEEPMO backend integration'))throw new Error('Unsafe operations payload');
const code=`const home=${JSON.stringify(home)};
const operations=${JSON.stringify(operations)};
const analytics=${JSON.stringify(analytics)};
const reporting=${JSON.stringify(reporting)};
const csp="default-src 'none'; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
const headers=(mime)=>({'content-type':mime,'x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':csp,'cache-control':'public, max-age=120'});
export default {
 async fetch(request){
  const url=new URL(request.url);
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method Not Allowed',{status:405,headers:{'allow':'GET, HEAD'}});
  if(url.pathname === '/api/health'){const payload={status:'ok',service:'theorg-intelligence',mode:'synthetic-demo',connected_agent_runtime:false,epmo_connected:false,live_ai:false};return new Response(request.method==='HEAD'?null:JSON.stringify(payload),{headers:{'cache-control':'no-store','content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff'}});}
  let body,mime;
  if(url.pathname === '/' || url.pathname === '/index.html'){body=home;mime='text/html; charset=utf-8';}
  else if(url.pathname === '/operations' || url.pathname === '/operations.html'){body=operations;mime='text/html; charset=utf-8';}
  else if(url.pathname === '/assets/operations-analytics.mjs'){body=analytics;mime='text/javascript; charset=utf-8';}
  else if(url.pathname === '/assets/report-engine.mjs'){body=reporting;mime='text/javascript; charset=utf-8';}
  else return new Response('Not Found',{status:404,headers:{'content-type':'text/plain; charset=utf-8'}});
  return new Response(request.method==='HEAD'?null:body,{headers:headers(mime)});
 }
};
`;
const target=join(root,'dist','worker.mjs');
mkdirSync(dirname(target),{recursive:true});
writeFileSync(target,code,'utf8');
console.log('Generated isolated TheOrg Worker:',target,'with executive home, operations suite and two first-party modules');
