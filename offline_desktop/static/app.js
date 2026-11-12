/* TheOrg Offline Engine UI — original, no external scripts or services. */
'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const tokenKey = 'theorg.offline.token';
  let token = sessionStorage.getItem(tokenKey) || localStorage.getItem(tokenKey) || '';
  // The desktop launcher passes a local-only startup token in the URL fragment.
  // Fragments are not sent in HTTP requests. Clear it from the address bar
  // immediately and retain it for this browser session only.
  if(location.hash.startsWith('#theorg-token=')) {
    const startupToken = decodeURIComponent(location.hash.slice('#theorg-token='.length));
    history.replaceState(null, '', location.pathname + location.search);
    if(/^[A-Za-z0-9_-]{20,100}$/.test(startupToken)) {
      token = startupToken;
      sessionStorage.setItem(tokenKey, token);
      localStorage.removeItem(tokenKey);
    }
  }
  let activeView = 'supervisor';
  let companyAgentProfiles=[];
  let jobs = [], modelData = {}, engineStatus = {};
  let lastChatSignature = null;
  let chatSessions=[], activeSessionId=null, activeSessionTasks=[];
  let includeArchivedSessions=false, selectedChatTaskId=null;
  let inspectorTab='task', inspectorCodeRequest=0, chatSearchRequest=0;
  const labels = {overview:'Overview',supervisor:'Chat',operator:'Windows Operator',tasks:'Task queue',coding:'Code Studio',company:'Agent team',models:'Models',files:'Files',memory:'Memory',settings:'Settings'};

  /* Original, dependency-free line icon set. Icons are pure local SVG,
     never downloaded or constructed from model-provided markup. */
  const iconShapes = {
    'square-pen':[['rect',{x:3,y:3,width:15,height:18,rx:2}],['path',{d:'m12 7 5 5'}],['path',{d:'m15 4 4 4'}],['path',{d:'M18 2 22 6 13 15 9 16 10 12Z'}]],
    'messages-square':[['path',{d:'M21 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 3v-6a7.5 7.5 0 0 1 7.5-7.5'}],['path',{d:'M3 13a6 6 0 0 1-1-3.5A7.5 7.5 0 0 1 9.5 2h7A5.5 5.5 0 0 1 22 7.5V12'}]],
    'list-checks':[['path',{d:'m3 6 2 2 4-4 M12 6h9 M3 14l2 2 4-4 M12 14h9 M3 21h18'}]],
    'code-2':[['path',{d:'m8 17-5-5 5-5 M16 7l5 5-5 5 M14 4l-4 16'}]],
    'monitor-cog':[['rect',{x:2,y:3,width:20,height:15,rx:2}],['path',{d:'M8 22h8 M12 18v4 M14 8l1 1 1-1 1 1-1 1 1 1-1 1-1-1-1 1-1-1 1-1z'}]],
    'users':[['path',{d:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3.2a4 4 0 0 1 0 7.6 M22 21v-2a4 4 0 0 0-3-3.85'}],['circle',{cx:9,cy:7,r:4}]],
    'cpu':[['rect',{x:5,y:5,width:14,height:14,rx:2}],['rect',{x:9,y:9,width:6,height:6,rx:1}],['path',{d:'M9 1v4 M15 1v4 M9 19v4 M15 19v4 M1 9h4 M1 15h4 M19 9h4 M19 15h4'}]],
    'folder-open':[['path',{d:'M2 7V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v3 M3 21l3-10h17l-3 10H3Z'}]],
    'book-open':[['path',{d:'M12 7v14 M3 18.5a9 9 0 0 1 9 2.5 9 9 0 0 1 9-2.5V4a9 9 0 0 0-9 2.5A9 9 0 0 0 3 4v14.5Z'}]],
    'layout-dashboard':[['rect',{x:3,y:3,width:7,height:9,rx:1}],['rect',{x:14,y:3,width:7,height:5,rx:1}],['rect',{x:14,y:12,width:7,height:9,rx:1}],['rect',{x:3,y:16,width:7,height:5,rx:1}]],
    'settings-2':[['path',{d:'M4 7h16 M4 17h16'}],['circle',{cx:8,cy:7,r:2}],['circle',{cx:16,cy:17,r:2}]],
    'blocks':[['rect',{x:3,y:3,width:7,height:7,rx:2}],['rect',{x:14,y:3,width:7,height:7,rx:2}],['rect',{x:3,y:14,width:7,height:7,rx:2}],['path',{d:'M17.5 14v7 M14 17.5h7'}]],
    'panel-left':[['rect',{x:3,y:3,width:18,height:18,rx:2}],['path',{d:'M9 3v18'}]],
    'refresh-cw':[['path',{d:'M20 11a8 8 0 0 0-14-5L3 9 M3 4v5h5 M4 13a8 8 0 0 0 14 5l3-3 M21 20v-5h-5'}]],
    'sparkles':[['path',{d:'m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z M5 18l.5 1.5L7 20l-1.5.5L5 22l-.5-1.5L3 20l1.5-.5L5 18Z'}]],
    'history':[['path',{d:'M3 12a9 9 0 1 0 2.7-6.4L3 8 M3 3v5h5 M12 7v5l3 2'}]],
    'route':[['circle',{cx:6,cy:19,r:2}],['path',{d:'M9 19h7a5 5 0 0 0 0-10h-8A4 4 0 0 1 8 1h10'}],['circle',{cx:19,cy:3,r:2}]],
    'file-text':[['path',{d:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z M14 2v6h6 M8 13h8 M8 17h6'}]],
    'shield-check':[['path',{d:'m12 22 2.5-1c5-2 7-6 7-11V5l-9.5-3L2.5 5v5c0 5 2 9 7 11L12 22Z M8 12l2.5 2.5L16 9'}]],
    'arrow-up':[['path',{d:'M12 19V5 M5 12l7-7 7 7'}]],
    'lock-keyhole':[['rect',{x:4,y:10,width:16,height:12,rx:2}],['path',{d:'M8 10V7a4 4 0 0 1 8 0v3'}],['circle',{cx:12,cy:16,r:1}]]
  };
  function hydrateIcons(){
    const NS='http://www.w3.org/2000/svg';
    document.querySelectorAll('[data-icon]').forEach(node=>{
      const specs=iconShapes[node.dataset.icon];if(!specs)return;
      const svg=document.createElementNS(NS,'svg');
      for(const [key,value] of Object.entries({viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor','stroke-width':1.75,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,String(value));
      for(const [tag,attrs] of specs){
        const shape=document.createElementNS(NS,tag);
        for(const [k,v] of Object.entries(attrs))shape.setAttribute(k,String(v));
        svg.append(shape);
      }
      node.replaceChildren(svg);
    });
  }
  hydrateIcons();

  function text(node, value){ node.textContent = String(value ?? ''); return node; }
  function element(tag, className, value) {
    const e = document.createElement(tag);
    if(className)e.className=className;
    if(value !== undefined)text(e,value);
    return e;
  }
  function showToast(message,isError=false) {
    const toast=$('toast');toast.textContent=String(message);toast.className='toast show'+(isError?' error':'');
    clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),4600);
  }
  async function request(path, opts={}) {
    const r=await fetch('/api/'+path,{
      method:opts.method||'GET',cache:'no-store',
      headers:{'Authorization':'Bearer '+token,...(opts.body?{'Content-Type':'application/json'}:{})},
      body:opts.body?JSON.stringify(opts.body):undefined
    });
    let result;
    try{result=await r.json();}catch{throw new Error('Engine returned an invalid response ('+r.status+').');}
    if(r.status===401){lock();throw new Error('Invalid or expired access token.');}
    if(!r.ok)throw new Error(result.error||('Engine request failed ('+r.status+').'));
    return result;
  }
  function lock(){
    $('unlockOverlay').classList.remove('hidden');
    $('connectionStatus').classList.add('error');
    $('connectionStatus').lastChild.textContent=' Locked';
  }
  function unlock(){
    const entered=$('tokenInput').value.trim();
    if(!entered){$('unlockError').textContent='Please enter the local access token.';return;}
    token=entered;
    if($('rememberToken').checked)localStorage.setItem(tokenKey,token);
    else localStorage.removeItem(tokenKey);
    sessionStorage.setItem(tokenKey,token);
    request('status').then(()=>{
      $('unlockOverlay').classList.add('hidden');$('unlockError').textContent='';
      $('tokenInput').value='';refreshAll();
      loadChatSessions().catch(e=>showToast(e.message,true));
    }).catch(e=>{$('unlockError').textContent=e.message;});
  }
  function changeView(view){
    if(!labels[view])return;
    activeView=view;
    document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+view));
    document.querySelectorAll('.nav-button').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
    text($('breadcrumb'),view.toUpperCase());text($('pageTitle'),labels[view]);
    document.querySelector('.sidebar').classList.remove('open');
    if(view==='coding')loadCodeStudio().catch(e=>showToast(e.message,true));
    if(view==='company')loadCompany().catch(e=>showToast(e.message,true));
    if(view==='operator')loadOperator().catch(e=>showToast(e.message,true));
    if(view==='models'){
      loadModels().catch(e=>showToast(e.message,true));
      loadAdaptive().catch(e=>showToast(e.message,true));
      loadOperatingDesk().catch(e=>showToast(e.message,true));
      loadKnowledgeCandidates().catch(e=>showToast(e.message,true));
    }
    if(view==='tasks'||view==='supervisor')loadTasks().catch(e=>showToast(e.message,true));
    if(view==='files')loadFiles();if(view==='memory')loadMemories();if(view==='settings')loadAudit();
  }
  function appendEmpty(node,message){ node.replaceChildren(element('div','empty',message)); }
  function pill(tag){return element('span','status-tag '+tag,tag);}
  function fmtSize(bytes){
    if(!Number.isFinite(Number(bytes)))return 'Unknown size';
    let n=Number(bytes);if(n>=1e9)return (n/1e9).toFixed(2)+' GB';
    if(n>=1e6)return (n/1e6).toFixed(1)+' MB';
    return Math.max(0,Math.round(n/1024))+' KB';
  }
  function renderTasks(container, limit=100){
    container.replaceChildren();const recent=jobs.slice(0,limit);
    if(!recent.length){appendEmpty(container,'No tasks yet. Enter an instruction in the Supervisor.');return;}
    for(const job of recent){
      const card=element('article','task-card');
      const top=element('div','task-top');
      const title=element('strong','',job.role.toUpperCase()+' · '+job.id.slice(0,8));
      top.append(title,pill(job.status));card.append(top);
      card.append(element('div','tiny',job.created||''));
      card.append(element('p','',job.prompt));
      if(job.output)card.append(element('pre','',job.output));
      if(job.error)card.append(element('p','error-msg',job.error));
      if(job.status==='queued'){
        const btn=element('button','text-btn','Cancel queued task');
        btn.addEventListener('click',()=>request('tasks/cancel',{method:'POST',body:{id:job.id}}).then(loadTasks).catch(e=>showToast(e.message,true)));
        card.append(btn);
      }
      container.append(card);
    }
  }
  function readyRow(title,ready,detail){
    const row=element('div');row.append(element('span','',title));
    row.append(element('strong',ready?'ok-text':'warn-text',detail));return row;
  }
  async function loadStatus(){
    const data=await request('status');engineStatus=data;
    const online=Boolean(data.active_backend);
    const state=$('connectionStatus');state.classList.remove('error');
    state.replaceChildren(element('i'),document.createTextNode(' Local engine connected'));
    text($('metricModel'),online?'READY':'NOT LOADED');
    text($('metricModelDetail'),online?(data.active_model||data.active_backend):'Add local inference runtime');
    text($('metricTasks'),data.tasks?.completed||0);
    text($('metricFiles'),data.workspace_files||0);
    text($('metricMemory'),data.memory_count||0);
    const list=$('systemReadiness');list.replaceChildren();
    list.append(readyRow('Local service',true,'RUNNING'));
    list.append(readyRow('SQLite persistence',true,'CONNECTED'));
    list.append(readyRow('Offline language model',online,online?'READY':'NOT INSTALLED'));
    list.append(readyRow('GGUF model files',data.model_files>0,(data.model_files||0)+' available'));
    list.append(readyRow('llama-server binary',data.llama_binary, data.llama_binary?'FOUND':'OPTIONAL'));
  }
  function activeChatItems(){return activeSessionId?activeSessionTasks:jobs;}
  function currentChatSession(){return chatSessions.find(x=>x.id===activeSessionId);}
  function setSessionTitle(){
    const active=currentChatSession(), archived=!!active?.archived;
    text($('activeSessionTitle'),active?.title||'All local tasks');
    $('sessionRename').hidden=!active;
    $('sessionArchive').hidden=!active;
    text($('sessionArchive'),archived?'Restore':'Archive');
    const context=$('chatContextToggle');
    context.hidden=!active;
    context.disabled=archived;
    context.setAttribute('aria-pressed',String(!!active?.include_context));
    text(context,active?.include_context?'Context on':'Context off');
    context.title='Include up to three previous completed task excerpts in future prompts, in this session only. Off by default.';
    $('promptInput').disabled=archived;
    $('submitTask').disabled=archived;
    text($('chatComposerStatus'),archived?'Session archived · restore to send':
      (active?.include_context?'Recent completed task context enabled':'Independent local task · no conversation context'));
    text($('chatDisclaimer'),archived
      ?'This session is archived. Restore it to add tasks. Existing jobs continue independently.'
      :'Sessions organize independent local tasks. Previous messages are not automatically sent to the model. No AI replies are fabricated.');
  }
  function renderSessionList(){
    const list=$('sessionList');list.replaceChildren();
    const term=$('sessionSearch').value.trim().toLocaleLowerCase();
    const visible=chatSessions.filter(session=>
      (includeArchivedSessions||!session.archived) &&
      session.title.toLocaleLowerCase().includes(term));
    if(!visible.length){
      list.append(element('div','session-empty',term
        ?'No matching session titles.':'No saved sessions. Choose New task to begin.'));
      return;
    }
    for(const session of visible.slice(0,100)){
      const item=element('button','session-row'+(activeSessionId===session.id?' selected':''));
      item.type='button';item.dataset.sessionId=session.id;
      item.setAttribute('aria-current',activeSessionId===session.id?'page':'false');
      const icon=element('span','session-row-icon','◌');
      const info=element('span','session-row-copy');
      info.append(element('strong','',session.title.slice(0,100)));
      info.append(element('small','',(session.archived?'Archived · ':'')+
        String(session.task_count||0)+' tasks'));
      item.append(icon,info);
      item.addEventListener('click',()=>selectChatSession(session.id).catch(e=>showToast(e.message,true)));
      list.append(item);
    }
  }
  async function loadChatSessions(){
    const raw=await request('chat/sessions?archived=true');
    chatSessions=raw.sessions||[];
    if(activeSessionId && !chatSessions.some(s=>s.id===activeSessionId)){
      activeSessionId=null;activeSessionTasks=[];lastChatSignature=null;
    }
    renderSessionList();setSessionTitle();
  }
  async function selectChatSession(id){
    chatSearchRequest++;
    $('chatMessageSearch').value='';
    $('chatHistoryResults').hidden=true;
    $('chatHistoryMatches').replaceChildren();
    if(id && !chatSessions.some(s=>s.id===id)){
      throw new Error('Session was not found; refresh the local list.');
    }
    activeSessionId=id||null;
    lastChatSignature=null;
    selectedChatTaskId=null;
    closeChatDetails();
    changeView('supervisor');
    await loadTasks();
    renderSessionList();setSessionTitle();
    $('chatScroll').scrollTop=$('chatScroll').scrollHeight;
  }
  async function clipboardCopy(value,button){
    if(!navigator.clipboard?.writeText){
      showToast('Clipboard is unavailable in this browser.',true);return;
    }
    try{
      await navigator.clipboard.writeText(String(value));
      if(button)text(button,'Copied');
      showToast('Copied to clipboard.');
    }catch{showToast('Clipboard access was denied.',true);}
  }
  function closeChatDetails(){
    inspectorCodeRequest++;
    const panel=$('chatDetailsPanel');
    panel.hidden=true;
    $('chatDetailsToggle').setAttribute('aria-expanded','false');
  }
  function openChatDetails(job){
    selectedChatTaskId=job.id;
    if(inspectorTab==='code'){renderCodeInspector();return;}
    const panel=$('chatDetailsPanel'),target=$('chatDetailsContent');
    target.replaceChildren();
    const section=element('section','chat-evidence');
    const fields=[
      ['Task ID',job.id],
      ['Role',job.role||'Unknown'],
      ['Status',job.status||'Unknown'],
      ['Created',job.created||'Unknown'],
      ['Updated',job.updated||'Unknown'],
      ['Optional context',job.has_context?'Previous completed-task excerpts attached by user choice':'None'],
      ['Output evidence',job.output?'Returned by local worker':'None returned'],
      ['Error',job.error||'None reported']
    ];
    for(const [label,value] of fields){
      const row=element('div','chat-evidence-row');
      row.append(element('dt','',label),element('dd','',String(value)));
      section.append(row);
    }
    const note=element('p','chat-evidence-notice',
      'Task status and text come from the local SQLite task record. Completion does not prove real-world tool execution, verified sources or successful changes unless separate evidence is shown.');
    target.append(section);
    const timeline=element('ol','chat-execution-timeline');
    const queueItem=element('li','');
    queueItem.append(element('strong','','Queued locally'));
    queueItem.append(element('span','',job.created||'Creation time unavailable'));
    timeline.append(queueItem);
    if(job.status!=='queued'){
      const update=element('li','');
      update.append(element('strong','', 'Last recorded status: '+(job.status||'unknown')));
      update.append(element('span','',job.updated||'Time unavailable'));
      timeline.append(update);
    }
    if(job.output){
      const captured=element('li','');
      captured.append(element('strong','','Local response stored'));
      captured.append(element('span','','Text only; no independent external tool evidence implied'));
      timeline.append(captured);
    }
    target.append(element('h3','chat-evidence-subhead','Recorded activity'),timeline,note);
    if(job.output){
      target.append(element('h3','chat-evidence-subhead','Recorded response'));
      target.append(element('pre','chat-evidence-response',String(job.output).slice(0,12000)));
    }
    if(job.output){
      const summary=window.TheOrgChatRenderer?.codeSummary(job.output)||[];
      if(summary.length){
        target.append(element('h3','chat-evidence-subhead','Code blocks'));
        for(const block of summary){
          target.append(element('p','chat-evidence-item',
            block.language+' · '+block.lines+' lines · block '+block.index));
        }
      }
    }
    panel.hidden=false;
    $('chatDetailsToggle').setAttribute('aria-expanded','true');
    if(window.matchMedia('(max-width:1050px)').matches)panel.focus?.();
  }
  async function searchSavedTasks(){
    const serial=++chatSearchRequest;
    const value=$('chatMessageSearch').value.trim();
    if(value.length<2)return showToast('Enter at least two characters to search saved local tasks.',true);
    const panel=$('chatHistoryResults'),target=$('chatHistoryMatches');
    panel.hidden=false;
    panel.focus();
    target.replaceChildren(element('p','muted','Searching saved local tasks…'));
    const url='chat/search?q='+encodeURIComponent(value)+
       (activeSessionId?'&session_id='+encodeURIComponent(activeSessionId):'');
    try{
      const response=await request(url),data=response.search;
      if(serial!==chatSearchRequest)return;
      text($('chatSearchStatus'),data.matches.length+' saved matches found locally');
      target.replaceChildren();
      if(!data.matches?.length){
        target.append(element('p','muted','No saved tasks match. Try a more specific phrase.'));
        return;
      }
      const hint=element('p','muted','Up to '+data.limit+' local SQLite matches; no website or AI provider was contacted.');
      target.append(hint);
      for(const item of data.matches){
        const row=element('article','chat-history-match');
        row.append(element('strong','',item.prompt.slice(0,160)));
        row.append(element('div','chat-history-meta',
          (item.created||'Unknown date')+' · '+(item.role||'Agent')+' · '+(item.status||'Unknown')));
        if(item.output)row.append(element('p','chat-history-excerpt',item.output.slice(0,240)));
        const button=element('button','chat-action-button','Inspect saved task');
        button.type='button';button.addEventListener('click',async()=>{
          button.disabled=true;
          try{
            const detail=await request('chat/task?id='+encodeURIComponent(item.id));
            inspectorTab='task';
            $('chatInspectorTask').classList.add('selected');
            $('chatInspectorTask').setAttribute('aria-pressed','true');
            $('chatInspectorCode').classList.remove('selected');
            $('chatInspectorCode').setAttribute('aria-pressed','false');
            openChatDetails(detail.task);
            panel.hidden=true;
          }catch(e){showToast(e.message,true);}
          finally{button.disabled=false;}
        });
        row.append(button);target.append(row);
      }
    }catch(e){
      if(serial===chatSearchRequest)
        target.replaceChildren(element('p','chat-error-text','History search unavailable: '+e.message));
    }
  }
  async function renderCodeInspector(){
    const panel=$('chatDetailsPanel'),target=$('chatDetailsContent');
    panel.hidden=false;$('chatDetailsToggle').setAttribute('aria-expanded','true');
    const serial=++inspectorCodeRequest;
    target.replaceChildren(element('p','muted','Loading read-only Code Studio proposals…'));
    try{
      const data=await request('code/plans');
      if(serial!==inspectorCodeRequest||inspectorTab!=='code')return;
      target.replaceChildren();
      target.append(element('p','chat-evidence-notice',
        'These are separate local Code Studio proposals, NOT proven actions or changes made by this chat task. Applying or committing remains in Code Studio with its own approval gates.'));
      const plans=(data.plans||[]).slice(0,8);
      if(!plans.length){
        target.append(element('p','muted','No local Code Studio proposals recorded.'));
        return;
      }
      for(const plan of plans){
        const card=element('article','chat-inspector-plan');
        const heading=element('div','chat-inspector-plan-head');
        heading.append(element('strong','',plan.objective||'Untitled proposal'));
        heading.append(pill(plan.status||'unknown'));card.append(heading);
        card.append(element('p','muted','Review-only proposal '+String(plan.id).slice(0,12)));
        const inspect=element('button','btn secondary','View diff and evidence');
        inspect.type='button';
        inspect.addEventListener('click',async()=>{
          inspect.disabled=true;
          try{
            const result=await request('code/plan?id='+encodeURIComponent(plan.id));
            if(serial!==inspectorCodeRequest||inspectorTab!=='code')return;
            const record=result.plan||{};
            const body=element('div','chat-inspector-diff');
            body.append(element('div','chat-inspector-digest',
              'Status: '+record.status+' · Digest: '+String(record.digest||'Not provided')));
            for(const change of (record.changes||[]).slice(0,20)){
              body.append(element('h4','',change.path||'File change'));
              body.append(element('pre','chat-inspector-pre',
                String(change.diff||'No textual diff').slice(0,25000)));
            }
            body.append(element('h4','','Recorded validation'));
            body.append(element('pre','chat-inspector-pre',
              JSON.stringify(record.evidence||{note:'No verification evidence recorded'},null,2).slice(0,15000)));
            const go=element('button','btn secondary','Open Code Studio for review');
            go.type='button';go.addEventListener('click',()=>{
              chosenCodePlan=record;
              if(record.project_id)chosenCodeProject=record.project_id;
              changeView('coding');
            });
            body.append(go);card.append(body);
          }catch(e){showToast(e.message,true);}
          finally{inspect.disabled=false;}
        });
        card.append(inspect);target.append(card);
      }
    }catch(e){
      if(serial===inspectorCodeRequest)target.replaceChildren(
        element('p','chat-error-text','Cannot load Code Studio evidence: '+e.message));
    }
  }
  function renderChatMessages(){
    const feed=$('supervisorResults'),scroll=$('chatScroll'),welcome=$('chatWelcome');
    if(!feed||!scroll||!welcome)return;
    const allRecent=activeChatItems().slice(0,100).reverse();
    const term=$('chatMessageSearch').value.trim().toLocaleLowerCase();
    // Keep immediate filtering bounded. Search history searches all local records.
    const recent=term?allRecent.filter(job=>[job.prompt,String(job.output||'').slice(0,2400),
       job.error,job.role].some(value=>String(value||'').toLocaleLowerCase().includes(term))):allRecent;
    text($('chatSearchStatus'),term
      ?recent.length+' matching task'+(recent.length===1?'':'s')+' in recent history'
      :allRecent.length+' recent task'+(allRecent.length===1?'':'s'));
    const signature=String(activeSessionId||'all')+':'+term+':'+recent.map(job=>
      [job.id,job.status,job.updated||'',String(job.output||'').length,
       String(job.error||'').length].join('\x1f')).join('\x1e');
    if(signature===lastChatSignature)return;
    lastChatSignature=signature;
    const nearBottom=scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<150;
    feed.replaceChildren();welcome.hidden=allRecent.length>0||!!term;
    if(term&&!recent.length)feed.append(element('div','chat-search-empty',
      'No recent tasks match this search. Try another word or open All tasks.'));
    for(const job of recent){
      const user=element('article','chat-message chat-user');
      const userBody=element('div','chat-message-body');
      userBody.append(element('p','chat-prompt',job.prompt));
      userBody.append(element('div','chat-message-meta',
        (job.created||'Local task')+' · '+(job.role||'Agent')));
      user.append(userBody);feed.append(user);
      const reply=element('article','chat-message chat-assistant');
      const badge=element('div','chat-avatar','T');
      badge.setAttribute('aria-hidden','true');
      const body=element('div','chat-message-body');
      const label=element('div','chat-response-head');
      label.append(element('strong','', 'TheOrg · '+(job.role||'Agent')),pill(job.status));
      body.append(label);
      if(job.output){
        const content=element('div','chat-response-rich');
        if(window.TheOrgChatRenderer){
          try{content.append(window.TheOrgChatRenderer.render(job.output,clipboardCopy));}
          catch{content.append(element('pre','chat-response-text',job.output));}
        }else content.append(element('pre','chat-response-text',job.output));
        body.append(content);
      }else if(job.error)body.append(element('p','chat-error-text',job.error));
      else body.append(element('p','chat-pending-text',
        job.status==='queued'?'Waiting for a local model worker…':
        job.status==='running'?'Running locally; checking for results…':
        job.status==='cancelled'?'Task cancelled.':'No verified model response available.'));
      const actions=element('div','chat-message-actions');
      const details=element('button','chat-action-button','Details');
      details.type='button';details.setAttribute('aria-label','View task details and evidence');
      details.addEventListener('click',()=>openChatDetails(job));actions.append(details);
      const revise=element('button','chat-action-button','Revise');
      revise.type='button';revise.title='Copy this request into the composer to edit; no task runs automatically.';
      revise.addEventListener('click',()=>{
        $('promptInput').value=job.prompt; $('promptInput').focus();
        text($('chatComposerStatus'),'Editing a new task draft; original task remains unchanged.');
      });
      actions.append(revise);
      const branch=element('button','chat-action-button','Branch');
      branch.type='button';branch.title='Create a fresh independent session using this task as an editable draft.';
      branch.addEventListener('click',async()=>{
        branch.disabled=true;
        try{
          const title=('Branch: '+job.prompt.replace(/\s+/g,' ')).slice(0,100);
          const {session}=await request('chat/sessions',{method:'POST',body:{title}});
          await loadChatSessions();await selectChatSession(session.id);
          $('promptInput').value=job.prompt;$('promptInput').focus();
          showToast('New independent branch created; draft not yet submitted.');
        }catch(e){showToast(e.message,true);}
        finally{branch.disabled=false;}
      });actions.append(branch);
      if(job.status==='completed'&&job.output){
        const remember=element('button','chat-action-button','Suggest as knowledge');
        remember.type='button';remember.title='Create an unverified candidate; separate owner review required.';
        remember.addEventListener('click',async()=>{
          if(!confirm('Save this completed task output as an UNVERIFIED local knowledge candidate? Approval requires independent evidence.'))return;
          remember.disabled=true;
          try{await request('adaptive/solutions/from-task',{method:'POST',body:{task_id:job.id,confirmed:true}});
              showToast('Unverified knowledge candidate saved. Review it under Models.');}
          catch(e){showToast(e.message,true);remember.disabled=false;}
        });actions.append(remember);
      }
      if(job.output){
        const copy=element('button','chat-action-button','Copy response');
        copy.type='button';
        copy.addEventListener('click',()=>clipboardCopy(job.output,copy));actions.append(copy);
      }
      if(job.status==='interrupted'){
        const retry=element('button','chat-action-button','Retry interrupted');
        retry.type='button';
        retry.addEventListener('click',async()=>{
          if(!confirm('Retry this interrupted local task? This queues another local inference attempt; it does not authorize tools or external services.'))return;
          retry.disabled=true;
          try{
            await request('tasks/retry',{method:'POST',body:{id:job.id,confirmed:true}});
            await loadTasks();showToast('Interrupted task requeued locally.');
          }catch(e){showToast(e.message,true);retry.disabled=false;}
        });
        actions.append(retry);
      }
      if(job.status==='failed'){
        const models=element('button','chat-action-button','Check local models');
        models.type='button';models.addEventListener('click',()=>changeView('models'));
        actions.append(models);
      }
      if(job.status==='queued'){
        const cancel=element('button','chat-action-button','Cancel');
        cancel.type='button';
        cancel.addEventListener('click',()=>request('tasks/cancel',{
          method:'POST',body:{id:job.id}
        }).then(loadTasks).catch(e=>showToast(e.message,true)));
        actions.append(cancel);
      }
      body.append(actions);reply.append(badge,body);feed.append(reply);
    }
    if(nearBottom)scroll.scrollTop=scroll.scrollHeight;
    const selected=recent.find(j=>j.id===selectedChatTaskId);
    if(selected&&!$('chatDetailsPanel').hidden)openChatDetails(selected);
  }
  async function loadTasks(){
    const [all,session]=await Promise.all([
      request('tasks'),
      activeSessionId?request('chat/session/tasks?id='+encodeURIComponent(activeSessionId)):Promise.resolve(null)
    ]);
    jobs=all.tasks||[];
    activeSessionTasks=session?.tasks||[];
    renderTasks($('taskList'));renderChatMessages();
  }
  function runtimeCard(title,detail,ready){const c=element('div','runtime-card'),left=element('div');left.append(element('strong','',title),element('small','',detail));c.append(left,pill(ready?'completed':'failed'));return c;}
  async function loadAdaptive(){
    const data=await request('adaptive');
    const root=$('adaptiveEditionList');root.replaceChildren();
    const choice=data.adaptive.automatic||{}, mode=data.adaptive.choice_mode||'auto';
    const autoCard=element('article','adaptive-edition-card'+(mode==='auto'?' selected':''));
    autoCard.append(element('div','adaptive-edition-label','AUTO — recommended'));
    autoCard.append(element('h3','','Let TheOrg choose'));
    autoCard.append(element('p','',
      'Current choice: '+(choice.name||'TheOrg Adaptive 1')+
      (choice.model?' · '+choice.model:'')+'. '+(choice.reason||'Hardware check unavailable.')));
    autoCard.append(element('div','adaptive-edition-state',
      mode==='auto'?'Automatic selection enabled':'Manual edition selected'));
    autoCard.append(element('p','muted',
      'Rechecks available RAM and installed GGUF files. No model download, inference startup, training or remote connection happens automatically.'));
    const autoButton=element('button','btn secondary',mode==='auto'?'Auto enabled':'Enable automatic selection');
    autoButton.type='button';autoButton.disabled=mode==='auto';
    autoButton.addEventListener('click',async()=>{
      if(!confirm('Let TheOrg select the safest edition from current RAM and installed local models? No model starts automatically.'))return;
      autoButton.disabled=true;
      try{await request('adaptive/select',{method:'POST',body:{tier:'auto',confirmed:true}});
          await Promise.all([loadAdaptive(),loadModels()]);
          showToast('Automatic edition selection enabled. Inference still requires your approval.');
      }catch(e){showToast(e.message,true);autoButton.disabled=false;}
    });
    autoCard.append(autoButton);
    // Edition choice never starts inference. This separate action requires
    // permission and reruns the hardware + GGUF checks immediately before use.
    if(mode==='auto'){
      const launch=element('button','btn secondary','Start recommended local model');
      launch.type='button';
      launch.disabled=!choice.model || choice.tier==='nano';
      launch.title=launch.disabled?'No local model currently passes the auto preflight.':'Requires a separate explicit confirmation. No remote services used.';
      launch.addEventListener('click',async()=>{
        if(!confirm('Start the recommended LOCAL model '+choice.model+' now? TheOrg will recheck free RAM and GGUF metadata; this may consume substantial memory.'))return;
        launch.disabled=true;
        try{
          const result=await request('adaptive/start-recommended',{method:'POST',body:{confirmed:true}});
          showToast('Local model start requested: '+result.adaptive_start.model+'. Verify actual generation next.');
          await Promise.all([loadAdaptive(),loadModels(),loadStatus()]);
        }catch(e){showToast(e.message,true);launch.disabled=false;}
      });
      autoCard.append(launch);
    }
    root.append(autoCard);
    for(const tier of data.adaptive.options||[]){
      const card=element('article','adaptive-edition-card'+(tier.selected?' selected':''));
      card.append(element('div','adaptive-edition-label','Adaptive '+({nano:'1',lite:'2',advanced:'3'}[tier.id]||'')));
      card.append(element('h3','',tier.label));
      card.append(element('p','',tier.id==='nano'
        ?'Model-free operation, local tools and verified knowledge recall.'
        :tier.id==='lite'
          ?'For smaller PCs. Optional 0.8B/2B model weights, subject to memory checks.'
          :'For capable PCs. Optional 4B/9B models with hardware preflight.'));
      card.append(element('div','adaptive-edition-state',mode!=='auto'&&tier.selected?'Manually selected':mode==='auto'&&tier.selected?'Auto recommended':tier.eligible_by_ram?'RAM estimate passes':'RAM estimate insufficient'));
      card.append(element('div','muted',tier.note||''));
      const choose=element('button','btn secondary',mode!=='auto'&&tier.selected?'Selected':'Select edition');
      choose.type='button';choose.disabled=(mode!=='auto'&&tier.selected)||!tier.eligible_by_ram;
      choose.addEventListener('click',async()=>{
        if(!confirm('Choose '+tier.name+'? This changes the local edition policy but does not download or start a model.'))return;
        choose.disabled=true;
        try{
          await request('adaptive/select',{method:'POST',body:{tier:tier.id,confirmed:true}});
          await Promise.all([loadAdaptive(),loadModels()]);
          showToast('Adaptive '+tier.label+' selected. Inference remains unverified.');
        }catch(e){showToast(e.message,true);choose.disabled=false;}
      });
      card.append(choose);root.append(card);
    }
  }
  async function searchAdaptive(){
    const query=$('adaptiveQuery').value.trim();
    if(query.length<3)return showToast('Enter at least three characters.',true);
    const target=$('adaptiveResults');target.replaceChildren();
    try{
      const {resolution}=await request('adaptive/resolve',{method:'POST',body:{query}});
      if(resolution.solution){
        const p=element('div','task-card');
        p.append(element('strong','', 'Previously verified local solution'));
        p.append(element('p','',resolution.solution.answer));
        p.append(element('small','', 'Evidence: '+resolution.solution.evidence));
        target.append(p);
      }else target.append(element('p','muted',
        'No sufficiently close verified local solution. Suggested path: '+resolution.route+
        '. External agents and websites require separate approval.'));
    }catch(e){target.append(element('p','muted',e.message));}
  }
  async function loadOperatingDesk(){
    const target=$('operatingStatus');target.textContent='Reading local work counts…';
    try{
      const {desk}=await request('operating/overview');
      const parts=Object.entries(desk.workspaces||{}).map(([name,state])=>{
        const total=typeof state==='number'?state:Object.values(state).reduce((a,b)=>a+Number(b||0),0);
        return name.replaceAll('_',' ')+': '+total;
      });
      target.textContent='Adaptive '+desk.adaptive.selected+' ('+desk.adaptive.policy+') · '+parts.join(' · ')+
        '. Source counts only; model inference and agent execution not implied.';
    }catch(e){target.textContent='Local operating desk unavailable: '+e.message;}
  }
  async function routeOperatingInstruction(){
    const instruction=$('operatingInstruction').value.trim();
    const target=$('operatingRouteResult');
    if(instruction.length<3)return showToast('Enter at least three characters.',true);
    target.textContent='Checking reviewed knowledge and on-device policy…';
    try{
      const {route}=await request('operating/route',{method:'POST',body:{instruction,role:'supervisor'}});
      target.textContent='Adaptive '+route.tier+' · '+route.route+' · '+route.recommended_next_action+
        ' No task queued or tool executed.';
    }catch(e){target.textContent='Route unavailable: '+e.message;}
  }
  async function loadKnowledgeCandidates(){
    const target=$('knowledgeCandidates');target.replaceChildren(element('p','muted','Loading local candidates…'));
    try{
      const {solutions}=await request('adaptive/solutions');
      target.replaceChildren();
      const candidates=(solutions||[]).filter(x=>x.status==='candidate');
      if(!candidates.length){target.append(element('p','muted','No pending candidates. Completed task results may be suggested for review.'));return;}
      for(const item of candidates.slice(0,30)){
        const card=element('article','task-card');
        card.append(element('strong','',item.question),element('p','muted','Unverified · '+item.origin+' · '+item.updated));
        const accept=element('button','btn secondary','Review and approve');accept.type='button';
        accept.addEventListener('click',async()=>{
          const evidence=prompt('Enter your OWN verification evidence (at least 10 characters) for this specific solution. Imported evidence is NOT inherited:');
          if(evidence===null)return;
          if(evidence.trim().length<10)return showToast('Evidence must contain at least 10 characters.',true);
          if(!confirm('Confirm that you independently checked this solution? Approval makes it eligible for local recall; no model is trained.'))return;
          accept.disabled=true;
          try{
            await request('adaptive/solutions/review',{method:'POST',body:{id:item.id,approved:true,evidence,confirmed:true}});
            await loadKnowledgeCandidates();showToast('Solution reviewed and saved locally.');
          }catch(e){showToast(e.message,true);accept.disabled=false;}
        });
        const reject=element('button','btn secondary','Reject');reject.type='button';
        reject.addEventListener('click',async()=>{
          if(!confirm('Reject this candidate? Its history is preserved.'))return;
          reject.disabled=true;
          try{await request('adaptive/solutions/review',{method:'POST',body:{id:item.id,approved:false,evidence:'',confirmed:true}});
              await loadKnowledgeCandidates();}
          catch(e){showToast(e.message,true);reject.disabled=false;}
        });
        card.append(accept,reject);target.append(card);
      }
    }catch(e){target.replaceChildren(element('p','chat-error-text',e.message));}
  }
  async function exportReviewedKnowledge(){
    if(!confirm('Export up to 12 verified solutions to a LOCAL JSON file? Examine the text for private data before sharing. Tasks, stored notes and tokens are not separately exported.'))return;
    const target=$('knowledgeTransferStatus');target.textContent='Preparing owner-approved local knowledge export…';
    try{
      const {knowledge}=await request('adaptive/knowledge/export',{method:'POST',body:{confirmed:true,limit:12}});
      const file=new Blob([JSON.stringify({bundle:knowledge.bundle,sha256:knowledge.sha256},null,2)],{type:'application/json'});
      const href=URL.createObjectURL(file), a=document.createElement('a');
      a.href=href;a.download='TheOrg-reviewed-knowledge.json';document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(href),1200);
      target.textContent=knowledge.bundle.entries.length+' reviewed solutions exported locally; SHA-256 is not a signature.';
    }catch(e){target.textContent='Export failed: '+e.message;}
  }
  async function importReviewedKnowledge(){
    const target=$('knowledgeTransferStatus'),file=$('knowledgeImportFile').files?.[0];
    if(!file)return showToast('Choose an exported JSON file first.',true);
    if(file.size>125000)return showToast('Knowledge file exceeds the 125 KB safety limit.',true);
    try{
      const data=JSON.parse(await file.text());
      if(!data||typeof data!=='object'||!data.bundle||!data.sha256)throw new Error('Invalid knowledge file.');
      const {validation}=await request('adaptive/knowledge/validate',{method:'POST',body:data});
      target.textContent=validation.count+' entries validated. All will be unverified candidates.';
      if(!confirm('Import '+validation.count+' entries as UNVERIFIED local candidates? No old knowledge is deleted or automatically approved.'))return;
      const result=await request('adaptive/knowledge/import',{method:'POST',body:{...data,confirmed:true}});
      target.textContent=result.import.created_candidates+' candidates imported; '+result.import.duplicates_skipped+' duplicates skipped. Owner review required.';
      await loadKnowledgeCandidates();
    }catch(e){target.textContent='Import rejected: '+e.message;}
  }
  async function loadModels(){
    const data=await request('models');modelData=data;
    const hardware=data.hardware||{},gpu=hardware.gpu||{},suggestion=data.recommendation||{};
    const memorySize=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0
      ?fmtSize(n):'Unknown';
    text($('modelAvailableRAM'),memorySize(hardware.available_ram_bytes));
    text($('modelTotalRAM'),'Total RAM: '+memorySize(hardware.total_ram_bytes));
    text($('modelAvailableVRAM'),gpu.detected
      ?memorySize(gpu.available_vram_bytes):'Not detected');
    text($('modelGpuName'),gpu.detected
      ?(gpu.device_name||'NVIDIA GPU')+' · total '+memorySize(gpu.total_vram_bytes)
      :'VRAM unavailable — CPU sizing remains available');
    text($('modelRecommendation'),suggestion.recommendation||'Not available');
    text($('modelRecommendationSpec'),suggestion.suggested_model_class||'No automatic choice');
    text($('modelAdvisorNote'),
      (suggestion.reason||'No hardware advice available.')+
      (suggestion.recommended_installed_file
        ?' · Installed GGUF candidate: '+suggestion.recommended_installed_file+'.'
        :' · No locally installed file has an estimated RAM fit.')+
      ' This is not a runtime or quality certification. GPU offload is unverified.');
    const allowed=data.inference_probe?.benchmark_unlocked===true;
    $('modelBenchmark').disabled=!allowed;
    text($('modelBenchmarkLock'),allowed
      ?'Benchmark enabled: a real local generation probe succeeded recently for this selected model. Quality is still unverified.'
      :'Benchmark locked: first test real local generation on the selected model. Eligibility expires after five minutes or a model change.');
    const runtimes=$('runtimeList');runtimes.replaceChildren(
      runtimeCard('llama.cpp local server','127.0.0.1:8081 · '+(data.backends?.llamacpp?'Ready':'Not responding'),Boolean(data.backends?.llamacpp)),
      runtimeCard('Browser-only Chrome AI','Optional Prompt API · not an agent backend',Boolean(window.LanguageModel))
    );
    $('backendSelect').value=data.selected||'auto';$('ollamaModel').value=data.ollama_model||'';
    const models=$('modelList');models.replaceChildren();
    if(!(data.files||[]).length){appendEmpty(models,'No GGUF models found. Copy an official compatible .gguf into models/.');return;}
    for(const file of data.files){
      const card=element('div','model-card');
      card.append(element('strong','',file.name));card.append(element('small','',fmtSize(file.bytes)));
      const inspect=element('button','btn secondary','Inspect GGUF metadata');
      const detail=element('small','','Local model has not been verified for this device.');
      inspect.addEventListener('click',async()=>{
        try{
          const r=await request('models/preflight',{method:'POST',body:{name:file.name}});
          const p=r.preflight,m=p.metadata||{};
          text(detail,(m.metadata_recognized?('GGUF v'+m.gguf_version+' · '+(m.architecture||'unknown')+' · chat template '+(m.chat_template_present?'present':'not verified')):('Header unverified: '+(m.metadata_error||'not inspected')))+' · RAM '+(p.ram_check_passed?'estimate passed':'blocked: '+p.ram_block_reason)+' · real inference NOT VERIFIED');
        }catch(e){text(detail,'GGUF inspection failed: '+e.message)}
      });card.append(inspect,detail);
      const btn=element('button','btn secondary','Start offline inference');
      btn.disabled=!data.llama_binary;
      btn.title=data.llama_binary?'Start this local GGUF with llama.cpp':'Install llama-server to enable model loading';
      btn.addEventListener('click',()=>{
        if(!confirm('Start local inference for '+file.name+'? Memory requirements depend on model size.'))return;
        request('models/preflight',{method:'POST',body:{name:file.name}})
          .then(r=>{if(!r.preflight.ram_check_passed)throw new Error('Not enough available RAM for this model; use a smaller GGUF.');
            if(!r.preflight.runtime_available)throw new Error('Built-in llama.cpp runtime is missing; use the Windows EXE package.');
            return request('models/start',{method:'POST',body:{name:file.name,confirmed:true}})})
          .then(r=>showToast(r.note||'Model startup requested')).catch(e=>showToast(e.message,true));
      });
      card.append(btn);models.append(card);
    }
  }
  async function probeModelGeneration(){
    const output=$('modelProbeResult');
    text(output,'Sending a short test prompt to the running LOCAL model...');
    try {
      const data=await request('models/probe',{method:'POST',body:{confirmed:true}});
      const probe=data.probe;
      text(output,`Actual endpoint response (${probe.elapsed_seconds}s): ${probe.response_excerpt} — ${probe.verification}`);
      await loadModels();
    } catch(error) {
      $('modelBenchmark').disabled=true;
      text($('modelBenchmarkLock'),'Benchmark locked: the latest real inference probe failed.');
      text(output,'Probe failed: '+error.message);showToast(error.message,true);
    }
  }
  async function exportLocalBundle(){
    if(!chosenCodeProject){showToast('Choose a project first.',true);return;}
    if(!confirm('Export this local Git repository history to a portable bundle? No data will leave this device.'))return;
    try {
      const result=await request('code/projects/bundle',{method:'POST',body:{project_id:chosenCodeProject,confirmed:true}});
      text($('codeExportResult'),'Exported locally: '+result.bundle.local_path+' · SHA-256 '+result.bundle.sha256);
      showToast('Offline Git bundle created.');
    } catch(error) {showToast(error.message,true);}
  }

  async function probeChromeAI(){
    const out=$('chromeAIStatus');
    if(!('LanguageModel' in window) || typeof window.LanguageModel.availability !== 'function'){
      text(out,'This browser/device does not expose the Chrome on-device Prompt API. TheOrg still works without it.');
      $('chromeAIRun').disabled=true;return;
    }
    try{
      const available=await window.LanguageModel.availability();
      text(out,'Chrome on-device model: '+available+'. First-time model download may be required.');
      $('chromeAIRun').disabled=available==='unavailable';
    }catch(e){text(out,'Chrome AI status error: '+e.message);$('chromeAIRun').disabled=true;}
  }
  async function runChromeAI(){
    const prompt=$('chromeAIPrompt').value.trim();
    if(!prompt){showToast('Enter a prompt first.',true);return;}
    if(!window.LanguageModel){showToast('Chrome Prompt API unavailable.',true);return;}
    $('chromeAIRun').disabled=true;text($('chromeAIOutput'),'Initializing on-device model...');
    try{
      // Called directly from an explicit click; Chrome may require user activation.
      const session=await window.LanguageModel.create();
      try{
        const result=await session.prompt(prompt);
        text($('chromeAIOutput'),result);
      }finally{if(typeof session.destroy==='function')session.destroy();}
    }catch(e){text($('chromeAIOutput'),'Chrome AI unavailable: '+e.message);}
    finally{$('chromeAIRun').disabled=false;}
  }
  async function importModel(){
    const file=$('modelUpload').files?.[0];
    if(!file){showToast('Select a local .gguf or .zip file first.',true);return;}
    const isZip=/\.zip$/i.test(file.name);
    if(!(/\.gguf$/i.test(file.name)||isZip)){showToast('Only GGUF and ZIP model files are supported.',true);return;}
    if(!confirm('Copy '+file.name+' ('+fmtSize(file.size)+') into TheOrg portable model storage? This duplicates the file on disk.'))return;
    const btn=$('importModel');btn.disabled=true;text($('modelImportStatus'),'Importing '+file.name+' — keep this tab open...');
    try{
      const r=await fetch(isZip?'/api/models/import-zip':'/api/models/import',{method:'POST',headers:{
        Authorization:'Bearer '+token,'Content-Type':'application/octet-stream',
        'X-TheOrg-Confirm':'import','X-TheOrg-Model-Name':encodeURIComponent(file.name)},body:file});
      const answer=await r.json();
      if(!r.ok)throw new Error(answer.error||'Model import failed');
      text($('modelImportStatus'),'Model imported: '+answer.name+' ('+fmtSize(answer.bytes)+')');
      await loadModels();
    }catch(e){text($('modelImportStatus'),'Import failed: '+e.message);showToast(e.message,true);}
    finally{btn.disabled=false;}
  }
  async function loadFiles(){
    const data=await request('files'),files=$('fileList');files.replaceChildren();
    if(!(data.files||[]).length){appendEmpty(files,'No files yet. Use the editor to save a first local note.');return;}
    for(const file of data.files){
      const btn=element('button');btn.append(element('span','',file.name),element('small','',fmtSize(file.size)));
      btn.addEventListener('click',()=>{$('fileName').value=file.name;readFile();});files.append(btn);
    }
  }
  async function readFile(){
    try{const x=await request('files/read',{method:'POST',body:{name:$('fileName').value}});
      $('fileContent').value=x.content;showToast('File loaded locally');}
    catch(e){showToast(e.message,true)}
  }
  async function writeFile(){
    const name=$('fileName').value;
    if(!name){showToast('Enter a workspace-relative file path.',true);return;}
    if(!confirm('Save '+name+' inside the restricted TheOrg workspace? This may overwrite an existing file.'))return;
    try{await request('files/write',{method:'POST',body:{name,content:$('fileContent').value,confirmed:true}});
      showToast('Saved '+name);await loadFiles();await loadStatus();}
    catch(e){showToast(e.message,true)}
  }
  async function loadMemories(){
    const data=await request('memories'),list=$('memoryList');list.replaceChildren();
    if(!(data.memories||[]).length){appendEmpty(list,'No saved notes. Add a reference to keep it in local SQLite.');return;}
    for(const m of data.memories){
      const c=element('div','memory-item');c.append(element('strong','',m.title),element('p','',m.content));
      const btn=element('button','','Delete memory');
      btn.addEventListener('click',()=>{
        if(!confirm('Permanently delete this local memory?'))return;
        request('memories/delete',{method:'POST',body:{id:m.id}}).then(()=>{loadMemories();loadStatus()}).catch(e=>showToast(e.message,true));
      });c.append(btn);list.append(c);
    }
  }
  async function loadAudit(){
    const d=await request('audit'),list=$('auditEvents');list.replaceChildren();
    if(!(d.events||[]).length){appendEmpty(list,'No audit events yet.');return;}
    for(const x of d.events){const e=element('div','audit-event');e.append(element('strong','',x.event+' · '),document.createTextNode(x.created));list.append(e);}
  }
  /* Windows Operator — the preview never triggers commands. Each action gets
     a fresh, short-lived digest approval; all source/provider data is text. */
  let operatorCatalog=[];
  async function loadOperator(){
    const [available,history,integrations]=await Promise.all([
      request('capabilities'),request('capabilities/history'),request('integrations')
    ]);
    operatorCatalog=available.capabilities||[];
    const catalog=$('operatorCatalog');catalog.replaceChildren();
    for(const tool of operatorCatalog){
      const card=element('div','task-card');
      card.append(element('strong','',tool.id+' · '+(tool.enabled?'Enabled':'Disabled')));
      card.append(element('div','muted',tool.description||'No description'));
      catalog.append(card);
    }
    const providers=$('operatorIntegrations');providers.replaceChildren();
    for(const item of integrations.integrations||[]){
      const card=element('div','task-card');
      card.append(element('strong','',item.provider+' · '+item.status));
      card.append(element('div','muted','Required scope: '+item.scope));
      card.append(element('div','muted','No account connected status is inferred from this catalog.'));
      providers.append(card);
    }
    const recent=$('operatorHistory');recent.replaceChildren();
    const records=(history.requests||[]).slice(0,20);
    if(!records.length)appendEmpty(recent,'No operator tool execution yet.');
    for(const item of records){
      const card=element('div','task-card');
      card.append(element('strong','',item.capability+' · '+item.status));
      card.append(element('div','muted','Request '+String(item.id).slice(0,10)+' · '+String(item.updated)));
      recent.append(card);
    }
  }
  async function runOperatorAction(tool,args,effect){
    const prepared=await request('capabilities/prepare',{
      method:'POST',body:{capability:tool,arguments:args}
    });
    const p=prepared.request;
    const label='Execute exactly '+tool+'?'+
      '\nEffect: '+effect+
      '\nRequest: '+p.id+
      '\nDigest: '+p.digest+
      '\nExpiry: '+new Date(p.expires_at*1000).toLocaleString()+
      '\nOnly this exact action is approved. No unattended follow-up actions.';
    if(!confirm(label)){
      showToast('Approval declined; the prepared request will expire.');
      return;
    }
    const outcome=await request('capabilities/execute',{
      method:'POST',body:{id:p.id,digest:p.digest,confirmed:true}
    });
    text($('operatorPlanStatus'),JSON.stringify(outcome,null,2));
    await loadOperator();
    const sourceFailed=tool==='windows.source.verify' && outcome.result?.source_tests_passed!==true;
    const ciNotVerified=tool==='github.workflow.result' && outcome.result?.source_tests_verified!==true;
    if(outcome.status==='completed' && !sourceFailed && !ciNotVerified)
      showToast('Tool completed; inspect returned evidence.');
    else showToast('Source/CI not verified or action requires review: '+outcome.status,true);
    return outcome;
  }
  async function inspectWindows(){
    const source=operatorCatalog.find(t=>t.id==='windows.window.list');
    const target=$('operatorWindowList');target.replaceChildren();
    if(!source?.enabled){
      text($('operatorWindowsStatus'),'Window inventory is disabled. Enable its local operator flag first.');
      return;
    }
    const result=await runOperatorAction('windows.window.list',{},'local_window_metadata_read');
    if(!result||result.status!=='completed'||!result.result?.windows){
      text($('operatorWindowsStatus'),'Window inventory not verified; inspect the audit history.');
      return;
    }
    const windows=result.result.windows;
    text($('operatorWindowsStatus'),windows.length+' visible windows returned. Titles are private local metadata.');
    if(!windows.length)appendEmpty(target,'No visible windows found.');
    for(const item of windows){
      const card=element('div','task-card');
      card.append(element('strong','',item.title||'Unnamed window'));
      card.append(element('div','muted','PID '+item.pid+' · window '+item.hwnd));
      const button=element('button','btn secondary','Request focus on this window');
      const allowed=operatorCatalog.find(t=>t.id==='windows.window.focus');
      button.disabled=!allowed?.enabled;
      button.addEventListener('click',async()=>{
        button.disabled=true;
        try{
          const outcome=await runOperatorAction('windows.window.focus',{
            hwnd:item.hwnd,pid:item.pid,title_sha256:item.title_sha256
          },'local_window_focus_only');
          text($('operatorWindowsStatus'),outcome?.result?.focus_confirmed
            ?'Foreground focus verified. No input was sent.'
            :'Focus not verified or approval declined. Inspect execution history.');
        }catch(e){text($('operatorWindowsStatus'),e.message);showToast(e.message,true);}
        finally{button.disabled=false;}
      });
      card.append(button);target.append(card);
    }
  }
  async function previewOperator(){
    const instruction=$('operatorInstruction').value.trim();
    if(instruction.length<5){showToast('Enter at least 5 characters.',true);return;}
    const btn=$('operatorPreview');btn.disabled=true;
    try{
      const r=await request('operator/plan',{method:'POST',body:{instruction}});
      text($('operatorPlanStatus'),r.plan.warning);
      await loadOperator();
      const target=$('operatorPlan');target.replaceChildren();
      for(const step of r.plan.tasks||[]){
        const card=element('div','task-card');
        const tool=step.tool;
        card.append(element('strong','',tool||'Manual scoping required'));
        card.append(element('div','muted','Effect: '+step.effect));
        if(!tool){card.append(element('div','muted','No executable tool matched this instruction.'));target.append(card);continue;}
        const entry=operatorCatalog.find(x=>x.id===tool);
        if(!entry||!entry.enabled){
          card.append(element('div','muted','Disabled. An operator must enable this tool in the local environment.'));
          target.append(card);continue;
        }
        const args={...step.arguments};
        const needsSha=args.expected_sha==='<reviewed-commit-sha>';
        let shaInput;
        if(needsSha){
          shaInput=element('input');
          shaInput.placeholder='Exact reviewed 40-character commit SHA';
          shaInput.maxLength=40;
          shaInput.setAttribute('aria-label','Exact reviewed commit SHA for '+tool);
          card.append(shaInput);
        }
        const action=element('button','btn secondary','Prepare and approve this one action');
        action.addEventListener('click',async()=>{
          if(needsSha)args.expected_sha=shaInput.value.trim();
          action.disabled=true;
          try{await runOperatorAction(tool,args,step.effect);}
          catch(e){text($('operatorPlanStatus'),e.message);showToast(e.message,true);}
          finally{action.disabled=false;}
        });
        card.append(action);target.append(card);
      }
    }catch(e){text($('operatorPlanStatus'),e.message);showToast(e.message,true);}
    finally{btn.disabled=false;}
  }
  async function refreshAll(){
    try{await Promise.all([loadStatus(),loadTasks()]);if(activeView==='models')await loadModels();}
    catch(e){showToast(e.message,true);}
  }
  document.querySelectorAll('[data-view],[data-go]').forEach(btn=>btn.addEventListener('click',()=>changeView(btn.dataset.view||btn.dataset.go)));
  $('menuToggle').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));
  $('refreshBtn').addEventListener('click',refreshAll);
  $('operatorPreview').addEventListener('click',previewOperator);
  $('operatorRefresh').addEventListener('click',()=>loadOperator().catch(e=>showToast(e.message,true)));
  $('operatorWindows').addEventListener('click',()=>inspectWindows().catch(e=>showToast(e.message,true)));
  $('operatorVerifyRun').addEventListener('click',async()=>{
    const runId=Number($('operatorRunId').value);
    const sha=$('operatorRunSha').value.trim();
    if(!Number.isSafeInteger(runId)||runId<1||!/^[0-9a-f]{40}$/.test(sha)){
      return showToast('Enter a positive run ID and the exact 40-character lowercase commit SHA.',true);
    }
    const button=$('operatorVerifyRun');button.disabled=true;
    try{
      const outcome=await runOperatorAction('github.workflow.result',{
        run_id:runId,expected_sha:sha
      },'authenticated_remote_read');
      if(outcome)text($('operatorRunStatus'),outcome.result?.source_tests_verified===true
        ?'GitHub confirmed source tests passed on the exact reviewed commit.'
        :'Source tests were not verified. Review the result and GitHub job steps.');
    }catch(e){text($('operatorRunStatus'),e.message);showToast(e.message,true);}
    finally{button.disabled=false;}
  });
  $('refreshTasks').addEventListener('click',loadTasks);
  $('refreshFiles').addEventListener('click',loadFiles);
  $('readFile').addEventListener('click',readFile);
  $('writeFile').addEventListener('click',writeFile);
  $('unlockBtn').addEventListener('click',unlock);
  $('tokenInput').addEventListener('keydown',e=>{if(e.key==='Enter')unlock()});
  $('changeToken').addEventListener('click',()=>{localStorage.removeItem(tokenKey);sessionStorage.removeItem(tokenKey);token='';lock();});
  $('chatComposer').addEventListener('submit',async e=>{
    e.preventDefault();
    const prompt=$('promptInput').value.trim();
    if(!prompt)return showToast('Enter an instruction for the local specialist.',true);
    if(currentChatSession()?.archived)return showToast('Restore this session before adding tasks.',true);
    const btn=$('submitTask');btn.disabled=true;
    $('chatComposer').setAttribute('aria-busy','true');
    text($('chatComposerStatus'),'Saving a new local task…');
    let created=null;
    try{
      if(!activeSessionId){
        const opened=await request('chat/sessions',{method:'POST',body:{title:'New session'}});
        activeSessionId=opened.session.id;created=opened.session.id;
      }
      const r=await request('tasks',{method:'POST',body:{
        prompt,role:$('roleSelect').value,session_id:activeSessionId
      }});
      $('promptInput').value='';resizeChatComposer();
      showToast('Task queued locally · '+r.id.slice(0,8));
      text($('chatComposerStatus'),'Task queued · '+r.id.slice(0,8)+' · awaiting real local worker');
      const existing=currentChatSession();
      if(created||(existing&&existing.title==='New session'&&Number(existing.task_count)===0)){
        const title=prompt.replace(/\s+/g,' ').slice(0,70)||'New session';
        try{await request('chat/sessions/rename',{method:'POST',
          body:{id:activeSessionId,title}});}
        catch{showToast('Task saved; session title can be renamed later.',true);}
      }
      await Promise.all([loadChatSessions(),loadTasks()]);
      $('chatScroll').scrollTop=$('chatScroll').scrollHeight;
    }catch(error){
      text($('chatComposerStatus'),'Could not save task: '+error.message);
      showToast(error.message,true);await loadChatSessions().catch(()=>{});
    }finally{
      $('chatComposer').removeAttribute('aria-busy');
      btn.disabled=!!currentChatSession()?.archived;$('promptInput').focus();
    }
  });
  function resizeChatComposer(){
    const input=$('promptInput');
    input.style.height='auto';
    input.style.height=Math.min(200,Math.max(52,input.scrollHeight))+'px';
  }
  $('promptInput').addEventListener('input',resizeChatComposer);
  $('promptInput').addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){
      e.preventDefault();
      if(typeof $('chatComposer').requestSubmit==='function')$('chatComposer').requestSubmit();
      else $('submitTask').click();
    }
  });
  $('newChatButton').addEventListener('click',async()=>{
    const button=$('newChatButton');button.disabled=true;
    try{
      const res=await request('chat/sessions',{method:'POST',body:{title:'New session'}});
      await loadChatSessions();
      await selectChatSession(res.session.id);
      $('promptInput').value='';$('promptInput').focus();
    }catch(e){showToast(e.message,true);}
    finally{button.disabled=false;}
  });
  $('chatMessageSearch').addEventListener('input',renderChatMessages);
  $('chatSearchAll').addEventListener('click',searchSavedTasks);
  $('chatCloseSearch').addEventListener('click',()=>{
    chatSearchRequest++;
    $('chatHistoryResults').hidden=true;$('chatHistoryMatches').replaceChildren();
    $('chatMessageSearch').focus();
  });
  $('chatMessageSearch').addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();searchSavedTasks();}
    if(event.key==='Escape'){
      chatSearchRequest++;
      $('chatHistoryResults').hidden=true;
      $('chatMessageSearch').value='';renderChatMessages();
    }
  });
  $('chatContextToggle').addEventListener('click',async()=>{
    const session=currentChatSession();
    if(!session||session.archived)return;
    const enabled=!Boolean(session.include_context);
    if(enabled&&!confirm('Allow the next local model task in this session to receive excerpts from up to three PREVIOUS completed tasks? Stored prompts and answers may contain private information. Off by default; no external website or tool is authorized.'))return;
    const button=$('chatContextToggle');button.disabled=true;
    try{
      await request('chat/sessions/context',{method:'POST',body:{id:session.id,enabled,confirmed:true}});
      await loadChatSessions();
      showToast(enabled?'Recent session context enabled.':'Session context disabled for new tasks.');
    }catch(e){showToast(e.message,true);}
    finally{button.disabled=false;}
  });
  function activateInspector(tab){
    inspectorTab=tab==='code'?'code':'task';
    for(const [id,value] of [['chatInspectorTask','task'],['chatInspectorCode','code']]){
      $(id).classList.toggle('selected',inspectorTab===value);
      $(id).setAttribute('aria-pressed',String(inspectorTab===value));
    }
    if(inspectorTab==='code')renderCodeInspector();
    else{
      inspectorCodeRequest++;
      const target=activeChatItems().find(x=>x.id===selectedChatTaskId)||activeChatItems()[0];
      if(target)openChatDetails(target);
      else $('chatDetailsContent').replaceChildren(element('p','muted','Choose a task to inspect its local status.'));
    }
  }
  $('chatInspectorTask').addEventListener('click',()=>activateInspector('task'));
  $('chatInspectorCode').addEventListener('click',()=>activateInspector('code'));
  $('sessionSearch').addEventListener('input',renderSessionList);
  $('showArchivedSessions').addEventListener('click',()=>{
    includeArchivedSessions=!includeArchivedSessions;
    text($('showArchivedSessions'),includeArchivedSessions?'Hide archived':'Show archived');
    renderSessionList();
  });
  $('chatAllTasks').addEventListener('click',()=>selectChatSession(null).catch(e=>showToast(e.message,true)));
  $('sessionRename').addEventListener('click',async()=>{
    const session=currentChatSession();if(!session)return;
    const name=prompt('Rename local session:',session.title);
    if(name===null)return;
    try{
      await request('chat/sessions/rename',{method:'POST',body:{id:session.id,title:name}});
      await loadChatSessions();
    }catch(e){showToast(e.message,true);}
  });
  $('sessionArchive').addEventListener('click',async()=>{
    const session=currentChatSession();if(!session)return;
    const restore=!!session.archived;
    if(!restore&&!confirm('Archive this session? Existing tasks will not be deleted or cancelled.'))return;
    try{
      await request('chat/sessions/archive',{method:'POST',
        body:{id:session.id,archived:!restore,confirmed:true}});
      await loadChatSessions();
      if(!restore)await selectChatSession(null);
      else await selectChatSession(session.id);
    }catch(e){showToast(e.message,true);}
  });
  $('chatDetailsClose').addEventListener('click',closeChatDetails);
  $('chatDetailsToggle').addEventListener('click',()=>{
    if(!$('chatDetailsPanel').hidden){closeChatDetails();return;}
    if(inspectorTab==='code'){renderCodeInspector();return;}
    const target=activeChatItems().find(x=>x.id===selectedChatTaskId)||activeChatItems()[0];
    if(target)openChatDetails(target);
    else{
      $('chatDetailsPanel').hidden=false;
      $('chatDetailsToggle').setAttribute('aria-expanded','true');
    }
  });
  $('chatJumpBottom').addEventListener('click',()=>{
    $('chatScroll').scrollTo({top:$('chatScroll').scrollHeight,behavior:'smooth'});
  });
  $('chatScroll').addEventListener('scroll',()=>{
    const scroller=$('chatScroll');
    $('chatJumpWrapper').hidden=
      scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<190;
  },{passive:true});
  document.querySelectorAll('.prompt-starter').forEach(button=>
    button.addEventListener('click',()=>{
      changeView('supervisor');
      $('promptInput').value=button.dataset.prompt||'';
      if([...$('roleSelect').options].some(x=>x.value===button.dataset.role))
        $('roleSelect').value=button.dataset.role;
      $('promptInput').focus();
    }));
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
      e.preventDefault();changeView('supervisor');$('promptInput').focus();
    }
    if(e.key==='Escape'){
      closeChatDetails();
      document.querySelector('.sidebar').classList.remove('open');
    }
  });
  $('importModel').addEventListener('click',importModel);
  $('modelBenchmark').addEventListener('click',async()=>{
    const target=$('modelProbeResult');
    if(modelData.inference_probe?.benchmark_unlocked!==true){
      return showToast('Run and pass a real local generation probe before benchmarking.',true);
    }
    const button=$('modelBenchmark');button.disabled=true;
    text(target,'Running a real structured-output check against the selected local model...');
    try{
      const r=await request('models/benchmark',{method:'POST',body:{confirmed:true}});
      text(target,JSON.stringify(r.benchmark,null,2));
    }catch(e){text(target,'Benchmark unavailable: '+e.message);}
    finally{await loadModels().catch(()=>{});}
  });
  $('modelProbe').addEventListener('click',probeModelGeneration);
  $('refreshHardware').addEventListener('click',()=>loadModels().catch(e=>showToast(e.message,true)));
  $('adaptiveFind').addEventListener('click',searchAdaptive);
  $('operatingRefresh').addEventListener('click',loadOperatingDesk);
  $('operatingRoute').addEventListener('click',routeOperatingInstruction);
  $('knowledgeRefresh').addEventListener('click',loadKnowledgeCandidates);
  $('knowledgeExport').addEventListener('click',exportReviewedKnowledge);
  $('knowledgeImport').addEventListener('click',importReviewedKnowledge);
  $('adaptiveQuery').addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();searchAdaptive();}
  });
  $('codeExportBundle').addEventListener('click',exportLocalBundle);
  $('chromeAIRun').addEventListener('click',runChromeAI);
  $('stopModel').addEventListener('click',async()=>{
    if(!confirm('Stop TheOrg-managed local model and release its memory?'))return;
    try{const result=await request('models/stop',{method:'POST',body:{confirmed:true}});showToast(result.note||'Model stopped');await loadModels();await loadStatus();}
    catch(e){showToast(e.message,true);}
  });
  probeChromeAI();
  $('saveModel').addEventListener('click',async()=>{
    try{await request('models/select',{method:'POST',body:{backend:$('backendSelect').value,ollama_model:$('ollamaModel').value.trim()}});
      showToast('Local inference configuration saved');await loadModels();await loadStatus();}
    catch(e){showToast(e.message,true)}
  });
  $('saveMemory').addEventListener('click',async()=>{
    const title=$('memoryTitle').value,content=$('memoryContent').value;
    try{await request('memories',{method:'POST',body:{title,content}});$('memoryTitle').value='';$('memoryContent').value='';
      showToast('Saved in private memory');loadMemories();loadStatus();}
    catch(e){showToast(e.message,true)}
  });
  /* Code Studio: no dynamic HTML; all model / Git output remains textContent. */
  let chosenCodeProject='', chosenCodePlan=null, codePlans=[];
  async function loadCodeStudio(){
    const [projects, plans]=await Promise.all([request('code/projects'),request('code/plans')]);
    const select=$('codeProject'),prev=chosenCodeProject||select.value;
    select.replaceChildren(element('option','','Select a local project'));
    select.firstChild.value='';
    for(const p of projects.projects||[]){const opt=element('option','',p.slug+(p.dirty?' · changed':''));opt.value=p.id;select.append(opt)}
    if((projects.projects||[]).some(p=>p.id===prev))select.value=prev;
    else if((projects.projects||[]).length)select.value=projects.projects[0].id;
    chosenCodeProject=select.value;
    if(chosenCodeProject){await loadCodeFiles();await loadCodeHistory();}
    else {appendEmpty($('codeFileList'),'Create a local Git project to begin.');appendEmpty($('codeHistory'),'No commits yet.');}
    request('code/sandbox').then(r=>{text($('sandboxReadiness'), r.sandbox.available?'Offline test sandbox ready: '+r.sandbox.image:('Sandbox: '+r.sandbox.reason+(r.trusted_local_opt_in?' · trusted-local opt-in enabled':' · local execution disabled')))}).catch(e=>text($('sandboxReadiness'),'Sandbox status unavailable: '+e.message));
    codePlans=plans.plans||[];
    const list=$('codePlans');list.replaceChildren();
    if(!codePlans.length)appendEmpty(list,'No code proposals yet. Create a project and preview a change.');
    for(const plan of codePlans){
      const b=element('button','code-plan-button'+(chosenCodePlan?.id===plan.id?' selected':''));
      b.append(element('strong','',plan.objective.slice(0,100)),pill(plan.status),element('small','',plan.id.slice(0,12)));
      b.addEventListener('click',()=>loadCodePlan(plan.id));list.append(b);
    }
    if(chosenCodePlan)await loadCodePlan(chosenCodePlan.id);
    await loadAutopilotRuns();
    await loadAgentReviews();
  }
  async function loadAutopilotRuns(){
    const list=$('autopilotRuns'); if(!list)return;
    const result=await request('code/autopilot'); list.replaceChildren();
    if(!result.runs.length){appendEmpty(list,'No automatic coding runs yet. Choose a local project and authorize a bounded objective.');return;}
    for(const run of result.runs){
      const card=element('div','task-item');
      const heading=element('div','task-top');
      heading.append(element('strong','',run.objective.slice(0,120)),pill(run.status));
      card.append(heading,element('small','',run.id.slice(0,12)+' · '+run.history.length+'/'+run.max_attempts+' attempts'));
      for(const item of run.history){
        const detail=element('div','inline-note','Attempt '+item.attempt+' · '+item.status+' · '+item.plan_id.slice(0,10));
        if(item.commit_sha)detail.append(document.createTextNode(' · committed '+item.commit_sha.slice(0,12)));
        card.append(detail);
      }
      if(run.error)card.append(element('p','note','Stopped: '+run.error));
      if(['queued','running'].includes(run.status)&&!run.cancel_requested){
        const stop=element('button','btn secondary','Request safe stop');
        stop.addEventListener('click',async()=>{
          if(!confirm('Request cancellation at the next safe checkpoint? Current model calls or tests may finish first.'))return;
          try{await request('code/autopilot/cancel',{method:'POST',body:{id:run.id,confirmed:true}});
            showToast('Safe cancellation requested');await loadAutopilotRuns();}
          catch(e){showToast(e.message,true);}
        });card.append(stop);
      }else if(run.cancel_requested)card.append(element('div','inline-note','Cancellation requested; waiting for a safe checkpoint.'));
      list.append(card);
    }
  }
  async function startAutopilot(){
    if(!chosenCodeProject)return showToast('Select or create a local Git project first.',true);
    const objective=$('autopilotObjective').value.trim();
    if(objective.length<3)return showToast('Enter a coding objective.',true);
    if(!$('autopilotScope').checked)return showToast('Authorize the isolated local scope for this run.',true);
    if(!confirm('AUTO-APPROVE one LOCAL coding workflow for this project? TheOrg may apply edits, run sandbox tests, attempt repairs and make a local commit only on success. No GitHub push or deployment.'))return;
    const btn=$('autopilotStart');btn.disabled=true;
    try{
      const result=await request('code/autopilot',{method:'POST',body:{project_id:chosenCodeProject,objective,
        max_attempts:Number($('autopilotAttempts').value),confirmed:true,
        approval_scope:'isolated-local-code-and-tests'}});
      $('autopilotScope').checked=false;
      showToast('Authorized run '+result.run.id.slice(0,10)+' queued');await loadAutopilotRuns();
    }catch(e){showToast(e.message,true);}finally{btn.disabled=false;}
  }
  async function loadAgentReviews(){
    const panel=$('agentReviewList');if(!panel)return;
    const data=await request('agents/reviews');panel.replaceChildren();
    if(!(data.reviews||[]).length){appendEmpty(panel,'No advisory agent reviews yet.');return;}
    for(const review of data.reviews){
      const item=element('div','task-item');
      item.append(element('strong','',review.objective.slice(0,100)),pill(review.status));
      item.append(element('small','',review.steps.length+' / 5 roles · Git '+review.git_head.slice(0,9)));
      for(const step of review.steps){
        const note=element('div','inline-note');
        note.append(element('strong','',step.role+': '),document.createTextNode(step.output.slice(0,1200)));
        item.append(note);
      }
      if(review.error)item.append(element('p','note',review.error));
      if(review.status==='interrupted'){
        const resume=element('button','btn secondary','Reauthorize unfinished review');
        resume.addEventListener('click',async()=>{
          if(!confirm('Resume only the remaining advisory roles for the same Git revision?'))return;
          try{await request('agents/reviews/resume',{method:'POST',body:{id:review.id,confirmed:true}});
              await loadAgentReviews();}catch(e){showToast(e.message,true);}
        });item.append(resume);
      }
      if(['queued','running','interrupted'].includes(review.status) && !review.cancel_requested){
        const stop=element('button','btn secondary','Request cancellation');
        stop.addEventListener('click',async()=>{
          if(!confirm('Cancel this advisory review?'))return;
          try{await request('agents/reviews/cancel',{method:'POST',body:{id:review.id,confirmed:true}});
              await loadAgentReviews();}catch(e){showToast(e.message,true);}
        });item.append(stop);
      }
      panel.append(item);
    }
  }
  async function startAgentReview(){
    if(!chosenCodeProject)return showToast('Select a local Git project first.',true);
    const objective=$('agentObjective').value.trim();
    if(objective.length<5 || objective.length>1200)return showToast('Enter a review objective (5–1200 characters).',true);
    if(!$('agentScope').checked)return showToast('Authorize this advisory-only scope first.',true);
    if(!confirm('Run five local advisory roles on this selected project, without executing tools?'))return;
    try{
      await request('agents/reviews',{method:'POST',body:{project_id:chosenCodeProject,
            objective,scope:'local-advisory-agent-review',confirmed:true}});
      $('agentScope').checked=false;await loadAgentReviews();showToast('Advisory review queued.');
    }catch(e){showToast(e.message,true);}
  }
  async function loadCodeFiles(){
    const data=await request('code/files?project_id='+encodeURIComponent(chosenCodeProject)),list=$('codeFileList');
    list.replaceChildren();
    if(!(data.files||[]).length){appendEmpty(list,'Project is empty.');return;}
    for(const f of data.files){
      const b=element('button');b.append(element('span','',f.name),element('small','',fmtSize(f.bytes)));
      b.addEventListener('click',async()=>{
        try{const d=await request('code/files/read',{method:'POST',body:{project_id:chosenCodeProject,path:f.name}});
          $('codePath').value=f.name;$('codeContent').value=d.content;showToast('Opened '+f.name+' (read only until proposal approved)');}
        catch(e){showToast(e.message,true)}
      });list.append(b);
    }
  }
  async function loadCodeHistory(){
    const panel=$('codeHistory');panel.replaceChildren();
    const data=await request('code/history?project_id='+encodeURIComponent(chosenCodeProject));
    if(!data.commits.length)return appendEmpty(panel,'No local Git commits.');
    for(const commit of data.commits){
      const item=element('div','history-entry');
      item.append(element('strong','',commit.short+' · '+commit.title),
        element('small','',commit.date));panel.append(item);
    }
  }
  async function loadCodePlan(id){
    const result=await request('code/plan?id='+encodeURIComponent(id));
    chosenCodePlan=result.plan;renderCodePlan(chosenCodePlan);
  }
  function codeAction(label,ask,action,body){
    const b=element('button','btn secondary',label);
    b.addEventListener('click',async()=>{
      if(!confirm(ask))return;
      b.disabled=true;
      try{const r=await request('code/plans/'+action,{method:'POST',body:{id:chosenCodePlan.id,confirmed:true,...body}});
        chosenCodePlan=r.plan;renderCodePlan(r.plan);await loadCodeStudio();showToast(label+' completed');}
      catch(e){showToast(e.message,true);await loadCodeStudio()}
      finally{b.disabled=false;}
    });return b;
  }
  function renderCodePlan(plan){
    const box=$('codePlanDetail');box.replaceChildren();
    const heading=element('h3','',plan.objective);box.append(heading);
    box.append(element('div','digest','Status '+plan.status+' · Review SHA-256 '+plan.digest));
    const actions=element('div','code-actions');
    if(plan.status==='draft')actions.append(codeAction('Advisory AI QA review',
      'Request an independent local-model QA assessment? This does not authorize any changes.',
      'review',{}));
    if(plan.status==='draft')actions.append(codeAction('Approve exact diff',
      'Approve this exact reviewed SHA-256 plan? This only records approval; it does not modify files.',
      'approve',{digest:plan.digest}));
    if(plan.status==='approved')actions.append(codeAction('Apply approved changes',
      'Write exactly these reviewed file contents inside the selected local Git project?', 'apply',{}));
    if(['applied','checks_failed','verified'].includes(plan.status)){
      actions.append(codeAction('Verify without running tests',
        'Run Git integrity and Python AST checks only? No source code execution. This cannot mark a plan fully verified.',
        'verify',{run_tests:false}));
      actions.append(codeAction('Run tests inside offline Docker sandbox',
        'Run Python tests in a no-network, read-only Docker container using a bounded temporary source snapshot? Requires a LOCAL image. No image will be downloaded.',
        'verify',{run_tests:true,execution_mode:'sandbox'}));
      actions.append(codeAction('Trusted local tests (opt-in only)',
        'HIGH RISK: Run Python test code under your Windows account WITHOUT sandbox isolation? Requires THEORG_ALLOW_TRUSTED_TESTS=1 before starting the engine. Proceed only for your own trusted code.',
        'verify',{run_tests:true,execution_mode:'trusted_local'}));
    }
    if(plan.status==='rolled_back'&&plan.evidence?.checks?.unit_tests?.passed===false){
      actions.append(codeAction('Generate AI repair draft',
        'Ask the selected LOCAL model to suggest a NEW repair diff using the failed tests? This does not apply changes.',
        'repair',{}));
    }
    if(plan.status==='verified')actions.append(codeAction('Commit locally',
      'Create a LOCAL Git commit of the exact verified files? No push or deployment will occur.',
      'commit',{message:'TheOrg: '+plan.objective.slice(0,85)}));
    if(['applied','checks_failed','verified','interrupted'].includes(plan.status))actions.append(codeAction('Roll back approved edits',
      'Restore the original file contents? Any independent edits will cause the rollback to be refused.',
      'rollback',{}));
    box.append(actions);
    for(const change of plan.changes||[]){box.append(element('h3','',change.path+(change.new_file?' · new file':'')));
      box.append(element('pre','',change.diff||'(No textual diff)'));}
    if(plan.evidence&&Object.keys(plan.evidence).length){
      box.append(element('h3','','Verification evidence'));
      box.append(element('pre','',JSON.stringify(plan.evidence,null,2)));
    }
    box.append(element('p','note','Approval is tied to this diff digest and the project Git baseline. Any changed file or Git HEAD invalidates the authorization.'));
  }
  async function codeSearch(){
    if(!chosenCodeProject)return showToast('Select a project first',true);
    const q=$('codeSearch').value.trim();if(!q)return showToast('Enter a search keyword',true);
    try{
      const result=await request('code/search?project_id='+encodeURIComponent(chosenCodeProject)+'&q='+encodeURIComponent(q));
      const panel=$('codeSearchResults');panel.replaceChildren();
      if(!result.matches.length)return appendEmpty(panel,'No matches in accessible project files.');
      for(const match of result.matches){
        const b=element('button');b.append(element('strong','',match.path+':'+match.line),element('small','',match.excerpt));
        b.addEventListener('click',async()=>{
          try{const data=await request('code/files/read',{method:'POST',body:{project_id:chosenCodeProject,path:match.path}});
            $('codePath').value=match.path;$('codeContent').value=data.content;
            showToast('Source opened: '+match.path);}
          catch(e){showToast(e.message,true)}
        });panel.append(b);
      }
    }catch(e){showToast(e.message,true)}
  }
  // Company jobs: explicit user dispatch, no model output is treated as authorization.
  async function loadCompany(){
    const company = $('companyName').value.trim() || 'demo';
    const target = $('companyOrderList');target.replaceChildren();
    const [projects, runtime, data, directory] = await Promise.all([
      request('code/projects'), request('company/runtime'),
      request('company/orders?company_id='+encodeURIComponent(company)),
      request('company/agents?company_id='+encodeURIComponent(company))
    ]);
    companyAgentProfiles=directory.agents||[];
    const agentSelector=$('companyAgentSelect'), selectedAgent=agentSelector.value;
    agentSelector.replaceChildren(element('option','', 'Select a specialist'));
    for(const agent of companyAgentProfiles){
      const opt=element('option','',agent.display_name+' · '+agent.title);
      opt.value=agent.id;agentSelector.append(opt);
    }
    if(companyAgentProfiles.some(x=>x.id===selectedAgent))agentSelector.value=selectedAgent;
    if(agentSelector.value)populateCompanyAgent();
    $('companyRuntime').textContent=runtime.opencode.available
      ? 'OpenCode detected: '+runtime.opencode.version+' · External runtime; authorization required.'
      : 'OpenCode not available: '+(runtime.opencode.reason||'Install and authenticate the OpenCode CLI before dispatch.');
    const projectSelect=$('companyProject'), wanted=projectSelect.value;
    projectSelect.replaceChildren(element('option','', 'Select existing local project'));
    for(const p of projects.projects||[]){
      const opt=element('option','',p.slug);opt.value=p.id;projectSelect.append(opt);
    }
    if([...projectSelect.options].some(x=>x.value===wanted))projectSelect.value=wanted;
    if(!data.orders.length) return appendEmpty(target,'No company work orders. Choose an existing Code Studio project and create one.');
    for(const order of data.orders){
      const card=element('div','task-item');
      card.append(element('strong','',order.objective),
        element('small','',order.company_id+' · '+order.status+' · '+order.id));
      for(const job of order.jobs||[]){
        const jobBox=element('div','file-item');
        jobBox.append(element('strong','',job.agent_role+' · '+job.status+
          (job.edit_mode?' · isolated edit':' · read only')),
          element('small','',job.instruction));
        if(job.error)jobBox.append(element('div','inline-note',job.error));
        if(job.report?.summary)jobBox.append(element('pre','',job.report.summary.slice(0,2800)));
        if(job.report?.changed_count)jobBox.append(element('small','',job.report.changed_count+' changed files (isolated copy only)'));
        if(job.report?.inherited_from_accepted_job)jobBox.append(element('small','',
          'Input source inherited from QA-accepted job '+job.report.inherited_from_accepted_job.slice(0,10)));
        if(job.report?.project_baseline_manifest_sha256)jobBox.append(element('small','',
          'Original project baseline SHA-256: '+job.report.project_baseline_manifest_sha256.slice(0,16)+'…'));
        const actions=element('div','button-row');
        if(job.report?.changed_files?.length){
          const paths=element('button','btn secondary','Inspect changed source hashes');
          paths.addEventListener('click',()=>{
            const lines=job.report.changed_files.map(x=>x.path+'\\n  Before: '+(x.before||'new')+'\\n  After: '+(x.after||'deleted'));
            alert(lines.join('\\n\\n'));
          });actions.append(paths);
        }
        if(job.status==='queued'){
          const b=element('button','btn secondary','Approve & run');
          b.addEventListener('click',async()=>{
            const model=$('companyModel').value.trim();
            if(!model)return showToast('Choose an explicit provider/model first.',true);
            if(!confirm('Authorize the external OpenCode CLI to read a COPIED snapshot of this project? Its selected model provider may receive project source content, and provider costs may apply.'))return;
            const edit=!!job.edit_mode;
            if(edit && !confirm('Approve source changes in the ISOLATED COPY only? The CLI runs under your user account; it is not an OS sandbox. No merge or deployment will occur.'))return;
            b.disabled=true;
            try{
              await request('company/jobs/dispatch',{method:'POST',body:{
                job_id:job.id,model,confirmed:true,data_transfer_confirmed:true,
                isolated_edit_confirmed:edit
              }});
              await loadCompany();showToast('Authorized work dispatched. Review result before accepting.');
            }catch(e){showToast(e.message,true);b.disabled=false}
          });actions.append(b);
        }
        if(job.status==='submitted_for_qa'){
          const check=element('button','btn secondary','Check structural evidence');
          check.addEventListener('click',async()=>{
            try{
              const x=await request('company/qa/structural?job_id='+encodeURIComponent(job.id));
              alert(x.assessment.structural_pass
                ? 'Structural checks passed. Content correctness, tests and reviewer identity remain UNVERIFIED.'
                : 'Structural checks failed:\n'+x.assessment.findings.join('\n'));
            }catch(e){showToast(e.message,true)}
          });actions.append(check);
          const aiQa=element('button','btn secondary','Run separate AI QA review');
          aiQa.addEventListener('click',async()=>{
            const model=$('companyModel').value.trim();
            if(!model)return showToast('Choose an explicit QA provider/model first.',true);
            if(!confirm('Run a NEW read-only AI reviewer on the staged source? This may transmit source to the selected provider. It does NOT approve the deliverable.'))return;
            aiQa.disabled=true;
            try{
              await request('company/qa/run',{method:'POST',body:{
                job_id:job.id,model,confirmed:true,data_transfer_confirmed:true
              }});
              showToast('Separate AI QA review started. Refresh for findings.');
            }catch(e){showToast(e.message,true)}
            finally{aiQa.disabled=false}
          });actions.append(aiQa);
          const qaHistory=element('button','btn secondary','View QA findings');
          qaHistory.addEventListener('click',async()=>{
            try{
              const r=await request('company/qa?job_id='+encodeURIComponent(job.id));
              const findings=r.reviews.map(q=>q.reviewer_role+' · '+q.verdict+'\n'+q.findings);
              alert(findings.join('\n\n')||'No QA records yet.');
            }catch(e){showToast(e.message,true)}
          });actions.append(qaHistory);
          for(const verdict of ['accept','reject']){
            const b=element('button','btn secondary',verdict==='accept'?'Record QA acceptance':'Reject & request repair');
            b.addEventListener('click',async()=>{
              const notes=prompt('Record specific evidence you independently inspected (minimum 30 characters). Do not falsely claim tests or reviewer identity:', '');
              if(notes===null)return;
              const role=['qa','qa_auditor'].includes(job.agent_role)?'security_officer':'qa_auditor';
              if(!confirm('Record a '+role.toUpperCase()+' reviewer attestation? It is not a verified reviewer login or independent automated test.'))return;
              try{
                await request('company/qa/review',{method:'POST',body:{
                  job_id:job.id,verdict,findings:notes,reviewer_role:role,confirmed:true
                }});
                await loadCompany();
              }catch(e){showToast(e.message,true)}
            });actions.append(b);
          }
        }
        if(job.status==='accepted'&&job.edit_mode){
          const promote=element('button','btn secondary','Create Code Studio draft');
          promote.addEventListener('click',async()=>{
            if(!confirm('Convert QA-attested ISOLATED changes into a review-only Code Studio diff? This will not change the original project. A separate exact digest approval will still be required.'))return;
            promote.disabled=true;
            try{
              const outcome=await request('company/jobs/propose',{method:'POST',body:{
                job_id:job.id,confirmed:true
              }});
              chosenCodeProject=order.project_id;
              changeView('coding');
              await loadCodePlan(outcome.plan.id);
              showToast('Draft created. Review the diff and digest before any application.');
            }catch(e){showToast(e.message,true);promote.disabled=false}
          });actions.append(promote);
        }
        if(job.status==='accepted'){
          const exportBtn=element('button','btn secondary','Export accepted results');
          exportBtn.addEventListener('click',async()=>{
            if(!confirm('Export the QA-attested summary and changed source into this company’s results folder? No code is executed or merged.'))return;
            try{
              const data=await request('company/jobs/export',{method:'POST',body:{
                job_id:job.id,confirmed:true
              }});
              alert('Exported '+data.files.length+' files to:\n'+data.folder);
            }catch(e){showToast(e.message,true)}
          });actions.append(exportBtn);
        }
        if(['failed','rejected','interrupted'].includes(job.status)){
          const retry=element('button','btn secondary','Prepare fresh retry');
          retry.addEventListener('click',async()=>{
            if(!confirm('Reset this failed/interrupted job to queued for a NEW manually approved attempt? Prior attempt files are preserved. No provider request will be sent yet.'))return;
            try{await request('company/jobs/requeue',{method:'POST',body:{
              job_id:job.id,confirmed:true
            }});await loadCompany()}catch(e){showToast(e.message,true)}
          });actions.append(retry);
        }
        if(job.status==='running' && job.cancellation_requested){
          actions.append(element('span','tiny','Cancellation requested; awaiting local process termination.'));
        }
        if(['queued','interrupted','running'].includes(job.status) && !job.cancellation_requested){
          const running=job.status==='running';
          const cancel=element('button','btn secondary',running?'Stop running agent':'Cancel queued request');
          cancel.addEventListener('click',async()=>{
            const warning=running
              ?'Request termination of the running OpenCode process tree? Work will not be accepted; termination may take a moment and must be verified.'
              :'Cancel this not-yet-active request?';
            if(!confirm(warning))return;
            try{await request('company/jobs/cancel',{method:'POST',body:{
              job_id:job.id,confirmed:true
            }});await loadCompany()}catch(e){showToast(e.message,true)}
          });actions.append(cancel);
        }
        const handoff=element('button','btn secondary','Send note to this agent');
        handoff.addEventListener('click',async()=>{
          const note=prompt('Owner note for '+job.agent_role+'. Saved as untrusted task context:', '');
          if(note===null)return;
          if(!confirm('Save this note for the selected job? This alone will not execute work.'))return;
          try{
            await request('company/messages',{method:'POST',body:{
              order_id:order.id,to_job:job.id,message:note,confirmed:true
            }});showToast('Owner note saved to job inbox.');
          }catch(e){showToast(e.message,true)}
        });actions.append(handoff);
        jobBox.append(actions);card.append(jobBox);
      }
      target.append(card);
    }
  }
  function populateCompanyAgent(){
    const p=companyAgentProfiles.find(x=>x.id===$('companyAgentSelect').value);
    if(!p)return;
    $('companyAgentName').value=p.display_name;
    $('companyAgentTitle').value=p.title;
    $('companyAgentDepartment').value=p.department;
    $('companyAgentExpertise').value=(p.expertise||[]).join(', ');
    $('companyAgentInstructions').value=p.instructions||'';
    $('companyAgentEnabled').checked=p.enabled;
    $('companyAgentEnabled').disabled=['qa_auditor','security_officer'].includes(p.id);
  }
  $('companyAgentSelect').addEventListener('change',populateCompanyAgent);
  $('companyAgentSave').addEventListener('click',async()=>{
    const id=$('companyAgentSelect').value;
    if(!id)return showToast('Select a company specialist first.',true);
    const updates={
      display_name:$('companyAgentName').value.trim(),
      title:$('companyAgentTitle').value.trim(),
      department:$('companyAgentDepartment').value.trim(),
      expertise:$('companyAgentExpertise').value.split(',').map(x=>x.trim()).filter(Boolean),
      instructions:$('companyAgentInstructions').value,
      enabled:$('companyAgentEnabled').checked
    };
    if(!confirm('Save role-description changes for this company? Immutable roles and execution permissions will not be changed.'))return;
    try{
      await request('company/agents',{method:'POST',body:{
        company_id:$('companyName').value.trim(),agent_id:id,updates,confirmed:true
      }});
      await loadCompany();showToast('Company specialist profile saved.');
    }catch(e){showToast(e.message,true)}
  });
  $('companyRefresh').addEventListener('click',()=>loadCompany().catch(e=>showToast(e.message,true)));
  $('companyPlanPreview').addEventListener('click',async()=>{
    const company=$('companyName').value.trim(),project=$('companyProject').value;
    const objective=$('companyObjective').value.trim(),btn=$('companyPlanPreview');
    if(!project)return showToast('Select a local Code Studio project first.',true);
    if(objective.length<5)return showToast('Enter an objective of at least five characters.',true);
    btn.disabled=true;
    try{
      const result=await request('company/plan',{method:'POST',body:{
        company_id:company,project_id:project,objective
      }});
      $('companyTasks').value=JSON.stringify(result.plan.tasks,null,2);
      $('companyPlanStatus').textContent=result.plan.warning+
        ' This is an EDITABLE preview; no external agent was called or authorized.';
      showToast('Agent draft prepared locally. Review dependencies and click Create draft work order.');
    }catch(e){showToast(e.message,true)}
    finally{btn.disabled=false}
  });
  $('companyCreate').addEventListener('click',async()=>{
    const company=$('companyName').value.trim(), project=$('companyProject').value;
    const objective=$('companyObjective').value.trim();
    let tasks;
    try{tasks=JSON.parse($('companyTasks').value)}catch{return showToast('Tasks must be valid JSON.',true);}
    if(!project)return showToast('Create or select a Code Studio project first.',true);
    if(!confirm('Create this work order? This only saves queued tasks; NO external AI execution starts.'))return;
    const b=$('companyCreate');b.disabled=true;
    try{
      await request('company/orders',{method:'POST',body:{
        company_id:company,project_id:project,objective,tasks,confirmed:true
      }});
      await loadCompany();showToast('Persistent work order created. Dispatch requires separate approval.');
    }catch(e){showToast(e.message,true)}
    finally{b.disabled=false}
  });
  $('autopilotStart').addEventListener('click',startAutopilot);
  $('agentStart').addEventListener('click',startAgentReview);
  $('agentRefresh').addEventListener('click',()=>loadAgentReviews().catch(e=>showToast(e.message,true)));
  $('autopilotRefresh').addEventListener('click',()=>loadAutopilotRuns().catch(e=>showToast(e.message,true)));
  $('codeContextBtn').addEventListener('click',async()=>{
    const objective=$('codeObjective').value.trim()||$('autopilotObjective').value.trim();
    if(!chosenCodeProject||objective.length<2){showToast('Select a project and enter a coding objective first.',true);return;}
    try{
      const q='code/context?project_id='+encodeURIComponent(chosenCodeProject)+'&objective='+encodeURIComponent(objective);
      const data=await request(q), target=$('codeContextResults');target.replaceChildren();
      const summary=element('div','inline-note',data.files_matched+' matching files · '+data.context_chars+' characters · approximately '+(data.context_estimated_tokens||0)+' tokens · Git '+data.git_head.slice(0,9));
      target.append(summary);
      for(const file of data.files){
        const row=element('div','file-item',file.path+' · rank '+file.score+(file.truncated?' · clipped':''));
        target.append(row);
      }
      if(!data.files.length)target.append(element('div','empty','No matching source files. Refine the objective.'));
    }catch(e){showToast(e.message,true);}
  });
  $('codeSearchBtn').addEventListener('click',codeSearch);
  $('codeSearch').addEventListener('keydown',e=>{if(e.key==='Enter')codeSearch()});
  $('codeProject').addEventListener('change',()=>{chosenCodeProject=$('codeProject').value;Promise.all([loadCodeFiles(),loadCodeHistory()]).catch(e=>showToast(e.message,true))});
  $('codeCreateProject').addEventListener('click',async()=>{
    const slug=$('codeNewProject').value.trim();if(!slug)return showToast('Enter a project slug',true);
    if(!confirm('Create new isolated project workspace/projects/'+slug+' and initialize a local Git repository?'))return;
    try{const r=await request('code/projects',{method:'POST',body:{slug,confirmed:true}});
      chosenCodeProject=r.project.id;$('codeNewProject').value='';await loadCodeStudio();showToast('Project created locally');}
    catch(e){showToast(e.message,true)}
  });
  $('codePropose').addEventListener('click',async()=>{
    if(!chosenCodeProject)return showToast('Select a project first',true);
    try{const r=await request('code/plans',{method:'POST',body:{project_id:chosenCodeProject,
      objective:$('codeObjective').value,changes:[{path:$('codePath').value,content:$('codeContent').value}]}});
      chosenCodePlan=r.plan;await loadCodeStudio();showToast('Review the new draft diff before approving');}
    catch(e){showToast(e.message,true)}
  });
  $('codeGenerate').addEventListener('click',async()=>{
    if(!chosenCodeProject)return showToast('Select a project first',true);
    if(!confirm('Ask your local model to draft code changes? It will only propose a diff, never execute code.'))return;
    const b=$('codeGenerate');b.disabled=true;b.textContent='Generating local draft…';
    try{const r=await request('code/plans/generate',{method:'POST',body:{project_id:chosenCodeProject,objective:$('codeObjective').value}});
      chosenCodePlan=r.plan;await loadCodeStudio();showToast('Model draft ready for your review');}
    catch(e){showToast(e.message,true)}finally{b.disabled=false;b.textContent='Generate draft using local AI'}
  });
  $('codeRefresh').addEventListener('click',()=>loadCodeStudio().catch(e=>showToast(e.message,true)));
  (async()=>{
    try{const x=await request('profiles');
      for(const p of x.profiles){const opt=element('option','',p.name);opt.value=p.id;$('roleSelect').append(opt);}
    }catch{}
    if(token){try{await request('status');$('unlockOverlay').classList.add('hidden');await Promise.all([refreshAll(),loadChatSessions()]);}
      catch{lock();}}
    else lock();
    setInterval(()=>{if(token&&document.visibilityState==='visible'&&$('unlockOverlay').classList.contains('hidden')){
      Promise.all([loadStatus(),loadTasks(),...(activeView==='coding'?[loadAutopilotRuns()]:[])]).catch(()=>{});
    }},7000);
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
  })();
})();
