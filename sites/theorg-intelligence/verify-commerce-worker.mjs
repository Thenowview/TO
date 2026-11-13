import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {COMMERCIAL_TOOLS} from './commercial-tools.mjs';
const path=new URL('./dist/commerce-worker.mjs',import.meta.url);
const source=readFileSync(path,'utf8');
for(const re of [/checkout_enabled:false/,/accounts_enabled:false/,/hosted_ai_enabled:false/,
 /source_verified:false/,/connect-src 'none'/,/x-robots-tag/,/frame-ancestors 'none'/,
 /Disallow/, /\/tools\//, /\/assets\/commercial-tools\.mjs/])assert.match(source,re);
const {default:worker}=await import(path.href+'?test');
const origin='https://theorg-commerce-preview.example';
async function check(p,expect=200,mime=null){
 const res=await worker.fetch(new Request(origin+p),{});
 assert.equal(res.status,expect,p);
 if(mime)assert.match(res.headers.get('content-type')||'',mime);
 assert.match(res.headers.get('x-robots-tag')||'',/noindex/);
 assert.match(res.headers.get('content-security-policy')||'',/connect-src 'none'/);
 return res;
}
for(const p of ['/','/marketplace','/quick-wins','/reports','/pricing','/privacy','/terms','/refunds','/sample-reports','/how-it-works','/my-reports','/account','/checkout'])
 await check(p,200,/text\/html/);
for(const t of COMMERCIAL_TOOLS){
 const r=await check('/tools/'+t.id,200,/text\/html/);
 const html=await r.text();
 assert.match(html,new RegExp(t.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'Product page missing visible name');
}
for(const p of ['/assets/commercial-tools.mjs','/assets/report-engine.mjs'])
 await check(p,200,/text\/javascript/);
const health=await check('/api/health',200,/application\/json/);
const state=await health.json();
assert.equal(state.tools,22);
assert.equal(state.checkout_enabled,false);
assert.equal(state.hosted_ai_enabled,false);
assert.equal(state.source_verified,false);
assert.equal((await (await check('/robots.txt',200,/text\/plain/)).text()).includes('Disallow: /'),true);
const commercial=await check('/api/commercial-status',200,/application\\/json/);
const commerceStatus=await commercial.json();
assert.equal(commerceStatus.checkout_enabled,false);
assert.equal(commerceStatus.accounts_enabled,false);
assert.equal(commerceStatus.payment_provider_connected,false);
assert.equal(commerceStatus.legal_policies_approved,false);
assert.match(await (await check('/privacy')).text(),/Draft/);
assert.match(await (await check('/terms')).text(),/not the final contract/);
assert.match(await (await check('/checkout')).text(),/no funds collected/i);
assert.match(await (await check('/sample-reports')).text(),/synthetic/i);
await check('/tools/not-a-product',404);
await check('/not-found',404);
const bad=await worker.fetch(new Request(origin+'/tools/project-health',{method:'POST'}),{});
assert.equal(bad.status,405);
const head=await worker.fetch(new Request(origin+'/tools/project-health',{method:'HEAD'}),{});
assert.equal(head.status,200);
assert.equal((await head.text()).length,0);
console.log('TheOrg commercial Worker: 22 routes, 2 assets, noindex, no payment and no AI: PASS');
