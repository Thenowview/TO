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
    try{await chrome.runtime.sendMessage({command:"theorg.provider.event",nonce,status,...rest});}
    catch{} // The status is also visible in the local work-order record if the bridge responds.
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
        return value.slice(0,85000);
      await sleep(1000);
    }
    throw new Error("No complete assistant response detected within 210 seconds. Review the provider tab manually.");
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
      await safeStatus(msg.nonce,"submitted");
      const content=await waitForResponse(config,previous);
      await safeStatus(msg.nonce,"captured",{content});
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
