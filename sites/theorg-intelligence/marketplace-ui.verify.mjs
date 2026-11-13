import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('./marketplace.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
assert.ok(script,'Marketplace module script missing');
const source=script[1].replace(/^import .*;$/gm,'');
new Script(source,{filename:'theorg-marketplace-inline.mjs'});
for(const id of ['toolCards','filters','selectedName','selectedDescription','toolForm','fields','resultArea','downloadHtml','downloadJson','formStatus']){
 assert.ok(html.includes('id="'+id+'"'),'Missing commercial UI control: '+id);
}
for(const route of ['#tools','#studio','#pricing','#how']){
 assert.ok(html.includes(route),'Missing commercial navigation '+route);
}
assert.match(html,/No signup for sample assessments/);
assert.match(html,/payments, accounts and live AI are not yet enabled/);
assert.match(html,/https:\/\/theepmo\.com/);
assert.match(html,/target="_blank" rel="noopener noreferrer"/);
assert.ok(source.includes('analyzeCommercialTool'),'Marketplace must use shared calculation engine');
assert.ok(source.includes("data_status:'caller-supplied'"),'No unverified report publication');
assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/,'Commercial preview must not upload customer data');
assert.doesNotMatch(html,/<script[^>]*src=|<link[^>]*href=/i,'No remote assets or scripts are allowed in preview');
console.log('Commercial storefront UX and no-payment/no-network contract: PASS');
