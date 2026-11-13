import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateLocalBundle,buildLocalTaskReport,createLocalReportFiles} from './local-report-cli.mjs';
const valid=()=>({
 schema_version:'theorg-local-bundle-1',tenant:'tenantA',company:'companyA',source_provenance_verified:false,
 tasks:[{id:'id-1',title:'Review weekly project scorecard',status:'accepted',tool:'kpi-variance',
          digest:'sha256:'+'a'.repeat(64),reviewer:'reviewerB'},
        {id:'id-2',title:'Investigate late milestone',status:'awaiting-qa',tool:'kpi-variance',reviewer:null}],
 events:[{id:'ev-1',task_id:'id-1',actor:'reviewerB',action:'accept',previous:'awaiting-qa',current:'accepted'}]
});
test('accepts bounded company-scoped export',()=>assert.equal(validateLocalBundle(valid()).tasks.length,2));
test('rejects cross-task event references',()=>{const b=valid();b.events[0].task_id='outside';assert.throws(()=>validateLocalBundle(b))});
test('rejects missing company scope and duplicate task ids',()=>{const b=valid();b.tenant='../other';assert.throws(()=>validateLocalBundle(b));const c=valid();c.tasks[1].id='id-1';assert.throws(()=>validateLocalBundle(c))});
test('report never fabricates source verification from local QA state',()=>{
 const report=buildLocalTaskReport(valid());
 assert.equal(report.status,'caller-supplied');
 assert.equal(report.metrics.integrity_reviewed,1);
 assert.equal(report.metrics.verified_business_sources,0);
 assert.equal(report.tasks[0].verified,false);
 assert.match(report.warning,/not independently verified/);
});
test('generates actual HTML CSV Markdown JSON files in isolated directory',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'theorg-report-test-'));
 try{
  const result=await createLocalReportFiles(valid(),folder);
  assert.equal(result.reports.length,8);
  const html=await readFile(join(folder,'theorg-ai-workforce-report.html'),'utf8');
  assert.match(html,/AI Workforce Operational Report/);
  assert.match(html,/Not verified/);
  const csv=await readFile(join(folder,'theorg-daily-brief.csv'),'utf8');
  assert.match(csv,/section,key,value/);
  const doc=JSON.parse(await readFile(join(folder,'theorg-daily-brief.json'),'utf8'));
  assert.equal(doc.status,'caller-supplied');
 }finally{await rm(folder,{recursive:true,force:true})}
});
test('unsupported format refuses to write files',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'theorg-report-test-'));
 try{await assert.rejects(()=>createLocalReportFiles(valid(),folder,{types:['daily-brief'],formats:['xlsx']}))}
 finally{await rm(folder,{recursive:true,force:true})}
});
