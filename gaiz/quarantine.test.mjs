import test from 'node:test';
import assert from 'node:assert/strict';
import {quarantineGovernanceReport} from './quarantine.mjs';
const good={title:'Synthetic governance report',summary:'ملخص مبسط 😃',metrics:{completed:3,pending:1},
 findings:[{id:1,description:'Schedule requires review'}]};
test('quarantine returns only hash/counts and no report text',()=>{
 const result=quarantineGovernanceReport(good);
 assert.equal(result.status,'quarantine-schema-validated');
 assert.equal(result.importAllowed,false);assert.equal(result.renderAllowed,false);
 assert.match(result.reportSha256,/^[a-f0-9]{64}$/);
 assert.equal(result.findingsCount,1);
 assert.doesNotMatch(JSON.stringify(result),/Synthetic governance|Schedule requires review/);
});
test('rejects active markup, links, controls, bidi, unknown fields, over-limit',()=>{
 const rejected=[
  {...good,summary:'<img src=x onerror=alert(1)>'},
  {...good,title:'<script>alert(1)</script>'},
  {...good,summary:'javascript:alert(1)'},
  {...good,summary:'https://example.test'},
  {...good,title:'A\u202Eevil'},
  {...good,title:'A\u0000B'},
  {...good,unknownField:true},
  {...good,summary:'A'.repeat(4001)}
 ];
 for(const report of rejected)assert.throws(()=>quarantineGovernanceReport(report));
 assert.throws(()=>quarantineGovernanceReport(good,{maxBytes:256}));
});
