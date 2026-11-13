// TheOrg task engine: isolated deterministic MVP for allowed tools.
// Adapted from THEEPMO's patterns: tenant boundary, evidence-based gates,
// transactional append-only audit, shared contracts. Not its code or data.
import { validateScope, validateObjective } from './intelligence-rules.mjs';
import { validateTool } from './tool-platform.mjs';

const allowedStates=['draft','approved','running','awaiting-qa','accepted','failed','rejected'];
const digestOK=d=>typeof d==='string'&&/^sha256:[a-f0-9]{64}$/.test(d);
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const stamp=()=>new Date().toISOString();
const mkid=()=>crypto.randomUUID();
export function createTask(input,tool) {
 const scope=validateScope(input?.tenant_id,input?.company_id);
 const definition=validateTool(tool);
 const title=validateObjective(input?.title);
 assert(/^[0-9]+\.[0-9]+\.[0-9]+$/.test(String(input.tool_version||'1.0.0')),'Invalid tool version');
 assert(typeof input.owner_id==='string'&&/^[A-Za-z0-9_-]{2,64}$/.test(input.owner_id),'Invalid owner');
 const id=mkid(),at=stamp();
 return {...scope,id,title,owner_id:input.owner_id,tool_id:definition.id,tool_version:String(input.tool_version||'1.0.0'),status:'draft',created_at:at,updated_at:at,steps:definition.steps.map((name,i)=>({step:i+1,name,status:'pending'})),results:[],qa:null,execution_mode:'bounded-deterministic',events:[{event_id:mkid(),type:'draft',actor:input.owner_id,at}]};
}
export function transition(task,action,context={}) {
 assert(task&&allowedStates.includes(task.status),'Invalid task state');
 const scope=validateScope(context.tenant_id,context.company_id);
 assert(scope.tenant_id===task.tenant_id&&scope.company_id===task.company_id,'Company scope mismatch');
 assert(typeof context.actor==='string'&&context.actor.length>=2,'Missing actor');
 let status,patch={};
 if(action==='approve'){
  assert(task.status==='draft'&&context.role==='executive','Executive draft approval required');
  status='approved';
 }else if(action==='begin'){
  assert(task.status==='approved'&&context.role==='runtime','Approved task required');
  status='running';
 }else if(action==='submit'){
  assert(task.status==='running'&&context.role==='runtime','Runtime submission only');
  assert(digestOK(context.digest)&&Array.isArray(context.results)&&context.results.length>0&&context.results.length<=8,'Evidence-backed outputs required');
  patch={results:context.results.map(r=>({step:r.step,status:'completed',output:String(r.output||'').slice(0,2000)})),evidence_digest:context.digest};
  assert(patch.results.every(r=>Number.isInteger(r.step)&&r.step>=1&&r.step<=task.steps.length),'Invalid step');
  status='awaiting-qa';
 }else if(action==='accept'){
  assert(task.status==='awaiting-qa'&&context.role==='reviewer'&&context.actor!==task.owner_id,'Independent reviewer required');
  assert(digestOK(context.digest)&&context.digest===task.evidence_digest&&context.evidence_verified===true,'Evidence must be independently verified');
  assert(task.results.length===task.steps.length&&new Set(task.results.map(r=>r.step)).size===task.steps.length,'All steps need evidence');
  patch={qa:{reviewer:context.actor,digest:context.digest,accepted_at:stamp(),verified:true}};
  status='accepted';
 }else if(action==='reject'){
  assert(['draft','approved','awaiting-qa'].includes(task.status)&&['executive','reviewer'].includes(context.role),'Rejection not permitted');
  status='rejected';
 }else if(action==='fail'){
  assert(['approved','running'].includes(task.status)&&context.role==='runtime','Runtime failure state required');
  status='failed';
 }else throw new Error('Action not allowed');
 const at=stamp();
 return {...task,...patch,status,updated_at:at,events:[...task.events,{event_id:mkid(),type:action,actor:context.actor,role:context.role,at,from:task.status,to:status}]};
}
export function analyzeTask(task){
 assert(task&&allowedStates.includes(task.status),'Invalid task');
 const total=task.steps.length,complete=task.results?.length||0;
 return {task_id:task.id,tenant_id:task.tenant_id,company_id:task.company_id,tool_id:task.tool_id,status:task.status,steps_total:total,steps_with_outputs:complete,completion_pct:task.status==='accepted'?100:0,verified:task.status==='accepted'&&task.qa?.verified===true,evidence_digest:task.evidence_digest||null,qa_state:task.qa?.verified?'accepted':'not-verified',elapsed_ms:null,cost_usd:null,warning:task.status==='accepted'?null:'Not independently verified; do not treat as completed'};
}
// No arbitrary shell, browser, email, network or native messaging action.
// An explicitly approved runtime could call this pure offline analyst.
export function runBoundedAnalysis(tool,inputs) {
 const t=validateTool(tool);
 assert(t.kind==='analysis'||t.kind==='reporting','Only safe deterministic analysis/reporting supported');
 assert(inputs&&Array.isArray(inputs.rows)&&inputs.rows.length<=100,'Bound input set');
 const rows=inputs.rows.map(r=>{const actual=Number(r.actual),target=Number(r.target);
  assert(Number.isFinite(actual)&&actual>=0&&actual<=100&&Number.isFinite(target)&&target>=0&&target<=100,'Invalid metric row');
  return {name:String(r.name||'Metric').slice(0,80),actual,target,gap:Math.round((actual-target)*100)/100};});
 const avg=rows.length?rows.reduce((a,b)=>a+b.gap,0)/rows.length:0;
 return {mode:'deterministic-offline',tool_id:t.id,metrics_count:rows.length,average_variance:Math.round(avg*100)/100,rows,external_actions:0,model_calls:0,verified:false};
}

export async function evidenceDigest(results) {
 assert(Array.isArray(results)&&results.length>0&&results.length<=8,'Invalid evidence list');
 const text=JSON.stringify(results.map(r=>({step:r.step,status:r.status||'completed',output:String(r.output||'').slice(0,2000)})));
 const sum=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return 'sha256:'+Array.from(new Uint8Array(sum),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function runApprovedOfflineTask(approvedTask,tool,inputs,actor='local-runtime') {
 assert(approvedTask?.status==='approved','Only approved tasks can run');
 assert(approvedTask.tool_id===tool?.id,'Tool identity mismatch');
 const runtimeContext={tenant_id:approvedTask.tenant_id,company_id:approvedTask.company_id,role:'runtime',actor};
 const running=transition(approvedTask,'begin',runtimeContext);
 // Concrete deterministic analysis only; no model, shell, network or filesystem side effects.
 const analysis=runBoundedAnalysis(tool,inputs);
 const results=running.steps.map(step=>({step:step.step,status:'completed',output:JSON.stringify({step:step.name,metric_summary:analysis})}));
 const digest=await evidenceDigest(results);
 return transition(running,'submit',{...runtimeContext,digest,results});
}
export async function verifyTaskEvidence(task) {
 if(task?.status!=='awaiting-qa'||!Array.isArray(task.results)||!digestOK(task.evidence_digest))return false;
 return (await evidenceDigest(task.results))===task.evidence_digest &&
   task.results.length===task.steps.length &&
   new Set(task.results.map(r=>r.step)).size===task.steps.length;
}
