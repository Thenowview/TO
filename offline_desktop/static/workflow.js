'use strict';
/* Company workflow. Retrieved text is data, never HTML or executable code. */
(() => {
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const root=el('details');root.className='office-workflow';root.append(el('summary','Company task groups · maximum 4 active tasks'));
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
    const messages=el('div');messages.className='office-group-chat';c.append(button('Open this task’s group chat',async()=>{
      const d=await api('answer-flow/messages?id='+encodeURIComponent(flow.task_id));messages.replaceChildren();
      messages.append(el('p','Private task group: Manager · assigned specialist · Research · Reviewer. Messages stay within this task.'));
      for(const m of d.messages){const bubble=el('article');bubble.className='office-group-message';bubble.append(el('strong',m.sender+' → '+m.recipient+' · '+m.kind),el('pre',m.body));messages.append(bubble);}
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
      status.textContent=(p.enabled?'Managed workflow on. ':'Managed workflow off. ')+(p.provider.connected?'Chrome bridge connected. ':p.provider.configured?'Chrome bridge paired; waiting for browser. ':'Chrome bridge needs installation and pairing. ')+ 'Maximum 4 active task groups. Browser research uses your signed-in ChatGPT account, without loading a local model. Evidence and a lesson are required to close.';
      if(!controls.childElementCount){
        controls.append(button('Prepare Chrome bridge',async()=>{const info=await api('browser-bridge/prepare-extension',{confirmed:true});status.textContent='Chrome extension folder: '+info.folder+'. '+info.instructions;window.alert('Extension files are ready at:\n'+info.folder+'\n\nOpen chrome://extensions, choose Load unpacked, then this folder. Return to TheOrg and click the extension’s Connect button.');}));
        for(const [key,label] of [['enabled','Managed workflow'],['online_fallback','Use signed-in ChatGPT in Chrome']]){
          const l=el('label',label),c=el('input');c.type='checkbox';c.checked=p[key];l.prepend(c);controls.append(l);
          c.onchange=async()=>{try{
            if(key==='online_fallback'&&c.checked&&!confirm('Let the paired Chrome extension submit current questions in fresh ChatGPT chats using your signed-in account? Local files, saved notes and TheOrg history stay local. Your ChatGPT account limits apply.')){c.checked=false;return;}
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
  const setup=el('details');setup.className='office-workflow';
  setup.append(el('summary','Company Setup'));
  const setupStatus=el('p');setupStatus.setAttribute('role','status');setup.append(setupStatus);
  const profile={};
  for(const [key,label] of [['name','Company name'],['mission','Mission'],['customers','Customers'],['constraints','Budget and constraints']]){
    profile[key]=field(setup,label);
  }
  const sections=[
    ['departments','Departments and reporting to the CEO',['name','responsibility','role','routing_keywords']],
    ['goals','Strategic goals',['outcome','owner','measure','target']],
    ['milestones','90-day plan',['period','deliverable','owner']]
  ];
  const lists={};
  function addRow(key,fields,values={}){
    const row=el('fieldset');
    for(const name of fields){
      const input=field(row,name==='owner'?'Owner department':name.replaceAll('_',' '));
      input.dataset.field=name;input.value=values[name]||'';input.maxLength=600;
    }
    const remove=el('button','Remove row');remove.type='button';remove.onclick=()=>row.remove();
    row.append(remove);lists[key].append(row);
  }
  for(const [key,label,fields] of sections){
    setup.append(el('h3',label));
    lists[key]=el('div');setup.append(lists[key]);
    const add=el('button','Add '+(key==='milestones'?'milestone':key.slice(0,-1)));
    add.type='button';add.onclick=()=>addRow(key,fields);setup.append(add);
  }
  const starter={
    departments:[
      {name:'Operations',responsibility:'Deliver work and coordinate handoffs',role:'operations',routing_keywords:'meeting, delivery, scheduling'},
      {name:'Research',responsibility:'Gather and document evidence',role:'research',routing_keywords:'research, sources, comparison'},
      {name:'Customer Service',responsibility:'Prepare customer responses',role:'writer',routing_keywords:'customer, response, support'},
      {name:'Finance',responsibility:'Track costs and financial goals',role:'finance',routing_keywords:'budget, invoice, cost'},
      {name:'Quality Assurance',responsibility:'Check deliverables against acceptance criteria',role:'qa',routing_keywords:'review, acceptance, quality'}
    ],
    goals:[{outcome:'Deliver the first repeatable company workflow',owner:'Operations',measure:'Verified completed tasks',target:''}],
    milestones:[
      {period:'Days 1–30',deliverable:'Define priorities, responsibilities and acceptance checks',owner:'Operations'},
      {period:'Days 31–60',deliverable:'Pilot the workflow and document evidence',owner:'Research'},
      {period:'Days 61–90',deliverable:'Review results and propose improvements',owner:'Quality Assurance'}
    ]
  };
  let revision=null;
  function fillPlan(plan){
    for(const [key,label,fields] of sections){
      lists[key].replaceChildren();
      for(const item of plan[key]||[])addRow(key,fields,item);
    }
  }
  async function loadPlan(){
    try{
      const data=await api('company/setup');revision=data.revision;
      if(data.plan){for(const key of Object.keys(profile))profile[key].value=data.plan[key];}
      fillPlan(data.plan||starter);
      setupStatus.textContent=revision?'Approved plan version '+revision:'Edit the starter plan before approving it.';
    }catch(e){setupStatus.textContent=e.message;}
  }
  const approve=el('button','Approve company plan');approve.type='button';
  approve.onclick=async()=>{
    if(revision===null)return;
    const plan=Object.fromEntries(Object.entries(profile).map(([key,input])=>[key,input.value]));
    for(const [key] of sections){
      plan[key]=Array.from(lists[key].children,row=>Object.fromEntries(
        Array.from(row.querySelectorAll('[data-field]'),input=>[input.dataset.field,input.value])));
    }
    approve.disabled=true;
    try{
      const data=await api('company/setup',{plan,revision,confirmed:true});
      revision=data.revision;setupStatus.textContent='Approved company plan version '+revision+'.';
    }catch(e){setupStatus.textContent=e.message;}
    finally{approve.disabled=false;}
  };
  setup.append(approve);
  setup.addEventListener('toggle',()=>{if(setup.open&&revision===null)loadPlan();});
  host.insertBefore(setup,root);
  const epmo=el('details');epmo.className='office-workflow';
  epmo.append(el('summary','EPMO projects'),el('p','Import a project response from your authorized EPMO workspace and link a local task.'));
  const snapshot=field(epmo,'EPMO project response JSON',true);snapshot.maxLength=100000;
  const result=el('p');result.setAttribute('role','status');
  const projectSelect=el('select'),taskSelect=el('select');
  for(const [label,input] of [['EPMO project',projectSelect],['TheOrg task',taskSelect]]){
    const wrapper=el('label',label);wrapper.append(input);epmo.append(wrapper);
  }
  const linked=el('ul');
  async function loadProjects(){
    const [data,taskData]=await Promise.all([api('company/epmo'),api('tasks')]);
    const tasks=taskData.tasks;
    const option=(id,label)=>{const item=el('option',label);item.value=id;return item;};
    projectSelect.replaceChildren(option('','Choose a project'),...data.projects.map(p=>option(p.id,p.code+' · '+p.name+' · '+p.progress+'%')));
    taskSelect.replaceChildren(option('','Choose a task'),...tasks.map(t=>option(t.id,t.prompt.slice(0,100))));
    linked.replaceChildren(...data.links.map(link=>{
      const project=data.projects.find(p=>p.id===link.project_id);
      const task=tasks.find(t=>t.id===link.task_id);
      return el('li',project.code+' · '+(task?.prompt.slice(0,100)||link.task_id)+' · '+link.status);
    }));
  }
  function epmoAction(label,action){
    const control=el('button',label);control.type='button';
    control.onclick=async()=>{
      control.disabled=true;
      try{result.textContent=await action();await loadProjects();}
      catch(error){result.textContent=error.message;}
      finally{control.disabled=false;}
    };
    return control;
  }
  epmo.append(epmoAction('Import projects',async()=>{
    const data=await api('company/epmo/import',{snapshot:JSON.parse(snapshot.value),confirmed:true});
    snapshot.value='';
    return 'Imported '+data.imported+' projects.'+(data.has_more_pages?' More pages are available in EPMO.':'');
  }),epmoAction('Link task to project',async()=>{
    if(!projectSelect.value||!taskSelect.value)throw Error('Choose a project and task.');
    await api('company/epmo/link',{project_id:projectSelect.value,task_id:taskSelect.value,confirmed:true});
    return 'Task linked.';
  }),result,linked);
  epmo.addEventListener('toggle',()=>{if(epmo.open)loadProjects().catch(error=>{result.textContent=error.message;});});
  host.insertBefore(epmo,root);
  root.addEventListener('toggle',()=>{if(root.open)refresh();});setInterval(()=>{if(root.open&&!root.contains(document.activeElement))refresh();},5000);
})();
