/**
 * TheOrg Commercial Tool Registry, v1. Public, first-party deterministic workflows.
 * No model call, web research, payment, account or source verification occurs.
 * Each result is a client-side preview, not an AI-authenticated professional opinion.
 */
const n=(id,label,max=100,example=70,min=0)=>({id,label,type:'number',min,max,example});
const t=(id,label,example)=>({id,label,type:'text',maxLength:240,example});
const c=(id,label,example=false)=>({id,label,type:'boolean',example});
const d=(id,label,example)=>({id,label,type:'date',example});
const entry=(id,name,category,model,fields,{tier='advanced',price=39,epmo=true,route='reports',description='',reportType='task-report',signup=false}={})=>Object.freeze({
 id,name,category,model,fields:fields.map(x=>Object.freeze(x)),tier,price_usd:price,epmo_fit:epmo,
 report_type:reportType,signup_required_for_paid:signup,route,
 description:description||('Prepare an evidence-labeled '+name.toLowerCase()+' preview from your supplied inputs'),
 execution_mode:model==='memo'||model==='evidence'?'structured-draft':'deterministic-calculation',
 real_ai_enabled:false,checkout_enabled:false,available_as_preview:true
});
export const COMMERCIAL_TOOLS=Object.freeze([
 entry('project-health','Project Health Check','Projects','project',[n('delivery','Delivery confidence (%)',100,78),n('budget','Budget adherence (%)',100,86),n('risks','Risk management maturity (%)',100,67),n('governance','Governance readiness (%)',100,74)],{tier:'free',price:19,reportType:'portfolio-report',description:'A four-factor health score with key weaknesses and next actions'}),
 entry('kpi-analyzer','KPI Performance Analyzer','Performance','variance',[t('metric','KPI name','On-time delivery'),n('actual','Actual (%)',100,82),n('target','Target (%)',100,90),c('lowerBetter','Lower values are better',false)],{tier:'free',price:9,reportType:'strategy-report',description:'See actual, target and variance immediately'}),
 entry('risk-assessment','Project Risk Assessment','Governance','risk',[t('risk','Risk title','Dependency delay'),n('likelihood','Likelihood (1–5)',5,4,1),n('impact','Impact (1–5)',5,4,1),t('mitigation','Proposed mitigation','Weekly dependency review')],{tier:'free',price:19,reportType:'governance-report'}),
 entry('pmo-maturity','PMO Maturity Snapshot','Governance','maturity',[n('governance','Governance (0–5)',5,3,0),n('delivery','Delivery methods (0–5)',5,2,0),n('measurement','Measurement (0–5)',5,3,0),n('portfolio','Portfolio control (0–5)',5,2,0),n('people','People and capability (0–5)',5,3,0)],{tier:'free',price:39,reportType:'strategy-report'}),
 entry('decision-brief','Executive Decision Brief','Executive','decision',[t('decision','Decision required','Approve project recovery option'),n('value','Expected business value (%)',100,80),n('confidence','Supporting evidence completeness (%)',100,65),n('risk','Decision risk (%)',100,40),t('owner','Accountable decision owner','Project sponsor')],{tier:'free',price:19,reportType:'board-pack'}),
 entry('milestone-delay','Milestone Delay Analyst','Projects','dates',[t('milestone','Milestone','Go-live'),d('planned','Planned date','2026-11-10'),d('actual','Actual completion date','2026-11-14')],{tier:'quick-win',price:9}),
 entry('portfolio-performance','Portfolio Performance Analyst','Projects','project',[n('delivery','Delivery (%)',100,75),n('budget','Financial control (%)',100,85),n('risks','Risk controls (%)',100,60),n('governance','Alignment (%)',100,80)],{tier:'advanced',price:59,reportType:'portfolio-report',signup:true}),
 entry('resource-capacity','Resource Capacity Analyst','Operations','capacity',[t('team','Team','Delivery Office'),n('available','Available hours',2000,160,1),n('allocated','Allocated hours',2000,180)],{tier:'quick-win',price:19,reportType:'portfolio-report'}),
 entry('financial-variance','Project Financial Analyst','Finance','finance',[t('project','Project','Portfolio Alpha'),n('budget','Approved budget',100000000,100000,1),n('spent','Recorded spending',100000000,112000)],{tier:'advanced',price:59,signup:true}),
 entry('strategy-alignment','Strategic Alignment Analyst','Strategy','score',[n('objective','Objective alignment (%)',100,85),n('ownership','Owner clarity (%)',100,80),n('measurement','Success metrics readiness (%)',100,62)],{tier:'advanced',price:59,signup:true,reportType:'strategy-report'}),
 entry('benefits-realization','Benefits Realization Analyst','Strategy','variance',[t('metric','Benefit measure','Hours saved'),n('actual','Realized benefit',100,60),n('target','Expected benefit',100,85),c('lowerBetter','Lower values are better',false)],{tier:'advanced',price:59,signup:true,reportType:'strategy-report'}),
 entry('compliance-evidence','Compliance Evidence Reviewer','Governance','evidence',[t('control','Control or requirement','Project change approval'),c('policy','Documented policy available',true),c('owner','Accountable owner assigned',true),c('proof','Supporting evidence attached',false),c('review','Independent review recorded',false)],{tier:'advanced',price:59,signup:true,reportType:'governance-report'}),
 entry('portfolio-priority','Portfolio Prioritization Agent','Strategy','priority',[t('initiative','Initiative','Automation initiative'),n('value','Business value (%)',100,83),n('readiness','Delivery readiness (%)',100,71),n('risk','Execution risk (%)',100,40)],{tier:'advanced',price:59,signup:true,reportType:'portfolio-report'}),
 entry('forecast-scenario','Business Forecasting Scenario','Finance','forecast',[t('metric','Indicator','Quarterly delivery score'),n('period1','First observed period',1000000,65),n('period2','Second observed period',1000000,73),n('period3','Third observed period',1000000,80)],{tier:'advanced',price:59,signup:true}),
 entry('root-cause','Root Cause Investigation','Operations','memo',[t('problem','Observed problem','Milestone delivery is below target'),t('hypothesis','Hypothesis to test','Dependency approvals take longer than expected'),t('evidence','Evidence available','Milestone log and approval dates'),t('owner','Investigation owner','Delivery manager')],{tier:'advanced',price:59,signup:true}),
 entry('lessons-learned','Lessons Learned Curator','Knowledge','memo',[t('event','Event or project outcome','Project delay'),t('observation','What happened','Dependency approval lagged'),t('lesson','Draft lesson','Escalate aged approvals weekly'),t('evidence','Supporting source','Synthetic project closeout record')],{tier:'advanced',price:39,signup:true}),
 entry('executive-report','Executive Report Generator','Executive','memo',[t('topic','Reporting subject','Weekly project portfolio health'),t('finding','Known key finding','Three milestones need review'),t('action','Proposed next action','Request accountable owners to submit updates'),t('source','Evidence reference','User-provided example only')],{tier:'advanced',price:39,signup:true,reportType:'daily-brief'}),
 entry('task-quality','Task Quality Auditor','Governance','evidence',[t('control','Deliverable','Executive status report'),c('policy','Acceptance criteria documented',true),c('owner','Task owner identified',true),c('proof','Output evidence provided',false),c('review','Independent review completed',false)],{tier:'advanced',price:39,signup:true,reportType:'task-report'}),
 entry('board-pack','Board Pack Builder','Executive','memo',[t('topic','Board agenda topic','Quarterly delivery assurance'),t('finding','Verified facts to reference','Pending evidence checks on several projects'),t('action','Decision requested','Approve corrective action review'),t('source','Evidence/source references','User-supplied evidence only')],{tier:'advanced',price:99,signup:true,reportType:'board-pack'}),
 entry('knowledge-research','Enterprise Knowledge Researcher','Knowledge','memo',[t('topic','Research question','What caused delivery delays?'),t('finding','User-supplied documented answer','The dependency handoff needs review'),t('action','Proposed follow-up','Check evidence with project owners'),t('source','Source/reference','User-provided source identifier')],{tier:'advanced',price:39,signup:true,epmo:false}),
 entry('market-research','Market Research Brief','Strategy','memo',[t('topic','Market or customer segment','Small-team project review services'),t('finding','Known observation or hypothesis','SMEs may value fixed-price report reviews'),t('action','Validation next step','Interview five potential customers'),t('source','Source, or label as hypothesis','Unvalidated hypothesis')],{tier:'advanced',price:59,signup:true,epmo:false}),
 entry('swot','Business SWOT Snapshot','Strategy','swot',[t('strength','Strength','Clear reporting process'),t('weakness','Weakness','Limited customer validation'),t('opportunity','Opportunity','Demand for one-off reports'),t('threat','Threat','Established competitors')],{tier:'quick-win',price:19,epmo:false})
]);
const fail=message=>{throw new Error(message)};
const round=n=>Math.round(n*100)/100;
const safeText=(v,field)=>{if(typeof v!=='string'||!v.trim()||v.length>field.maxLength&&field.maxLength||v.length>240)fail('Enter a valid '+field.label);return v.trim()};
const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))fail('Use YYYY-MM-DD dates');const n=Date.parse(v+'T00:00:00.000Z');if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==v)fail('Invalid date');return n};
const grade=score=>score>=85?'Strong':score>=70?'Watch':score>=50?'Needs attention':'Critical';
export function exampleForTool(id){
 const tool=COMMERCIAL_TOOLS.find(t=>t.id===id);
 if(!tool)fail('Unknown tool');
 return Object.fromEntries(tool.fields.map(field=>[field.id,field.example]));
}
export function analyzeCommercialTool(id,input){
 const tool=COMMERCIAL_TOOLS.find(t=>t.id===id);
 if(!tool)fail('Unknown tool');
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Provide tool inputs');
 const values={};
 for(const field of tool.fields){
  const value=input[field.id];
  if(field.type==='text')values[field.id]=safeText(value,field);
  else if(field.type==='date'){date(value);values[field.id]=value}
  else if(field.type==='boolean'){if(typeof value!=='boolean')fail('Invalid selection: '+field.label);values[field.id]=value}
  else if(field.type==='number'){
   if(typeof value!=='number'||!Number.isFinite(value)||value<field.min||value>field.max)fail('Invalid number: '+field.label);
   values[field.id]=value;
  }else fail('Unknown input field');
 }
 const m={},findings=[],actions=[],v=values;
 switch(tool.model){
  case 'project':{
   const score=round(v.delivery*0.35+v.budget*0.25+v.risks*0.25+v.governance*0.15);
   Object.assign(m,{project_health_score:score,health_band:grade(score),delivery_pct:v.delivery,budget_control_pct:v.budget,risk_control_pct:v.risks,governance_pct:v.governance});
   const areas=[['delivery',v.delivery],['budget',v.budget],['risks',v.risks],['governance',v.governance]].sort((a,b)=>a[1]-b[1]);
   findings.push('Weighted health score '+score+'/100 (user inputs, not audited)','Weakest provided dimension: '+areas[0][0]+' ('+areas[0][1]+'%)');
   actions.push('Ask the accountable owner to evidence the weakest dimension and approve a remediation plan');break;
  }
  case 'variance':{
   const gap=round(v.actual-v.target);const met=v.lowerBetter?v.actual<=v.target:v.actual>=v.target;
   Object.assign(m,{actual:v.actual,target:v.target,variance:gap,meets_target:met,measure:v.metric});
   findings.push(v.metric+': actual '+v.actual+' vs target '+v.target+'; gap '+gap);
   actions.push(met?'Document what sustained the target':'Request reviewed corrective actions from metric owner');break;
  }
  case 'risk':{
   if(!Number.isInteger(v.likelihood)||!Number.isInteger(v.impact))fail('Risk ratings must be whole numbers');
   const score=v.likelihood*v.impact;Object.assign(m,{risk_score:score,risk_band:score>=15?'High':score>=8?'Medium':'Low',likelihood:v.likelihood,impact:v.impact});
   findings.push(v.risk+': risk score '+score+'/25 under the illustrative 5×5 model');
   actions.push('Review mitigation: '+v.mitigation);break;
  }
  case 'maturity':{
   for(const key of ['governance','delivery','measurement','portfolio','people'])if(!Number.isInteger(v[key]))fail('Maturity ratings must be whole numbers');
   const dims=['governance','delivery','measurement','portfolio','people'];const mean=round(dims.reduce((a,k)=>a+v[k],0)/5);
   Object.assign(m,{average_maturity:mean,maximum_maturity:5,dimensions_assessed:5});
   findings.push('Average maturity '+mean+'/5 based on supplied self-ratings');
   actions.push('Prioritize improvement of '+dims.sort((a,b)=>v[a]-v[b])[0]+' and establish evidence requirements');break;
  }
  case 'decision':{
   const readiness=round(v.value*0.45+v.confidence*0.4+(100-v.risk)*0.15);
   Object.assign(m,{decision_readiness_score:readiness,confidence_pct:v.confidence,risk_pct:v.risk});
   findings.push(v.decision+': indicative readiness '+readiness+'/100');
   actions.push('Send evidence gaps to '+v.owner+' and obtain human decision approval');break;
  }
  case 'dates':{
   const days=Math.round((date(v.actual)-date(v.planned))/86400000);
   Object.assign(m,{days_from_plan:days,status:days>0?'Late':days<0?'Early':'On time'});
   findings.push(v.milestone+': '+(days>0?days+' days after plan':days<0?Math.abs(days)+' days before plan':'on planned date'));
   actions.push('Validate milestone completion evidence and update the approved project schedule');break;
  }
  case 'capacity':{
   const utilization=round(v.allocated/v.available*100);
   Object.assign(m,{utilization_pct:utilization,remaining_hours:round(v.available-v.allocated),overallocated:utilization>100});
   findings.push(v.team+': '+utilization+'% allocation against stated capacity');
   actions.push(utilization>100?'Request workload rebalance and owner approval':'Maintain capacity monitoring');break;
  }
  case 'finance':{
   const gap=round(v.spent-v.budget);const pct=round(gap/v.budget*100);
   Object.assign(m,{approved_budget:v.budget,recorded_spending:v.spent,budget_variance:gap,variance_pct:pct,over_budget:gap>0});
   findings.push(v.project+': '+pct+'% spending deviation relative to approved budget');
   actions.push(gap>0?'Validate invoices and request a financial control review':'Reconcile source ledger and current commitments');break;
  }
  case 'score':{
   const keys=['objective','ownership','measurement'];const mean=round(keys.reduce((a,k)=>a+v[k],0)/keys.length);
   Object.assign(m,{alignment_score:mean,alignment_band:grade(mean)});
   findings.push('Self-assessed strategy readiness: '+mean+'/100');
   actions.push('Review weakest strategic control: '+keys.sort((a,b)=>v[a]-v[b])[0]);break;
  }
  case 'evidence':{
   const checks=['policy','owner','proof','review'];const complete=checks.filter(k=>v[k]).length;const score=complete*25;
   Object.assign(m,{checklist_complete:complete,checklist_total:4,readiness_pct:score,independent_qa_claimed:v.review,source_verified:false});
   findings.push(v.control+': '+complete+' of 4 checklist items marked complete by user');
   actions.push(...checks.filter(k=>!v[k]).map(k=>'Obtain '+k+' evidence or approval'));break;
  }
  case 'priority':{
   const score=round(v.value*0.4+v.readiness*0.3+(100-v.risk)*0.3);
   Object.assign(m,{priority_score:score,value_pct:v.value,readiness_pct:v.readiness,risk_pct:v.risk});
   findings.push(v.initiative+': illustrative priority '+score+'/100');
   actions.push('Compare other initiatives using the same weighting and seek portfolio approval');break;
  }
  case 'forecast':{
   const change=round((v.period3-v.period1)/2);const next=round(v.period3+change);
   Object.assign(m,{historical_last:v.period3,linear_change_per_period:change,next_period_scenario:next,model:'simple linear scenario'});
   findings.push(v.metric+': next period scenario '+next+' (linear projection, not a validated forecast)');
   actions.push('Gather longer time series and test alternative scenarios before planning decisions');break;
  }
  case 'swot':{
   Object.assign(m,{quadrants_completed:4,source_evidence_verified:false});
   findings.push('Strength: '+v.strength,'Weakness: '+v.weakness,'Opportunity: '+v.opportunity,'Threat: '+v.threat);
   actions.push('Validate each statement against evidence and prioritize two actions');break;
  }
  case 'memo':{
   Object.assign(m,{draft_sections:4,externally_verified_sources:0});
   for(const field of tool.fields)findings.push(field.label+': '+v[field.id]);
   actions.push('Check source references and submit the draft for independent review');break;
  }
  default:fail('Unimplemented calculation');
 }
 return {schema_version:'theorg-commercial-preview-1',tool_id:id,tool_name:tool.name,category:tool.category,
   calculated_metrics:m,findings,proposed_actions:actions,report_type:tool.report_type,
   input_status:'self-reported',source_verified:false,qa_accepted:false,model_calls:0,executed_actions:0,
   paid_report_unlocked:false,generated_at:new Date().toISOString(),
   disclosure:'Illustrative preview using user-provided fields. Not AI inference, independently verified evidence, a paid deliverable or professional advice.'};
}
export function commercialCategories(){return [...new Set(COMMERCIAL_TOOLS.map(t=>t.category))].sort()}
export function saleSummary(){return {total:COMMERCIAL_TOOLS.length,free:COMMERCIAL_TOOLS.filter(t=>t.tier==='free').length,
 one_off:COMMERCIAL_TOOLS.filter(t=>t.tier==='quick-win').length,advanced:COMMERCIAL_TOOLS.filter(t=>t.tier==='advanced').length,
 checkout_live:false,accounts_live:false,ready_for_payment:false}}
