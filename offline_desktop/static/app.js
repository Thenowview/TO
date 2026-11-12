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
  let activeView = 'overview';
  let companyAgentProfiles=[];
  let jobs = [], modelData = {}, engineStatus = {};
  const labels = {overview:'Workspace overview',supervisor:'AI Supervisor',operator:'Windows Operator',tasks:'Task queue',coding:'Code Studio',company:'Company agents',models:'Local models',files:'Workspace files',memory:'Memory vault',settings:'System & security'};

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
    if(view==='models')loadModels();if(view==='tasks'||view==='supervisor')loadTasks();
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
  async function loadTasks(){const data=await request('tasks');jobs=data.tasks||[];renderTasks($('taskList'));renderTasks($('supervisorResults'),6);}
  function runtimeCard(title,detail,ready){const c=element('div','runtime-card'),left=element('div');left.append(element('strong','',title),element('small','',detail));c.append(left,pill(ready?'completed':'failed'));return c;}
  async function loadModels(){
    const data=await request('models');modelData=data;
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
    } catch(error) { text(output,'Probe failed: '+error.message);showToast(error.message,true); }
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
    const [available,history]=await Promise.all([request('capabilities'),request('capabilities/history')]);
    operatorCatalog=available.capabilities||[];
    const catalog=$('operatorCatalog');catalog.replaceChildren();
    for(const tool of operatorCatalog){
      const card=element('div','task-card');
      card.append(element('strong','',tool.id+' · '+(tool.enabled?'Enabled':'Disabled')));
      card.append(element('div','muted',tool.description||'No description'));
      catalog.append(card);
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
    if(outcome.status==='completed')showToast('Action completed; inspect returned evidence.');
    else showToast('Action requires review: '+outcome.status,true);
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
  $('operatorVerifyRun').addEventListener('click',async()=>{
    const runId=Number($('operatorRunId').value);
    const sha=$('operatorRunSha').value.trim();
    if(!Number.isSafeInteger(runId)||runId<1||!/^[0-9a-f]{40}$/.test(sha)){
      return showToast('Enter a positive run ID and the exact 40-character lowercase commit SHA.',true);
    }
    const button=$('operatorVerifyRun');button.disabled=true;
    try{
      await runOperatorAction('github.workflow.result',{
        run_id:runId,expected_sha:sha
      },'authenticated_remote_read');
      text($('operatorRunStatus'),'Result recorded in local operator history. See outcome above.');
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
  $('submitTask').addEventListener('click',async()=>{
    const prompt=$('promptInput').value.trim();if(!prompt){showToast('Enter a task instruction.',true);return;}
    const btn=$('submitTask');btn.disabled=true;
    try{const r=await request('tasks',{method:'POST',body:{prompt,role:$('roleSelect').value}});
      showToast('Task queued: '+r.id.slice(0,8));$('promptInput').value='';await loadTasks();changeView('tasks');}
    catch(e){showToast(e.message,true);}finally{btn.disabled=false;}
  });
  $('importModel').addEventListener('click',importModel);
  $('modelBenchmark').addEventListener('click',async()=>{const target=$('modelProbeResult');text(target,'Testing local model output...');try{const r=await request('models/benchmark',{method:'POST',body:{confirmed:true}});text(target,JSON.stringify(r.benchmark,null,2));}catch(e){text(target,'Benchmark unavailable: '+e.message);}});
  $('modelProbe').addEventListener('click',probeModelGeneration);
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
    if(token){try{await request('status');$('unlockOverlay').classList.add('hidden');await refreshAll();}
      catch{lock();}}
    else lock();
    setInterval(()=>{if(token&&document.visibilityState==='visible'&&$('unlockOverlay').classList.contains('hidden')){
      Promise.all([loadStatus(),loadTasks(),...(activeView==='coding'?[loadAutopilotRuns()]:[])]).catch(()=>{});
    }},7000);
    if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
  })();
})();
