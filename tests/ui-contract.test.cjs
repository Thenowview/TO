/* Static Supervisor UI contract checks; not browser E2E tests. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..","apps","chrome-extension");
const html=fs.readFileSync(path.join(root,"home.html"),"utf8");
const ui=fs.readFileSync(path.join(root,"home.js"),"utf8");
const background=fs.readFileSync(path.join(root,"background.js"),"utf8");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));

test("Supervisor HTML provides every ID accessed by the client",()=>{
 const identifiers=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
 const present=new Set(identifiers);
 const requested=new Set([...ui.matchAll(/\$\("([^"]+)"\)/g)].map(m=>m[1]));
 const missing=[...requested].filter(id=>!present.has(id));
 assert.deepEqual(missing,[],"Missing DOM elements: "+missing.join(","));
 assert.equal(identifiers.length,present.size,"HTML IDs must be unique");
 assert.ok(requested.size>=25,"Supervisor must have substantive UI bindings");
});

test("all UI scripts and styles are locally packaged",()=>{
 const assets=[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/g)]
  .map(m=>m[1]);
 assert.ok(assets.includes("home.js"));
 assert.ok(assets.includes("home.css"));
 for(const name of assets){
  assert.ok(!/^(?:https?:|\/\/)/.test(name),"Remote UI assets are not permitted");
  assert.ok(fs.existsSync(path.join(root,name)),"Missing package asset: "+name);
 }
 assert.equal(manifest.manifest_version,3);
 assert.equal(manifest.background.service_worker,"background.js");
});

test("all Supervisor commands are routed by the extension background",()=>{
 const calls=[...ui.matchAll(/\brpc\("([^"]+)"/g)].map(m=>m[1]);
 const routes=new Set([...background.matchAll(/case "([^"]+)":/g)].map(m=>m[1]));
 const missing=[...new Set(calls)].filter(c=>!routes.has(c));
 assert.deepEqual(missing,[],"Unrouted commands: "+missing.join(","));
 assert.ok(routes.has("execution_queue"));
 assert.ok(routes.has("dispatch_next"));
 assert.ok(routes.has("get_qa_packet"));
 // The execution buttons invoke rpc(command,...) using commands from a data table,
 // not rpc("literal",...), so the general static check alone cannot see them.
 const dynamicBindings=[...ui.matchAll(/\["agent[A-Za-z]+","(agent_[a-z_]+)",\{/g)].map(m=>m[1]);
 assert.ok(dynamicBindings.includes("agent_run_safe_batch"),"Expected local batch action in Supervisor");
 assert.deepEqual(dynamicBindings.filter(command=>!routes.has(command)),[],
   "Dynamic agent actions must be routed by background service worker");
});

test("artifact previews cannot render untrusted HTML and are read-only text",()=>{
 assert.ok(background.includes('case "preview_text_artifact"'));
 assert.ok(ui.includes('rpc("preview_text_artifact"'));
 assert.ok(ui.includes("previewPane.textContent="));
 assert.ok(!ui.includes("previewPane.innerHTML="));
 assert.ok(ui.includes("result.renderMode!==\"textContent_only\""));
});

test("Chrome supervisor exposes GIZE AI as the product label without changing compatibility IDs",()=>{
 assert.match(html,/<title>GIZE AI — Supervisor<\/title>/);
 assert.match(html,/<strong>GIZE AI<\/strong>/);
 assert.match(manifest.name,/GIZE AI/);
 assert.doesNotMatch(html,/<strong>TheOrg<\/strong>|<title>TheOrg/);
 assert.match(ui,/theorgTransfer:/); // persisted legacy key retained
});

test("AO tool-risk display is sourced from disabled-MCP native catalog and remains inert text",()=>{
 assert.match(ui,/rpc\("agent_tools",\{taskId:o\.taskId\}\)/);
 assert.match(ui,/catalogVersion !== "ao\.local\.tools\.v1"/);
 assert.match(ui,/policy\.mcpEnabled !== false/);
 assert.match(ui,/policy\.remoteToolExecutionEnabled !== false/);
 assert.match(ui,/t\.requiresOwnerApproval !== true/);
 assert.match(ui,/AO NATIVE TOOL RISK \(informational, not an authorization\)/);
 assert.match(ui,/UNKNOWN OR UNAPPROVED TOOL; do not execute/);
 assert.match(ui,/\$\("agentDetails"\)\.textContent=details\.join/);
 assert.doesNotMatch(ui,/\$\("agentDetails"\)\.innerHTML/);
});

test("AO catalog rejects duplicate, malformed, unauthorized and expanded descriptors",()=>{
 const vm=require("node:vm");
 const source=ui.slice(ui.indexOf("function validatedAoCatalog("),ui.indexOf("async function showAgentJob("));
 const validate=vm.runInNewContext(source+";validatedAoCatalog");
 const rows=[
 ["write_note","reversible_write","company_order","native_allowlist",true],
 ["read_note","read_only","company_order","native_allowlist",true],
 ["list_notes","read_only","company_order","native_allowlist",true],
 ["system_info","read_only","local_system_summary","native_allowlist",true],
 ["browser_open","consequential_external","approved_https_host","browser_navigation_only",false],
 ["windows_open_notepad","consequential_external","explicit_notepad_launch","native_allowlist",false]];
 const valid=()=>({catalogVersion:"ao.local.tools.v1",mcpEnabled:false,remoteToolExecutionEnabled:false,
 toolNames:rows.map(r=>r[0]),toolDescriptors:rows.map(([id,riskClass,permissionScope,execution,safeBatch])=>
 ({id,version:1,riskClass,requiresOwnerApproval:true,permissionScope,execution,safeBatch}))});
 assert.equal(validate(valid()).size,6);
 for(const mutate of [
 p=>p.toolDescriptors[1]=p.toolDescriptors[0],
 p=>p.toolDescriptors[0]=null,
 p=>p.toolDescriptors[0].id="shell",
 p=>p.toolDescriptors[0].permissionScope="*",
 p=>p.toolDescriptors[0].requiresOwnerApproval=false,
 p=>p.toolDescriptors[0].version="1",
 p=>p.toolDescriptors[0].riskClass="read_only",
 p=>p.toolDescriptors[0].execution="shell",
 p=>p.toolDescriptors[4].safeBatch=true,
 p=>p.toolDescriptors[0].command="cmd.exe",
 p=>delete p.toolDescriptors[0].version,
 p=>p.toolNames[1]=p.toolNames[0],
 p=>p.toolDescriptors[0].id="read_note", // duplicates an existing descriptor
 p=>p.toolNames[0]="__proto__", // inherited property must never count as a tool
 p=>p.toolDescriptors[0].id="__proto__", // inherited property must never count as a descriptor
 p=>p.toolDescriptors.pop(),
 p=>p.mcpEnabled=true,
 p=>p.remoteToolExecutionEnabled=true,
 p=>p.catalogVersion="unknown"
 ]) {const p=valid();mutate(p);assert.equal(validate(p),null);}
 for(const p of [null,{},[],{toolDescriptors:"bad"}]) assert.equal(validate(p),null);
});

test("quick start has three task choices and optional provider controls",()=>{
 assert.equal([...html.matchAll(/data-service="/g)].length,3);
 assert.match(html,/<details id="providers"/);
 assert.match(html,/Consult an AI adviser or edit the plan/);
 assert.ok(ui.includes('$("ownerInstruction").placeholder=btn.dataset.service'));
 assert.ok(!ui.includes('$("ownerInstruction").value=btn.dataset.service'));
 assert.match(html,/id="acceptCompletion"[^>]*disabled/);
 assert.ok(ui.includes('rpc("accept_completion"'));
 assert.ok(ui.includes('navigator.clipboard.writeText(prepared.prompt)'));
});


test("standalone workspace and job browsers deny unsolicited permissions and autofill",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","apps","desktop","Program.cs"),"utf8");
 for(const host of ["_workspace","view"]){
  assert.ok(source.includes(host+".CoreWebView2.PermissionRequested += (_, args) => args.State = CoreWebView2PermissionState.Deny;"),host+" must deny unbrokered camera, microphone, location and other site permissions");
  assert.ok(source.includes(host+".CoreWebView2.Profile.IsGeneralAutofillEnabled = false;"),host+" must not autofill personal form data");
  assert.ok(source.includes(host+".CoreWebView2.Profile.IsPasswordAutosaveEnabled = false;"),host+" must not save passwords outside the scoped vault");
 }
});


test("workspace native-message source rejects custom ports and userinfo",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","apps","desktop","Program.cs"),"utf8");
 const guard=source.slice(source.indexOf("private static bool WorkspaceUrl"),source.indexOf("private async void BridgeMessage"));
 assert.ok(guard.includes("uri.IsDefaultPort"),"same host on another port must not access bridge");
 assert.ok(guard.includes("string.IsNullOrEmpty(uri.UserInfo)"),"credential-bearing URL must not access bridge");
});


test("saved-login adapter rejects concealed inert and readonly targets",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","apps","desktop","Program.cs"),"utf8");
 const fill=source.slice(source.indexOf("private async Task FillLogin()"));
 for(const guard of ["!e.readOnly","!e.disabled","[inert],[hidden],[aria-hidden=true]","s.visibility!==\'hidden\'","s.visibility!==\'collapse\'","s.display!==\'none\'"])
  assert.ok(fill.includes(guard),"Missing saved-login denial: "+guard);
});
