const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context={URL};context.globalThis=context;
for(const file of ['reviewed-plan.js','task-manager.js'])
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../apps/chrome-extension',file),'utf8'),context);
const binding=context.TheOrgReviewedPlan;
const taskId='a'.repeat(32),jobId='b'.repeat(32),reviewFingerprint='plan-v1:'+'C'.repeat(64);
const reply={jobId,status:'awaiting_approval',reviewFingerprint};
test('review snapshot is immutable and bound to exact order/job',()=>{
  const snapshot=binding.snapshot(taskId,jobId,reply);
  assert.ok(Object.isFrozen(snapshot));
  assert.equal(binding.approvalArgs(snapshot,taskId,jobId).reviewFingerprint,reviewFingerprint);
  assert.throws(()=>binding.approvalArgs(snapshot,'d'.repeat(32),jobId));
  assert.throws(()=>binding.approvalArgs(snapshot,taskId,'e'.repeat(32)));
});
test('legacy/malformed/non-reviewable host replies cannot enable approval',()=>{
  for(const patch of [{reviewFingerprint:undefined},{reviewFingerprint:'bad'},
    {jobId:'c'.repeat(32)},{status:'queued'}])
    assert.equal(binding.snapshot(taskId,jobId,{...reply,...patch}),null);
  assert.throws(()=>binding.approvalArgs(null,taskId,jobId));
});
function manager(){
 const requests=[];
 const manager=new context.TheOrgTaskManager({});
 manager.orders=async()=>({[taskId]:{companyId:'synthetic'}});
 manager.native=async request=>{requests.push(request);return {ok:true,status:'queued'}};
 return {manager,requests};
}
test('manager forwards reviewed approval but never lets extra fields replace scope/command',async()=>{
 const {manager:man,requests}=manager();
 await man.agentCommand(taskId,jobId,'agent_approve',{
   approved:true,reviewFingerprint,companyId:'foreign',command:'shell',jobId:'f'.repeat(32)});
 assert.equal(requests.length,1);
 assert.equal(requests[0].companyId,'synthetic');
 assert.equal(requests[0].jobId,jobId);
 assert.equal(requests[0].command,'agent_approve');
 assert.equal(requests[0].reviewFingerprint,reviewFingerprint);
});
test('manager refuses approval without a reviewed fingerprint before contacting native host',async()=>{
 const {manager:man,requests}=manager();
 for(const extra of [{},{approved:true},{approved:'true',reviewFingerprint},
   {approved:true,reviewFingerprint:'plan-v1:invalid'}])
   await assert.rejects(()=>man.agentCommand(taskId,jobId,'agent_approve',extra));
 assert.equal(requests.length,0);
});
