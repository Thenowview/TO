/* TheOrg: approved multi-order AI provider queue. Four active jobs maximum.
 * The browser must be opened by the user AFTER queueing. No provider auto-login.
 * A crash cannot automatically re-send the same instruction.
 */
(() => {
"use strict";
const QUEUE_KEY="theorgAutoProviderQueueV2";
const TAB_KEY="theorgNewProviderTabsV2";
const LIMIT=4, MAX_JOBS=120;
const WAIT_TTL=24*60*60*1000, ACTIVE_TTL=8*60*1000;
const ACTIVE=new Set(["starting","waiting_response","capturing_files"]);
const PENDING=new Set(["queued",...ACTIVE]);
const HOSTS=Object.freeze({chatgpt:"https://chatgpt.com",claude:"https://claude.ai"});
const TASK=/^[a-f0-9]{32}$/, AGENT=/^[a-z][a-z0-9_-]{0,39}$/;
const fail=e=>String(e?.message||e).slice(0,230);
function providerFor(url){
  try {
    const x=new URL(url);
    if(x.protocol!=="https:" || !["/","/new"].includes(x.pathname))return null;
    return Object.keys(HOSTS).find(p=>HOSTS[p]===x.origin)||null;
  }catch{return null;}
}
function validHost(url,provider){
  try{const u=new URL(url);return u.protocol==="https:"&&HOSTS[provider]===u.origin;}catch{return false;}
}
class ProviderAutoHandoff {
  constructor(api,manager,planner){this.api=api;this.manager=manager;this.planner=planner;this.serial=Promise.resolve();}
  lock(fn){const v=this.serial.then(fn,fn);this.serial=v.catch(()=>undefined);return v;}
  async load(){return (await this.api.storage.local.get(QUEUE_KEY))[QUEUE_KEY]||[];}
  async save(data){await this.api.storage.local.set({[QUEUE_KEY]:data});}
  async tabCandidates(){return (await this.api.storage.session.get(TAB_KEY))[TAB_KEY]||{};}
  async noteTab(tab){
    if(!Number.isInteger(tab?.id))return;
    const pending=await this.tabCandidates();
    pending[tab.id]=Date.now();
    for(const [id,at] of Object.entries(pending))
      if(Date.now()-at>WAIT_TTL)delete pending[id];
    await this.api.storage.session.set({[TAB_KEY]:pending});
  }
  async forgetTab(tabId){
    const pending=await this.tabCandidates();
    if(pending[tabId]){delete pending[tabId];await this.api.storage.session.set({[TAB_KEY]:pending});}
  }
  safe(job){
    const {prompt,nonce,transfers,...exposed}=job;
    return {...exposed,hasPendingPrompt:Boolean(prompt)};
  }
  async sync(job){
    return this.manager.serialize(async()=>{
      const data=await this.manager.orders(),order=data[job.taskId];
      if(!order)return;
      order.automationJobs=order.automationJobs||{};
      const old=order.automationJobs[job.id]||{};
      order.automationJobs[job.id]={
        ...old,jobId:job.id,agentId:job.agentId,
        providerId:job.actualProvider||job.providerId,status:job.status,
        createdUtc:job.createdUtc,updatedUtc:new Date().toISOString(),
        expiresAt:job.expiresAt,tabId:job.tabId,error:job.error||""
      };
      await this.manager.saveOrders(data);
    });
  }
  async expire(jobs){
    let changed=false;
    for(const j of jobs){
      if(PENDING.has(j.status)&&Date.now()>j.expiresAt){
        j.status="interrupted";j.prompt="";j.transfers={};
        j.error="Authorization expired or provider response timed out; requeue after review.";
        await this.sync(j);changed=true;
      }
    }
    if(changed)await this.save(jobs);
  }
  async create(taskId,providerId,agentId,approved,customInstruction=null){
    if(approved!==true||!TASK.test(taskId)||
       !["chatgpt","claude","auto"].includes(providerId)||
       !(agentId==="supervisor"||AGENT.test(agentId)))
      throw new Error("Explicit order/provider/agent permission is required.");
    const data=await this.manager.orders(),order=data[taskId];
    if(!order||order.phase==="archived")throw new Error("Order missing or archived.");
    let prompt;
    if(agentId==="supervisor"){
      prompt=typeof customInstruction==="string"?customInstruction:
        globalThis.TheOrgJobIntake.prompt(order.instruction);
    }else{
      if(!order.plan?.reviewed)throw new Error("Approve the Supervisor plan first.");
      const q=await this.manager.executionQueue(taskId);
      const entry=q.queue.find(x=>x.agentId===agentId);
      if(entry?.state!=="ready_for_manual_provider_consultation")
        throw new Error("Specialist dependencies, plan approval or QA are still pending.");
      if(!["chatgpt","claude"].includes(entry.providerId))
        throw new Error("Automatic specialist dispatch only supports ChatGPT and Claude.");
      if(providerId!=="auto"&&providerId!==entry.providerId)
        throw new Error("Specialist's approved provider does not match.");
      providerId=entry.providerId;prompt=await this.manager.agentPrompt(taskId,agentId);
    }
    if(typeof prompt!=="string"||prompt.length<10||prompt.length>15000)
      throw new Error("Supervisor prompt exceeds authorized size.");
    return this.lock(async()=>{
      const jobs=await this.load();await this.expire(jobs);
      if(jobs.some(j=>j.taskId===taskId&&j.agentId===agentId&&PENDING.has(j.status)))
        throw new Error("An agent already has an outstanding request in this order.");
      if(jobs.length>=MAX_JOBS){
        const oldestCompleted=jobs.findIndex(j=>!PENDING.has(j.status));
        if(oldestCompleted<0)throw new Error("Queue capacity reached; archive old requests first.");
        jobs.splice(oldestCompleted,1);
      }
      const at=Date.now();
      const job={id:crypto.randomUUID(),nonce:crypto.randomUUID(),taskId,
        companyId:order.companyId,agentId,providerId,actualProvider:null,
        status:"queued",prompt,tabId:null,error:"",transfers:{},
        createdAt:at,createdUtc:new Date().toISOString(),expiresAt:at+WAIT_TTL};
      jobs.push(job);
      await this.save(jobs);await this.sync(job);
      return this.safe(job);
    });
  }
  async arm(taskId,providerId,approved){return this.create(taskId,providerId,"supervisor",approved);}
  async answer(taskId,answers,approved){
    if(approved!==true || !TASK.test(taskId) || typeof answers!=="string" ||
       answers.trim().length<5 || answers.length>2500)
      throw new Error("Review and approve the clarification answers (5–2500 characters).");
    const all=await this.manager.orders(),order=all[taskId];
    if(!order)throw new Error("Unknown order.");
    const prior=Object.values(order.automationJobs||{}).filter(j=>
      j.agentId==="supervisor" && j.intake?.kind==="clarification" &&
      j.status==="saved");
    if(!prior.length)throw new Error("No ChatGPT clarification request exists.");
    const prompt=globalThis.TheOrgJobIntake.prompt(order.instruction,answers);
    return this.create(taskId,"chatgpt","supervisor",true,prompt);
  }
  async bulk(taskId,approved){
    if(approved!==true)throw new Error("Bulk agent scheduling requires approval.");
    const q=await this.manager.executionQueue(taskId);
    if(!q.planApproved)throw new Error("Approve the specialist plan first.");
    const ready=q.queue.filter(j=>j.state==="ready_for_manual_provider_consultation"&&
      ["chatgpt","claude"].includes(j.providerId)).slice(0,8);
    if(!ready.length)throw new Error("No eligible specialists; check dependencies.");
    const queued=[],errors=[];
    for(const role of ready){
      try{queued.push(await this.create(taskId,role.providerId,role.agentId,true));}
      catch(e){errors.push({agentId:role.agentId,error:fail(e)});}
    }
    return {queued:queued.map(j=>this.safe(j)),errors};
  }
  async list(){
    return this.lock(async()=>{
      const jobs=await this.load();await this.expire(jobs);
      const active=jobs.filter(j=>ACTIVE.has(j.status)).length;
      return {jobs:jobs.map(j=>this.safe(j)).reverse(),
        active,queued:jobs.filter(j=>j.status==="queued").length,
        availableSlots:Math.max(0,LIMIT-active),maxActive:LIMIT};
    });
  }
  async status(taskId){
    if(!TASK.test(taskId))throw new Error("Invalid order.");
    const all=await this.list();
    return {...all,jobs:all.jobs.filter(j=>j.taskId===taskId)};
  }
  async cancel(taskId,jobId){
    return this.lock(async()=>{
      const jobs=await this.load(),job=jobs.find(j=>j.taskId===taskId&&j.id===jobId);
      if(!job||!PENDING.has(job.status))throw new Error("This request is not pending.");
      job.status="cancelled";job.prompt="";job.transfers={};
      job.error="Cancelled by Supervisor.";
      await this.save(jobs);await this.sync(job);
      return {taskId,jobId,status:job.status};
    });
  }
  async maybeStart(tab){
    if(!Number.isInteger(tab?.id))return null;
    const provider=providerFor(tab.url||"");if(!provider)return null;
    const candidate=(await this.tabCandidates())[tab.id];
    if(!candidate)return null; // Never repurpose a personal tab opened before authorization.
    const claim=await this.lock(async()=>{
      const jobs=await this.load();await this.expire(jobs);
      if(jobs.filter(j=>ACTIVE.has(j.status)).length>=LIMIT)return null;
      if(jobs.some(j=>j.tabId===tab.id))return null;
      // FIFO amongst eligible requests for this provider.
      const job=jobs.find(j=>j.status==="queued"&&
        (j.providerId==="auto"||j.providerId===provider)&&candidate>=j.createdAt);
      if(!job)return null;
      job.status="starting";job.tabId=tab.id;job.actualProvider=provider;
      job.expiresAt=Date.now()+ACTIVE_TTL;
      const prompt=job.prompt;job.prompt=""; // Restart may interrupt, never resubmit.
      await this.save(jobs);await this.sync(job);
      await this.forgetTab(tab.id);
      return {id:job.id,nonce:job.nonce,providerId:provider,prompt};
    });
    if(!claim)return null;
    try{
      await this.api.scripting.executeScript({target:{tabId:tab.id},files:["provider-page-agent.js"]});
      const reply=await this.api.tabs.sendMessage(tab.id,{
        command:"theorg.provider.begin",nonce:claim.nonce,
        providerId:claim.providerId,prompt:claim.prompt
      });
      if(reply?.accepted!==true)throw new Error("Provider new-chat page could not accept prompt.");
    }catch(e){await this.failJob(claim.nonce,"Page integration failed: "+fail(e));}
    return claim;
  }
  async dispatchWaiting(){
    const candidates=await this.tabCandidates();
    const tabs=Object.keys(candidates).map(Number);
    for(const id of tabs){
      if((await this.list()).availableSlots===0)break;
      try{
        const tab=await this.api.tabs.get(id);
        if(tab)await this.maybeStart(tab);
      }catch{await this.forgetTab(id);}
    }
  }
  async failJob(nonce,message){
    return this.lock(async()=>{
      const jobs=await this.load(),j=jobs.find(x=>x.nonce===nonce);
      if(!j||!ACTIVE.has(j.status))return;
      j.status="blocked";j.prompt="";j.error=String(message).slice(0,230);
      await this.save(jobs);await this.sync(j);
      void this.dispatchWaiting().catch(()=>undefined);
    });
  }
  async event(message,sender){
    return this.lock(async()=>{
    const jobs=await this.load(),j=jobs.find(x=>x.nonce===message.nonce);
    if(!j||sender?.tab?.id!==j.tabId||!validHost(sender.tab.url,j.actualProvider))
      throw new Error("Invalid provider tab, job or response authorization.");
    if(Date.now()>j.expiresAt)throw new Error("Provider job expired.");
    if(message.status==="submitted"){
      if(j.status!=="starting")throw new Error("Duplicate provider submission.");
      j.status="waiting_response";await this.save(jobs);await this.sync(j);
      return {status:j.status,jobId:j.id};
    }
    if(message.status==="file_warning"){
      if(j.status!=="capturing_files")throw new Error("File warning before response capture.");
      const data=await this.manager.orders(),o=data[j.taskId];
      const record=o?.automationJobs?.[j.id];
      if(record){
        record.fileWarnings=record.fileWarnings||[];
        if(record.fileWarnings.length<4)record.fileWarnings.push(fail(message.error));
        await this.manager.saveOrders(data);
      }
      return {status:"file_warning"};
    }
    if(message.status==="blocked"){
      if(!ACTIVE.has(j.status))throw new Error("Provider job is no longer active.");
      j.status="blocked";j.prompt="";j.transfers={};j.error=fail(message.error);
      await this.save(jobs);await this.sync(j);
      void this.dispatchWaiting().catch(()=>undefined);
      return {status:"blocked",jobId:j.id};
    }
    if(message.status==="files_complete"){
      if(j.status!=="capturing_files")throw new Error("Job not awaiting file completion.");
      j.status="saved";j.prompt="";j.transfers={};
      await this.save(jobs);await this.sync(j);
      void this.dispatchWaiting().catch(()=>undefined);
      return {status:"saved",jobId:j.id};
    }
    if(message.status!=="captured"||j.status!=="waiting_response"||
       typeof message.content!=="string"||message.content.length>90000||
       message.content.trim().length<10)
      throw new Error("Invalid or duplicate AI response.");
    const url=new URL(sender.tab.url),source=url.origin+url.pathname.slice(0,400);
    const output=await this.manager.saveAutomaticResult(j.taskId,j.actualProvider,
      message.content,source,j.agentId,j.id);
    j.status="capturing_files";j.prompt="";j.result=output;
    await this.save(jobs);await this.sync(j);
    if(j.agentId==="supervisor"){
      const data=await this.manager.orders(),record=data[j.taskId]?.automationJobs?.[j.id];
      if(record){
        record.intake=globalThis.TheOrgJobIntake.parse(message.content);
        await this.manager.saveOrders(data);
      }
    }
    if(message.truncated===true){
      const data=await this.manager.orders(),record=data[j.taskId]?.automationJobs?.[j.id];
      if(record){record.truncated=true;await this.manager.saveOrders(data);}
    }
    return {status:"capturing_files",jobId:j.id,result:output};
    });
  }
  async fileEvent(message,sender){
    const jobs=await this.load(),j=jobs.find(x=>x.nonce===message.nonce);
    if(!j||j.status!=="capturing_files"||sender?.tab?.id!==j.tabId||
       !validHost(sender.tab.url,j.actualProvider)||
       Date.now()>j.expiresAt)throw new Error("File transfer not authorized for this saved job.");
    j.transfers=j.transfers||{};
    const source=HOSTS[j.actualProvider];
    if(message.command==="theorg.provider.file.start"){
      if(Object.keys(j.transfers).length>=2)throw new Error("Maximum two generated files per job.");
      const t=await this.manager.beginAutomaticFile(j.taskId,j.actualProvider,
        message.fileName,message.bytes,message.sha256,source,j.agentId,j.id);
      j.transfers[t.uploadId]={accessToken:t.accessToken};
      await this.save(jobs);
      return {transfer:t};
    }
    const t=j.transfers[message.uploadId];
    if(!t||t.accessToken!==message.accessToken)throw new Error("Unknown file transfer token.");
    if(message.command==="theorg.provider.file.chunk"){
      const result=await this.manager.artifactTransfer(j.taskId,"append_artifact_chunk",
        message.uploadId,message.accessToken,{index:message.index,dataBase64:message.dataBase64});
      return {result};
    }
    if(message.command==="theorg.provider.file.finish"){
      const result=await this.manager.completeAutomaticFile(j.taskId,
        message.uploadId,message.accessToken,j.agentId,j.id);
      delete j.transfers[message.uploadId];await this.save(jobs);
      return {result};
    }
    throw new Error("Unsupported file transfer operation.");
  }
}
globalThis.TheOrgProviderAutoHandoff=ProviderAutoHandoff;
if(typeof module!=="undefined"&&module.exports)
  module.exports={ProviderAutoHandoff,providerFor,validHost,LIMIT};
})();