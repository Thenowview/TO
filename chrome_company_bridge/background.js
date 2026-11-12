'use strict';
let busy=false;
async function api(path,body){
  const {connection}=await chrome.storage.session.get('connection');if(!connection)throw Error('Not paired');
  const u=new URL(connection.base);if(!['127.0.0.1','localhost'].includes(u.hostname)||!['8765','18766','18768'].includes(u.port)||u.protocol!=='http:')throw Error('Invalid local engine');
  const response=await fetch(connection.base+'/api/browser-bridge/'+path,{method:'POST',redirect:'error',credentials:'omit',headers:{Authorization:'Bearer '+connection.token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Bridge request failed');return data;
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(message.type!=='pair'||sender.id!==chrome.runtime.id)return false;
  (async()=>{try{
    await chrome.storage.session.set({connection:{base:message.base,token:message.token}});
    await api('pair',{client_id:chrome.runtime.id,confirmed:true});
    await chrome.alarms.create('theorg-research',{periodInMinutes:0.5});reply({ok:true});poll();
  }catch(e){await chrome.storage.session.remove('connection');reply({error:e.message});}})();return true;
});
async function poll(){
  if(busy)return;busy=true;let request=null;
  try{
    const {active}=await chrome.storage.session.get('active');
    if(active){
      // A worker restart creates uncertainty about submission; never send twice.
      await api('finish',{client_id:chrome.runtime.id,id:active.id,lease:active.lease,answer:'',sources:[],error:'Bridge interrupted. Inspect the ChatGPT chat before explicitly retrying.'}).catch(()=>{});
      await chrome.storage.session.remove('active');return;
    }
    ({request}=await api('claim',{client_id:chrome.runtime.id}));if(!request)return;
    const tab=await chrome.tabs.create({url:'https://chatgpt.com/',active:true});
    await chrome.storage.session.set({active:{id:request.id,lease:request.lease,tabId:tab.id}});
    // Wait for this dedicated tab to load. No user tab or old conversation is reused.
    for(let i=0;i<40;i++){const t=await chrome.tabs.get(tab.id);if(t.status==='complete')break;await new Promise(r=>setTimeout(r,500));}
    const current=await chrome.tabs.get(tab.id);if(new URL(current.url).origin!=='https://chatgpt.com')throw Error('ChatGPT sign-in or navigation is required.');
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['chatgpt.js']});
    const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:(question,role)=>globalThis.TheOrgChatGPT.run(question,role),args:[request.question,request.role]});
    if(!result||result.error)throw Error(result?.error||'No browser answer returned');
    await api('finish',{client_id:chrome.runtime.id,id:request.id,lease:request.lease,answer:result.answer,sources:result.sources,error:''});
    // Keep the new chat tab available as evidence; never delete conversations.
  }catch(e){if(request)await api('finish',{client_id:chrome.runtime.id,id:request.id,lease:request.lease,answer:'',sources:[],error:String(e.message).slice(0,500)}).catch(()=>{});}
  finally{await chrome.storage.session.remove('active');busy=false;}
}
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='theorg-research')poll();});
setInterval(poll,4000);
