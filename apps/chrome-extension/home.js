/* GIZE AI Supervisor Home. Local controls only; AI-chat exchanges are manual handoffs.
 * External responses are never inserted as HTML or executed.
 */
"use strict";

const $ = (id) => document.getElementById(id);
const app = { orders: [], activeId: null, providers: {}, handoffAgent: null, qaTarget: null };
const allowedFileTypes = new Set([
  "txt","md","json","csv","py","js","ts","css","html","xml",
  "pdf","docx","xlsx","pptx","png","jpg","jpeg","webp","zip","gaiz","gize"
]);

function node(tag, text, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined && text !== null) el.textContent = String(text);
  return el;
}
function append(parent, ...children) {
  children.forEach(child => parent.append(child));
  return parent;
}
function clear(el) { el.replaceChildren(); return el; }
function toast(message, isError = false) {
  const div = $("toast");
  div.textContent = message;
  div.className = "toast visible" + (isError ? " error" : "");
  setTimeout(() => { if (div.textContent === message) div.className = "toast"; }, 6000);
}
async function rpc(command, args = {}) {
  const result = await chrome.runtime.sendMessage({command, ...args});
  if (!result || result.ok !== true)
    throw new Error(result && result.error ? result.error : "GIZE AI controller did not respond");
  return result;
}
async function action(fn) {
  try { await fn(); }
  catch (err) { toast(err && err.message ? err.message : String(err), true); }
}
async function copy(text, label) {
  await navigator.clipboard.writeText(text);
  toast((label || "Text") + " copied. Paste into the AI chat yourself.");
}
function selectedOrder() {
  return app.orders.find(order => order.taskId === app.activeId) || null;
}

async function checkEngine() {
  try {
    await rpc("ping");
    $("engineStatus").textContent = "Local controller connected";
    $("engineStatus").className = "connection connected";
  } catch {
    $("engineStatus").textContent = "Controller unavailable";
    $("engineStatus").className = "connection pending";
  }
}

function renderProviders() {
  const grid = clear($("providerGrid"));
  const select = $("plannerProvider");
  clear(select);
  Object.entries(app.providers).forEach(([key, p]) => {
    const choice = node("option", p.title);
    choice.value = key;
    select.append(choice);
    const card = node("button", undefined, "provider");
    card.type = "button";
    const mark = node("span", p.title.substring(0, 2).toUpperCase(), "provider-mark");
    const txt = node("span", undefined, "provider-copy");
    append(txt, node("b", p.title), node("small",
      p.kind === "developer-platform" ? "Developer platform • dashboard" : "AI chat • manual consultation"));
    append(card, mark, txt);
    card.addEventListener("click", () => {
      select.value = key;
      $("work").scrollIntoView({behavior:"smooth"});
      toast(p.title + " selected as planning adviser.");
    });
    grid.append(card);
  });
  if (app.providers.chatgpt) select.value = "chatgpt";
}

async function refreshOrders(selectId = null) {
  const data = await rpc("orders");
  app.orders = data.orders || [];
  if (selectId) app.activeId = selectId;
  if (app.activeId && !app.orders.some(o => o.taskId === app.activeId)) app.activeId = null;
  if (!app.activeId && app.orders.length) app.activeId = app.orders[0].taskId;
  $("orderCount").textContent = app.orders.length;
  const list = clear($("ordersList"));
  if (!app.orders.length) list.append(node("p","No work orders yet.","muted"));
  for (const order of app.orders) {
    const btn = node("button", undefined, "order-entry" + (order.taskId === app.activeId ? " active" : ""));
    btn.type = "button";
    append(btn, node("b", order.title || "Untitled order"),
      node("small", (order.companyId || "") + " · " + (order.phase || "pending")));
    btn.addEventListener("click", () => action(async () => {
      app.activeId = order.taskId;
      await refreshOrders();
    }));
    list.append(btn);
  }
  await showSelected();
  try { await refreshAgentJobs(); }
  catch(error) { $("agentDetails").textContent="Local agent runtime unavailable: "+error.message; }
}

async function renderExecutionQueue(taskId) {
  const target = $("executionQueue");
  try {
    const response = await rpc("execution_queue",{taskId});
    const queue = response.queue || [];
    const ready = queue.filter(t => t.state === "ready_for_manual_provider_consultation");
    $("dispatchNext").disabled = !response.planApproved || ready.length===0;
    const statuses = {
      plan_review_required:"Needs plan approval",
      agent_tab_open:"Chat tab open",
      browser_session_untracked:"Previous Chrome session needs manual recovery",
      waiting_on_dependencies:"Waiting on earlier assignments",
      needs_agent_followup:"Agent needs follow-up",
      needs_revision:"Revision required",
      manual_qa_pass_unverified:"Manual QA recorded (not certified)",
      awaiting_qa_evidence:"Waiting for QA evidence",
      ready_for_manual_provider_consultation:"Ready for specialist chat"
    };
    target.replaceChildren();
    target.append(node("b",queue.length+" specialist(s) • "+ready.length+" ready for manual consultation"));
    for (const item of queue) {
      const line=node("div",undefined,"queue-entry");
      const summary=node("div",undefined,"queue-title");
      append(summary,node("b",item.agentId+" — "+item.role),
        node("small",statuses[item.state]||item.state));
      if(item.pendingDependencies?.length)
        summary.append(node("small","Waiting for: "+item.pendingDependencies.join(", ")));
      append(line,summary,node("small","Verified completion: No"));
      if(item.state==="browser_session_untracked") {
        const recover=node("button","Recover this agent tab","secondary");
        recover.type="button";
        recover.addEventListener("click",()=>action(async()=>{
          const consent=window.confirm(
            "Open a NEW GIZE AI-owned tab for "+item.agentId+"? "+
            "Tabs from the earlier Chrome session will not be closed automatically."
          );
          if(!consent)return;
          const restored=await rpc("recover_agent",{
            taskId,agentId:item.agentId
          });
          let copied=false;
          try {await navigator.clipboard.writeText(restored.prompt);copied=true;}
          catch {}
          toast(item.agentId+" re-opened. Previous tabs were left untouched. "+
            (copied?"Paste the copied task instructions into the new chat.":
             "Copy the agent instructions from the specialist card."));
          await refreshOrders(taskId);
        }));
        line.append(recover);
      }
      target.append(line);
    }
    target.append(node("p",response.trustNotice,"form-note"));
  }catch(error){
    $("dispatchNext").disabled=true;
    target.textContent="Task queue unavailable: "+(error.message||String(error));
  }
}

async function showSelected() {
  const order = selectedOrder();
  $("noOrder").hidden = Boolean(order);
  $("activeOrder").hidden = !order;
  if (!order) {
    $("dispatchNext").disabled = true;
    $("executionQueue").textContent = "Choose a work order to view the execution queue.";
    $("artifactAgent").replaceChildren(new Option("Select a specialist",""));
    clear($("deliveries")).append(node("p","Choose a work order to view files.","muted"));
    return;
  }
  $("activeOrderTitle").textContent = order.title;
  $("activeOrderId").textContent = "Order ID: " + order.taskId + " · Company: " + order.companyId;
  $("orderPhase").textContent = (order.phase || "pending").replaceAll("_"," ");
  $("planResponse").value = "";
  const approved = Boolean(order.plan && order.plan.reviewed);
  const plan = order.plan;
  $("planSummary").textContent = plan
    ? (plan.source === "local_deterministic_sop_not_ai"
      ? "Local SOP plan • "+(plan.skillVersion || "version not recorded")+" • "+
        plan.tasks.length+" specialist(s) • Risk: "+(plan.riskTier || "review required")+
        ". No AI provider has been consulted or task performed. Review and approve the assignment list."
      : "AI-advised planning proposal • "+plan.tasks.length+
        " assignment(s). Verify every objective before approval.")
    : "No task plan is available.";
  $("approvePlan").disabled = !order.plan || approved;
  $("interpretPlan").disabled = approved;
  $("agentsList").replaceChildren();
  const agents = (order.plan && order.plan.tasks) || [];
  if (!agents.length) {
    $("agentsList").append(node("p","The Supervisor has not saved a structured plan yet.","muted"));
  } else for (const agent of agents) {
    const section = node("article", undefined, "agent-card");
    const head = node("div", undefined, "agent-head");
    append(head, node("b", agent.role + " · " + agent.id),
      node("small", (agent.status || "planned") +
        (agent.playbookVersion ? " · SOP "+agent.playbookVersion : "")));
    const about = node("p", agent.objective);
    const actions = node("div", undefined, "action-row");
    const open = node("button", "Open " + (app.providers[agent.provider]?.title || agent.provider) + " chat ↗", "secondary");
    const prompt = node("button", "Copy agent instructions", "secondary");
    const report = node("button", "Return agent results", "secondary");
    for (const b of [open, prompt, report]) {b.type="button"; b.disabled=!approved;}
    open.addEventListener("click",()=>action(async()=>{
      await rpc("open_agent_tab",{taskId:order.taskId,agentId:agent.id,providerId:agent.provider});
      toast("Agent tab opened in GIZE AI's task group. You control the AI conversation.");
    }));
    prompt.addEventListener("click",()=>action(async()=>{
      const r=await rpc("get_agent_prompt",{taskId:order.taskId,agentId:agent.id});
      await copy(r.prompt,"Agent instructions");
    }));
    report.addEventListener("click",()=>{
      app.handoffAgent=agent.id;
      $("handoffTitle").textContent = "Agent handoff: " + agent.id;
      $("handoffSummary").value = "";
      $("handoffDialog").showModal();
    });
    append(actions,open,prompt,report);
    const criteria = node("div",undefined,"qa-criteria");
    for (const [index, criterion] of agent.acceptanceCriteria.entries()) {
      const finding = (order.qaFindings?.[agent.id] || {})[index];
      const row = node("div",undefined,"qa-criterion-row");
      const detail = node("div",undefined,"qa-criterion-detail");
      append(detail,node("b",(index+1)+". "+criterion),
        node("small",finding
          ? finding.verdict.replaceAll("_"," ")+
            " • manual, identity unverified • "+
            (finding.evidence||"").slice(0,160)
          : "No QA finding recorded"));
      const review = node("button",finding?"Update QA":"Record QA","secondary");
      review.type="button";
      review.disabled=!approved || !(order.agentReports?.[agent.id]?.outcome==="submitted");
      review.addEventListener("click",()=>{
        app.qaTarget={taskId:order.taskId,agentId:agent.id,index};
        $("qaHeading").textContent="QA finding — "+agent.id;
        $("qaCriterion").textContent=criterion;
        $("qaVerdict").value=finding?.verdict||"pass";
        $("qaEvidence").value=finding?.evidence||"";
        $("qaDialog").showModal();
      });
      append(row,detail,review);
      criteria.append(row);
    }
    append(section,head,about,actions,criteria);
    $("agentsList").append(section);
  }
  const agentSelect = $("artifactAgent");
  clear(agentSelect);
  agentSelect.append(new Option("Select a specialist",""));
  agents.forEach(agent=>agentSelect.append(new Option(agent.role+" — "+agent.id,agent.id)));
  const r = order.review;
  $("reviewResult").textContent = r
    ? (r.verdict||"pending").replaceAll("_"," ")+": "+(r.reason||"")
    : "No independent task verification recorded.";
  await renderTaskQueueThenDeliveries(order.taskId);
}

async function renderTaskQueueThenDeliveries(taskId) {
  await renderExecutionQueue(taskId);
  await renderDeliveries(taskId);
}

async function renderDeliveries(taskId) {
  const target=clear($("deliveries"));
  try {
    const [fileReply,native] = await Promise.all([
      rpc("list_artifacts",{taskId}),rpc("get_order",{taskId})
    ]);
    const list=fileReply.artifacts||[];
    const demo=(native.order?.artifacts)||[];
    const title=node("h4","Imported AI-agent files ("+list.length+")");
    target.append(title);
    if(!list.length)target.append(node("p","No actual agent file imported yet.","muted"));
    for(const artifact of list) {
      const item=node("div",undefined,"artifact-entry");
      const details=node("div",undefined,"artifact-details");
      append(details,node("b",artifact.fileName+" · v"+artifact.version),
        node("small",artifact.agentId+" • "+artifact.bytes+" bytes • "+artifact.intakeStatus),
        node("small","SHA-256: "+artifact.sha256));
      const actions=node("div",undefined,"action-row");
      const verify=node("button","Verify SHA-256","secondary");
      const download=node("button","Download","secondary");
      const canPreview=/\.(txt|md|json|csv)$/i.test(artifact.fileName) && artifact.bytes<=32768;
      const previewButton=node("button","Preview text","secondary");
      const previewPane=node("pre",undefined,"artifact-preview");
      previewPane.hidden=true;
      verify.type="button";download.type="button";previewButton.type="button";
      previewButton.hidden=!canPreview;
      previewButton.addEventListener("click",()=>action(async()=>{
        if(!previewPane.hidden){previewPane.hidden=true;previewPane.textContent="";return;}
        const response=await rpc("preview_text_artifact",{taskId,artifactId:artifact.artifactId});
        const result=response.preview;
        if(result.renderMode!=="textContent_only" || result.contentApproved!==false)
          throw new Error("Unexpected preview security contract");
        previewPane.textContent=result.text+(result.truncated?"\n[Preview truncated]":"");
        previewPane.hidden=false;
        toast("Untrusted text preview only. No malware or independent content approval.");
      }));
      verify.addEventListener("click",()=>action(async()=>{
        const r=await rpc("verify_artifact",{taskId,artifactId:artifact.artifactId});
        toast(r.artifact.integrityValid
          ?"Integrity passed; content QA still required."
          :"Artifact is missing or corrupted.",!r.artifact.integrityValid);
        await renderDeliveries(taskId);
      }));
      download.addEventListener("click",()=>action(async()=>{
        const parts=[];
        let offset=0;
        let expectedSha="";
        let expectedTotal=null;
        while(expectedTotal===null || offset<expectedTotal){
          const response=await rpc("read_artifact_chunk",{
            taskId,artifactId:artifact.artifactId,offset,chunkBytes:128*1024});
          const data=response.result;
          if(data.offset!==offset ||
             (expectedTotal!==null && data.totalBytes!==expectedTotal))
            throw new Error("File transfer returned an inconsistent offset or size");
          expectedTotal=data.totalBytes;
          expectedSha=data.sha256;
          if(expectedTotal>32*1024*1024)throw new Error("File exceeds safe download limit");
          const bytes=base64ToBytes(data.dataBase64);
          if(bytes.length===0 && !data.done)throw new Error("Empty file chunk");
          parts.push(bytes);
          offset+=bytes.length;
          if(offset>expectedTotal)throw new Error("File transfer exceeded expected bytes");
        }
        const blob=new Blob(parts,{type:"application/octet-stream"});
        const hash=await sha256Hex(await blob.arrayBuffer());
        if(hash.toUpperCase()!==String(expectedSha).toUpperCase())
          throw new Error("File SHA-256 mismatch. Download stopped.");
        const url=URL.createObjectURL(blob);
        const link=document.createElement("a");
        link.href=url;link.download=artifact.fileName;
        document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),5000);
        toast("Downloaded locally with SHA-256 checked. Independent content QA remains pending.");
        await renderDeliveries(taskId);
      }));
            append(actions,verify,previewButton,download);
      append(item,details,actions,previewPane);
      target.append(item);
    }
    const demoTitle=node("h4","Controller demonstration files ("+demo.length+")");
    target.append(demoTitle);
    if(demo.length){
      target.append(node("p","These are local test artifacts, not AI deliverables.","muted"));
      for(const file of demo){
        const div=node("div",file.fileName+" · "+file.bytes+" bytes · "+file.sha256,"demo-row");
        target.append(div);
      }
    }
  } catch(err) {
    target.append(node("p","File listing unavailable: "+(err.message||String(err)),"muted"));
  }
}

function fileToBase64(file) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const data=String(reader.result||"");
      resolve(data.slice(data.indexOf(",")+1));
    };
    reader.onerror=()=>reject(new Error("Unable to read selected file"));
    reader.readAsDataURL(file);
  });
}

// Uint8Array chunks are converted without exceeding JavaScript function argument limits.
function bytesToBase64(bytes) {
  const fragments=[];
  for(let i=0;i<bytes.length;i+=8192)
    fragments.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
  return btoa(fragments.join(""));
}
function base64ToBytes(input) {
  const binary=atob(input), bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
}
async function sha256Hex(buffer) {
  const hash=await crypto.subtle.digest("SHA-256",buffer);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
}

async function uploadChunkedFile(order,file) {
  const taskId=order.taskId;
  const agentId=$("artifactAgent").value;
  if(!agentId)throw new Error("Select the responsible specialist");
  const companyId=order.companyId;
  const sha256=await sha256Hex(await file.arrayBuffer());
  const key="theorgTransfer:"+companyId+":"+taskId+":"+agentId;
  let saved=(await chrome.storage.session.get(key))[key];
  if(saved&&(saved.sha256!==sha256||saved.fileName!==file.name||
      saved.size!==file.size)){
    saved=null;
    await chrome.storage.session.remove(key);
  }
  let upload;
  if(saved){
    try {
      const status=await rpc("upload_status",{taskId,
        uploadId:saved.uploadId,accessToken:saved.accessToken});
      upload={...saved,nextIndex:status.result.nextIndex,
        bytesReceived:status.result.bytesReceived};
    } catch {
      await chrome.storage.session.remove(key);
      saved=null;
    }
  }
  if(!upload){
    const result=await rpc("begin_artifact_upload",{
      taskId,agentId,fileName:file.name,totalBytes:file.size,sha256,
      provider:$("artifactProvider").value,
      sourceReference:$("artifactReference").value
    });
    upload={...result.transfer,sha256,fileName:file.name,size:file.size,
      bytesReceived:0,nextIndex:0};
    await chrome.storage.session.set({[key]:upload});
  }
  try {
    while(upload.bytesReceived<file.size){
      const bytes=new Uint8Array(await file.slice(
        upload.bytesReceived,upload.bytesReceived+128*1024).arrayBuffer());
      const result=await rpc("append_artifact_chunk",{
        taskId,uploadId:upload.uploadId,accessToken:upload.accessToken,
        index:upload.nextIndex,dataBase64:bytesToBase64(bytes)
      });
      upload.bytesReceived=result.result.bytesReceived;
      upload.nextIndex=result.result.nextIndex;
      await chrome.storage.session.set({[key]:upload});
      $("uploadProgress").textContent="Uploading "+file.name+": "+
        Math.floor(100*upload.bytesReceived/file.size)+"% ("+
        upload.bytesReceived+" / "+file.size+" bytes)";
    }
    const done=await rpc("complete_artifact_upload",{
      taskId,uploadId:upload.uploadId,accessToken:upload.accessToken
    });
    await chrome.storage.session.remove(key);
    $("uploadProgress").textContent="File received and stored; content QA pending.";
    return done.result.artifact;
  }catch(error){
    $("uploadProgress").textContent="Transfer interrupted. Choose the same file to resume within this Chrome session.";
    throw error;
  }
}

function registerEvents() {
  $("recheck").addEventListener("click",()=>action(checkEngine));
  $("refreshOrders").addEventListener("click",()=>action(()=>refreshOrders()));
  $("refreshQueue").addEventListener("click",()=>action(async()=>{
    const o=selectedOrder();
    if(!o)throw new Error("Select a work order first");
    await renderExecutionQueue(o.taskId);
  }));
  $("dispatchNext").addEventListener("click",()=>action(async()=>{
    const o=selectedOrder();
    if(!o)throw new Error("Choose a work order first");
    const result=await rpc("dispatch_next",{taskId:o.taskId});
    if(!result.dispatched){
      toast(result.reason||"No eligible agent can start yet.",true);
      await renderExecutionQueue(o.taskId);
      return;
    }
    let copied = false;
    try {
      await navigator.clipboard.writeText(result.prompt);
      copied = true;
    } catch {
      // User can always choose the existing Copy agent instructions control.
    }
    toast("Opened "+result.agentId+" in a GIZE AI-owned provider tab. "+
      (copied?"Instructions copied: paste into the chat manually.":
      "Use Copy agent instructions before chatting."));
    await refreshOrders(o.taskId);
  }));

  $("pinHome").addEventListener("click",()=>action(async()=>{
    const tab=await chrome.tabs.getCurrent();
    if(!tab||!tab.id)throw new Error("Pin the full-tab Supervisor page, not its side panel.");
    await chrome.tabs.update(tab.id,{pinned:true});
    toast("GIZE AI Supervisor home pinned.");
  }));
  $("newOrder").addEventListener("submit",event=>{
    event.preventDefault();
    action(async()=>{
      const r=await rpc("create_order",{companyId:$("companyId").value.trim(),
        instruction:$("ownerInstruction").value.trim()});
      toast("Order created. The Supervisor prepared a local specialist plan automatically. Review it and approve dispatch.");
      $("ownerInstruction").value="";
      await refreshOrders(r.taskId);
      $("work").scrollIntoView({behavior:"smooth"});
    });
  });
  for(const btn of document.querySelectorAll("[data-service]")){
    btn.addEventListener("click",()=>{
      $("ownerInstruction").value=btn.dataset.service;
      $("ownerInstruction").focus();
      window.scrollTo({top:0,behavior:"smooth"});
    });
  }
  $("copyPlannerPrompt").addEventListener("click",()=>action(async()=>{
    const o=selectedOrder();
    if(!o)throw new Error("Create a work order first");
    const r=await rpc("get_plan_prompt",{instruction:o.instruction || o.title});
    await copy(r.prompt,"Supervisor planning prompt");
  }));
  $("openPlanner").addEventListener("click",()=>action(async()=>{
    const o=selectedOrder();
    if(!o)throw new Error("Create a work order first");
    await rpc("open_supervisor_tab",{taskId:o.taskId,providerId:$("plannerProvider").value});
    toast("Supervisor adviser opened. Paste the planning prompt manually.");
  }));
  $("interpretPlan").addEventListener("click",()=>action(async()=>{
    const o=selectedOrder();
    if(!o)throw new Error("Choose a work order first");
    const r=await rpc("save_supervisor_plan",{taskId:o.taskId,response:$("planResponse").value});
    toast(r.plan.tasks.length+" proposed specialist assignments saved. Review and approve.");
    await refreshOrders(o.taskId);
  }));
  $("approvePlan").addEventListener("click",()=>action(async()=>{
    const o=selectedOrder();
    if(!o)throw new Error("Choose a work order first");
    const r=await rpc("approve_plan",{taskId:o.taskId});
    toast(r.taskCount+" specialist assignments approved for dispatch.");
    await refreshOrders(o.taskId);
  }));
  $("reviewOrder").addEventListener("click",()=>action(async()=>{
    const o=selectedOrder();
    if(!o)throw new Error("Choose a work order first");
    const r=await rpc("review",{taskId:o.taskId});
    toast(r.verdict.replaceAll("_"," ")+": "+r.reason);
    await refreshOrders(o.taskId);
  }));
  $("copyAuditorPrompt").addEventListener("click",()=>action(async()=>{
    const order=selectedOrder();
    if(!order)throw new Error("Select a work order to prepare independent QA instructions");
    const result=await rpc("get_qa_prompt",{taskId:order.taskId});
    await copy(result.prompt,"Quality Auditor SOP");
  }));
  $("exportAuditPacket").addEventListener("click",()=>action(async()=>{
    const o=selectedOrder();
    if(!o)throw new Error("Select a work order before exporting");
    const result=await rpc("get_qa_packet",{taskId:o.taskId});
    const packet=result.packet;
    const blob=new Blob([JSON.stringify(packet,null,2)+"\n"],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="theorg-audit-"+o.taskId.slice(0,8)+".json";
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    toast("Local QA packet exported. Findings are not externally authenticated.");
  }));
  $("qaCancel").addEventListener("click",()=>$("qaDialog").close());
  $("qaForm").addEventListener("submit",event=>{
    event.preventDefault();
    action(async()=>{
      const target=app.qaTarget;
      if(!target)throw new Error("Select a criterion");
      const data=await rpc("record_qa_finding",{
        taskId:target.taskId,agentId:target.agentId,
        criterionIndex:target.index,verdict:$("qaVerdict").value,
        evidence:$("qaEvidence").value
      });
      $("qaDialog").close();app.qaTarget=null;
      toast("QA finding recorded. Independent authentication and owner acceptance remain pending.");
      await refreshOrders(target.taskId);
    });
  });
  $("cancelHandoff").addEventListener("click",()=>{$("handoffDialog").close();});
  $("handoffForm").addEventListener("submit",event=>{
    event.preventDefault();
    action(async()=>{
      const o=selectedOrder();
      if(!o || !app.handoffAgent)throw new Error("Select an agent");
      const r=await rpc("handoff",{taskId:o.taskId,agentId:app.handoffAgent,
        outcome:$("handoffOutcome").value,summary:$("handoffSummary").value});
      $("handoffDialog").close();
      toast("Handoff saved. "+r.closedTabs+" owned agent tab(s) closed. Supervisor audit pending.");
      await refreshOrders(o.taskId);
    });
  });
  $("artifactUpload").addEventListener("submit",event=>{
    event.preventDefault();
    action(async()=>{
      const o=selectedOrder();
      const file=$("artifactFile").files[0];
      if(!o||!file)throw new Error("Choose a work order and file");
      if(!o.plan?.reviewed)throw new Error("Approve the agent plan before importing files");
      if(file.size<1||file.size>32*1024*1024)
        throw new Error("GIZE AI currently supports files up to 32 MiB");
      if(!allowedFileTypes.has((file.name.split(".").pop()||"").toLowerCase()))
        throw new Error("Unsupported file extension");
      const form=$("artifactUpload");
      const submit=form.querySelector('button[type="submit"]');
      submit.disabled=true;
      try {
        const artifact=await uploadChunkedFile(o,file);
        $("artifactFile").value="";
        // Automatically run deterministic byte/format checks; never auto-approve semantics.
        const inspected=await rpc("verify_artifact",{
          taskId:o.taskId, artifactId:artifact.artifactId
        });
        const safe=inspected.artifact.integrityValid && inspected.artifact.formatValid;
        toast(safe
          ? artifact.fileName+" v"+artifact.version+" passed file-integrity and format checks; independent content QA remains pending."
          : artifact.fileName+" requires review: "+inspected.artifact.structuralReview,
          !safe);
        await renderTaskQueueThenDeliveries(o.taskId);
      }finally {
        submit.disabled=false;
      }
    });
  });
}


async function refreshAgentJobs(preferred=null) {
  const o=selectedOrder(),select=$("agentJobs");
  select.replaceChildren();
  if(!o) {
    app.agentJobId=null;
    select.append(node("option","Create or select a work order first"));
    $("agentDetails").textContent="Create a work order to plan local AI tasks.";
    return;
  }
  const r=await rpc("agent_list",{taskId:o.taskId});
  const jobs=r.jobs||[];
  for(const job of jobs){
    const option=node("option",job.jobId.slice(0,10)+" · "+job.status+" · "+job.mode);
    option.value=job.jobId;select.append(option);
  }
  if(!jobs.length){
    app.agentJobId=null;
    select.append(node("option","No local agent jobs yet"));
    $("agentDetails").textContent="No local AI or synthetic plan has been created for this order.";
    return;
  }
  const candidate=preferred||app.agentJobId;
  app.agentJobId=jobs.some(x=>x.jobId===candidate)?candidate:jobs[0].jobId;
  select.value=app.agentJobId;
  await showAgentJob();
}

async function showAgentJob() {
  const o=selectedOrder(),jobId=app.agentJobId;
  if(!o||!jobId)return;
  const r=await rpc("agent_get",{taskId:o.taskId,jobId});
  const details=[
    "LOCAL AGENT PREVIEW — NOT PRODUCTION",
    "Job: "+r.jobId+" | "+r.mode+" | "+r.status+" | next step "+(r.stepIndex+1),
    "Model: "+r.model,
    "Approved sites: "+(r.approvedHosts||[]).join(", "),
    "OWNER INSTRUCTION:\n"+r.instruction,
    "REVIEW ALL PLAN TOOLS BEFORE APPROVAL:\n"+JSON.stringify(r.plan,null,2),
    "QA RESULT:\n"+(r.qaJson||"Not performed"),
    "RECENT EXECUTION EVENTS:\n"+(r.events||[]).slice(-10)
      .map(e=>e.createdUtc+" | "+e.eventType+" | "+e.evidence).join("\n")
  ];
  $("agentDetails").textContent=details.join("\n\n");
  $("agentApprove").disabled=r.status!=="awaiting_approval";
  $("agentRunNext").disabled=r.status!=="queued";
  $("agentRunSafeBatch").disabled=r.status!=="queued" ||
    !["write_note","read_note","list_notes","system_info"].includes(r.plan?.steps?.[r.stepIndex]?.tool);
  $("agentReview").disabled=r.status!=="completed_pending_review";
  $("agentRecover").disabled=r.status!=="running";
  $("agentCancel").disabled=["review_pending","cancelled","blocked"].includes(r.status);
}

function registerLocalAgentEvents() {
  const run=(fn)=>()=>action(fn);
  $("agentCreate").addEventListener("click",run(async()=>{
    const o=selectedOrder();
    if(!o)throw new Error("Create and select a work order first");
    const r=await rpc("agent_create",{
      taskId:o.taskId,mode:$("agentMode").value,
      model:$("agentModel").value.trim(),
      approvedHosts:$("agentHosts").value.trim()
    });
    app.agentJobId=r.jobId;
    await refreshAgentJobs(r.jobId);
    toast(r.mode==="ollama"?"Local Ollama plan created. Review before approving.":
      "Synthetic test plan created. No LLM used.");
  }));
  $("agentRefresh").addEventListener("click",run(()=>refreshAgentJobs()));
  $("agentJobs").addEventListener("change",run(async()=>{
    app.agentJobId=$("agentJobs").value;
    await showAgentJob();
  }));
  $("agentMemorySave").addEventListener("click",run(async()=>{
    const o=selectedOrder();
    if(!o)throw new Error("Select a company work order first");
    const result=await rpc("agent_memory_put",{
      taskId:o.taskId,key:$("agentMemoryKey").value.trim(),
      value:$("agentMemoryValue").value.trim()
    });
    if(!result.stored)throw new Error("Memory was not confirmed stored");
    toast("Company-scoped memory stored locally. It is not a trained model weight.");
  }));
  $("agentMemoryLoad").addEventListener("click",run(async()=>{
    const o=selectedOrder();
    if(!o)throw new Error("Select a company work order first");
    const result=await rpc("agent_memory_list",{taskId:o.taskId});
    $("agentMemoryOutput").hidden=false;
    $("agentMemoryOutput").textContent=JSON.stringify(result.memories||[],null,2);
  }));
  $("agentTools").addEventListener("click",run(async()=>{
    const o=selectedOrder();
    if(!o)throw new Error("Select a company work order first");
    const result=await rpc("agent_tools",{taskId:o.taskId});
    $("agentMemoryOutput").hidden=false;
    $("agentMemoryOutput").textContent=JSON.stringify(result,null,2);
  }));
  for(const [id,command,extras] of [
    ["agentApprove","agent_approve",{approved:true}],
    ["agentRunNext","agent_run_next",{}],
    ["agentRunSafeBatch","agent_run_safe_batch",{}],
    ["agentReview","agent_review",{}],
    ["agentRecover","agent_recover",{}],
    ["agentCancel","agent_cancel",{}]
  ]){
    $(id).addEventListener("click",run(async()=>{
      const o=selectedOrder(),jobId=app.agentJobId;
      if(!o||!jobId)throw new Error("Select an agent job first");
      const response=await rpc(command,{taskId:o.taskId,jobId,...extras});
      toast(command==="agent_run_next" ?
        "Tool step requested. Examine evidence and output before continuing." :
        command==="agent_run_safe_batch" ?
        (response.executedSteps||0)+" approved local-only step(s) executed; inspect evidence and QA." :
        "Local agent status: "+(response.status||response.qa?.verdict||"updated"));
      await showAgentJob();
    }));
  }
}

(async function init(){
  registerEvents();
  registerLocalAgentEvents();
  await checkEngine();
  try {
    const r=await rpc("providers");
    app.providers=r.providers||{};
    renderProviders();
  } catch(error){toast("Provider directory unavailable: "+error.message,true);}
  try { await refreshOrders(); }
  catch(error){toast("Local work orders unavailable: "+error.message,true);}
})();
