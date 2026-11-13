import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./dist/worker.mjs',import.meta.url),'utf8');
const literals=[
 /connected_agent_runtime\s*:\s*false/,
 /epmo_connected\s*:\s*false/,
 /live_ai\s*:\s*false/,
 /connect-src 'none'/,
 /frame-ancestors 'none'/,
 /x-content-type-options/,
 /url\.pathname\s*===\s*'\/operations'/,
 /\/assets\/operations-analytics\.mjs/,
 /\/assets\/report-engine\.mjs/,
 /script-src 'self'/,
 /\/marketplace/,
 /\/quick-wins/,
 /\/assets\/commercial-tools\.mjs/,
 /checkout_enabled:false/,
 /source_verified:false/,
 /request\.method\s*!==\s*'GET'/
];
for (const check of literals) assert.match(source,check,'Missing Worker contract '+check);
assert.doesNotMatch(source,/https?:\/\/[^\s"']+theepmo\.com/i);
assert.ok(source.includes("export default"),'Missing module export');
const moduleUrl=new URL('./dist/worker.mjs',import.meta.url);
const {default:worker}=await import(moduleUrl.href+'?contract');
assert.equal(typeof worker?.fetch,'function');
const origin='https://theorg-intelligence-lab.example';
for(const [path,mime] of [
 ['/',/text\/html/],['/index.html',/text\/html/],
 ['/operations',/text\/html/],['/operations.html',/text\/html/],
 ['/marketplace',/text\/html/],['/quick-wins',/text\/html/],['/reports',/text\/html/],
 ['/assets/operations-analytics.mjs',/text\/javascript/],
 ['/assets/report-engine.mjs',/text\/javascript/],
 ['/assets/commercial-tools.mjs',/text\/javascript/]
]){
 const response=await worker.fetch(new Request(origin+path),{});
 assert.equal(response.status,200,path+' did not return HTTP 200');
 assert.match(response.headers.get('content-type')||'',mime,path+' wrong mime');
 assert.match(response.headers.get('content-security-policy')||'',/connect-src 'none'/);
 assert.ok((await response.text()).length>100,path+' body missing');
}
const health=await worker.fetch(new Request(origin+'/api/health'),{});
assert.equal(health.status,200);
const state=await health.json();
assert.equal(state.connected_agent_runtime,false);
assert.equal(state.epmo_connected,false);
assert.equal(state.live_ai,false);
const blocked=await worker.fetch(new Request(origin+'/operations',{method:'POST'}),{});
assert.equal(blocked.status,405);
const missing=await worker.fetch(new Request(origin+'/missing'),{});
assert.equal(missing.status,404);
const head=await worker.fetch(new Request(origin+'/operations',{method:'HEAD'}),{});
assert.equal(head.status,200);
assert.equal((await head.text()).length,0);
console.log('Standalone Worker syntax, routes, headers and safety contract: PASS');
