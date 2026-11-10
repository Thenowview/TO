/* TheOrg MV3 background — extension-owned messages only, no content scripts or site scraping. */
importScripts("agent-playbooks.js", "supervisor-plan.js", "task-manager.js");
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
      case "ping": return await manager.checkEngine();
      case "providers": return {ok:true,providers:manager.providers()};
      case "agent_skills": return {ok:true,version:globalThis.TheOrgSkills.version,profiles:globalThis.TheOrgSkills.profiles(),rubric:globalThis.TheOrgSkills.qualityRubric()};
      case "orders": return {ok:true,orders:await manager.listOrders()};
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
      case "read_artifact": return {ok:true,content:await manager.readArtifact(message.taskId,message.artifactId)};
      case "handoff": return {ok:true,...await manager.handoffAndClose(message.taskId,message.agentId,message.summary,message.outcome)};
      case "record_qa_finding":
        return {ok:true,...await manager.recordQaFinding(
          message.taskId,message.agentId,message.criterionIndex,message.verdict,
          message.evidence)};
      case "get_qa_packet":
        return {ok:true,packet:await manager.getQaPacket(message.taskId)};
      case "review": return {ok:true,...await manager.supervisorReview(message.taskId)};
      case "save_supervisor_plan": return {ok:true,...await manager.saveSupervisorPlan(message.taskId,message.response)};
      case "get_plan_prompt": return {ok:true,prompt:planner.supervisorPrompt(message.instruction)};
      case "get_agent_prompt": return {ok:true,prompt:await manager.agentPrompt(message.taskId,message.agentId)};
      default:return {ok:false,error:"unsupported_command"};
    }
  })().then(sendResponse).catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));
  return true;
});
