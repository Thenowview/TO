/* TheOrg opt-in, isolated-world ChatGPT/Claude interaction.
 * Injected ONLY after a verified work-order grant on an exact allowlisted origin.
 * No site credentials, local storage, cookies, arbitrary scripts, or external URLs.
 * Provider DOM changes may break automation: fail closed, never claim completion.
 */
(() => {
  "use strict";
  if(globalThis.__THEORG_PROVIDER_PAGE_AGENT_V1__)return;
  globalThis.__THEORG_PROVIDER_PAGE_AGENT_V1__=true;
  let active=false;
  const CONFIG={
    chatgpt:{
      origin:"https://chatgpt.com",fresh:["/","/new"],
      editor:['#prompt-textarea[contenteditable="true"]','[data-testid="prompt-textarea"][contenteditable="true"]','textarea[data-testid="prompt-textarea"]'],
      send:['button[data-testid="send-button"]','button[aria-label="Send prompt"]','button[aria-label="Send message"]'],
      assistant:['[data-message-author-role="assistant"]','[data-testid="conversation-turn-assistant"]'],
      stop:['button[data-testid="stop-button"]','button[aria-label*="Stop generating"]']
    },
    claude:{
      origin:"https://claude.ai",fresh:["/","/new"],
      editor:['[data-testid="chat-input"] [contenteditable="true"]','[contenteditable="true"].ProseMirror','div[contenteditable="true"][data-placeholder]'],
      send:['button[data-testid="send-button"]','button[aria-label="Send message"]','button[aria-label="Send"]'],
      assistant:['[data-testid="assistant-message"]','div.font-claude-message'],
      stop:['button[aria-label*="Stop response"]','button[data-testid="stop-button"]']
    }
  };
  const sleep=n=>new Promise(resolve=>setTimeout(resolve,n));
  const visible=el=>!!el && el.isConnected && el.getClientRects().length>0;
  const findVisible=selectors=>{
    for(const css of selectors){
      try{const found=[...document.querySelectorAll(css)].find(visible);if(found)return found;}
      catch{}
    }
    return null;
  };
  const assistants=selectors=>{
    for(const css of selectors){
      try{
        const found=[...document.querySelectorAll(css)].filter(visible);
        if(found.length)return found;
      }catch{}
    }
    return [];
  };
  const editorText=el=>el?.value!==undefined?el.value:el?.innerText||el?.textContent||"";
  const normalize=str=>String(str||"").replace(/\u00a0/g," ").replace(/\r\n?/g,"\n").trim();
  const safeStatus=async(nonce,status,rest={})=>{
    try{return await chrome.runtime.sendMessage({command:"theorg.provider.event",nonce,status,...rest});}
    catch(e){return {ok:false,error:String(e?.message||e)};}
  };
  async function waitForEditor(config,limit=30000){
    const until=Date.now()+limit;
    while(Date.now()<until){
      const editor=findVisible(config.editor);
      if(editor)return editor;
      await sleep(400);
    }
    throw new Error("New-chat editor unavailable; sign in or open a supported new conversation.");
  }
  function insertPrompt(editor,prompt){
    if(normalize(editorText(editor)))
      throw new Error("The AI chat already contains a draft; nothing was overwritten.");
    editor.focus();
    if(editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement){
      const own=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(editor),"value");
      if(own?.set)own.set.call(editor,prompt);
      else editor.value=prompt;
      editor.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:prompt}));
    }else{
      const selection=getSelection(),range=document.createRange();
      range.selectNodeContents(editor);range.collapse(false);
      selection.removeAllRanges();selection.addRange(range);
      if(!document.execCommand("insertText",false,prompt))
        throw new Error("Provider editor rejected automatic text insertion.");
      editor.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:null}));
    }
    if(normalize(editorText(editor))!==normalize(prompt))
      throw new Error("Provider did not retain the exact prepared instruction; nothing submitted.");
  }
  async function waitForResponse(config,beforeCount){
    let latest="",stableSince=0,observedNew=false;
    const end=Date.now()+210000;
    while(Date.now()<end){
      const nodes=assistants(config.assistant);
      if(nodes.length>beforeCount)observedNew=true;
      const item=observedNew ? nodes.at(-1) : null;
      const value=normalize(item?.innerText||item?.textContent||"");
      const stop=!!findVisible(config.stop);
      if(value.length>=10 && value!==latest){latest=value;stableSince=Date.now();}
      if(value.length>=10 && !stop && stableSince && Date.now()-stableSince>=5500)
        return {content:value.slice(0,70000),truncated:value.length>70000,container:item};
      await sleep(1000);
    }
    throw new Error("No complete assistant response detected within 210 seconds. Review the provider tab manually.");
  }
  const FILE_RE=/^[\w][\w .()-]{0,110}\.(pdf|docx|xlsx|pptx|csv|txt|md|zip|png|jpg|jpeg|webp)$/i;
  const MAX_FILE=16*1024*1024;
  const encodeChunk=chunk=>{
    let binary="";
    for(let i=0;i<chunk.length;i+=8192)
      binary+=String.fromCharCode(...chunk.subarray(i,i+8192));
    return btoa(binary);
  };
  const shaHex=bytes=>crypto.subtle.digest("SHA-256",bytes).then(hash=>
    [...new Uint8Array(hash)].map(n=>n.toString(16).padStart(2,"0")).join(""));
  function downloadLinks(responseNode){
    const found=[],unique=new Set();
    if(!responseNode)return found;
    for(const a of responseNode.querySelectorAll("a[href]")){
      if(found.length>=2)break;
      let url;
      try{url=new URL(a.href,location.href);}catch{continue;}
      if(!((url.protocol==="https:"||url.protocol==="blob:") && url.origin===location.origin))
        continue;
      let name=(a.getAttribute("download")||"").trim();
      if(!name){
        try{name=decodeURIComponent(url.pathname.split("/").at(-1)||"");}catch{continue;}
      }
      if(!FILE_RE.test(name) || unique.has(url.href))continue;
      unique.add(url.href);found.push({url:url.href,fileName:name});
    }
    return found;
  }
  async function fetchBounded(url){
    const response=await fetch(url,{credentials:"include",redirect:"follow"});
    if(!response.ok || !response.body)throw new Error("The provider file could not be retrieved.");
    if(new URL(response.url).origin!==location.origin)
      throw new Error("Cross-origin AI file links require separate permission.");
    const size=Number(response.headers.get("content-length")||0);
    if(size>MAX_FILE)throw new Error("AI file exceeds 16 MB.");
    const reader=response.body.getReader(),parts=[];
    let count=0;
    try{
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        count+=value.length;
        if(count>MAX_FILE)throw new Error("AI file is over the capture limit.");
        parts.push(value);
      }
    }finally{reader.releaseLock();}
    if(count<1)throw new Error("AI file was empty.");
    const all=new Uint8Array(count);
    let at=0;for(const part of parts){all.set(part,at);at+=part.length;}
    return all;
  }
  async function captureFiles(nonce,responseNode){
    for(const item of downloadLinks(responseNode)){
      try{
        const bytes=await fetchBounded(item.url);
        const hash=await shaHex(bytes);
        const beginning=await chrome.runtime.sendMessage({
          command:"theorg.provider.file.start",nonce,fileName:item.fileName,
          bytes:bytes.length,sha256:hash});
        if(!beginning?.ok || !beginning.transfer)
          throw new Error(beginning?.error||"Native file capture could not be started");
        const {uploadId,accessToken}=beginning.transfer;
        for(let index=0,at=0;at<bytes.length;index++,at+=96*1024){
          const part=bytes.subarray(at,Math.min(at+96*1024,bytes.length));
          const next=await chrome.runtime.sendMessage({
            command:"theorg.provider.file.chunk",nonce,uploadId,accessToken,index,
            dataBase64:encodeChunk(part)});
          if(!next?.ok)throw new Error(next?.error||"File chunk rejected");
        }
        const completed=await chrome.runtime.sendMessage({
          command:"theorg.provider.file.finish",nonce,uploadId,accessToken});
        if(!completed?.ok || !completed.result?.path)
          throw new Error(completed?.error||"Native file verification not confirmed");
      }catch(e){
        await safeStatus(nonce,"file_warning",{
          error:"Cannot automatically import "+item.fileName+": "+String(e?.message||e).slice(0,160)
        });
      }
    }
  }
  async function execute(msg){
    if(active)throw new Error("A task is already running in this provider tab.");
    active=true;
    const config=CONFIG[msg.providerId];
    try{
      if(!config || location.origin!==config.origin ||
         !config.fresh.includes(location.pathname) ||
         typeof msg.prompt!=="string" || msg.prompt.length<10 || msg.prompt.length>15000)
        throw new Error("Unsupported provider page or invalid preapproved prompt.");
      if(document.querySelector("input[type=password]")?.getClientRects().length)
        throw new Error("Sign-in page detected. Complete sign-in manually, then open a new chat.");
      const editor=await waitForEditor(config);
      if(document.querySelectorAll('[data-message-author-role="user"],[data-testid="user-message"]').length)
        throw new Error("Existing conversation detected. Open a fresh chat.");
      const previous=assistants(config.assistant).length;
      insertPrompt(editor,msg.prompt);
      let send=null;
      for(let i=0;i<14;i++){
        send=findVisible(config.send);
        if(send && !send.disabled && send.getAttribute("aria-disabled")!=="true")break;
        await sleep(220);
      }
      if(!send || send.disabled || send.getAttribute("aria-disabled")==="true")
        throw new Error("Provider send control could not be verified. Review the page manually.");
      send.click();
      // A click is not proof of submission; require a changed composer or user turn.
      let actuallySent=false;
      for(let attempt=0;attempt<22;attempt++){
        if(!normalize(editorText(editor)) ||
           document.querySelectorAll('[data-message-author-role="user"],[data-testid="user-message"]').length)
          {actuallySent=true;break;}
        await sleep(200);
      }
      if(!actuallySent)throw new Error("The provider did not confirm that the prompt was submitted.");
      await safeStatus(msg.nonce,"submitted");
      const answer=await waitForResponse(config,previous);
      const saved=await safeStatus(msg.nonce,"captured",{
        content:answer.content,truncated:answer.truncated
      });
      if(saved?.ok!==true || saved.status!=="capturing_files")
        throw new Error("TheOrg could not verify and store the AI response: "+String(saved?.error||"unknown"));
      await captureFiles(msg.nonce,answer.container);
      const finished=await safeStatus(msg.nonce,"files_complete");
      if(finished?.ok!==true||finished.status!=="saved")
        throw new Error("TheOrg could not complete the AI job: "+String(finished?.error||"unknown"));
    }catch(error){
      await safeStatus(msg.nonce,"blocked",{error:String(error?.message||error).slice(0,230)});
    }finally{active=false;}
  }
  chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(!msg || msg.command!=="theorg.provider.begin")return false;
    if(active){sendResponse({accepted:false,reason:"already-running"});return false;}
    const config=CONFIG[msg.providerId];
    if(!config || location.origin!==config.origin ||
       !config.fresh.includes(location.pathname)){
      sendResponse({accepted:false,reason:"unsupported-new-chat"});return false;
    }
    sendResponse({accepted:true});
    void execute(msg);
    return false;
  });
})();
