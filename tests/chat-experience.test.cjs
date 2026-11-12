"use strict";
/* Real, deterministic DOM-safe Markdown rendering tests without a browser dependency. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const raw=fs.readFileSync(path.join(root,"offline_desktop/static/chat_renderer.js"),"utf8");
const html=fs.readFileSync(path.join(root,"offline_desktop/static/index.html"),"utf8");
const app=fs.readFileSync(path.join(root,"offline_desktop/static/app.js"),"utf8");
const css=fs.readFileSync(path.join(root,"offline_desktop/static/chat_experience.css"),"utf8");
const sw=fs.readFileSync(path.join(root,"offline_desktop/static/sw.js"),"utf8");

function fakeNode(name){
  const n={tagName:name,attributes:{},children:[],className:"",handlers:{},_text:"",type:""};
  Object.defineProperty(n,"childNodes",{get(){return n.children;}});
  Object.defineProperty(n,"textContent",{
    get(){return n._text+n.children.map(x=>x.textContent).join("");},
    set(value){n._text=String(value);n.children=[];}
  });
  n.append=(...children)=>n.children.push(...children);
  n.setAttribute=(key,value)=>n.attributes[key]=String(value);
  n.addEventListener=(name,fn)=>n.handlers[name]=fn;
  return n;
}
function setup(){
  const context={window:{},URL,document:{
    createElement:tag=>fakeNode(tag),
    createTextNode:text=>{const node=fakeNode("#text");node.textContent=text;return node;},
    createDocumentFragment:()=>fakeNode("#fragment")
  }};
  vm.runInNewContext(raw,context,{filename:"chat_renderer.js",timeout:1000});
  return context.window.TheOrgChatRenderer;
}
function walk(root){
  return [root,...(root.children||[]).flatMap(walk)];
}

test("Markdown parser never instantiates arbitrary HTML or executes event attributes",()=>{
  const renderer=setup();
  const x=renderer.render("<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>");
  const nodes=walk(x);
  assert.ok(nodes.every(n=>!["script","img"].includes(n.tagName)));
  assert.match(x.textContent,/<script>alert\(1\)<\/script>/);
  assert.match(x.textContent,/<img src=x onerror=alert\(1\)>/);
  assert.equal(raw.includes("innerHTML"),false);
  assert.equal(raw.includes("insertAdjacentHTML"),false);
});

test("Markdown links allow explicit http(s) without credentials or javascript URLs",()=>{
  const renderer=setup();
  const x=renderer.render("[Docs](https://example.com/guide) [bad](javascript:alert(1)) [secret](https://user:pass@example.com/)");
  const links=walk(x).filter(n=>n.tagName==="a");
  assert.equal(links.length,1);
  assert.equal(links[0].href,"https://example.com/guide");
  assert.equal(links[0].target,"_blank");
  assert.equal(links[0].rel,"noopener noreferrer");
  assert.match(x.textContent,/javascript:/);
});

test("Fenced code is preformatted, copyable and never interpreted",()=>{
  const renderer=setup(),copied=[];
  const tick=String.fromCharCode(96);
  const source="console.log('<unsafe>');";
  const message=[tick.repeat(3)+"js",source,tick.repeat(3)].join("\n");
  const x=renderer.render(message,value=>copied.push(value));
  const code=walk(x).find(n=>n.tagName==="code");
  const button=walk(x).find(n=>n.tagName==="button");
  assert.equal(code.textContent,source);
  assert.ok(button);
  button.handlers.click();
  assert.equal(copied[0],source);
  assert.equal(renderer.codeSummary(message)[0].language,"js");
});

test("Diffs and lists use safe, readable DOM elements",()=>{
  const renderer=setup();
  const tick=String.fromCharCode(96);
  const message=["# Update","- fixed editor","- preserved tasks","",
    tick.repeat(3)+"diff","+console.log('new')","-console.log('old')",tick.repeat(3)].join("\n");
  const x=renderer.render(message);
  const nodes=walk(x);
  assert.ok(nodes.some(n=>n.tagName==="h3"));
  assert.ok(nodes.some(n=>n.tagName==="ul"));
  assert.ok(nodes.some(n=>n.className.includes("chat-diff-add")));
  assert.ok(nodes.some(n=>n.className.includes("chat-diff-remove")));
});

test("Session controls, output details and offline cache are wired",()=>{
  for(const id of ["sessionList","sessionSearch","newChatButton","activeSessionTitle",
                    "sessionRename","sessionArchive","chatAllTasks","chatDetailsPanel",
                    "chatDetailsToggle","chatDetailsClose","chatJumpBottom"]){
    assert.ok(html.includes('id="'+id+'"'),"Missing UI control: "+id);
  }
  assert.ok(html.indexOf("/chat_renderer.js")<html.indexOf("/app.js"));
  assert.ok(html.includes('/chat_experience.css'));
  for(const expression of ["chat/sessions","chat/session/tasks","chat/sessions/archive",
                           "chat/sessions/rename","TheOrgChatRenderer.render",
                           "function renderChatMessages","function openChatDetails"]){
    assert.ok(app.includes(expression),"Missing linked feature: "+expression);
  }
  assert.ok(app.includes("Previous messages are not automatically"));
  assert.ok(app.includes("No verified model response available."));
  assert.ok(sw.includes("/chat_renderer.js")&&sw.includes("/chat_experience.css"));
  assert.ok(sw.includes("u.pathname.startsWith('/api/')"));
});

test("Layout has responsive task rail and mobile evidence drawer",()=>{
  assert.ok(css.includes("@media(max-width:1050px)"));
  assert.ok(css.includes("@media(max-width:560px)"));
  assert.ok(css.includes(".recent-sessions"));
  assert.ok(css.includes(".chat-details-panel"));
  assert.ok(css.includes(".chat-code-block"));
  assert.ok(css.includes(":focus-visible"));
  assert.ok(css.includes("prefers-reduced-motion"));
});
