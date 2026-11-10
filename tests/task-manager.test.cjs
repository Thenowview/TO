/* Node built-in regression checks for TheOrg MV3 Supervisor workflow.
   The Chrome API is mocked. These are not actual browser E2E tests. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = {};
context.globalThis = context;
const src = file => fs.readFileSync(path.join(__dirname,"..","apps","chrome-extension",file),"utf8");
vm.runInNewContext(src("supervisor-plan.js"),context,{filename:"supervisor-plan.js"});
vm.runInNewContext(src("task-manager.js"),context,{filename:"task-manager.js"});

const validInstruction="Create a report with source citations and a verification checklist.";
const rawPlan=JSON.stringify({
  summary:"Prepare a grounded report",
  tasks:[{id:"research1",role:"researcher",objective:"Prepare a sourced research report",
    provider:"chatgpt",acceptanceCriteria:["Include verified primary references"],dependencies:[]}]
});
function fakeChrome() {
  const local={}, session={},tabs=new Map(),imports=[];
  let nextId=100;
  const api={
    storage:{
      local:{
        get:async k=>({[k]:local[k]}),
        set:async values=>{Object.assign(local,values)}
      },
      session:{
        get:async k=>({[k]:session[k]}),
        set:async values=>{Object.assign(session,values)}
      }
    },
    tabs:{
      create:async ({url})=>{
        const tab={id:nextId++,windowId:1,groupId:-1,url};
        tabs.set(tab.id,tab);
        return tab;
      },
      get:async id=>{
        if(!tabs.has(id))throw new Error("tab missing");
        return tabs.get(id);
      },
      remove:async id=>{tabs.delete(id)},
      group:async ({groupId,tabIds})=>{
        const id=groupId??37;
        for(const tabId of tabIds)tabs.get(tabId).groupId=id;
        return id;
      }
    },
    tabGroups:{update:async ()=>true},
    runtime:{sendNativeMessage:async (_host,request)=>{
      switch(request.command){
        case "ping":return {ok:true,engine:"TheOrg.Bridge"};
        case "submit_order":return {ok:true,order:{
          orderId:"a".repeat(32),companyId:request.companyId,
          createdUtc:"2026-11-10T00:00:00Z",aiMode:"deterministic_demo_no_external_provider"
        }};
        case "import_artifact":{
          const item={artifactId:"c".repeat(32),fileName:request.fileName,
            agentId:request.agentId,intakeStatus:"received_unverified",
            sha256:"B".repeat(64),integrityValid:false};
          imports.push(item);
          return {ok:true,artifact:item};
        }
        case "list_artifacts":return {ok:true,artifacts:imports};
        case "get_order":return {ok:true,order:{artifacts:[{fileName:"plan.md",sha256:"C".repeat(64)}]}};
        default:return {ok:false,error:"unsupported_command"};
      }
    }}
  };
  return {api,local,session,tabs,imports};
}

test("structured plan validates roles, providers and dependency graph",()=>{
  const plan=context.TheOrgPlanner.interpret(rawPlan);
  assert.equal(plan.tasks.length,1);
  assert.equal(plan.tasks[0].id,"research1");
  assert.throws(()=>context.TheOrgPlanner.interpret(JSON.stringify({tasks:[
    {id:"a",role:"researcher",objective:"Prepare a full report",provider:"chatgpt",
      acceptanceCriteria:["Has source references"],dependencies:["a"]}
  ]})),/dependency/i);
  assert.throws(()=>context.TheOrgPlanner.interpret("{not json}"),/JSON/);
});

test("Supervisor and agent task tabs hand off without closing unrelated tabs",async()=>{
  const fake=fakeChrome();
  const man=new context.TheOrgTaskManager(fake.api);
  const created=await man.createOrder("demo",validInstruction);
  assert.equal(created.taskId,"a".repeat(32));
  assert.equal((await man.orders())[created.taskId].instruction,validInstruction);
  const personalTab=await fake.api.tabs.create({url:"https://example.com/"});
  const sup=await man.openSupervisorTab(created.taskId,"chatgpt");
  assert.equal(sup.groupId,37);
  await man.saveSupervisorPlan(created.taskId,rawPlan);
  assert.ok(fake.tabs.has(personalTab.id));
  assert.ok(!fake.tabs.has(sup.tabId));
  await man.approvePlan(created.taskId);
  assert.equal((await man.orders())[created.taskId].plan.reviewed,true);
  const agent=await man.openAgentTab(created.taskId,"research1","qwen");
  assert.equal(agent.groupId,37);
  await assert.rejects(
    ()=>man.openAgentTab(created.taskId,"unassigned","qwen"),/reviewed Supervisor plan/);
  await man.importArtifact(created.taskId,"research1","report.md","YWJj","qwen","test");
  const returned=await man.handoffAndClose(
    created.taskId,"research1",
    "I produced a local draft that still needs independent evidence review.","submitted");
  assert.equal(returned.saved,true);
  assert.equal(returned.closedTabs,1);
  assert.ok(fake.tabs.has(personalTab.id));
  assert.ok(!fake.tabs.has(agent.tabId));
  const audit=await man.supervisorReview(created.taskId);
  assert.equal(audit.verdict,"blocked"); // unverified file must not be accepted
});

test("cannot import for unapproved or cross-assignment specialists",async()=>{
  const fake=fakeChrome();
  const man=new context.TheOrgTaskManager(fake.api);
  const order=await man.createOrder("demo",validInstruction);
  await assert.rejects(
    ()=>man.importArtifact(order.taskId,"research1","a.txt","YQ==","chatgpt","manual"),
    /approved Supervisor plan/);
  await man.saveSupervisorPlan(order.taskId,rawPlan);
  await man.approvePlan(order.taskId);
  await assert.rejects(
    ()=>man.importArtifact(order.taskId,"developer1","a.txt","YQ==","chatgpt","manual"),
    /approved Supervisor plan/);
});
