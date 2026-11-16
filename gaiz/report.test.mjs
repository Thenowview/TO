import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGovernanceReport} from './report.mjs';
const good={title:'Synthetic board report',summary:'Demo only',metrics:{completed:3},findings:[{id:1,description:'Synthetic observation'}]};
test('GAIZ structured reports validate and preserve source',()=>{
 assert.equal(validateGovernanceReport(good),good);
});
test('empty, executable, malformed or over-limit reports fail closed',()=>{
 for(const bad of [{},{...good,title:''},{...good,html:'<script>alert(1)</script>'},{...good,metrics:{completed:1.2}},{...good,metrics:{completed:-1}},{...good,findings:[{id:1,description:'a'},{id:1,description:'b'}]},{...good,summary:'A'.repeat(4001)}])assert.throws(()=>validateGovernanceReport(bad));
});
