/* Company-scoped named agent directory: no external connections or model required. */
const test=require("node:test"), assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const ext=path.join(__dirname,"..","apps","chrome-extension");
function setup(){
  const state={};
  const api={storage:{local:{
    get:async k=>({[k]:state[k]}),
    set:async data=>Object.assign(state,data)
  }}};
  const context={console};context.globalThis=context;
  for(const name of ["agent-playbooks.js","company-agent-directory.js"])
    vm.runInNewContext(fs.readFileSync(path.join(ext,name),"utf8"),context,{filename:name});
  return {directory:new context.TheOrgCompanyAgentDirectory(api),state,context};
}
test("Every company receives twelve distinct named role profiles",async()=>{
  const {directory}=setup();
  const a=await directory.roster("alpha");
  assert.equal(a.length,12);
  assert.equal(new Set(a.map(x=>x.id)).size,12);
  assert.equal(new Set(a.map(x=>x.name)).size,12);
  assert.ok(a.every(x=>x.department&&x.title&&x.expertise.length));
  assert.ok(a.find(x=>x.id==="qa_auditor")?.reportsTo==="supervisor");
});
test("Custom name, role title, expertise and SOP are strictly isolated by company",async()=>{
  const {directory}=setup();
  await directory.update("alpha","developer",{
    name:"Ada",title:"Principal Software Architect",department:"Engineering",
    expertise:["typescript","python","agent orchestration"],
    responsibilities:"Design and implement testable software modules.",
    instructions:"Inspect repository contracts before proposing changes and test results.",
    enabled:true
  });
  const a=(await directory.roster("alpha")).find(p=>p.id==="developer");
  const b=(await directory.roster("beta")).find(p=>p.id==="developer");
  assert.equal(a.name,"Ada");
  assert.equal(a.title,"Principal Software Architect");
  assert.notEqual(a.name,b.name);
  assert.match(await directory.context("alpha","developer"),/Ada/);
  assert.doesNotMatch(await directory.context("beta","developer"),/Ada/);
  assert.match(await directory.context("alpha","developer"),/cannot override tool permissions/);
});
test("Fixed IDs and permissions cannot be edited through profiles",async()=>{
  const {directory}=setup();
  for(const payload of [{capabilities:["shell.exec"]},{id:"security_officer"},{reportsTo:"owner"},{approvalDefault:"none"}]){
    await assert.rejects(()=>directory.update("alpha","developer",payload),/Only agent display metadata/i);
  }
  await assert.rejects(()=>directory.update("alpha","unknown",{name:"Bob"}),/Unknown/);
  await assert.rejects(()=>directory.update("../beta","developer",{name:"Bob"}),/company/);
});
test("Disabled specialist cannot be routed or prompted, default can be restored",async()=>{
  const {directory}=setup();
  await directory.update("alpha","developer",{enabled:false});
  const output=await directory.recommend("alpha","Fix a Python bug in the backend and add tests.");
  assert.equal(output.recommended.some(x=>x.id==="developer"),false);
  await assert.rejects(()=>directory.context("alpha","developer"),/disabled/);
  await directory.reset("alpha","developer");
  const output2=await directory.recommend("alpha","Fix a Python bug in the backend and add tests.");
  assert.ok(output2.recommended.some(x=>x.id==="developer"));
});
test("Expertise matching is bounded, deterministic and advisory",async()=>{
  const {directory}=setup();
  await directory.update("alpha","analyst",{expertise:["insurance premiums","portfolio metrics"]});
  const r=await directory.recommend("alpha","Analyze insurance premiums and portfolio metrics.");
  assert.equal(r.recommended[0].id,"analyst");
  assert.equal(r.requiresPlanReview,true);
  assert.equal(r.approved,false);
  assert.ok(r.recommended.length<=3);
});
test("Supervisor wire-up and HTML are present",()=>{
  const background=fs.readFileSync(path.join(ext,"background.js"),"utf8");
  const manager=fs.readFileSync(path.join(ext,"task-manager.js"),"utf8");
  const ui=fs.readFileSync(path.join(ext,"home.js"),"utf8");
  const html=fs.readFileSync(path.join(ext,"home.html"),"utf8");
  assert.match(background,/company-agent-directory\.js/);
  assert.match(background,/company_agent_update/);
  assert.match(manager,/companyDirectory\.context/);
  assert.match(manager,/companyDirectory\.recommend/);
  for(const id of ["companyAgentSelect","companyAgentExpertise","companyAgentInstructions","companyAgentCards","companyAgentRecommendations"])
    assert.ok(html.includes('id="'+id+'"'));
  assert.match(ui,/loadCompanyAgents/);
  assert.match(ui,/updateCompanyAgent/);
});
