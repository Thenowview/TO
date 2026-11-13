// TheOrg report builder: original implementation informed by report layout patterns
// observed in user-supplied CEOBI/StackSilah archives. No copied source or fonts.
export const REPORT_CATALOG=Object.freeze([
{id:'daily-brief',name:'Executive Daily Brief',sections:['Executive pulse','Top exceptions','Decisions required','Tasks accepted','Next actions']},
{id:'task-report',name:'Individual Task Report',sections:['Task identity','Inputs and provenance','Execution steps','Evidence','Independent QA','Outcomes']},
{id:'weekly-operations',name:'Weekly Operations Report',sections:['Workload','Verified throughput','Failures and blockers','Department performance','Next week']},
{id:'portfolio-report',name:'Project & Portfolio Report',sections:['Delivery pulse','Milestones','Resource allocation','Portfolio risks','Corrective actions']},
{id:'strategy-report',name:'Strategy Performance Report',sections:['Objectives','KPI scorecard','Variances','Strategic initiatives','Recommendations']},
{id:'governance-report',name:'Governance & Risk Report',sections:['Risk profile','Controls','Compliance gaps','QA evidence','Mitigation plan']},
{id:'board-pack',name:'Board & Committee Pack',sections:['Executive summary','Strategic performance','Financial outlook','Decision requests','Risk and compliance','Portfolio delivery','Actions and evidence']},
{id:'ai-workforce-report',name:'AI Workforce Performance Report',sections:['Tool activity','Verified outcomes','Failure reasons','Time and cost coverage','Independent QA']}
]);
const fail=(message)=>{throw new Error(message)};
const str=(x,limit=1500)=>typeof x==='string'?x.slice(0,limit):x===null||x===undefined?'':String(x).slice(0,limit);
const esc=x=>str(x,5000).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const list=(a)=>Array.isArray(a)?a.slice(0,200):[];
const toCell=v=>v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);
const csvCell=v=>{const raw=toCell(v);const safe=/^[\s]*[=+@\-]/.test(raw)?"'"+raw:raw;return '"'+safe.replace(/"/g,'""')+'"';};
export function buildReport({type,title,company,period,metrics={},findings=[],recommendations=[],tasks=[],evidence=[],approval=null,data_status='synthetic'}={}){
 const recipe=REPORT_CATALOG.find(r=>r.id===type);if(!recipe)fail('Unknown report template');
 const cleanTitle=str(title||recipe.name,160),cleanCompany=str(company||'Example Company',120);
 if(!cleanTitle.trim()||!cleanCompany.trim())fail('Report title and company required');
 if(!['synthetic','caller-supplied','verified'].includes(data_status))fail('Unknown data status');
 if(data_status==='verified')fail('Verified publication requires a separate authenticated server-side QA receipt; caller flags are not authority');
 return {schema_version:'1.0',report_type:type,title:cleanTitle,company:cleanCompany,period:str(period||'Unspecified period',80),
 status:data_status,generated_at:new Date().toISOString(),classification:'internal-demo',sections:recipe.sections,
 metrics:Object.fromEntries(Object.entries(metrics).slice(0,60).map(([k,v])=>[str(k,80),v])),
 findings:list(findings).map(x=>str(x,600)),recommendations:list(recommendations).map(x=>str(x,600)),
 tasks:list(tasks).map(x=>({id:str(x.id||'',80),title:str(x.title||'',200),status:str(x.status||'unverified',40),verified:false})),
 evidence:list(evidence).map(x=>({ref:str(x.ref||'',180),digest:str(x.digest||'',100)})),
 approval:approval?{reviewer:str(approval.reviewer||'',100),authorized:approval.authorized===true}:null,
 warning:data_status==='verified'?null:'Draft report: supplied/sample inputs are not independently verified'};
}
export function reportHTML(report){
 if(!report?.schema_version)fail('Report missing');
 const rows=Object.entries(report.metrics||{}).map(([k,v])=>'<tr><th>'+esc(k)+'</th><td>'+esc(toCell(v))+'</td></tr>').join('');
 const findings=list(report.findings).map(x=>'<li>'+esc(x)+'</li>').join('');
 const recommendations=list(report.recommendations).map(x=>'<li>'+esc(x)+'</li>').join('');
 const tasks=list(report.tasks).map(t=>'<tr><td>'+esc(t.id)+'</td><td>'+esc(t.title)+'</td><td>'+esc(t.status)+'</td><td>'+esc(t.verified?'Verified':'Not verified')+'</td></tr>').join('');
 return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(report.title)+'</title><style>body{font:15px/1.6 system-ui,sans-serif;color:#182638;margin:0;padding:30px;max-width:900px}h1{font-size:30px}h2{border-bottom:1px solid #c5d2dd;padding-bottom:8px;margin-top:32px}header{border-bottom:4px solid #137b78}small{color:#475569}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:8px;border-bottom:1px solid #d6e0eb}aside{padding:14px;background:#fff6e5;border-left:4px solid #b66c10}@media print{body{padding:0}button{display:none}}</style><header><small>THEORG / EXECUTIVE INTELLIGENCE</small><h1>'+esc(report.title)+'</h1><p>'+esc(report.company)+' · '+esc(report.period)+' · '+esc(report.generated_at)+'</p></header>'+
 (report.warning?'<aside>'+esc(report.warning)+'</aside>':'')+
 '<h2>Performance indicators</h2><table>'+rows+'</table><h2>Findings</h2><ul>'+findings+'</ul><h2>Recommendations</h2><ul>'+recommendations+'</ul><h2>Task evidence</h2><table><thead><tr><th>ID</th><th>Task</th><th>Status</th><th>QA</th></tr></thead><tbody>'+tasks+'</tbody></table>'+
 '<h2>Governance</h2><p>Classification: '+esc(report.classification)+' · Status: '+esc(report.status)+' · Reviewer: '+esc(report.approval?.reviewer||'Not assigned')+'</p>'+
 '<small>Print this HTML to PDF using a browser. This export is not a digitally signed board approval.</small></html>';
}
export function reportMarkdown(report){
 if(!report?.schema_version)fail('Report missing');
 const safe=x=>str(x,500).replace(/[\r\n]+/g,' ');
 return ['# '+safe(report.title),'','Company: '+safe(report.company),'Period: '+safe(report.period),'Data status: '+safe(report.status),
  '',...(report.warning?['**'+safe(report.warning)+'**','']:[]),'## KPIs',
  ...Object.entries(report.metrics).map(([k,v])=>'- '+safe(k)+': '+safe(toCell(v))),
  '','## Findings',...report.findings.map(x=>'- '+safe(x)),'','## Recommendations',...report.recommendations.map(x=>'- '+safe(x)),
  '','## Tasks',...report.tasks.map(t=>'- '+safe(t.title)+' · '+safe(t.status)+' · '+(t.verified?'verified':'not verified')),
  '','## Governance','Reviewer: '+safe(report.approval?.reviewer||'Unassigned'),'Evidence references: '+report.evidence.length].join('\n');
}
export function reportCSV(report){
 if(!report?.schema_version)fail('Report missing');
 return 'section,key,value\r\n'+Object.entries(report.metrics).map(([k,v])=>['metrics',k,toCell(v)].map(csvCell).join(',')).concat(
  report.tasks.map(t=>['tasks',t.id,t.status+'; QA '+(t.verified?'verified':'pending')].map(csvCell).join(','))).join('\r\n')+'\r\n';
}
export function reportJSON(report){return JSON.stringify(report,null,2)}
export function exportArtifact(report,format){
 const formats={html:[reportHTML,'text/html','.html'],md:[reportMarkdown,'text/markdown','.md'],csv:[reportCSV,'text/csv','.csv'],json:[reportJSON,'application/json','.json']};
 if(!formats[format])fail('Format not supported; PDF is available via browser Print > Save as PDF');
 const [render,mime,extension]=formats[format];return {filename:'theorg-'+report.report_type+extension,mime,content:render(report)};
}
