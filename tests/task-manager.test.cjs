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
vm.runInNewContext(src("agent-playbooks.js"),context,{filename:"agent-playbooks.js"});
vm.runInNewContext(src("supervisor-plan.js"),context,{filename:"supervisor-plan.js"});
vm.runInNewContext(src("task-manager.js"),context,{filename:"task-manager.js"});

const validInstruction="Create a report with source citations and a verification checklist.";
const rawPlan=JSON.stringify({
  summary:"Prepare a grounded report",
  tasks:[{id:"research1",role:"researcher",objective:"Prepare a sourced research report",
    provider:"chatgpt",acceptanceCriteria:["Include verified primary references"],dependencies:[]}]
});
function fakeChrome(options = {}) {
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
          const item={artifactId:(imports.length+1).toString(16).padStart(32,"c").slice(-32),
            version:imports.filter(x=>x.fileName===request.fileName &&
              x.agentId===request.agentId).length+1,
            fileName:request.fileName,agentId:request.agentId,
            intakeStatus:"received_unverified",
            sha256:"B".repeat(64),integrityValid:false,formatValid:false};
          imports.push(item);
          return {ok:true,artifact:item};
        }
        case "list_artifacts":return {ok:true,artifacts:imports};
        case "get_order":return {ok:true,order:{artifacts:options.noDemo ? [] :
          [{fileName:"plan.md",sha256:"C".repeat(64)}]}};
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
  assert.throws(()=>context.TheOrgPlanner.interpret("This is not valid JSON for a specialist task plan"),/JSON/);
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


test("acceptance QA requires real handoff, records every criterion, and never automatically certifies completion", async()=>{
  const fake=fakeChrome();
  const man=new context.TheOrgTaskManager(fake.api);
  const order=await man.createOrder("demo",validInstruction);
  await man.saveSupervisorPlan(order.taskId,rawPlan);
  await man.approvePlan(order.taskId);

  await assert.rejects(
    ()=>man.recordQaFinding(order.taskId,"research1",0,"pass",
      "Primary sources were manually inspected and referenced in the draft."),
    /handoff/);

  await man.importArtifact(order.taskId,"research1","report.md","YWJj","chatgpt","synthetic");
  await man.handoffAndClose(order.taskId,"research1",
    "The reference report is ready for acceptance checking.","submitted");
  await assert.rejects(
    ()=>man.recordQaFinding(order.taskId,"research1",0,"pass","OK"),
    /QA evidence/);

  // The fake host models a completed *structural* check, not substantive QA.
  fake.imports[0].intakeStatus="structure_verified_content_qa_pending";
  fake.imports[0].integrityValid=true;
  fake.imports[0].formatValid=true;

  await man.recordQaFinding(order.taskId,"research1",0,"fail",
    "The delivered report does not contain independently verifiable primary references.");
  let reviewed=await man.supervisorReview(order.taskId);
  assert.equal(reviewed.verdict,"qa_revision_required");

  await man.recordQaFinding(order.taskId,"research1",0,"pass",
    "I checked the cited sources and confirmed the specific acceptance criterion manually.");
  reviewed=await man.supervisorReview(order.taskId);
  assert.equal(reviewed.verdict,"manual_qa_recorded_owner_confirmation_pending");
  const packet=await man.getQaPacket(order.taskId);
  assert.equal(packet.tasks[0].findings[0].identityVerified,false);
  assert.equal(packet.artifacts.length,1);
  assert.ok(packet.trustLimitations.length>=2);

  await man.handoffAndClose(order.taskId,"research1",
    "A revised source report replaces the earlier agent handoff; rerun acceptance QA.","submitted");
  const changed=await man.orders();
  assert.equal(changed[order.taskId].qaFindings.research1,undefined);
  reviewed=await man.supervisorReview(order.taskId);
  assert.equal(reviewed.verdict,"pending_independent_verification");
});


test("12 versioned SOPs produce specialist-specific standard work orders", () => {
  const skills=context.TheOrgSkills;
  assert.equal(skills.profiles().length,12);
  assert.match(skills.version,/^sop-\d+\.\d+\.\d+$/);
  const plan=skills.route("Compare five competitors, build an Excel analysis and executive presentation.");
  assert.equal(plan.source,"local_deterministic_sop_not_ai");
  assert.equal(plan.reviewed,false);
  assert.equal(plan.providerConnected,false);
  assert.deepEqual(Array.from(plan.tasks,x=>x.id),["analyst","documents","researcher"]);
  const verified=context.TheOrgPlanner.interpret(JSON.stringify(plan));
  assert.equal(verified.tasks.length,3);
  for(const task of plan.tasks) {
    assert.ok(task.playbookVersion===skills.version);
    assert.ok(task.acceptanceCriteria.length>=2);
    assert.match(skills.agentPrompt("Create a robust competitor presentation",plan,task.id),
      /STANDARD OPERATING PROCEDURE/);
  }
  const prompt=skills.agentPrompt("Prepare an Excel competitor analysis",plan,"analyst");
  assert.match(prompt,/Reconcile totals/i);
  assert.match(prompt,/ACCEPTANCE CHECKS/);
  assert.match(prompt,/Do not paste credentials/i);
  assert.match(prompt,/EVIDENCE:/);
  assert.throws(()=>skills.agentPrompt("example",plan,"unassigned"),/not assigned/);
});

test("one instruction locally drafts a plan without consulting a provider",async()=>{
  const fake=fakeChrome();
  const supervisor=new context.TheOrgTaskManager(fake.api);
  const created=await supervisor.createOrder("demo",
    "Fix backend software tests and prepare a reviewed code change.");
  const order=(await supervisor.orders())[created.taskId];
  assert.equal(order.phase,"plan_review_required");
  assert.equal(order.plan.source,"local_deterministic_sop_not_ai");
  assert.equal(order.plan.reviewed,false);
  assert.ok(order.plan.tasks.some(t=>t.id==="developer"));
  assert.equal(fake.tabs.size,0);
  await assert.rejects(
    ()=>supervisor.openAgentTab(created.taskId,"developer","chatgpt"),
    /reviewed Supervisor plan/);
  await supervisor.approvePlan(created.taskId);
  const assigned=await supervisor.openAgentTab(created.taskId,"developer","chatgpt");
  assert.equal(assigned.groupId,37);
  const prompt=await supervisor.agentPrompt(created.taskId,"developer");
  assert.match(prompt,/backend software tests/);
  assert.match(prompt,/Tests and build results/i);
  assert.match(prompt,/No secrets, production writes/i);
});

test("risk flag never authorizes external writing or fabricated AI access",()=>{
  const plan=context.TheOrgSkills.route(
    "Send email to customers and deploy the updated website to production.");
  assert.equal(plan.riskTier,"owner_review_required");
  assert.equal(plan.reviewed,false);
  assert.equal(plan.providerConnected,false);
  assert.equal(plan.approvalRequired,true);
  assert.match(plan.notes.join(" "),/external|permission/i);
  const defaultPlan=context.TheOrgSkills.route(
    "Organize my weekly project priorities with clear milestone owners.");
  assert.equal(defaultPlan.source,"local_deterministic_sop_not_ai");
  assert.ok(defaultPlan.tasks.some(t=>t.id==="planner"));
  assert.throws(()=>context.TheOrgSkills.route(""),/Instruction/);
});


test("failed QA findings generate review-only training proposals",()=>{
  const skills=context.TheOrgSkills;
  const packet={
    taskId:"a".repeat(32), instruction:"Prepare a tested software change.",
    tasks:[{agentId:"developer",role:"developer",objective:"Deliver tested code",
      acceptanceCriteria:["Verified regression tests passed"],
      findings:{0:{verdict:"fail",evidence:"The test evidence was not supplied in the handoff"}},
      handoff:{outcome:"submitted",summary:"Code draft prepared; QA evidence incomplete."}}],
    artifacts:[{artifactId:"c".repeat(32),filename:"patch.txt",sha256:"A".repeat(64)}]
  };
  const candidates=skills.improvementCandidates(packet);
  assert.equal(candidates.length,1);
  assert.equal(candidates[0].profileId,"developer");
  assert.equal(candidates[0].status,"proposed_only_requires_source_review_and_tests");
  assert.equal(candidates[0].playbookVersion,skills.version);
  assert.match(candidates[0].proposedAdjustment,/Review whether/);
  const reviewPrompt=skills.auditorPrompt(packet);
  assert.match(reviewPrompt,/do not claim to have opened/i);
  assert.match(reviewPrompt,/UNKNOWN/);
  assert.match(reviewPrompt,/Verified regression tests passed/);
  assert.match(reviewPrompt,/metadata and reported findings; not actual file contents/i);
  packet.tasks[0].findings[0].verdict="pass";
  assert.equal(skills.improvementCandidates(packet).length,0);
});


test("dependency-aware queue dispatches next eligible specialist without inventing completed work",async()=>{
  const fake=fakeChrome();
  const manager=new context.TheOrgTaskManager(fake.api);
  const created=await manager.createOrder("demo",
    "Research a market and create a sourced executive presentation with documented limitations.");
  const plan=JSON.stringify({
    summary:"First obtain research evidence, then prepare presentation",
    tasks:[
      {id:"researcher",role:"researcher",provider:"chatgpt",
       objective:"Collect verified market research references and source dates",
       acceptanceCriteria:["Verify every material factual claim against primary sources"],
       dependencies:[]},
      {id:"documents",role:"documents",provider:"qwen",
       objective:"Create the executive presentation from documented research",
       acceptanceCriteria:["Presentation content agrees with cited market research"],
       dependencies:["researcher"]}
    ]
  });
  await manager.saveSupervisorPlan(created.taskId,plan);
  let queue=await manager.executionQueue(created.taskId);
  assert.equal(queue.planApproved,false);
  assert.equal(queue.queue[0].state,"plan_review_required");
  assert.deepEqual(Array.from(queue.ready),[]);

  await manager.approvePlan(created.taskId);
  queue=await manager.executionQueue(created.taskId);
  assert.deepEqual(Array.from(queue.ready),["researcher"]);
  assert.equal(queue.queue[1].state,"waiting_on_dependencies");

  await assert.rejects(
    ()=>manager.openAgentTab(created.taskId,"documents","qwen"),
    /prerequisite handoffs/);

  const first=await manager.dispatchNextTask(created.taskId);
  assert.equal(first.dispatched,true);
  assert.equal(first.agentId,"researcher");
  assert.equal(first.manualProviderHandoff,true);
  assert.match(first.prompt,/STANDARD OPERATING PROCEDURE/);
  assert.equal(fake.tabs.size,1);
  await assert.rejects(
    ()=>manager.openAgentTab(created.taskId,"researcher","chatgpt"),
    /already has an open/);

  await manager.handoffAndClose(created.taskId,"researcher",
    "Primary market research sources were collected and are ready for independent QA.","submitted");
  queue=await manager.executionQueue(created.taskId);
  assert.equal(queue.queue[0].state,"awaiting_qa_evidence");
  assert.equal(queue.queue[1].state,"waiting_on_dependencies");
  const noAdvance=await manager.dispatchNextTask(created.taskId);
  assert.equal(noAdvance.dispatched,false);

  await manager.recordQaFinding(created.taskId,"researcher",0,"pass",
    "I manually checked the primary market source against the research handoff and verified its recorded date.");
  queue=await manager.executionQueue(created.taskId);
  assert.equal(queue.queue[0].state,"manual_qa_pass_unverified");
  assert.equal(queue.queue[0].verifiedComplete,false);
  assert.deepEqual(Array.from(queue.ready),["documents"]);

  const second=await manager.dispatchNextTask(created.taskId);
  assert.equal(second.agentId,"documents");
  assert.match(second.prompt,/presentation/i);
  assert.equal(fake.tabs.size,1);

  await manager.handoffAndClose(created.taskId,"documents",
    "Presentation draft was prepared for review; no claim of independently verified delivery.","submitted");
  queue=await manager.executionQueue(created.taskId);
  assert.equal(queue.queue[1].state,"awaiting_qa_evidence");
  assert.ok(queue.queue.every(t=>!t.verifiedComplete));
});


test("new artifact invalidates QA and malformed files block dependent specialists", async()=>{
  const mock=fakeChrome();
  const supervisor=new context.TheOrgTaskManager(mock.api);
  const order=await supervisor.createOrder("demo",
    "Research competitors, then draft a presentation using validated findings.");
  await supervisor.saveSupervisorPlan(order.taskId,JSON.stringify({
    summary:"Source evidence before presentation",
    tasks:[
      {id:"researcher",role:"researcher",provider:"chatgpt",
       objective:"Collect source evidence from market competitors",
       acceptanceCriteria:["Every material claim has primary source evidence"],dependencies:[]},
      {id:"documents",role:"documents",provider:"qwen",
       objective:"Create presentation with accurate cited evidence",
       acceptanceCriteria:["Presentation reproduces cited research accurately"],dependencies:["researcher"]}
    ]
  }));
  await supervisor.approvePlan(order.taskId);
  await supervisor.importArtifact(order.taskId,"researcher","research.md","YQ==","chatgpt","manual");
  await supervisor.handoffAndClose(order.taskId,"researcher",
    "Research report was prepared and submitted for independent checking.","submitted");
  await supervisor.recordQaFinding(order.taskId,"researcher",0,"pass",
    "I checked the primary references and recorded their dates manually.");
  let queue=await supervisor.executionQueue(order.taskId);
  assert.equal(queue.queue[0].state,"artifact_validation_pending");
  assert.equal(queue.queue[1].state,"waiting_on_dependencies");
  await assert.rejects(
    ()=>supervisor.openAgentTab(order.taskId,"documents","qwen"),
    /prerequisite handoffs/);

  mock.imports[0].integrityValid=true;
  mock.imports[0].formatValid=true;
  mock.imports[0].intakeStatus="structure_verified_content_qa_pending";
  queue=await supervisor.executionQueue(order.taskId);
  assert.deepEqual(Array.from(queue.ready),["documents"]);

  // Even an extra version of the same file must clear previous QA evidence.
  await supervisor.importArtifact(order.taskId,"researcher","research.md","Yg==","chatgpt","revised");
  const records=await supervisor.orders();
  assert.equal(records[order.taskId].qaFindings.researcher,undefined);
  queue=await supervisor.executionQueue(order.taskId);
  assert.equal(queue.queue[0].state,"artifact_validation_pending");
  assert.equal(queue.queue[1].state,"waiting_on_dependencies");
  assert.equal(queue.queue[1].verifiedComplete,false);
});


test("Supervisor review of real work does not require demonstration artifacts",async()=>{
  const fake=fakeChrome({noDemo:true});
  const manager=new context.TheOrgTaskManager(fake.api);
  const order=await manager.createOrder("demo",validInstruction);
  await manager.saveSupervisorPlan(order.taskId,rawPlan);
  await manager.approvePlan(order.taskId);
  await manager.handoffAndClose(order.taskId,"research1",
    "The sourced research brief is submitted with real references for manual QA.","submitted");
  await manager.recordQaFinding(order.taskId,"research1",0,"pass",
    "Manual review checked the brief and each cited source against the original acceptance criterion.");
  const result=await manager.supervisorReview(order.taskId);
  assert.equal(result.verdict,"manual_qa_recorded_owner_confirmation_pending");
  assert.equal(result.demonstrationArtifacts,0);
});

test("latest corrected artifact revision can supersede a malformed earlier version",async()=>{
  const mock=fakeChrome({noDemo:true});
  const manager=new context.TheOrgTaskManager(mock.api);
  const order=await manager.createOrder("demo",validInstruction);
  await manager.saveSupervisorPlan(order.taskId,rawPlan);
  await manager.approvePlan(order.taskId);
  await manager.importArtifact(order.taskId,"research1","report.md","YQ==","chatgpt","old");
  mock.imports[0].intakeStatus="format_invalid";
  await manager.importArtifact(order.taskId,"research1","report.md","Yg==","chatgpt","fixed");
  mock.imports[1].integrityValid=true;
  mock.imports[1].formatValid=true;
  mock.imports[1].intakeStatus="structure_verified_content_qa_pending";
  await manager.handoffAndClose(order.taskId,"research1",
    "The revised file replaces the malformed old artifact and is now ready for manual acceptance checks.","submitted");
  await manager.recordQaFinding(order.taskId,"research1",0,"pass",
    "I checked the current revised file and cross-referenced the primary source evidence manually.");
  const result=await manager.supervisorReview(order.taskId);
  assert.equal(result.importedArtifacts,2);
  assert.equal(result.verdict,"manual_qa_recorded_owner_confirmation_pending");
  const queue=await manager.executionQueue(order.taskId);
  assert.equal(queue.queue[0].state,"manual_qa_pass_unverified");
});


test("Chrome restart never closes untracked tabs and requires explicit recovery",async()=>{
  const mock=fakeChrome();
  const manager=new context.TheOrgTaskManager(mock.api);
  const order=await manager.createOrder("demo",validInstruction);
  await manager.saveSupervisorPlan(order.taskId,rawPlan);
  await manager.approvePlan(order.taskId);
  const opened=await manager.openAgentTab(order.taskId,"research1","chatgpt");
  assert.equal(mock.tabs.size,1);
  assert.equal((await manager.executionQueue(order.taskId)).queue[0].state,"agent_tab_open");

  // Chrome storage.session is erased on browser restart; earlier tab IDs
  // must never be reconstructed or force-closed from stale local metadata.
  delete mock.session.theorgOwnedTabsV1;
  const afterRestart=new context.TheOrgTaskManager(mock.api);
  const queue=await afterRestart.executionQueue(order.taskId);
  assert.equal(queue.queue[0].state,"browser_session_untracked");
  assert.deepEqual(Array.from(queue.ready),[]);
  assert.equal((await afterRestart.dispatchNextTask(order.taskId)).dispatched,false);
  await assert.rejects(
    ()=>afterRestart.openAgentTab(order.taskId,"research1","chatgpt"),
    /Recover task/);

  const resumed=await afterRestart.recoverAgentTask(order.taskId,"research1");
  assert.equal(resumed.untrackedTabsWereClosed,false);
  assert.equal(mock.tabs.size,2);
  assert.ok(mock.tabs.has(opened.tabId));
  assert.ok(mock.tabs.has(resumed.browserTab.tabId));

  const handed=await afterRestart.handoffAndClose(order.taskId,"research1",
    "The work was handed off from the new session with original browser tabs untouched.","submitted");
  assert.equal(handed.closedTabs,1);
  assert.equal(mock.tabs.size,1);
  assert.ok(mock.tabs.has(opened.tabId));
  const final=await afterRestart.executionQueue(order.taskId);
  assert.equal(final.queue[0].state,"awaiting_qa_evidence");
});


test("v2 specialist training enforces execution checkpoints, evidence, and bounded recovery",()=>{
  assert.equal(context.TheOrgSkills.version,"sop-2.0.0");
  const local=context.TheOrgSkills.route(validInstruction);
  const prompt=context.TheOrgSkills.agentPrompt(validInstruction,local,local.tasks[0].id);
  assert.match(prompt,/OBSERVE-ACT-VERIFY/);
  assert.match(prompt,/CHECKPOINT/);
  assert.match(prompt,/idempotent/i);
  assert.match(prompt,/GOAL SPECIFICATION/);
  assert.match(prompt,/independent review/i);
  const planning=context.TheOrgPlanner.supervisorPrompt(validInstruction);
  assert.match(planning,/edge cases/i);
  assert.match(planning,/bounded recovery/i);
  const plan=context.TheOrgPlanner.interpret(rawPlan);
  const manual=context.TheOrgPlanner.agentPrompt(validInstruction,plan,"research1");
  assert.match(manual,/read back the result/i);
  assert.match(manual,/self-reported success/i);
});
