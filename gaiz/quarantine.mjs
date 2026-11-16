// GAIZ2 governance report quarantine gate. No HTML, templates, URLs, file
// references or dynamic execution. Pure function; does not import or persist.
import {createHash} from 'node:crypto';
import {validateGovernanceReport} from './report.mjs';
const DANGEROUS=/<\s*\/?\s*(?:script|style|iframe|object|embed|svg|math|form|link|meta|img)\b|<\/?[a-z][^>]*>|javascript\s*:|data\s*:\s*text\/html|(?:^|[^\p{L}])(?:file|vbscript)\s*:/iu;
const BIDI=/[\u202A-\u202E\u2066-\u2069]/u;
const CONTROL=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;
const forbiddenKeys=new Set(['__proto__','constructor','prototype']);
function inspectText(value){
 if(CONTROL.test(value)||BIDI.test(value)||DANGEROUS.test(value))throw Error('Unsafe or unsupported report text');
 if(/(?:https?:\/\/|www\.)/iu.test(value))throw Error('External links require separate approval');
 return value;
}
function canonical(value){
 if(value===null||typeof value==='boolean'||typeof value==='number')return JSON.stringify(value);
 if(typeof value==='string')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 const keys=Object.keys(value);
 if(keys.some(k=>forbiddenKeys.has(k)))throw Error('Forbidden report field');
 return '{'+keys.sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
// Only the receipt should leave the local custody process, never the report.
export function quarantineGovernanceReport(report,{maxBytes=65536}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<256||maxBytes>65536)throw Error('Invalid quarantine bound');
 validateGovernanceReport(report);
 const serialized=canonical(report);
 const bytes=Buffer.byteLength(serialized,'utf8');
 if(bytes>maxBytes)throw Error('Quarantine payload size exceeded');
 inspectText(report.title);inspectText(report.summary);
 for(const [key] of Object.entries(report.metrics??{}))inspectText(key);
 for(const finding of report.findings??[])inspectText(finding.description);
 const digest=createHash('sha256').update(serialized).digest('hex');
 return Object.freeze({
  status:'quarantine-schema-validated',reportSha256:digest,bytes,
  fieldCount:Object.keys(report).length,metricsCount:Object.keys(report.metrics??{}).length,
  findingsCount:report.findings?.length??0,renderAllowed:false,
  importAllowed:false,plaintextReleased:false,
 });
}
