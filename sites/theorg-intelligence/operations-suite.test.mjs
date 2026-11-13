import test from 'node:test';
import assert from 'node:assert/strict';
import {OPERATIONS_TOOLS,REPORT_TYPES,analyzeOperations,workforceSummary} from './operations-analytics.mjs';
import {REPORT_CATALOG,buildReport,reportHTML,reportMarkdown,reportCSV,exportArtifact} from './report-engine.mjs';
const samples={
'executive-report':[{title:'Task A',reviewed:true,source_ref:'sample:1'}],
'kpi-intelligence':[{name:'KPI A',actual:83,target:90}],
'project-performance':[{project:'P',milestone:'Delivery',planned:'2026-10-01',actual:'2026-10-04'}],
'risk-compliance':[{risk:'Delay',likelihood:4,impact:4}],
'strategy-alignment':[{initiative:'I',objective:'O',progress:80,weight:1}],
'maturity-assessment':[{dimension:'Governance',score:3,target:4}],
'portfolio-optimization':[{initiative:'I',value:80,readiness:70,risk:20}],
'resource-capacity':[{role:'Dev',capacity:10,assigned:12}],
'board-decisions':[{decision:'D',status:'open'}],
'document-builder':[{title:'Template',reviewed:false}],
'benchmarking':[{peer:'A',metric:'Quality',value:80,unit:'%'},{peer:'B',metric:'Quality',value:90,unit:'%'}],
'knowledge-lessons':[{title:'Review',reviewed:true,source_ref:'sample:2'}],
'forecasting':[{period:'M1',value:10},{period:'M2',value:12}]
};
test('13 distinct registered bounded tools',()=>assert.equal(new Set(OPERATIONS_TOOLS.map(x=>x.id)).size,13));
test('all tool recipes produce bounded, explicitly unverified results',()=>{
 for(const t of OPERATIONS_TOOLS){const r=analyzeOperations(t.id,{rows:samples[t.id],horizon:3});assert.equal(r.tool_id,t.id);assert.equal(r.qa_accepted,false);assert.equal(r.source_evidence_verified,false);assert.equal(r.model_calls,0);assert.equal(r.external_actions,0)}
});
test('KPI gaps include direction and targets',()=>{const r=analyzeOperations('kpi-intelligence',{rows:[{name:'Risk',actual:21,target:15,direction:'lower'}]});assert.equal(r.metrics.missed,1);assert.equal(r.details[0].gap,6)});
test('risk score is 5 by 5',()=>{const r=analyzeOperations('risk-compliance',{rows:samples['risk-compliance']});assert.equal(r.details[0].score,16);assert.equal(r.metrics.high,1)});
test('portfolio weights must total one',()=>assert.throws(()=>analyzeOperations('portfolio-optimization',{rows:samples['portfolio-optimization'],weights:{value:1,readiness:1,risk:1}})));
test('forecast requires 2 points and is labeled scenario',()=>{assert.throws(()=>analyzeOperations('forecasting',{rows:[{period:'M1',value:3}]}));assert.match(analyzeOperations('forecasting',{rows:samples.forecasting,horizon:3}).metrics.method,/NOT statistical prediction/)});
test('resource overload detected',()=>assert.equal(analyzeOperations('resource-capacity',{rows:samples['resource-capacity']}).metrics.overallocated,1));
test('workforce success excludes unverified accepted tasks',()=>{const s=workforceSummary([{status:'accepted',qa:{verified:false}},{status:'accepted',qa:{verified:true}},{status:'failed'}]);assert.equal(s.verified_accepted,1);assert.equal(s.failed,1)});
test('eight distinct report formats',()=>{assert.equal(REPORT_CATALOG.length,8);assert.equal(new Set(REPORT_TYPES.map(x=>x.id)).size,8)});
test('all report templates produce HTML CSV Markdown JSON',()=>{for(const r of REPORT_CATALOG){const doc=buildReport({type:r.id,metrics:{progress:83}});for(const ext of ['html','csv','md','json'])assert.ok(exportArtifact(doc,ext).content.length>10)}});
test('HTML export escapes injected title and findings',()=>{const doc=buildReport({type:'board-pack',title:'<script>alert(1)</script>',findings:['<img src=x>']});const html=reportHTML(doc);assert.doesNotMatch(html,/<script>alert|<img src=x>/);assert.match(html,/&lt;script&gt;/)});
test('no false verified report from caller flag alone',()=>assert.throws(()=>buildReport({type:'daily-brief',data_status:'verified'})));
test('CSV quotes and Markdown sanitized',()=>{const doc=buildReport({type:'task-report',metrics:{'a,b':'a"b'},findings:['Hello\nworld']});assert.match(reportCSV(doc),/"a,b"/);assert.match(reportMarkdown(doc),/Hello world/)});
test('unimplemented native office exports are rejected',()=>{const doc=buildReport({type:'daily-brief'});for(const f of ['pptx','xlsx','docx','pdf'])assert.throws(()=>exportArtifact(doc,f))});
