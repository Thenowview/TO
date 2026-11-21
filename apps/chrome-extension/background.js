/* TheOrg MV3 background — extension-owned messages only, no content scripts or site scraping. */
importScripts("agent-playbooks.js", "supervisor-plan.js", "task-manager.js", "browser-workflow.js");
const browserWorkflows = new globalThis.GizeBrowserWorkflow.BrowserWorkflowRunner(chrome);
const manager = new globalThis.TheOrgTaskManager(chrome);
const planner = globalThis.TheOrgPlanner;

chrome.action.onClicked.addListener(async () => {
  try { await chrome.tabs.create({url: chrome.runtime.getURL("home.html"),active:true}); }
  catch(e){ console.warn("TheOrg home could not open",String(e)); }
});
chrome.tabs.onRemoved.addListener(id=>manager.handleRemoved(id).catch(()=>undefined));

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(sender.id!==chrome.runtime.id || !message || typeof message!=="object" ||
     typeof message.command!=="string") return false;
  (async()=>{
    switch(message.command){
      case "desktop_windows":
      case "desktop_observe":
      case "desktop_preview":
      case "desktop_execute":
      case "desktop_receipt":
      case "desktop_stop":
      case "desktop_history": {
        if(typeof sender.url !== "string" || sender.url.split(/[?#]/)[0] !== chrome.runtime.getURL("home.html"))
          throw new Error("Desktop actions require the Supervisor page");
        const order = (await manager.orders())[message.taskId];
        if(!order || order.phase === "archived") throw new Error("Active work order missing");
        const request = {command:message.command,companyId:order.companyId,orderId:message.taskId};
        if(message.command === "desktop_observe") request.window=message.window;
        if(message.command === "desktop_preview") request.action=message.action;
        if(message.command === "desktop_execute") {
          request.approved=message.approved===true;
          request.fingerprint=message.fingerprint;
        }
        if(message.command === "desktop_execute" || message.command === "desktop_receipt" || message.command === "desktop_stop") request.actionId=message.actionId;
        return await manager.native(request);
      }
      case "desktop_draft_plan": {
        if(typeof sender.url !== "string" || sender.url.split(/[?#]/)[0] !== chrome.runtime.getURL("home.html"))
          throw new Error("Desktop planning requires the Supervisor page");
        const order = (await manager.orders())[message.taskId];
        if(!order || order.phase === "archived") throw new Error("Active work order missing");
        return await manager.native({command:"desktop_draft_plan",companyId:order.companyId,orderId:message.taskId,
          instruction:order.instruction,model:message.model,window:message.window});
      }
      case "browser_workflow_create":
      case "browser_workflow_get":
      case "browser_workflow_list":
      case "browser_workflow_run":
      case "browser_workflow_stop": {
        // Only the packaged Supervisor may authorize workflow actions.
        if(typeof sender.url !== "string" || sender.url.split(/[?#]/)[0] !== chrome.runtime.getURL("home.html"))
          throw new Error("Browser workflows require the Supervisor page");
        const order = (await manager.orders())[message.taskId];
        if(!order || order.phase === "archived") throw new Error("Active work order missing");
        if(message.command === "browser_workflow_create")
          return {ok:true,workflow:await browserWorkflows.create(message.taskId,message.plan)};
        if(message.command === "browser_workflow_list")
          return {ok:true,workflows:await browserWorkflows.list(message.taskId)};
        if(message.command === "browser_workflow_get")
          return {ok:true,workflow:await browserWorkflows.get(message.taskId,message.workflowId)};
        if(message.command === "browser_workflow_stop") {
          await browserWorkflows.get(message.taskId,message.workflowId);
          return {ok:true,...browserWorkflows.stop(message.taskId,message.workflowId)};
        }
        return {ok:true,workflow:await browserWorkflows.run(message.taskId,message.workflowId,message.fingerprint)};
      }
      case "ping": return await manager.checkEngine();
      case "ao_capabilities": return {ok:true,...await manager.aoCapabilities()};
      case "providers": return {ok:true,providers:manager.providers()};
      case "agent_skills": return {ok:true,version:globalThis.TheOrgSkills.version,profiles:globalThis.TheOrgSkills.profiles(),rubric:globalThis.TheOrgSkills.qualityRubric()};
      case "orders": return {ok:true,orders:await manager.listOrders()};
      case "execution_queue": return {ok:true,...await manager.executionQueue(message.taskId)};
      case "dispatch_next": return {ok:true,...await manager.dispatchNextTask(message.taskId)};
      case "recover_agent": return {ok:true,...await manager.recoverAgentTask(message.taskId,message.agentId)};
      case "agent_create": return await manager.agentCreate(message.taskId,message.mode,message.model,message.approvedHosts);
      case "agent_list": return {ok:true,...await manager.agentList(message.taskId)};
      case "agent_memory_put":
      case "agent_memory_list":
      case "agent_tools": return await manager.agentMemory(
        message.taskId,message.command,message.key,message.value);

      case "agent_get":
      case "agent_approve":
      case "agent_run_next":
      case "agent_run_safe_batch":
      case "agent_review":
      case "agent_cancel":
      case "agent_recover": return await manager.agentCommand(
        message.taskId,message.jobId,message.command,{
          approved:message.approved===true,reviewFingerprint:message.reviewFingerprint});
      case "get_order": return await manager.getNativeOrder(message.taskId);
      case "open_supervisor_tab": return {ok:true,...await manager.openSupervisorTab(message.taskId,message.providerId)};
      case "approve_plan": return {ok:true,...await manager.approvePlan(message.taskId)};
      case "create_order": return {ok:true,...await manager.createOrder(message.companyId,message.instruction)};
      case "open_agent_tab": return {ok:true,...await manager.openAgentTab(message.taskId,message.agentId,message.providerId)};
      case "import_artifact": return {ok:true,artifact:await manager.importArtifact(
        message.taskId,message.agentId,message.fileName,message.dataBase64,
        message.provider,message.sourceReference)};
      case "begin_artifact_upload":
        return {ok:true,transfer:await manager.beginArtifactUpload(
          message.taskId,message.agentId,message.fileName,message.totalBytes,
          message.sha256,message.provider,message.sourceReference)};
      case "append_artifact_chunk":
        return {ok:true,result:await manager.artifactTransfer(
          message.taskId,"append_artifact_chunk",message.uploadId,message.accessToken,
          {index:message.index,dataBase64:message.dataBase64})};
      case "upload_status":
        return {ok:true,result:await manager.artifactTransfer(
          message.taskId,"upload_status",message.uploadId,message.accessToken)};
      case "complete_artifact_upload":
        return {ok:true,result:await manager.artifactTransfer(
          message.taskId,"complete_artifact_upload",message.uploadId,message.accessToken)};
      case "cancel_artifact_upload":
        return {ok:true,result:await manager.artifactTransfer(
          message.taskId,"cancel_artifact_upload",message.uploadId,message.accessToken)};
      case "read_artifact_chunk":
        return {ok:true,result:await manager.readArtifactChunk(
          message.taskId,message.artifactId,message.offset,message.chunkBytes)};
      case "list_artifacts": return {ok:true,artifacts:await manager.listArtifacts(message.taskId)};
      case "verify_artifact": return {ok:true,artifact:await manager.verifyArtifact(message.taskId,message.artifactId)};
      case "preview_text_artifact": return {ok:true,preview:await manager.previewTextArtifact(message.taskId,message.artifactId)};
      case "read_artifact": return {ok:true,content:await manager.readArtifact(message.taskId,message.artifactId)};
      case "handoff": return {ok:true,...await manager.handoffAndClose(message.taskId,message.agentId,message.summary,message.outcome)};
      case "record_qa_finding":
        return {ok:true,...await manager.recordQaFinding(
          message.taskId,message.agentId,message.criterionIndex,message.verdict,
          message.evidence)};
      case "get_qa_packet":
        return {ok:true,packet:await manager.getQaPacket(message.taskId)};
      case "get_qa_prompt":
        return {ok:true,prompt:await manager.qaAuditorPrompt(message.taskId)};
      case "review": return {ok:true,...await manager.supervisorReview(message.taskId)};
      case "accept_completion": return {ok:true,...await manager.acceptCompletion(
        message.taskId,message.snapshot,message.evidence)};
      case "save_supervisor_plan": return {ok:true,...await manager.saveSupervisorPlan(message.taskId,message.response)};
      case "get_plan_prompt": return {ok:true,prompt:planner.supervisorPrompt(message.instruction)};
      case "get_agent_prompt": return {ok:true,prompt:await manager.agentPrompt(message.taskId,message.agentId)};
      default:return {ok:false,error:"unsupported_command"};
    }
  })().then(sendResponse).catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));
  return true;
});


