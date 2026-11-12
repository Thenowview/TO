'use strict';
document.getElementById('reload').onclick=()=>chrome.runtime.reload();
document.getElementById('connect').onclick=async()=>{
  const out=document.getElementById('status');
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    const u=new URL(tab.url);
    if(!['127.0.0.1','localhost'].includes(u.hostname)||!['8765','18766','18768'].includes(u.port)||u.protocol!=='http:')throw Error('Open the local TheOrg page before connecting.');
    const [{result:token}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>sessionStorage.getItem('theorg.offline.token')||''});
    if(!/^[A-Za-z0-9_-]{20,100}$/.test(token))throw Error('TheOrg is not connected in this tab. Reopen it using its launcher.');
    const result=await chrome.runtime.sendMessage({type:'pair',base:u.origin,token});
    if(result.error)throw Error(result.error);out.textContent='Connected. Enable browser research fallback in TheOrg.';
  }catch(e){out.textContent=e.message;}
};
