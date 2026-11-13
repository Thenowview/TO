import test from 'node:test';
import assert from 'node:assert/strict';
import {localCommercialAdvisory} from './commercial-ai-cli.mjs';
import {COMMERCIAL_TOOLS,exampleForTool} from './commercial-tools.mjs';
test('consent required before any local fetch',async()=>{
 let outbound=0;
 await assert.rejects(()=>localCommercialAdvisory({toolId:'kpi-analyzer',input:exampleForTool('kpi-analyzer'),model:'qwen3:8b',fetchImpl:()=>{outbound++}}));
 assert.equal(outbound,0);
});
test('only fixed loopback Ollama endpoint receives bounded, advisory-only prompt',async()=>{
 const output=await localCommercialAdvisory({toolId:'project-health',input:exampleForTool('project-health'),model:'qwen3:8b',approved:true,fetchImpl:async(url,args)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/generate');
  assert.equal(args.method,'POST');
  const body=JSON.parse(args.body);
  assert.equal(body.stream,false);
  assert.ok(body.prompt.length<18000);
  assert.match(body.prompt,/SELF-REPORTED DRAFT/);
  return {ok:true,json:async()=>({response:'Verify actual evidence with the project sponsor'})};
 }});
 assert.equal(output.source_verified,false);
 assert.equal(output.qa_accepted,false);
 assert.equal(output.payment_status,'not-collected');
 assert.equal(output.business_actions,0);
 assert.equal(output.requires_human_review,true);
});
test('all 22 commercial workflows can be narrated by a local model without using customer cloud data',async()=>{
 for(const tool of COMMERCIAL_TOOLS){
  let calls=0;
  const value=await localCommercialAdvisory({toolId:tool.id,input:exampleForTool(tool.id),model:'local:8b',approved:true,fetchImpl:async(url)=>{calls++;return {ok:true,json:async()=>({response:'Advisory draft'})}}});
  assert.equal(calls,1);
  assert.equal(value.tool_id,tool.id);
  assert.equal(value.mode,'unverified-advisory');
 }
});
test('invalid model references cannot redirect model endpoint',async()=>{
 for(const model of ['https://evil.example/','../escape','bad model']){
  await assert.rejects(()=>localCommercialAdvisory({toolId:'kpi-analyzer',input:exampleForTool('kpi-analyzer'),approved:true,model}));
 }
});
