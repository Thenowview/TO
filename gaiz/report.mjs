// Format-level governance report validation for GAIZ2 synthetic schema v1.
// Do not confuse valid content shape with factual correctness or enterprise permission.
const allowed=new Set(['title','summary','metrics','findings']);
function plainObject(v){return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;}
function string(v,max){return typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u001f]/.test(v);}
export function validateGovernanceReport(value){
 if(!plainObject(value)||Object.keys(value).some(k=>!allowed.has(k)))throw Error('Unsupported GAIZ governance report');
 if(!string(value.title,160)||!string(value.summary,4000))throw Error('Report title and summary required');
 if('metrics' in value){
  if(!plainObject(value.metrics)||Object.keys(value.metrics).length>50)throw Error('Invalid report metrics');
  for(const [key,n] of Object.entries(value.metrics)){
   if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(key)||!Number.isSafeInteger(n)||n<0||n>1000000000)throw Error('Invalid report metric');
  }
 }
 if('findings' in value){
  if(!Array.isArray(value.findings)||value.findings.length>100)throw Error('Invalid findings');
  const ids=new Set();
  for(const f of value.findings){
   if(!plainObject(f)||Object.keys(f).sort().join('|')!=='description|id'||!Number.isSafeInteger(f.id)||f.id<1||f.id>1000000000||!string(f.description,2000)||ids.has(f.id))throw Error('Invalid finding');
   ids.add(f.id);
  }
 }
 return value;
}
