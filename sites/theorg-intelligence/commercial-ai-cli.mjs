// TheOrg commercial narrative adapter. Local Ollama ONLY; never bundled in public Worker.
// No web requests, transactions or project mutations. User explicitly opts in per call.
import {analyzeCommercialTool,COMMERCIAL_TOOLS} from './commercial-tools.mjs';
const LOCAL_ENDPOINT='http://127.0.0.1:11434/api/generate';
export async function localCommercialAdvisory({toolId,input,model,approved=false,fetchImpl=fetch}={}){
 if(approved!==true)throw new Error('Explicit model consent is required');
 if(typeof model!=='string'||!/^[A-Za-z0-9_.:\-]{1,80}$/.test(model))throw new Error('Invalid local model name');
 const tool=COMMERCIAL_TOOLS.find(t=>t.id===toolId);if(!tool)throw new Error('Unknown tool');
 const deterministic=analyzeCommercialTool(toolId,input);
 const facts=JSON.stringify({
  tool:tool.name,metrics:deterministic.calculated_metrics,
  findings:deterministic.findings.slice(0,8),
  actions:deterministic.proposed_actions.slice(0,8)
 }).slice(0,16000);
 const prompt='You are a business reporting assistant operating OFFLINE. The following is a SELF-REPORTED DRAFT from a bounded deterministic calculator. You must not assert that sources, financial records, legal compliance, audit evidence, project progress or user identity were verified. Do not claim to run any tools, access a database, approve a decision, process payment, or change business records. Identify important observations, uncertainty, limitations and questions for independent review in under 450 words. Provide advisory prose only.\n'+facts;
 const response=await fetchImpl(LOCAL_ENDPOINT,{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({model,prompt,stream:false,options:{temperature:0.2,num_predict:650}}),
  signal:AbortSignal.timeout(30000)
 });
 if(!response?.ok)throw new Error('Local model unavailable');
 const data=await response.json();
 if(typeof data?.response!=='string'||data.response.length>24000)throw new Error('Invalid model response');
 return {tool_id:toolId,model,advisory:data.response.slice(0,12000),
  calculation:deterministic.calculated_metrics,provider:'local-loopback-ollama',
  mode:'unverified-advisory',source_verified:false,qa_accepted:false,
  payment_status:'not-collected',business_actions:0,
  requires_human_review:true};
}
async function main(){
 if(process.env.THEORG_ENABLE_OLLAMA!=='YES')throw new Error('Set THEORG_ENABLE_OLLAMA=YES on an approved local machine');
 const [toolId,model]=process.argv.slice(2);
 if(!toolId||!model)throw new Error('Usage: THEORG_ENABLE_OLLAMA=YES node commercial-ai-cli.mjs <tool-id> <local-model> < input.json');
 let raw='';for await(const part of process.stdin){raw+=part;if(raw.length>65536)throw new Error('Input too large')}
 const result=await localCommercialAdvisory({toolId,model,input:JSON.parse(raw),approved:true});
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(process.argv[1]?.endsWith('commercial-ai-cli.mjs'))main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1});
