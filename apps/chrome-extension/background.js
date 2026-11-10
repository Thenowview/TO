/* TheOrg MV3 background — extension-owned messages only, no content scripts or site scraping. */
importScripts("supervisor-plan.js", "task-manager.js");
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
      case "orders": return {ok:true,orders:await manager.listOrders()};
      case "get_order": return await manager.getNativeOrder(message.taskId);
      case "open_supervisor_tab": return {ok:true,...await manager.openSupervisorTab(message.taskId,message.providerId)};
      case "approve_plan": return {ok:true,...await manager.approvePlan(message.taskId)};
      case "create_order": return {ok:true,...await manager.createOrder(message.companyId,message.instruction)};
      case "open_agent_tab": return {ok:true,...await manager.openAgentTab(message.taskId,message.agentId,message.providerId)};
      case "handoff": return {ok:true,...await manager.handoffAndClose(message.taskId,message.agentId,message.summary,message.outcome)};
      case "review": return {ok:true,...await manager.supervisorReview(message.taskId)};
      case "save_supervisor_plan": return {ok:true,...await manager.saveSupervisorPlan(message.taskId,message.response)};
      case "get_plan_prompt": return {ok:true,prompt:planner.supervisorPrompt(message.instruction)};
      case "get_agent_prompt": return {ok:true,prompt:await manager.agentPrompt(message.taskId,message.agentId)};
      default:return {ok:false,error:"unsupported_command"};
    }
  })().then(sendResponse).catch(e=>sendResponse({ok:false,error:String(e?.message||e)}));
  return true;
});
