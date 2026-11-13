// TheOrg operations analytics. Independent implementation of reporting patterns
// inspected in CEOBI Site.zip and StackSilah-main.zip. No source/assets imported.
// All input is caller-supplied. Numeric outcomes are deterministic, NOT AI inference.
export const OPERATIONS_TOOLS=Object.freeze([
['executive-report','Executive Report Generator','Executive','Summarize verified task outcomes','accepted-tasks'],
['kpi-intelligence','KPI Intelligence Agent','Performance','Analyze actual vs target and trend','kpis'],
['project-performance','Project Performance Analyst','Delivery','Assess milestones and exceptions','milestones'],
['risk-compliance','Risk & Compliance Analyst','Risk','Score risk exposure and treatments','risks'],
['strategy-alignment','Strategy Alignment Analyst','Strategy','Map initiatives to strategic objectives','initiatives'],
['maturity-assessment','Maturity Assessment Agent','Capability','Score maturity dimensions','maturity'],
['portfolio-optimization','Portfolio Optimization Agent','Portfolio','Rank initiatives using declared weights','portfolio'],
['resource-capacity','Resource Capacity Analyst','Operations','Identify resource overload and availability','resources'],
['board-decisions','Board Decision Assistant','Governance','Build decision and approval queue','decisions'],
['document-builder','Document & Template Builder','Documents','Populate reviewed report templates','records'],
['benchmarking','Benchmarking Agent','Performance','Compare consistent peer indicators','benchmarks'],
['knowledge-lessons','Knowledge & Lessons Agent','Knowledge','Curate accepted reviewed lessons','lessons'],
['forecasting','Forecasting Agent','Planning','Project disclosed linear scenarios','series']
].map(([id,name,category,description,inputType])=>Object.freeze({
 id,name,category,description,inputType,version:'1.0.0',mode:'bounded-offline',
 requiresApproval:true,aiEnabled:false,externalActions:false
})));
export const REPORT_TYPES=Object.freeze([
 ['daily-brief','Executive Daily Brief','Executive'],['task-report','Individual Task Report','Tasks'],
 ['weekly-operations','Weekly Operations Report','Operations'],['portfolio-report','Project & Portfolio Report','Portfolio'],
 ['strategy-report','Strategy Performance Report','Strategy'],['governance-report','Governance & Risk Report','Risk'],
 ['board-pack','Board & Committee Pack','Board'],['ai-workforce-report','AI Workforce Performance Report','AI Workforce']
].map(([id,name,category])=>Object.freeze({id,name,category,version:'1.0.0'})));
const assert=(x,msg)=>{if(!x)throw new Error(msg)};
const num=(v,min=-1e9,max=1e9)=>{assert(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,'Invalid numeric input');return v};
const text=(v,max=160)=>{assert(typeof v==='string'&&v.trim()&&v.length<=max,'Invalid text input');return v.trim()};
const arr=(v)=>{assert(Array.isArray(v)&&v.length<=2000,'Invalid row collection');return v};
const round=(n)=>Math.round(n*100)/100;
const avg=v=>v.length?round(v.reduce((a,b)=>a+b,0)/v.length):null;
const key=(v)=>text(v,80);
const counts=(a,f)=>Object.fromEntries(a.map(k=>[k,f(k)]));
const validDate=d=>{
 assert(typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d),'Expected ISO YYYY-MM-DD');
 const dt=Date.parse(d+'T00:00:00.000Z');
 assert(Number.isFinite(dt)&&new Date(dt).toISOString().slice(0,10)===d,'Invalid calendar date');
 return dt;
};
export function analyzeOperations(toolId,input){
 const tool=OPERATIONS_TOOLS.find(x=>x.id===toolId);assert(tool,'Unknown tool');
 assert(input&&typeof input==='object'&&!Array.isArray(input),'Invalid inputs');
 const rows=arr(input.rows||[]);
 let metrics={},details=[],recommendations=[];
 switch(toolId){
 case 'kpi-intelligence':{
   details=rows.map(r=>{const a=num(r.actual),t=num(r.target),direction=r.direction==='lower'?'lower':'higher';const gap=round(a-t);return {name:key(r.name),actual:a,target:t,gap,met:direction==='lower'?a<=t:a>=t,source_ref:r.source_ref||null}});
   metrics={total:details.length,met:details.filter(x=>x.met).length,missed:details.filter(x=>!x.met).length,mean_variance:avg(details.map(x=>x.gap))};
   recommendations=details.filter(x=>!x.met).map(x=>'Request a reviewed improvement action for '+x.name);break;
 }
 case 'project-performance':{
   details=rows.map(r=>({project:key(r.project),milestone:key(r.milestone),planned:validDate(r.planned),actual:r.actual?validDate(r.actual):null,owner:r.owner||null}));
   details=details.map(r=>({...r,late_days:r.actual===null?null:Math.max(0,Math.ceil((r.actual-r.planned)/86400000))}));
   metrics={milestones:details.length,late:details.filter(x=>x.late_days>0).length,unknown:details.filter(x=>x.late_days===null).length,avg_delay_days:avg(details.filter(x=>x.late_days!==null).map(x=>x.late_days))};
   recommendations=details.filter(x=>x.late_days>0).map(x=>'Investigate '+x.project+' / '+x.milestone);break;
 }
 case 'risk-compliance':{
   details=rows.map(r=>{const likelihood=num(r.likelihood,1,5),impact=num(r.impact,1,5);assert(Number.isInteger(likelihood)&&Number.isInteger(impact),'Risk matrix ratings must be whole numbers 1-5');return {risk:key(r.risk),likelihood,impact,owner:r.owner||null,mitigation:r.mitigation||null}}).map(r=>({...r,score:r.likelihood*r.impact,tier:r.likelihood*r.impact>=15?'high':r.likelihood*r.impact>=8?'medium':'low'}));
   metrics={total:details.length,high:details.filter(x=>x.tier==='high').length,average_exposure:avg(details.map(x=>x.score)),without_mitigation:details.filter(x=>!x.mitigation).length};
   recommendations=details.filter(x=>x.tier==='high').map(x=>'Review high risk: '+x.risk);break;
 }
 case 'strategy-alignment':{
   details=rows.map(r=>({initiative:key(r.initiative),objective:key(r.objective),progress:num(r.progress,0,100),weight:num(r.weight??1,0.01,100)}));
   const w=details.reduce((a,b)=>a+b.weight,0);metrics={initiatives:details.length,objectives:new Set(details.map(x=>x.objective)).size,weighted_progress:w?round(details.reduce((a,b)=>a+b.progress*b.weight,0)/w):null};
   recommendations=details.filter(x=>x.progress<50).map(x=>'Investigate lagging initiative '+x.initiative);break;
 }
 case 'maturity-assessment':{
   details=rows.map(r=>({dimension:key(r.dimension),score:num(r.score,0,5),target:num(r.target??5,0,5)})).map(r=>({...r,gap:round(r.target-r.score)}));
   metrics={dimensions:details.length,average_maturity:avg(details.map(x=>x.score)),below_target:details.filter(x=>x.gap>0).length};recommendations=details.filter(x=>x.gap>0).map(x=>'Improve '+x.dimension);break;
 }
 case 'portfolio-optimization':{
   const w=input.weights||{value:0.4,readiness:0.3,risk:0.3};['value','readiness','risk'].forEach(k=>num(w[k],0,1));assert(Math.abs(w.value+w.readiness+w.risk-1)<0.001,'Weights must total 1');
   details=rows.map(r=>({initiative:key(r.initiative),value:num(r.value,0,100),readiness:num(r.readiness,0,100),risk:num(r.risk,0,100)})).map(r=>({...r,priority:round(r.value*w.value+r.readiness*w.readiness+(100-r.risk)*w.risk)})).sort((a,b)=>b.priority-a.priority);
   metrics={initiatives:details.length,highest_priority:details[0]?.initiative||null,weights:w};break;
 }
 case 'resource-capacity':{
   details=rows.map(r=>({role:key(r.role),capacity:num(r.capacity,0),assigned:num(r.assigned,0)})).map(r=>({...r,utilization_pct:r.capacity?round(r.assigned/r.capacity*100):null,overallocated:r.assigned>r.capacity}));
   metrics={roles:details.length,overallocated:details.filter(x=>x.overallocated).length,unassigned_capacity:round(details.reduce((a,b)=>a+Math.max(0,b.capacity-b.assigned),0))};recommendations=details.filter(x=>x.overallocated).map(x=>'Rebalance '+x.role);break;
 }
 case 'board-decisions':{
   details=rows.map(r=>({decision:key(r.decision),status:['open','approved','rejected'].includes(r.status)?r.status:'open',owner:r.owner||null,due:r.due||null}));
   metrics={total:details.length,open:details.filter(x=>x.status==='open').length,approved:details.filter(x=>x.status==='approved').length};break;
 }
 case 'benchmarking':{
   details=rows.map(r=>({peer:key(r.peer),metric:key(r.metric),value:num(r.value),unit:key(r.unit)}));
   const comparable={};for(const d of details)(comparable[d.metric+'|'+d.unit]??=[]).push(d.value);
   details=details.map(d=>({...d,peer_mean:avg(comparable[d.metric+'|'+d.unit]),difference_to_mean:round(d.value-avg(comparable[d.metric+'|'+d.unit]))}));
   metrics={points:details.length,comparisons:Object.keys(comparable).length};break;
 }
 case 'forecasting':{
   const points=rows.map(r=>({period:key(r.period),value:num(r.value)}));assert(points.length>=2,'Need at least two historical points');
   const n=points.length,delta=round((points[n-1].value-points[0].value)/(n-1));
   const horizon=num(input.horizon??3,1,12);assert(Number.isInteger(horizon),'Forecast horizon must be an integer');
   details=Array.from({length:horizon},(_,i)=>({period:'future+'+(i+1),value:round(points[n-1].value+delta*(i+1)),assumption:'linear change; no confidence interval'}));
   metrics={observations:n,linear_change_per_period:delta,horizon,method:'simple linear scenario (NOT statistical prediction)'};break;
 }
 case 'executive-report':
 case 'weekly-operations': // not registered tool: retained for explicit rejection below
 case 'document-builder':
 case 'knowledge-lessons':{
   details=rows.map(r=>({title:key(r.title||r.name||'Record'),reviewed:r.reviewed===true,source_ref:r.source_ref||null,summary:String(r.summary||'').slice(0,1000)}));
   metrics={records:details.length,reviewed_with_source:details.filter(x=>x.reviewed&&x.source_ref).length,unverified:details.filter(x=>!(x.reviewed&&x.source_ref)).length};break;
 }
 default:throw new Error('Tool not implemented');
 }
 return {tool_id:tool.id,tool_version:tool.version,input_count:rows.length,metrics,details,recommendations,
   data_status:'caller-supplied',source_evidence_verified:false,qa_accepted:false,model_calls:0,external_actions:0,
   warning:'Calculated from supplied data only; verify source evidence and review before publishing'};
}
export function workforceSummary(tasks){
 const all=arr(tasks),accepted=all.filter(t=>t?.status==='accepted'&&t?.qa?.verified===true);
 const failed=all.filter(t=>t?.status==='failed'),running=all.filter(t=>['approved','running','awaiting-qa'].includes(t?.status));
 return {tasks:all.length,verified_accepted:accepted.length,failed:failed.length,active_or_pending:running.length,
   success_pct:all.length?round(accepted.length/all.length*100):null,
   avg_duration_ms:avg(accepted.filter(t=>Number.isFinite(t.duration_ms)).map(t=>t.duration_ms)),
   cost_usd:all.length>0&&all.every(t=>typeof t.cost_usd==='number'&&Number.isFinite(t.cost_usd))?round(all.reduce((a,b)=>a+b.cost_usd,0)):null,
   verified:'task-state-only; requires authenticated evidence store'};
}
