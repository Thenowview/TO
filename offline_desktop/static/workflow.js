'use strict';
/* Company workflow. Retrieved text is data, never HTML or executable code. */
(() => {
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const root=el('details');root.className='office-workflow';root.append(el('summary','Company workflow · employees, research, review and lessons'));
  const status=el('p'),controls=el('div'),list=el('div');status.setAttribute('role','status');root.append(status,controls,list);
  let busy=false,signature='';
  async function api(path,body){
    const token=sessionStorage.getItem('theorg.offline.token')||localStorage.getItem('theorg.offline.token')||'';
    const r=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed');return d;
  }
  function button(label,fn){const b=el('button',label);b.type='button';b.className='chat-action-button';b.onclick=async()=>{b.disabled=true;try{await fn();signature='';await refresh();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};return b;}
  function field(parent,label,multi=false){const l=el('label',label),input=el(multi?'textarea':'input');input.maxLength=multi?10000:2000;l.append(input);parent.append(l);return input;}
  function card(flow,job){
    const c=el('details');c.className='office-task';c.append(el('summary',(job?.prompt||flow.task_id).slice(0,90)+' · '+flow.stage.replaceAll('_',' ')),el('p',(flow.route||'local lookup')+'. '+flow.note));
    const messages=el('div');c.append(button('View employee handoffs',async()=>{
      const d=await api('answer-flow/messages?id='+encodeURIComponent(flow.task_id));messages.replaceChildren();
      for(const m of d.messages)messages.append(el('strong',m.sender+' → '+m.recipient+' · '+m.kind),el('pre',m.body));
    }),messages);
    if(job?.output)c.append(button('Save report to local workspace',async()=>{
      const name='deliverables/'+flow.task_id+'.md';
      await api('files/write',{name,content:job.output,confirmed:true});
      status.textContent='Saved local deliverable: '+name+'. Check its contents in Files before approving closure.';
    }));
    if(['awaiting_input','awaiting_review'].includes(flow.stage)){
      const h=el('details');h.append(el('summary','Research in ChatGPT or another source'),el('p','Manual handoff: research the question, then paste the answer and source. TheOrg has not read your browser chat.'));
      const q=el('textarea');q.readOnly=true;q.value=job?.prompt||'';q.setAttribute('aria-label','Research question');h.append(q);
      const a=el('a','Open ChatGPT');a.href='https://chatgpt.com/';a.target='_blank';a.rel='noopener noreferrer';h.append(a);
      const answer=field(h,'Research answer',true),source=field(h,'HTTPS source URL');
      h.append(button('Submit research for review',()=>api('answer-flow/research',{id:flow.task_id,answer:answer.value,source_url:source.value,confirmed:true})));c.append(h);
    }
    if(flow.stage==='awaiting_review'){
      c.append(el('p','Read the draft and employee handoffs. Generated text does not prove that an action or test succeeded.'));
      const evidence=field(c,'Verification evidence',true),lesson=field(c,'Lesson learned',true);
      c.append(button('Verify, save lesson and close',()=>api('answer-flow/close',{id:flow.task_id,evidence:evidence.value,lesson:lesson.value,confirmed:true})));
    }
    if(flow.source_url){const a=el('a','Research source');a.href=flow.source_url;a.target='_blank';a.rel='noopener noreferrer';c.append(a);}
    if(flow.lesson)c.append(el('p','Lesson learned: '+flow.lesson));
    if(flow.stage==='awaiting_input')c.append(button('Retry after configuration changes',()=>api('answer-flow/resume',{id:flow.task_id,confirmed:true})));
    if(!['completed','cancelled'].includes(flow.stage))c.append(button('Cancel workflow',()=>api('answer-flow/cancel',{id:flow.task_id,confirmed:true})));
    return c;
  }
  async function refresh(){
    if(busy)return;busy=true;
    try{
      const [d,j]=await Promise.all([api('answer-flow'),api('tasks')]);const p=d.policy;
      status.textContent=(p.enabled?'Managed workflow on. ':'Managed workflow off. ')+(p.provider.configured?'Online API configured. ':'No online API configured; use manual browser handoff. ')+ 'Employees share one model and work sequentially. Evidence and a lesson are required to close.';
      if(!controls.childElementCount){
        for(const [key,label] of [['enabled','Managed workflow'],['online_fallback','Online research fallback']]){
          const l=el('label',label),c=el('input');c.type='checkbox';c.checked=p[key];l.prepend(c);controls.append(l);
          c.onchange=async()=>{try{
            if(key==='online_fallback'&&c.checked&&!confirm('Send current questions to your configured provider? Files, saved notes and history stay local. Existing provider usage charges may apply.')){c.checked=false;return;}
            await api('answer-flow/settings',{options:{[key]:c.checked},confirmed:true});await refresh();
          }catch(e){c.checked=!c.checked;status.textContent=e.message;}};
        }
        controls.append(button('Refresh',async()=>{}));
        for(const [label,prompt,role] of [
          ['Research report','Research this question. Draft a report with sources and risks: ','research'],
          ['Meeting actions','Turn these meeting notes into decisions, owners, due dates and unanswered questions. Do not invent missing details: ','operations'],
          ['Customer response','Draft a customer response using these facts. Flag missing information. Do not send anything: ','writer']]){
          controls.append(button(label,async()=>{const input=document.getElementById('promptInput');input.value=prompt;document.getElementById('roleSelect').value=role;input.focus();}));
        }
      }
      const next=JSON.stringify(d.tasks);if(next!==signature){signature=next;list.replaceChildren(...d.tasks.map(f=>card(f,j.tasks.find(t=>t.id===f.task_id))));}
    }catch(e){status.textContent=e.message;}finally{busy=false;}
  }
  const host=document.querySelector('.chat-stage');if(!host)return;host.insertBefore(root,host.querySelector('.chat-filters'));
  root.addEventListener('toggle',()=>{if(root.open)refresh();});setInterval(()=>{if(root.open&&!root.contains(document.activeElement))refresh();},5000);
})();
