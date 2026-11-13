import test from 'node:test';
import assert from 'node:assert/strict';
import {createTask,transition,analyzeTask,runBoundedAnalysis,runApprovedOfflineTask,verifyTaskEvidence,acceptVerifiedTask,evidenceDigest,summarizeCompanyTasks,taskReport} from './task-engine.mjs';
import {TOOL_TEMPLATES} from './tool-platform.mjs';
const tool=TOOL_TEMPLATES.find(t=>t.id==='kpi-variance');
const unsupported=TOOL_TEMPLATES.find(t=>t.id==='epmo-status');
const scope={tenant_id:'tenantA',company_id:'companyA'};
const mk=()=>createTask({...scope,title:'Analyze milestone execution',owner_id:'ownerA'},tool);
const digest='sha256:'+'a'.repeat(64);
const ctx=(role,actor,more={})=>({...scope,role,actor,...more});
test('creates tenant-scoped draft without pretending execution',()=>{const task=mk();assert.equal(task.status,'draft');assert.equal(analyzeTask(task).completion_pct,0);assert.equal(analyzeTask(task).verified,false)});
test('cross-company actions denied',()=>assert.throws(()=>transition(mk(),'approve',{...ctx('executive','ceo'),company_id:'other'})));
test('analyst cannot approve their own job',()=>assert.throws(()=>transition(mk(),'approve',ctx('analyst','ownerA'))));
test('runtime must have executive approval',()=>assert.throws(()=>transition(mk(),'begin',ctx('runtime','agent'))));
test('submit requires evidence and approved runtime',()=>{const approved=transition(mk(),'approve',ctx('executive','ceo'));const running=transition(approved,'begin',ctx('runtime','agent'));assert.throws(()=>transition(running,'submit',ctx('runtime','agent',{digest:'bad',results:[{step:1,output:'Test'}]})));});
test('QA cannot accept incomplete steps',()=>{
 const approved=transition(mk(),'approve',ctx('executive','ceo'));
 const running=transition(approved,'begin',ctx('runtime','agent'));
 const submitted=transition(running,'submit',ctx('runtime','agent',{digest,results:[{step:1,output:'One result'}]}));
 assert.throws(()=>transition(submitted,'accept',ctx('reviewer','independent',{digest,evidence_verified:true})));
});
test('no self-review and no forged proof',()=>{
 const running=transition(transition(mk(),'approve',ctx('executive','ceo')),'begin',ctx('runtime','agent'));
 const results=running.steps.map(s=>({step:s.step,output:'Synthetic inspected data'}));
 const sub=transition(running,'submit',ctx('runtime','agent',{digest,results}));
 assert.throws(()=>transition(sub,'accept',ctx('reviewer','ownerA',{digest,evidence_verified:true})));
 assert.throws(()=>transition(sub,'accept',ctx('reviewer','reviewerB',{digest,evidence_verified:false})));
});
test('evidence accepted only with independent QA on all steps',async()=>{
 const running=transition(transition(mk(),'approve',ctx('executive','ceo')),'begin',ctx('runtime','agent'));
 const results=running.steps.map(step=>({step:step.step,status:'completed',output:'Evidence result'}));
 const actualDigest=await evidenceDigest(results);
 const sub=transition(running,'submit',ctx('runtime','agent',{digest:actualDigest,results}));
 const accepted=await acceptVerifiedTask(sub,ctx('reviewer','reviewerB'));
 assert.throws(()=>transition(sub,'accept',ctx('reviewer','reviewerB',{digest,evidence_verified:true})),'Caller-supplied verified flag must not bypass verification');
 assert.equal(accepted.status,'accepted');assert.equal(analyzeTask(accepted).verified,true);assert.equal(analyzeTask(accepted).completion_pct,100);
 assert.equal(accepted.events.length,5);
});
test('deterministic bounded analysis has zero external/model calls',()=>{
 const result=runBoundedAnalysis(tool,{rows:[{name:'Delivery',actual:83,target:90}]});
 assert.equal(result.average_variance,-7);assert.equal(result.external_actions,0);assert.equal(result.model_calls,0);assert.equal(result.verified,false);
});
test('reject unbounded inputs',()=>assert.throws(()=>runBoundedAnalysis(tool,{rows:Array(101).fill({actual:80,target:90})})));
test('no direct action can mark draft accepted',()=>assert.throws(()=>transition(mk(),'accept',ctx('reviewer','reviewerB',{digest,evidence_verified:true}))));

test('approved deterministic offline tool produces evidence awaiting QA',async()=>{
 const approved=transition(mk(),'approve',ctx('executive','ceo'));
 const result=await runApprovedOfflineTask(approved,tool,{rows:[{name:'Progress',actual:83,target:90}]});
 assert.equal(result.status,'awaiting-qa');
 assert.equal(result.results.length,result.steps.length);
 assert.equal(result.events.at(-1).type,'submit');
 assert.equal(await verifyTaskEvidence(result),true);
 assert.equal(analyzeTask(result).verified,false);
});
test('tampered output fails evidence verification',async()=>{
 const approved=transition(mk(),'approve',ctx('executive','ceo'));
 const result=await runApprovedOfflineTask(approved,tool,{rows:[{name:'Progress',actual:83,target:90}]});
 result.results[0].output='forged evidence';
 assert.equal(await verifyTaskEvidence(result),false);
});
test('execution refused before approval',async()=>{
 await assert.rejects(()=>runApprovedOfflineTask(mk(),tool,{rows:[]}));
});

test('verified acceptance refuses modified outputs even with reviewer role',async()=>{
 const approved=transition(mk(),'approve',ctx('executive','ceo'));
 const result=await runApprovedOfflineTask(approved,tool,{rows:[{name:'Progress',actual:83,target:90}]});
 result.results[0].output='fraudulent evidence';
 await assert.rejects(()=>acceptVerifiedTask(result,ctx('reviewer','reviewerB')));
});

test('non-implemented EPMO workflow is not falsely executed',async()=>{
 const task=createTask({...scope,title:'Review milestone execution',owner_id:'ownerA'},unsupported);
 const approved=transition(task,'approve',ctx('executive','ceo'));
 await assert.rejects(()=>runApprovedOfflineTask(approved,unsupported,{rows:[{actual:80,target:90}]}),/unimplemented steps/);
});

test('company dashboard omits cross-tenant tasks and never counts drafts as verified',()=>{
 const current=mk(),other={...mk(),tenant_id:'other'};
 const report=summarizeCompanyTasks([current,other],scope);
 assert.equal(report.total,1);assert.equal(report.verified,0);assert.equal(report.not_verified,1);
 assert.equal(report.cost,null);assert.equal(report.elapsed_ms,null);
});
test('task evidence report clearly distinguishes unverified draft',()=>{
 const report=taskReport(mk());
 assert.match(report,/Verified completion: no/);
 assert.match(report,/Evidence digest: none/);
});

test('KPI runtime rejects strings, nulls, empty rows and missing metric names',()=>{
 for(const rows of [[],[{name:'A',actual:'83',target:90}],[{name:'A',actual:null,target:90}],[{name:'A',actual:83,target:90}], [{name:'',actual:83,target:90}]]){
   if(rows.length===1&&rows[0].name==='A'&&rows[0].actual===83)continue;
   assert.throws(()=>runBoundedAnalysis(tool,{rows}));
 }
 assert.equal(runBoundedAnalysis(tool,{rows:[{name:'Valid',actual:83,target:90}]}).average_variance,-7);
});
