/* TheOrg opt-in ChatGPT/Claude page automation.
 * A user-approved, task-bound prompt may be sent once in a NEW chat only.
 * No credentials, cookies, general site browsing, or other AI platforms.
 * Provider responses are untrusted and must be independently reviewed.
 */
(() => {
  "use strict";
  const KEY="theorgProviderAutoHandoffV1";
  const ALLOWED=Object.freeze({chatgpt:"https://chatgpt.com",claude:"https://claude.ai"});
  const ID=/^[a-f0-9]{32}$/;
  const TTL_MS=10*60*1000;
  const DONE_MS=8*60*1000;

  function providerFor(url) {
    try{
      const parsed=new URL(url);
      if(parsed.protocol!=="https:")return null;
      const found=Object.keys(ALLOWED).find(x=>ALLOWED[x]===parsed.origin);
      if(!found)return null;
      if(found==="chatgpt" && !["/","/new"].includes(parsed.pathname))return null;
      if(found==="claude" && !["/","/new"].includes(parsed.pathname))return null;
      return found;
    }catch{return null;}
  }
  function originOf(url){
    try{return new URL(url).origin;}catch{return null;}
  }
  function isAllowedProvider(url,expected){
    return typeof expected==="string" && ALLOWED[expected]===originOf(url);
  }
  class ProviderAutoHandoff{
    constructor(chromeApi,manager,planner){
      this.api=chromeApi;this.manager=manager;this.planner=planner;
      this.attaching=new Set();
    }
    async state(){
      const all=await this.api.storage.local.get(KEY);
      return all[KEY] || null;
    }
    async saveState(v){await this.api.storage.local.set({[KEY]:v});}
    async arm(taskId,providerId,approved){
      if(approved!==true || !ID.test(taskId) ||
          !["chatgpt","claude","auto"].includes(providerId))
        throw new Error("An explicit work-order and provider automation approval is required");
      const orders=await this.manager.orders(),order=orders[taskId];
      if(!order || order.phase==="archived")throw new Error("Unknown or archived work order");
      const current=await this.state();
      if(current && ["armed","starting","waiting_response"].includes(current.status) &&
          Date.now()<current.expiresAt && current.taskId!==taskId)
        throw new Error("An existing provider automation is pending; cancel it before starting another.");
      const prompt=this.planner.supervisorPrompt(order.instruction);
      const nonce=crypto.randomUUID();
      const record={taskId,companyId:order.companyId,providerId,status:"armed",nonce,
                    prompt,expiresAt:Date.now()+TTL_MS,startedUtc:new Date().toISOString(),
                    tabId:null,error:null};
      order.autoHandoff={providerId,status:"armed",updatedUtc:record.startedUtc,
        expiresAt:record.expiresAt,autoSubmitAuthorized:true};
      await this.manager.saveOrders(orders);
      await this.saveState(record);
      return {taskId,providerId,status:record.status,
        expiresAt:record.expiresAt,note:"Open a NEW ChatGPT or Claude chat in Chrome. TheOrg will send the exact approved prompt once."};
    }
    async cancel(taskId){
      const current=await this.state();
      if(!current || current.taskId!==taskId)throw new Error("No automation found for this order");
      if(current.status==="saved")throw new Error("Already saved; no active automation to cancel");
      current.status="cancelled";current.prompt="";
      await this.saveState(current);
      const all=await this.manager.orders();
      if(all[taskId]?.autoHandoff){all[taskId].autoHandoff.status="cancelled";await this.manager.saveOrders(all);}
      return {taskId,status:"cancelled"};
    }
    async status(taskId){
      const all=await this.manager.orders();
      const order=all[taskId];
      if(!order)throw new Error("Unknown work order");
      const a=order.autoHandoff;
      return a || {status:"not_enabled"};
    }
    async maybeStart(tab) {
      if(!tab || !Number.isInteger(tab.id) || !tab.active)return;
      const detected=providerFor(tab.url||"");
      if(!detected || this.attaching.has(tab.id))return;
      const state=await this.state();
      if(!state || state.status!=="armed" || Date.now()>state.expiresAt ||
          (state.providerId!=="auto"&&state.providerId!==detected))return;
      this.attaching.add(tab.id);
      try{
        // Mark before injecting: service-worker restarts must not cause double submission.
        state.status="starting";state.tabId=tab.id;state.actualProvider=detected;
        state.expiresAt=Date.now()+DONE_MS;
        await this.saveState(state);
        const orders=await this.manager.orders();
        if(orders[state.taskId]?.autoHandoff){
          orders[state.taskId].autoHandoff.providerId=detected;
          orders[state.taskId].autoHandoff.status="in_progress";
          await this.manager.saveOrders(orders);
        }
        await this.api.scripting.executeScript({
          target:{tabId:tab.id},files:["provider-page-agent.js"]
        });
        const response=await this.api.tabs.sendMessage(tab.id,{
          command:"theorg.provider.begin",nonce:state.nonce,providerId:detected,
          prompt:state.prompt
        });
        if(!response || response.accepted!==true)
          throw new Error("Provider page could not accept the instruction.");
        // Never overwrite a newer submitted/captured status from the page script.
        const latest=await this.state();
        if(latest?.nonce===state.nonce && latest.status==="starting"){
          latest.prompt="";
          await this.saveState(latest);
        }
      }catch(error){
        await this.setBlocked(state,"Page integration failed: "+String(error?.message||error));
      }finally{this.attaching.delete(tab.id);}
    }
    async setBlocked(current,message){
      current.status="blocked";current.prompt="";current.error=String(message).slice(0,220);
      await this.saveState(current);
      const all=await this.manager.orders();
      if(all[current.taskId]?.autoHandoff){
        all[current.taskId].autoHandoff.status="blocked";
        all[current.taskId].autoHandoff.error=current.error;
        await this.manager.saveOrders(all);
      }
    }
    async onPageEvent(message,sender){
      const current=await this.state();
      if(!current || !message || message.nonce!==current.nonce ||
          !Number.isInteger(sender?.tab?.id) || sender.tab.id!==current.tabId ||
          !isAllowedProvider(sender.tab.url||"",current.actualProvider) ||
          !["starting","waiting_response"].includes(current.status))
        throw new Error("Unauthorized or stale automated provider response.");
      if(Date.now()>current.expiresAt){
        await this.setBlocked(current,"AI provider response exceeded the timeout");
        throw new Error("Provider capture expired.");
      }
      if(message.status==="submitted"){
        current.status="waiting_response";
        current.prompt="";
        await this.saveState(current);
        return {status:current.status};
      }
      if(message.status==="blocked"){
        await this.setBlocked(current,String(message.error||"Unsupported provider page or sign-in needed"));
        return {status:"blocked"};
      }
      if(message.status!=="captured" || typeof message.content!=="string" ||
          message.content.length>90000 || message.content.trim().length<10)
        throw new Error("Invalid provider content or unexpected event");
      // Bound provenance; never store URL query parameters, fragments, credentials or secrets.
      const url=new URL(sender.tab.url);
      const source=url.origin+url.pathname.slice(0,420);
      const result=await this.manager.saveAutomaticResult(
          current.taskId,current.actualProvider,message.content,source);
      current.status="saved";current.prompt="";current.result=result;
      await this.saveState(current);
      return {status:"saved",result};
    }
  }
  globalThis.TheOrgProviderAutoHandoff=ProviderAutoHandoff;
  if(typeof module!=="undefined"&&module.exports)
    module.exports={ProviderAutoHandoff,providerFor,isAllowedProvider};
})();
