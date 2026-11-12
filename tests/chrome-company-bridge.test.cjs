const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../chrome_company_bridge/chatgpt.js'),'utf8');
function editor(attrs={},visible=true){return {disabled:false,isContentEditable:true,innerText:'',getAttribute:k=>attrs[k]??null,getBoundingClientRect:()=>({width:visible?400:0,height:visible?50:0})};}
function load(editors,extra={}){
  const doc={querySelector:()=>null,querySelectorAll:s=>s.startsWith('textarea')?editors:[],...extra};
  const context={document:doc,location:{origin:'https://chatgpt.com'},setTimeout};vm.createContext(context);vm.runInContext(code,context);return context.TheOrgChatGPT;
}
test('modern unique visible composer works without historical prompt id',()=>{const e=editor({'aria-label':'Ask ChatGPT'});assert.equal(load([e]).findComposer(),e);});
test('hidden editors and search fields cannot become message targets',()=>{const search=editor({role:'searchbox'}),hidden=editor({},false),e=editor({'aria-label':'Ask ChatGPT'});assert.equal(load([search,hidden,e]).findComposer(),e);});
test('ambiguous editors are refused instead of guessing a message target',()=>{assert.equal(load([editor(),editor()]).findComposer(),null);});
test('an existing draft is never overwritten or submitted',async()=>{const e=editor();e.innerText='An unsent owner draft';e.focus=()=>{throw Error('Must not focus an existing draft')};const result=await load([e]).run('Public question','writer');assert.match(result.error,/existing draft/);});
test('reply fallback requires an assistant heading, excluding user articles',()=>{
  const user={querySelectorAll:()=>[{textContent:'You said:'}]},assistant={querySelectorAll:()=>[{textContent:'ChatGPT said:'}]};
  const api=load([],{querySelectorAll:s=>s==='article'?[user,assistant]:[]});assert.deepEqual(Array.from(api.findReplies()),[assistant]);
});
