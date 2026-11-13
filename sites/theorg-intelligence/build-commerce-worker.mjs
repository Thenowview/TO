// Independent isolated commercial preview. No account, payments, real AI or data APIs.
// A standalone Worker prevents the existing executive Worker from being changed.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {COMMERCIAL_TOOLS} from './commercial-tools.mjs';
import {renderPolicyPage,renderSampleReports,renderHowItWorks,renderDisabledAccount,renderDisabledCheckout} from './commerce-pages.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const read=name=>readFileSync(join(root,name),'utf8');
const page=read('marketplace.html');
const tools=read('commercial-tools.mjs');
const reports=read('report-engine.mjs');
const pages={privacy:renderPolicyPage('privacy'),terms:renderPolicyPage('terms'),refunds:renderPolicyPage('refunds'),samples:renderSampleReports(),how:renderHowItWorks(),account:renderDisabledAccount(),checkout:renderDisabledCheckout()};
if(!page.includes('payments, accounts and live AI are not yet enabled'))throw new Error('Marketing safety label required');
if(COMMERCIAL_TOOLS.some(t=>t.checkout_enabled||t.real_ai_enabled))throw new Error('Public preview must not include paid/remote tool execution');
const info=Object.fromEntries(COMMERCIAL_TOOLS.map(t=>[t.id,{name:t.name,description:t.description,tier:t.tier,epmo:t.epmo_fit}]));
const code=`const site=${JSON.stringify(page)};
const tools=${JSON.stringify(tools)};
const reports=${JSON.stringify(reports)};
const catalog=${JSON.stringify(info)};
const pages=${JSON.stringify(pages)};
const csp="default-src 'none'; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'";
const headers=type=>({'content-type':type,'x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':csp,'x-robots-tag':'noindex, nofollow','cache-control':'public, max-age=120'});
const escape=t=>String(t).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
export default {
 async fetch(request){
  const url=new URL(request.url);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method Not Allowed',{status:405,headers:{allow:'GET, HEAD'}});
  let body,mime='text/html; charset=utf-8';
  if(url.pathname==='/api/health'){
   const payload={status:'ok',service:'theorg-commercial-preview',mode:'synthetic-and-self-reported',tools:Object.keys(catalog).length,checkout_enabled:false,accounts_enabled:false,hosted_ai_enabled:false,source_verified:false};
   return new Response(request.method==='HEAD'?null:JSON.stringify(payload),{headers:{...headers('application/json; charset=utf-8'),'cache-control':'no-store'}});
  }
  if(url.pathname==='/api/commercial-status'){
   const payload={mode:'non-transactional-preview',checkout_enabled:false,accounts_enabled:false,payment_provider_connected:false,private_reports_enabled:false,external_ai_enabled:false,legal_policies_approved:false};
   return new Response(request.method==='HEAD'?null:JSON.stringify(payload),{headers:{...headers('application/json; charset=utf-8'),'cache-control':'no-store'}});
  }
  if(url.pathname==='/robots.txt'){
   return new Response(request.method==='HEAD'?null:'User-agent: *\\nDisallow: /\\n',{headers:headers('text/plain; charset=utf-8')});
  }
  if(url.pathname==='/'||url.pathname==='/index.html'||['/marketplace','/quick-wins','/reports','/pricing'].includes(url.pathname)){body=site;}
  else if(url.pathname==='/privacy'){body=pages.privacy;}
  else if(url.pathname==='/terms'){body=pages.terms;}
  else if(url.pathname==='/refunds'){body=pages.refunds;}
  else if(url.pathname==='/sample-reports'){body=pages.samples;}
  else if(url.pathname==='/how-it-works'){body=pages.how;}
  else if(url.pathname==='/my-reports'||url.pathname==='/account'){body=pages.account;}
  else if(url.pathname==='/checkout'){body=pages.checkout;}
  else if(url.pathname.startsWith('/tools/')){
   const slug=url.pathname.slice('/tools/'.length);
   const tool=Object.hasOwn(catalog,slug)?catalog[slug]:null;
   if(!tool)return new Response('Not Found',{status:404,headers:headers('text/plain; charset=utf-8')});
   const title=escape(tool.name)+' | TheOrg Report Preview';
   const detail='<section class="container" style="padding:26px 0 0"><div class="eyebrow">Report tool overview</div><h2 style="margin:8px 0 4px">'+escape(tool.name)+'</h2><p style="max-width:680px;color:var(--sub)">'+escape(tool.description)+'</p><p class="micro">This tool accepts your own inputs to prepare a bounded calculation or structured draft. The example is not independently verified; no purchase or model call occurs.</p></section>';
   body=site.replace('<title>TheOrg — Business intelligence on demand</title>','<title>'+title+'</title>').replace('<main>','<main>'+detail);
  }else if(url.pathname==='/assets/commercial-tools.mjs'){body=tools;mime='text/javascript; charset=utf-8';}
  else if(url.pathname==='/assets/report-engine.mjs'){body=reports;mime='text/javascript; charset=utf-8';}
  else return new Response('Not Found',{status:404,headers:headers('text/plain; charset=utf-8')});
  return new Response(request.method==='HEAD'?null:body,{headers:headers(mime)});
 }
};`;
const out=join(root,'dist','commerce-worker.mjs');
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,code,'utf8');
console.log('Built TheOrg isolated commercial preview:',out,'with',COMMERCIAL_TOOLS.length,'draft-only tool pages');
