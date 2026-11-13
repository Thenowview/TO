import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessCommercialLaunch} from './commercial-readiness.mjs';
const status=JSON.parse(readFileSync(new URL('./commercial-release-gates.json',import.meta.url),'utf8'));
test('preview is not accidentally marked commercial production ready',()=>{
 const result=assessCommercialLaunch(status);
 assert.equal(result.production_ready,false);
 assert.ok(result.pending.includes('github-ci-green'));
 assert.ok(result.pending.includes('merchant-eligibility-and-processor-connected'));
 assert.ok(result.pending.includes('complete-payment-to-private-delivery-qa'));
 assert.equal(result.production_gates_passed,0);
});
test('unsupported release contract is rejected',()=>assert.throws(()=>assessCommercialLaunch({checks:{}})));
test('unchecked and unevidenced yes flags do not satisfy release gates',()=>{
 const forged=structuredClone(status);
 for(const key of Object.keys(forged.checks))forged.checks[key].passed=true;
 const result=assessCommercialLaunch(forged);
 assert.equal(result.production_ready,false);
});
