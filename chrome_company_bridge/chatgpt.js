'use strict';
globalThis.TheOrgChatGPT={
findComposer(){
  const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&!e.disabled&&e.getAttribute('aria-hidden')!=='true';};
  const old=document.querySelector('#prompt-textarea');if(old&&visible(old))return old;
  const host=document.querySelector('main')||document;
  const editors=Array.from(host.querySelectorAll('textarea,[contenteditable]:not([contenteditable="false"])')).filter(visible)
    .filter(e=>e.getAttribute('role')!=='searchbox'&&e.getAttribute('type')!=='search');
  const named=editors.filter(e=>/ask chatgpt|ask anything|message chatgpt/i.test([e.getAttribute('aria-label'),e.getAttribute('placeholder'),e.getAttribute('data-placeholder')].join(' ')));
  return named.length===1?named[0]:editors.length===1?editors[0]:null;
},
findReplies(){
  const explicit=Array.from(document.querySelectorAll('[data-message-author-role="assistant"],[data-turn="assistant"],[data-role="assistant"],[data-testid="assistant-message"]'));
  if(explicit.length)return explicit;
  return Array.from(document.querySelectorAll('article')).filter(a=>Array.from(a.querySelectorAll('h5,h6,[role="heading"]')).some(h=>/^chatgpt\s+(said|says)|^assistant\s*:/i.test(h.textContent.trim())));
},
async run(question,role){
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  if(location.origin!=='https://chatgpt.com')return {error:'Unexpected website; no input sent.'};
  let composer;
  for(let i=0;i<60;i++){composer=this.findComposer();if(composer)break;await pause(500);}
  if(!composer)return {error:'No unique visible ChatGPT message box was found. The page may still be loading, use a different layout, or need your attention. No question was submitted.'};
  if(document.querySelector('[data-message-author-role="user"], [data-message-author-role="assistant"]'))return {error:'The opened chat is not empty. No question was sent.'};
  if((composer.isContentEditable?composer.innerText:composer.value||'').trim())return {error:'The new chat contains an existing draft. No text was replaced or submitted.'};
  const text='TheOrg company task. Act as the '+role+' specialist. Answer the current request with sources where needed, state uncertainty, and include a short verification checklist. Do not claim to execute PC actions or tests.\n\n'+question;
  composer.focus();
  if(composer.isContentEditable){document.execCommand('insertText',false,text);composer.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));}
  else{const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;setter?.call(composer,text);composer.dispatchEvent(new Event('input',{bubbles:true}));}
  await pause(500);
  let send;
  for(let i=0;i<30;i++){
    send=document.querySelector('button[data-testid="send-button"],button[aria-label="Send prompt"],button[aria-label="Send message"]');
    if(!send)send=Array.from(document.querySelectorAll('button')).find(b=>/^(send|send message|send prompt|submit)$/i.test(b.getAttribute('aria-label')||b.getAttribute('title')||b.innerText.trim()));
    if(send&&!send.disabled)break;await pause(300);
  }
  if(!send||send.disabled)return {error:'Send control unavailable. Draft was entered but not submitted; inspect the tab.'};
  send.click(); // Exactly one submission. Unknown results never trigger an automatic resend.
  let previous='',stable=0;
  for(let i=0;i<180;i++){
    await pause(1000);
    const replies=this.findReplies();
    const node=replies[replies.length-1];
    const answer=node?.innerText?.trim()||'';
    const streaming=Boolean(document.querySelector('button[data-testid="stop-button"],button[aria-label="Stop streaming"],button[aria-label="Stop generating"]'));
    stable=answer&&answer===previous&&!streaming?stable+1:0;previous=answer;
    if(stable>=4){
      if(answer.length>10000)return {error:'Answer exceeded the task size limit. Inspect the chat; no truncated answer was accepted.'};
      const sources=[{url:location.href,title:'ChatGPT task conversation'}];
      for(const a of node.querySelectorAll('a[href^="https://"]')){
        const url=new URL(a.href);if(url.username||url.password||url.href.length>1000||sources.some(s=>s.url===url.href))continue;
        sources.push({url:url.href,title:(a.textContent||url.hostname).slice(0,200)});if(sources.length>=12)break;
      }
      return {answer,sources};
    }
  }
  return {error:'ChatGPT response detection timed out. Inspect the new chat before retrying. Assistant containers: '+this.findReplies().length+'; articles: '+document.querySelectorAll('article').length+'.'};
}};
