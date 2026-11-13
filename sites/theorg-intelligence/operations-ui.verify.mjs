import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('./operations.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
assert.ok(script,'Exactly one operations module script is required');
const withoutImports=script[1].replace(/^import .*;$/gm,'');
new Script(withoutImports,{filename:'operations-inline.mjs'});
for(const id of ['toolList','reportList','rows','metrics','history','localBundleFile','localBundleStatus','localBundleMetrics','localBundleRows']){
 assert.ok(html.includes('id="'+id+'"'),'Missing operations UI control: '+id);
}
assert.ok(html.includes('No THEEPMO backend integration'),'Missing isolation boundary');
assert.ok(script[1].includes('validateImportedBundle'),'No local bundle validator');
assert.ok(script[1].includes('Verified business sources'),'Must distinguish verified business sources');
assert.ok(script[1].includes('file.size>1048576'),'Missing bounded import');
assert.doesNotMatch(script[1],/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/,'Public preview must not make business data requests');
console.log('Operations UI static contract: PASS');
