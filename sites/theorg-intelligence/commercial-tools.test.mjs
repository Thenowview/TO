import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMERCIAL_TOOLS,exampleForTool,analyzeCommercialTool,saleSummary,commercialCategories} from './commercial-tools.mjs';
import {buildReport,exportArtifact} from './report-engine.mjs';

test('22 unique commercially categorized workflows with no active purchase',()=>{
 const summary=saleSummary();
 assert.deepEqual({total:summary.total,free:summary.free,one_off:summary.one_off,advanced:summary.advanced},{total:22,free:5,one_off:3,advanced:14});
 assert.equal(new Set(COMMERCIAL_TOOLS.map(t=>t.id)).size,22);
 assert.equal(summary.checkout_live,false);
 assert.equal(summary.accounts_live,false);
 assert.equal(summary.ready_for_payment,false);
 for(const tool of COMMERCIAL_TOOLS){assert.equal(tool.checkout_enabled,false);assert.equal(tool.real_ai_enabled,false)}
});
test('all 22 example workflows produce deterministic, labeled, non-authoritative results',()=>{
 for(const tool of COMMERCIAL_TOOLS){
  const out=analyzeCommercialTool(tool.id,exampleForTool(tool.id));
  assert.equal(out.tool_id,tool.id);
  assert.ok(Object.keys(out.calculated_metrics).length>=1,'Missing metrics: '+tool.id);
  assert.ok(out.findings.length>=1,'Missing findings: '+tool.id);
  assert.ok(out.proposed_actions.length>=1,'Missing actions: '+tool.id);
  assert.equal(out.input_status,'self-reported');
  assert.equal(out.source_verified,false);
  assert.equal(out.qa_accepted,false);
  assert.equal(out.paid_report_unlocked,false);
  assert.equal(out.model_calls,0);
  assert.equal(out.executed_actions,0);
 }
});
test('quick-win KPI performance: higher and lower is better',()=>{
 const input=exampleForTool('kpi-analyzer');
 const result=analyzeCommercialTool('kpi-analyzer',input);
 assert.equal(result.calculated_metrics.variance,-8);
 assert.equal(result.calculated_metrics.meets_target,false);
 input.lowerBetter=true;
 assert.equal(analyzeCommercialTool('kpi-analyzer',input).calculated_metrics.meets_target,true);
});
test('risk matrix boundaries and score',()=>{
 const input=exampleForTool('risk-assessment');
 assert.equal(analyzeCommercialTool('risk-assessment',input).calculated_metrics.risk_score,16);
 for(const likelihood of [2.3,0,6,NaN,Infinity,'3',null]){
  assert.throws(()=>analyzeCommercialTool('risk-assessment',{...input,likelihood}));
 }
});
test('strict PMO maturity self-ratings',()=>{
 const input=exampleForTool('pmo-maturity');
 assert.equal(analyzeCommercialTool('pmo-maturity',input).calculated_metrics.dimensions_assessed,5);
 assert.throws(()=>analyzeCommercialTool('pmo-maturity',{...input,governance:2.5}));
});
test('calendar checks reject invalid and ambiguous milestone dates',()=>{
 const input=exampleForTool('milestone-delay');
 assert.equal(analyzeCommercialTool('milestone-delay',input).calculated_metrics.days_from_plan,4);
 for(const planned of ['2026-02-30','2026/11/01','tomorrow',null]){
  assert.throws(()=>analyzeCommercialTool('milestone-delay',{...input,planned}));
 }
});
test('finance and capacity math use supplied numbers only',()=>{
 assert.equal(analyzeCommercialTool('financial-variance',exampleForTool('financial-variance')).calculated_metrics.variance_pct,12);
 assert.equal(analyzeCommercialTool('resource-capacity',exampleForTool('resource-capacity')).calculated_metrics.overallocated,true);
 assert.throws(()=>analyzeCommercialTool('resource-capacity',{...exampleForTool('resource-capacity'),available:0}));
});
test('forecast is a scenario, not a statistically validated prediction',()=>{
 const result=analyzeCommercialTool('forecast-scenario',exampleForTool('forecast-scenario'));
 assert.equal(result.calculated_metrics.next_period_scenario,87.5);
 assert.match(result.findings.join(' '),/not a validated forecast/);
});
test('no hidden checkout, accounts, external calls, or claimed AI in commercial workflow',()=>{
 const list=COMMERCIAL_TOOLS.map(t=>t.execution_mode);
 assert.ok(list.every(x=>['structured-draft','deterministic-calculation'].includes(x)));
 assert.ok(COMMERCIAL_TOOLS.some(t=>t.epmo_fit));
 assert.ok(COMMERCIAL_TOOLS.some(t=>!t.epmo_fit));
 assert.ok(commercialCategories().length>=4);
});
test('invalid payloads and malicious type-coercion rejected',()=>{
 for(const data of [null,[],{'actual':'90'},{}])assert.throws(()=>analyzeCommercialTool('kpi-analyzer',data));
 assert.throws(()=>analyzeCommercialTool('root-cause',{...exampleForTool('root-cause'),problem:'x'.repeat(300)}));
 assert.throws(()=>analyzeCommercialTool('compliance-evidence',{...exampleForTool('compliance-evidence'),review:'yes'}));
});
test('every workflow produces a draft HTML/JSON report via shared report engine',()=>{
 for(const tool of COMMERCIAL_TOOLS){
  const r=analyzeCommercialTool(tool.id,exampleForTool(tool.id));
  const doc=buildReport({type:r.report_type,title:r.tool_name,metrics:r.calculated_metrics,findings:r.findings,recommendations:r.proposed_actions,data_status:'caller-supplied'});
  assert.equal(doc.status,'caller-supplied');
  assert.match(doc.warning,/not independently verified/i);
  const html=exportArtifact(doc,'html');
  assert.match(html.content,/not independently verified/i);
  const json=JSON.parse(exportArtifact(doc,'json').content);
  assert.equal(json.report_type,r.report_type);
 }
});
test('paid report cannot be unlocked by a user-supplied flag',()=>{
 const r=analyzeCommercialTool('board-pack',{...exampleForTool('board-pack'),paid_report_unlocked:true,qa_accepted:true});
 assert.equal(r.paid_report_unlocked,false);assert.equal(r.qa_accepted,false);
});
