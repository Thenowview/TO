// GAIZ2 field-level change PREVIEW, draft v1. Pure, no DB writes or API.
// Only use authenticated custodian report and tenant-scoped DB snapshot.
import {createHash} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const CONTROL=/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const ACTIVE=/<\s*\/?[a-z][^>]*>|(?:javascript|vbscript|file)\s*:|https?:\/\/|www\./iu;
const ALLOW=Object.freeze({
 'project.name':Object.freeze({source:'title',max:160}),
 'portfolio.description':Object.freeze({source:'summary',max:4000}),
});
function fail(message){throw Error('GAIZ preview denied: '+message);}
function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
function keysExact(value,fields){return plain(value)&&Object.keys(value).sort().join('|')===fields.slice().sort().join('|');}
function safeText(value,max){
 if(typeof value!=='string'||value.trim().length===0||value.length>max||CONTROL.test(value)||ACTIVE.test(value))
  fail('unsupported text');
 return value;
}
function canonical(value,depth=0){
 if(depth>8)fail('nested content');
 if(value===null||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isSafeInteger(value)&&!Object.is(value,-0))return JSON.stringify(value);
 if(typeof value==='string')return JSON.stringify(value);
 if(Array.isArray(value)&&value.length<=100)return '['+value.map(x=>canonical(x,depth+1)).join(',')+']';
 if(plain(value)&&Object.keys(value).length<=50)return '{'+Object.keys(value).sort().map(k=>
  JSON.stringify(k)+':'+canonical(value[k],depth+1)).join(',')+'}';
 fail('unsupported content type');
}
function sha(value){return createHash('sha256').update(value,'utf8').digest('hex');}
// report must originate from authorized isolated custodian; snapshot from RLS.
export function previewGaizFieldMapping({
 tenantId,report,custodyReceipt,snapshot,mappingProfile,
}={}){
 if(typeof tenantId!=='string'||!UUID.test(tenantId))fail('tenant');
 if(!plain(report)||!Object.keys(report).every(k=>['title','summary','metrics','findings'].includes(k))||
    !Object.hasOwn(report,'title')||!Object.hasOwn(report,'summary'))fail('report shape');
 safeText(report.title,160);safeText(report.summary,4000);
 if(report.metrics!==undefined){
  if(!plain(report.metrics)||Object.keys(report.metrics).length>50)fail('metrics');
  for(const [k,v] of Object.entries(report.metrics))
   if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(k)||!Number.isSafeInteger(v)||v<0||v>1e9)fail('metric');
 }
 if(report.findings!==undefined){
  if(!Array.isArray(report.findings)||report.findings.length>100)fail('findings');
  const found=new Set();
  for(const item of report.findings) {
   if(!keysExact(item,['id','description'])||!Number.isSafeInteger(item.id)||item.id<1||
      item.id>1e9||found.has(item.id))fail('finding');
   found.add(item.id);safeText(item.description,2000);
  }
 }
 const reportCanonical=canonical(report);
 if(Buffer.byteLength(reportCanonical,'utf8')>65536)fail('oversized report');
 if(!keysExact(custodyReceipt,['reportSha256','artifactSha256','tenantId','validated']) ||
    custodyReceipt.validated!==true||custodyReceipt.tenantId!==tenantId||
    typeof custodyReceipt.artifactSha256!=='string'||!HASH.test(custodyReceipt.artifactSha256)||
    custodyReceipt.reportSha256!==sha(reportCanonical))fail('custodian digest');
 if(!keysExact(snapshot,['kind','id','tenantId','revision','fields'])||
    snapshot.tenantId!==tenantId||!UUID.test(snapshot.id)||
    !Number.isSafeInteger(snapshot.revision)||snapshot.revision<0||
    !['project','portfolio'].includes(snapshot.kind)||!plain(snapshot.fields))fail('target snapshot');
 if(!keysExact(mappingProfile,['profileId','approved','tenantId','targetKind','fieldMappings'])||
    mappingProfile.approved!==true||mappingProfile.tenantId!==tenantId||
    mappingProfile.targetKind!==snapshot.kind||typeof mappingProfile.profileId!=='string'||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(mappingProfile.profileId)||
    !Array.isArray(mappingProfile.fieldMappings)||mappingProfile.fieldMappings.length<1||
    mappingProfile.fieldMappings.length>2)fail('mapping profile');
 const seen=new Set();
 const proposed=[];
 for(const path of mappingProfile.fieldMappings){
  if(typeof path!=='string'||seen.has(path)||!Object.hasOwn(ALLOW,path)||
     !path.startsWith(snapshot.kind+'.'))fail('mapping not allowlisted');
  seen.add(path);
  const {source,max}=ALLOW[path];
  const targetKey=path.split('.')[1];
  if(!Object.hasOwn(snapshot.fields,targetKey))fail('missing target field');
  const oldValue=snapshot.fields[targetKey];
  if(oldValue!==null&&typeof oldValue!=='string')fail('unexpected target type');
  if(typeof oldValue==='string'&&oldValue.length>max)fail('oversized existing field');
  const incoming=safeText(report[source],max);
  const unchanged=oldValue===incoming;
  proposed.push(Object.freeze({
   targetField:path,sourceField:'report.'+source,
   decision:unchanged?'no_change':'requires_manual_review',
   oldSha256:oldValue===null?null:sha(oldValue),proposedSha256:sha(incoming),
   oldLength:oldValue?.length??null,proposedLength:incoming.length,
   expectedRevision:snapshot.revision,containsPlaintext:false,
  }));
 }
 const fingerprint=sha(canonical({
  artifactSha256:custodyReceipt.artifactSha256,reportSha256:custodyReceipt.reportSha256,
  tenantId,profileId:mappingProfile.profileId,targetId:snapshot.id,
  revision:snapshot.revision,proposals:proposed,
 }));
 return Object.freeze({
  status:'hash-only-field-preview',tenantId,targetId:snapshot.id,targetKind:snapshot.kind,
  mappingProfileId:mappingProfile.profileId,reportSha256:custodyReceipt.reportSha256,
  artifactSha256:custodyReceipt.artifactSha256,previewSha256:fingerprint,
  proposedFields:Object.freeze(proposed),changeCount:proposed.filter(p=>p.decision!=='no_change').length,
  conflicts:Object.freeze(proposed.filter(p=>p.decision==='requires_manual_review').map(p=>p.targetField)),
  requiresExplicitSecondImportApproval:true,requiresFreshSnapshot:true,
  requiresCustodianValidation:true,containsPlaintext:false,appliesData:false,importAllowed:false,
 });
}
