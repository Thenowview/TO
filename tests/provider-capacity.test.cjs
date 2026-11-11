const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const root=path.join(__dirname,'..','apps','chrome-extension');
function fixture(){
 const global={URL,console,crypto:webcrypto};global.globalThis=global;
 global.TheOrgJobIntake={prompt:s=>"Please produce a structured and reviewable plan for: "+s,
                        parse:()=>({kind:"unstructured"})};
 global.TheOrgPlanner={supervisorPrompt:s=>"Please produce a structured and reviewable plan for: "+s};
 vm.runInNewContext(fs.readFileSync(path.join(root,'provider-auto-handoff.js'),'utf8'),
   global,{filename:'provider-auto-handoff.js'});
 const storage={},session={},orders={},tabs=new Map();let managerQueue=Promise.resolve();
 const api={storage:{local:{get:async k=>({[k]:storage[k]}),set:async x=>Object.assign(storage,x)},
   session:{get:async k=>({[k]:session[k]}),set:async x=>Object.assign(session,x)}},
   scripting:{executeScript:async()=>{}},tabs:{
     get:async id=>tabs.get(id),sendMessage:async()=>({accepted:true})}};
 const manager={
  orders:async()=>structuredClone(orders),
  saveOrders:async x=>{Object.keys(orders).forEach(k=>delete orders[k]);Object.assign(orders,structuredClone(x))},
  serialize(fn){const p=managerQueue.then(fn,fn);managerQueue=p.catch(()=>{});return p},
  async saveAutomaticResult(taskId,providerId,content,source,agentId,jobId){
   const v=orders[taskId].automationJobs[jobId];assert.equal(v.agentId,agentId);
   v.preview=content.slice(0,30000);v.resultPath='C:\\test\\results\\'+jobId+'.md';
   return {resultPath:v.resultPath,contentApproved:false};
  },async executionQueue(){return {queue:[],planApproved:false}}
 };
 const auto=new global.TheOrgProviderAutoHandoff(api,manager,global.TheOrgPlanner);
 const addOrder=i=>{const id=i.toString(16).padStart(32,'0');orders[id]={
   taskId:id,companyId:'demo',instruction:'Research improvements and implementation plans for software product '+i+'.',
   phase:'plan_review_required',plan:{reviewed:false,tasks:[]}};return id};
 const addTab=async i=>{const tab={id:i,url:'https://chatgpt.com/',active:true};
   tabs.set(i,tab);await auto.noteTab(tab);return tab};
 return {auto,api,orders,tabs,addOrder,addTab};
}
const until=async fn=>{for(let i=0;i<80;i++){
 if(await fn())return;await new Promise(r=>setTimeout(r,4));
 }throw Error('completion timeout')};
test('Only four provider jobs run; fifth waits until answer and files finish',async()=>{
 const f=fixture(),ids=[];
 for(let i=1;i<=5;i++){const id=f.addOrder(i);ids.push(id);await f.auto.arm(id,'chatgpt',true)}
 for(let i=1;i<=5;i++){await f.addTab(i);await f.auto.maybeStart(f.tabs.get(i))}
 let q=await f.auto.list();
 assert.equal(q.active,4);assert.equal(q.queued,1);assert.equal(q.maxActive,4);assert.equal(q.availableSlots,0);
 const j=q.jobs.find(x=>x.taskId===ids[0]),first=(await f.auto.load()).find(x=>x.id===j.id);
 const sender={tab:{id:first.tabId,url:'https://chatgpt.com/c/test'}};
 await f.auto.event({nonce:first.nonce,status:'submitted'},sender);
 const result=await f.auto.event({nonce:first.nonce,status:'captured',
   content:'This is a review-only plan with evidence and next steps.'},sender);
 assert.equal(result.status,'capturing_files');
 q=await f.auto.list();assert.equal(q.active,4);
 await f.auto.event({nonce:first.nonce,status:'files_complete'},sender);
 await until(async()=>{const now=await f.auto.list();return now.active===4&&now.queued===0});
 q=await f.auto.list();assert.equal(q.active,4);assert.equal(q.queued,0);
});
test('Cannot cancel another work order request',async()=>{
 const f=fixture(),id1=f.addOrder(1),id2=f.addOrder(2);
 const one=await f.auto.arm(id1,'chatgpt',true);
 await assert.rejects(()=>f.auto.cancel(id2,one.id),/not pending/i);
 await f.auto.cancel(id1,one.id);
 assert.equal((await f.auto.status(id1)).jobs[0].status,'cancelled');
});
