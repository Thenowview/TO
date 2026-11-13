import test from 'node:test';
import assert from 'node:assert/strict';
import {TOOL_TEMPLATES,validateTool,validateTask,taskSummary,simulatePlan} from './tool-platform.mjs';
test('five operational tool templates are ready',()=>assert.equal(TOOL_TEMPLATES.length,5));
test('custom tool has bounded steps, action and metric',()=>{
const t=validateTool({id:'my-analyst',name:'Weekly delivery reviewer',description:'Review the weekly delivery status',kind:'analysis',trigger:'manual',metric:'delivery_health',steps:['Collect status','Validate evidence']});
assert.equal(t.execution_mode,'design-only');assert.equal(t.requires_approval,true);
});
test('reject arbitrary code/tool action category',()=>assert.throws(()=>validateTool({id:'unsafe-tool',name:'Unsafe Tool',kind:'shell',trigger:'manual',metric:'delivery_health',steps:['Run command','Send files']})));
test('reject insufficient steps and invalid metric',()=>{assert.throws(()=>validateTool({id:'abc',name:'Three Good Words',kind:'analysis',metric:'other',steps:['First step','Second step']}));assert.throws(()=>validateTool({id:'abc',name:'Three Good Words',kind:'analysis',metric:'delivery_health',steps:['Only one']}))});
test('task cannot run when tool is absent',()=>assert.throws(()=>validateTask({title:'Analyze monthly status',scope:'Demo Company',owner:'Manager'},null)));
test('task is always a draft simulation with zero completed steps',()=>{
const t=validateTask({title:'Analyze monthly status',scope:'Example Company',owner:'Project Manager'},TOOL_TEMPLATES[0]);
assert.equal(t.status,'draft');assert.equal(t.execution_mode,'simulation');assert.equal(t.metrics.steps_completed,0);assert.equal(t.metrics.completion_pct,0);assert.equal(t.outcome,'not-verified');
});
test('reviewing a simulation never marks it as executed',()=>{
const t=validateTask({title:'Analyze monthly status',scope:'Example Company',owner:'Project Manager'},TOOL_TEMPLATES[0]);
const reviewed=simulatePlan(t);assert.equal(reviewed.status,'reviewed');assert.equal(reviewed.steps[0].status,'planned');assert.equal(reviewed.outcome.includes('No execution'),true);
});
test('analytics distinguish reviewed plans and closed work',()=>assert.deepEqual(taskSummary([{status:'draft'},{status:'reviewed'},{status:'closed'}]),{total:3,draft:1,reviewed:1,closed:1,rejected:0,other:0}));
test('runtime refuses to simulate a real-execution task',()=>assert.throws(()=>simulatePlan({execution_mode:'real',steps:[],events:[]})));
