// TheOrg standalone task-to-dashboard contracts. No model/provider or tool execution occurs here.
export const TOOL_TEMPLATES=Object.freeze([
 {id:'kpi-variance',name:'KPI variance calculator',category:'Analytics',description:'Compute arithmetic variances from supplied values without claiming source verification',kind:'analysis',trigger:'manual',steps:['Validate supplied KPI inputs','Calculate KPI variances','Prepare arithmetic summary'],metric:'delivery_health'},
 {id:'epmo-status',name:'Project status analyst',category:'Project delivery',description:'Review milestone, delivery and blocker evidence',steps:['Collect status','Validate evidence','Summarize variance','Prepare decision brief'],metric:'delivery_health'},
 {id:'epmo-risk',name:'Risk register analyst',category:'Risk',description:'Review open risks, probability and impact, with owner actions',steps:['Collect risks','Score exposure','Review mitigation','Prepare risk dashboard'],metric:'risk_exposure'},
 {id:'epmo-approval',name:'Approval gate reviewer',category:'Governance',description:'Check criteria, evidence and assigned approval before an advisory recommendation',steps:['Gather criteria','Verify evidence','Identify blockers','Prepare approval recommendation'],metric:'approval_readiness'},
 {id:'epmo-resources',name:'Resource capacity analyst',category:'Operations',description:'Analyze resource utilization and near-term availability',steps:['Collect capacity','Check assignments','Calculate variance','Suggest rebalance'],metric:'capacity_utilization'},
 {id:'epmo-lessons',name:'Knowledge curator',category:'Knowledge',description:'Extract draft lessons and request independent review',steps:['Collect outcomes','Draft lesson','Identify sources','Request QA review'],metric:'evidence_completeness'}
]);
const ID=/^[a-z][a-z0-9-]{2,49}$/;
const permitted=['analysis','classification','summarization','reporting','planning','research'];
const kinds=['manual','scheduled','on-event'];
const allowedMetrics=['delivery_health','risk_exposure','approval_readiness','capacity_utilization','evidence_completeness'];
export function validateTool(raw){
 if(!raw||typeof raw!=='object')throw new Error('Tool required');
 const tool={id:String(raw.id||''),name:String(raw.name||''),description:String(raw.description||''),kind:String(raw.kind||'analysis'),trigger:String(raw.trigger||'manual'),metric:String(raw.metric||'delivery_health'),steps:raw.steps};
 if(!ID.test(tool.id)||tool.name.trim().length<3||tool.name.length>80||tool.description.length>500||!permitted.includes(tool.kind)||!kinds.includes(tool.trigger)||!allowedMetrics.includes(tool.metric))throw new Error('Invalid tool definition');
 if(!Array.isArray(tool.steps)||tool.steps.length<2||tool.steps.length>8||tool.steps.some(s=>typeof s!=='string'||s.trim().length<3||s.length>120))throw new Error('Invalid steps');
 return Object.freeze({...tool,name:tool.name.trim(),steps:tool.steps.map(x=>x.trim()),execution_mode:'design-only',requires_approval:true});
}
export function validateTask(raw,tool){
 if(!tool||!raw||typeof raw!=='object')throw new Error('Tool and task required');
 const title=String(raw.title||'').trim(),scope=String(raw.scope||'').trim(),owner=String(raw.owner||'').trim();
 if(title.length<8||title.length>240||scope.length<3||scope.length>120||owner.length<3||owner.length>100)throw new Error('Invalid task');
 return {id:crypto.randomUUID(),tool_id:tool.id,tool_name:tool.name,title,scope,owner,created_at:new Date().toISOString(),status:'draft',execution_mode:'simulation',steps:tool.steps.map((name,i)=>({index:i+1,name,status:'not-run'})),events:[{type:'drafted',at:new Date().toISOString()}],metrics:{steps_total:tool.steps.length,steps_completed:0,evidence_items:0,completion_pct:0},qa_state:'not-reviewed',outcome:'not-verified'};
}
export function taskSummary(tasks){
 const list=Array.isArray(tasks)?tasks:[];
 const counts={total:list.length,draft:0,reviewed:0,closed:0,rejected:0,other:0};
 for(const task of list){const k=task.status;if(k in counts&&k!=='total')counts[k]++;else counts.other++}
 return counts;
}
export function simulatePlan(task){
 if(!task||task.execution_mode!=='simulation')throw new Error('Simulation only');
 return {...task,status:'reviewed',qa_state:'illustrative-only',outcome:'No execution: workflow plan generated locally',steps:task.steps.map(s=>({...s,status:'planned'})),events:[...task.events,{type:'simulation_previewed',at:new Date().toISOString()}]};
}
