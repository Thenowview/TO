// TheOrg offline reporting bridge: local JSON export -> governed report drafts.
// Invoked on an owner-controlled machine. No remote calls or browser injection.
// Inbound local task acceptance is NOT independent verification of real business sources.
import {buildReport,exportArtifact} from './report-engine.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const STATUS=new Set(['draft','approved','awaiting-qa','accepted','rejected','failed','running']);
const CODE=/^[a-zA-Z0-9_-]{1,64}$/;
export function validateLocalBundle(raw){
 if(!raw||raw.schema_version!=='theorg-local-bundle-1')throw new Error('Unknown bundle schema');
 if(!CODE.test(raw.tenant||'')||!CODE.test(raw.company||''))throw new Error('Invalid tenant/company');
 if(!Array.isArray(raw.tasks)||raw.tasks.length>100||!Array.isArray(raw.events)||raw.events.length>500)throw new Error('Bundle exceeds limits');
 const seen=new Set();
 const tasks=raw.tasks.map(t=>{
  if(!t||typeof t.id!=='string'||t.id.length>64||seen.has(t.id)||typeof t.title!=='string'||t.title.length>240||!STATUS.has(t.status)||typeof t.tool!=='string'||t.tool.length>80)throw new Error('Invalid task');
  seen.add(t.id);
  return {id:t.id,title:t.title,tool:t.tool,status:t.status,reviewer:typeof t.reviewer==='string'?t.reviewer:null,
   digest:typeof t.digest==='string'&&/^sha256:[a-f0-9]{64}$/.test(t.digest)?t.digest:null};
 });
 const events=raw.events.map(e=>{
  if(!e||typeof e.id!=='string'||typeof e.task_id!=='string'||!seen.has(e.task_id)||!CODE.test(e.actor||'')||typeof e.action!=='string'||e.action.length>64)throw new Error('Invalid event');
  return {id:e.id,task_id:e.task_id,actor:e.actor,action:e.action,previous:e.previous,current:e.current};
 });
 return {tenant:raw.tenant,company:raw.company,tasks,events,
   source:'local export, integrity and business provenance unverified'};
}
export function buildLocalTaskReport(bundle,reportType='ai-workforce-report'){
 const local=validateLocalBundle(bundle);
 const tally={total:local.tasks.length,integrity_reviewed:local.tasks.filter(t=>t.status==='accepted'&&t.reviewer&&t.digest).length,
  pending_qa:local.tasks.filter(t=>t.status==='awaiting-qa').length,
  failures:local.tasks.filter(t=>t.status==='failed'||t.status==='rejected').length,
  tracked_events:local.events.length,verified_business_sources:0};
 const stateCount=Object.fromEntries([...STATUS].map(s=>[s,local.tasks.filter(t=>t.status===s).length]));
 return buildReport({type:reportType,
  title:reportType==='task-report'?'Local Task Execution Summary':'AI Workforce Operational Report',
  company:local.company,period:'Local export (unverified)',
  metrics:{...tally,...stateCount},tasks:local.tasks.map(t=>({
   id:t.id,title:t.title,status:t.status,qa:{verified:false}
  })),
  findings:['Source: operator-controlled local runtime bundle, not an authenticated enterprise data connector',
   'Accepted states represent local integrity/reviewer checks, not verified external KPI provenance',
   ...local.tasks.filter(t=>t.status==='failed'||t.status==='rejected').slice(0,15).map(t=>'Investigate task '+t.id)],
  recommendations:['Review original evidence before any executive publication',
   'Provision authenticated enterprise storage and source verification to enable verified board reporting'],
  data_status:'caller-supplied'});
}
export async function createLocalReportFiles(bundle,outputDir,{types=['ai-workforce-report','daily-brief'],formats=['html','csv','json','md']}={}){
 const doc=validateLocalBundle(bundle);
 if(!Array.isArray(types)||!Array.isArray(formats)||types.length>8||formats.length>4)throw new Error('Too many report variants');
 const root=resolve(outputDir);
 await mkdir(root,{recursive:true});
 const results=[];
 for(const type of types){
  const report=buildLocalTaskReport(bundle,type);
  for(const format of formats){
   const file=exportArtifact(report,format);
   const dest=join(root,file.filename);
   if(resolve(dest)!==dest||!dest.startsWith(root+'/')&&dest!==root)throw new Error('Unsafe export path');
   await writeFile(dest,file.content,{encoding:'utf8',flag:'w',mode:0o600});
   results.push(dest);
  }
 }
 return {company:doc.company,reports:results,verified_business_sources:0};
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length!==1)throw new Error('Usage: node local-report-cli.mjs <safe-output-directory> < local-export.json');
 let content='';for await(const part of process.stdin){content+=part;if(content.length>1024*1024)throw new Error('Local bundle too large')}
 const bundle=JSON.parse(content);
 const result=await createLocalReportFiles(bundle,args[0]);
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(process.argv[1]?.endsWith('local-report-cli.mjs'))main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1});
