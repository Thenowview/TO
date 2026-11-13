// Explicit local-only Ollama advisory connector for TheOrg tool outputs.
// Never imported by the Cloudflare Worker. No credentials, cloud sync or actions.
// This supplements deterministic analytics; it cannot verify evidence or approve tasks.
import {analyzeOperations,OPERATIONS_TOOLS} from './operations-analytics.mjs';
const URL='http://127.0.0.1:11434/api/generate';
export async function localToolAdvisory({toolId,input,model,approved=false,fetchImpl=fetch}={}){
 if(approved!==true)throw new Error('Explicit local-model consent is required for each invocation');
 if(!/^[a-zA-Z0-9_.:\-]{1,80}$/.test(model||''))throw new Error('Invalid model identifier');
 const tool=OPERATIONS_TOOLS.find(t=>t.id===toolId);if(!tool)throw new Error('Unknown tool');
 const result=analyzeOperations(toolId,input);
 const prompt='You are an advisory-only business analyst. Analyze ONLY this caller-supplied, unverified deterministic result. Do not claim to have collected evidence, executed a business action, received approval, verified a KPI, or accessed external systems. Summarize key trends, uncertainties, and next steps. Keep the response under 500 words.\nTool: '+tool.name+'\nInput status: supplied and unverified\nAnalysis: '+JSON.stringify({metrics:result.metrics,details:result.details.slice(0,30),recommendations:result.recommendations}).slice(0,16000);
 const payload={model,prompt,stream:false,options:{temperature:0.2,num_predict:700}};
 const response=await fetchImpl(URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('Local Ollama request failed');
 const data=await response.json();
 if(typeof data?.response!=='string')throw new Error('Invalid local model response');
 return {tool_id:toolId,model,advisory:data.response.slice(0,12000),advisory_only:true,
  source_evidence_verified:false,qa_accepted:false,approved_execution:false,executed_actions:0,
  underlying_metrics:result.metrics,data_status:'caller-supplied',provider:'local-loopback-ollama'};
}
async function main(){
 if(process.env.THEORG_ENABLE_OLLAMA!=='YES')throw new Error('Set THEORG_ENABLE_OLLAMA=YES to enable a local model');
 const [toolId,model]=process.argv.slice(2);
 if(!toolId||!model)throw new Error('Usage: THEORG_ENABLE_OLLAMA=YES node local-ai-cli.mjs <tool-id> <local-model-name> < input.json');
 let inputText='';for await(const chunk of process.stdin){inputText+=chunk;if(inputText.length>65536)throw new Error('Input too large');}
 const input=JSON.parse(inputText);
 const result=await localToolAdvisory({toolId,input,model,approved:true});
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(process.argv[1]&&process.argv[1].endsWith('local-ai-cli.mjs'))main().catch(error=>{process.stderr.write('Local advisory unavailable: '+error.message+'\n');process.exitCode=1});
