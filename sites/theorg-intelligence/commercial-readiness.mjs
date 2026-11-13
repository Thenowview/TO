import {readFileSync} from 'node:fs';
const status=JSON.parse(readFileSync(new URL('./commercial-release-gates.json',import.meta.url),'utf8'));
export function assessCommercialLaunch(gates){
 if(!gates||gates.schema_version!=='theorg-commercial-release-gates-1'||!gates.checks)throw new Error('Invalid release contract');
 const entries=Object.entries(gates.checks);
 const required=entries.filter(([id])=>id!=='five-free-tools-implemented'&&id!=='commercial-preview-uploaded');
 const passing=required.filter(([,v])=>v?.passed===true&&typeof v.evidence==='string'&&v.evidence.trim().length>=12);
 const pending=required.filter(([id])=>!passing.some(([key])=>key===id)).map(([name])=>name);
 return Object.freeze({release_channel:gates.release_channel,
  production_ready:required.length>0&&pending.length===0,
  production_gates_passed:passing.length,
  production_gates_total:required.length,pending,
  note:'Only independently inspected evidence should allow a gate to pass'});
}
if(process.argv[1]?.endsWith('commercial-readiness.mjs')){
 const result=assessCommercialLaunch(status);
 console.log(JSON.stringify(result,null,2));
 if(process.argv.includes('--require-ready')&&!result.production_ready)process.exitCode=1;
}
