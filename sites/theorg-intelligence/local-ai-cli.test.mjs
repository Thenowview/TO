import test from 'node:test';
import assert from 'node:assert/strict';
import {localToolAdvisory} from './local-ai-cli.mjs';
test('local model not invoked without explicit approval',async()=>{
 let calls=0;await assert.rejects(()=>localToolAdvisory({toolId:'kpi-intelligence',input:{rows:[{name:'A',actual:80,target:90}]},model:'qwen3:8b',fetchImpl:()=>{calls++;throw Error('unexpected')}}));
 assert.equal(calls,0);
});
test('allowed request stays strictly on fixed localhost and remains advisory',async()=>{
 const response=await localToolAdvisory({toolId:'kpi-intelligence',input:{rows:[{name:'KPI',actual:83,target:90}]},model:'qwen3:8b',approved:true,fetchImpl:async(url,options)=>{
 assert.equal(url,'http://127.0.0.1:11434/api/generate');
 assert.equal(JSON.parse(options.body).stream,false);
 return {ok:true,json:async()=>({response:'Investigate the KPI variance with evidence'})};
 }});
 assert.equal(response.advisory_only,true);assert.equal(response.qa_accepted,false);assert.equal(response.executed_actions,0);assert.equal(response.underlying_metrics.mean_variance,-7);
});
test('invalid model names and unsupported tools denied',async()=>{await assert.rejects(()=>localToolAdvisory({toolId:'kpi-intelligence',model:'https://evil.com',approved:true,input:{rows:[]}}));await assert.rejects(()=>localToolAdvisory({toolId:'shell',model:'qwen3',approved:true,input:{rows:[]}}))});
