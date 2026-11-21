const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'apps/chrome-extension/home.js'),'utf8');
const rpc=source.slice(source.indexOf('async function rpc('),source.indexOf('async function action('));
const check=source.slice(source.indexOf('async function checkEngine('),source.indexOf('function renderProviders('));
function harness(sendMessage){
 const elements=Object.fromEntries(['recheck','engineStatus'].map(id=>[id,{removeAttribute(k){delete this[k]}}]));
 const notifications=[],timers=new Map();let next=0;
 const context=vm.createContext({chrome:{runtime:{sendMessage}},$:id=>elements[id],toast:x=>notifications.push(x),
 setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(rpc+check,context);
 return {elements,notifications,timers,context,check:()=>vm.runInContext('checkEngine()',context)};
}
test('healthy controller restores connection display and clears probe timer',async()=>{
 const h=harness(async()=>({ok:true}));await h.check();
 assert.equal(h.elements.engineStatus.textContent,'Local controller connected');
 assert.equal(h.elements.recheck.disabled,false);assert.equal(h.timers.size,0);
});
test('native connection and controller errors are visible and retryable',async()=>{
 for(const send of [async()=>{throw Error('host not found')},async()=>({ok:false,error:'invalid_state: reviewed plan changed'})]){
  const h=harness(send);await h.check();
  assert.equal(h.elements.recheck.disabled,false);assert.equal(h.timers.size,0);
  assert.equal(h.elements.engineStatus.textContent,'Controller unavailable');
  assert.match(h.notifications[0],/host not found|reviewed plan changed/);
  assert.ok(h.elements.engineStatus.title);
 }
});
test('stalled ping times out without retrying a request or blocking other UI RPC',async()=>{
 const calls=[];const h=harness(async m=>{calls.push(m.command);return m.command==='ping'?new Promise(()=>{}):{ok:true,providers:{}}});
 const pending=h.check();assert.equal(h.elements.recheck.disabled,true);
 const providers=await vm.runInContext('rpc("providers")',h.context);assert.equal(providers.ok,true);
 const timer=[...h.timers.values()][0];assert.equal(timer.ms,15000);timer.fn();await pending;
 assert.match(h.elements.engineStatus.title,/timed out/);assert.equal(h.elements.recheck.disabled,false);
 assert.deepEqual(calls,['ping','providers']);assert.equal(h.timers.size,0);
});
test('mutating RPC has no fake cancellation timer and startup does not await ping',async()=>{
 const h=harness(async()=>({ok:true}));await vm.runInContext('rpc("create_order")',h.context);
 assert.equal(h.timers.size,0);assert.match(source,/void checkEngine\(\);/);
});
test('native error detail reaches the Supervisor without treating it as HTML',async()=>{
 const c={URL};vm.runInNewContext(fs.readFileSync(path.join(root,'apps/chrome-extension/task-manager.js'),'utf8'),c);
 const manager=new c.TheOrgTaskManager({runtime:{sendNativeMessage:async()=>({ok:false,error:'invalid_state',detail:'Refresh and review again'})}});
 await assert.rejects(()=>manager.checkEngine(),/invalid_state: Refresh and review again/);
});
test('single EXE packages the bounded health probe and retains full CI self-tests',()=>{
 const setup=fs.readFileSync(path.join(root,'tools/Setup-OneFile.ps1'),'utf8');
 const installer=fs.readFileSync(path.join(root,'tools/TheOrg-OneFile.nsi'),'utf8');
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/onefile-existing-chrome-ci.yml'),'utf8');
 assert.match(setup,/Test-BridgeConnection\.ps1'\) -ExecutablePath \$bridge/);
 assert.doesNotMatch(setup,/& \$bridge --self-test/);
 assert.match(installer,/File \/oname=Test-BridgeConnection\.ps1/);
 assert.match(installer,/Delete "\$INSTDIR\\Test-BridgeConnection\.ps1"/);
 assert.match(workflow,/& out\/onefile\/bridge\/TheOrg\.Bridge\.exe --self-test/);
 assert.match(workflow,/Copy-Item -LiteralPath 'portable\/Test-BridgeConnection\.ps1'/);
});
