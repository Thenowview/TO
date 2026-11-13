import test from 'node:test';
import assert from 'node:assert/strict';
import {policyKeys,renderPolicyPage,renderSampleReports,renderHowItWorks,
 renderDisabledAccount,renderDisabledCheckout,EXAMPLE_REPORT_TOOLS} from './commerce-pages.mjs';

test('all legal pages state draft and do not invent seller policies',()=>{
 assert.deepEqual(policyKeys().sort(),['privacy','refunds','terms']);
 for(const page of policyKeys()){
  const html=renderPolicyPage(page);
  assert.match(html,/<html lang="en">/);
  assert.match(html,/Draft/);
  assert.match(html,/final|not the final|pre-launch/i);
  assert.match(html,/no payment|No payments|No commercial|No customer|preview/i);
 }
});
test('samples are exclusively synthetic, explicit and use known tool slugs',()=>{
 const content=renderSampleReports();
 assert.equal(EXAMPLE_REPORT_TOOLS.length,5);
 for(const id of EXAMPLE_REPORT_TOOLS)assert.ok(content.includes('/tools/'+id));
 assert.match(content,/synthetic/i);
 assert.match(content,/not customer reports/i);
 assert.doesNotMatch(content,/actual paid sale|customer testimony|certified by/i);
});
test('how it works is honest about no checkout or external provenance',()=>{
 const content=renderHowItWorks();
 assert.match(content,/planned, not active/);
 assert.match(content,/No data or account is transferred automatically/);
});
test('account and checkout pages explicitly refuse live transactions',()=>{
 const account=renderDisabledAccount();
 const checkout=renderDisabledCheckout();
 assert.match(account,/not active/);
 assert.match(checkout,/No orders can be placed/i);
 assert.match(checkout,/no funds collected/i);
 assert.doesNotMatch(account+checkout,/password.*type=|payment.*card.*type=/i);
});
test('unknown policy key has no page',()=>assert.equal(renderPolicyPage('../secret'),null));
