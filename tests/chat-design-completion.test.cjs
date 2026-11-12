"use strict";
/* Deterministic design/source contracts; running them does NOT certify live UX. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
const get=(name)=>fs.readFileSync(path.join(ROOT,name),"utf8");
const html=get("offline_desktop/static/index.html");
const js=get("offline_desktop/static/app.js");
const css=get("offline_desktop/static/design_polish.css");
const db=get("offline_desktop/engine/chat_sessions.py");
const app=get("offline_desktop/app.py");
const core=get("offline_desktop/engine/core.py");
const offline=get("offline_desktop/static/sw.js");

test("Chat sidebar, search and inspector controls are real DOM nodes",()=>{
  const ids=["chatContextToggle","chatMessageSearch","chatSearchAll","chatSearchStatus",
    "chatHistoryResults","chatCloseSearch","chatHistoryMatches",
    "chatDetailsPanel","chatInspectorTask","chatInspectorCode","chatDetailsContent",
    "chatComposer","chatComposerStatus","submitTask"];
  for(const id of ids)assert.ok(html.includes('id="'+id+'"'),id);
  assert.equal(new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1])).size,
    [...html.matchAll(/id="([^"]+)"/g)].length);
  assert.match(html,/aria-pressed="false"/);
  assert.match(html,/aria-live="polite"/);
});

test("Context is user-approved, bounded and opt-in at the database and engine",()=>{
  assert.ok(db.includes("include_context INTEGER NOT NULL DEFAULT 0"));
  assert.ok(db.includes("def context_for_new_task(session_id)"));
  assert.ok(db.includes("t.status='completed'"));
  assert.ok(db.includes("j.session_id=?"));
  assert.ok(db.includes("LIMIT 3"));
  assert.ok(core.includes("len(context_snapshot)>3200"));
  assert.ok(core.includes("untrusted reference data"));
  assert.ok(core.includes("output=infer(job['prompt'],job['role'],context_snapshot=snapshot)"));
  assert.ok(app.includes("payload.get('confirmed') is not True"));
  assert.ok(app.includes("chat_sessions.set_context("));
  assert.ok(js.includes("chat/sessions/context"));
  assert.ok(js.includes("Off by default; no external website or tool is authorized"));
});

test("Full history remains local and does not expose the raw context snapshot",()=>{
  assert.ok(app.includes("'/api/chat/search'"));
  assert.ok(app.includes("'/api/chat/task'"));
  assert.ok(db.includes("def search_history(query, session_id=None)"));
  assert.ok(db.includes("source"));
  assert.ok(db.includes('"remote_search_performed":False'));
  assert.ok(db.includes("LIMIT 25"));
  assert.ok(db.includes("CASE WHEN length(t.context_snapshot)>0"));
  assert.ok(core.includes("AS has_context"));
  assert.ok(js.includes("async function searchSavedTasks()"));
  assert.ok(js.includes("request('chat/task?id='"));
  assert.ok(js.includes("No saved tasks match"));
});

test("Code inspector cannot apply, commit, merge or fake a task linkage",()=>{
  const start=js.indexOf("async function renderCodeInspector()");
  const end=js.indexOf("function renderChatMessages()",start);
  const inspector=js.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.ok(inspector.includes("request('code/plans')"));
  assert.ok(inspector.includes("request('code/plan?id='"));
  assert.ok(inspector.includes("NOT proven actions"));
  assert.doesNotMatch(inspector,/method:'POST'/);
  assert.doesNotMatch(inspector,/\.innerHTML\s*=/);
  assert.ok(inspector.includes("changeView('coding')"));
  assert.ok(js.includes("Editing a new task draft; original task remains unchanged."));
});

test("Shared appearance and responsive interactions honor accessibility settings",()=>{
  assert.ok(html.includes('href="/design_polish.css"'));
  for(const marker of [".chat-filters",".chat-details-tabs",".chat-inspector-diff",
    ".chat-history-results",".chat-composer:focus-within"])assert.ok(css.includes(marker),marker);
  for(const breakpoint of ["max-width:1200px","max-width:850px","max-width:560px",
                           "max-height:640px"])assert.ok(css.includes(breakpoint));
  assert.ok(css.includes("prefers-reduced-motion:reduce"));
  assert.ok(css.includes("forced-colors:active"));
  assert.ok(js.includes("e.key==='Escape'"));
  assert.ok(js.includes("resizeChatComposer"));
  assert.ok(js.includes("setAttribute('aria-busy','true')"));
});

test("New appearance assets are cacheable and integrity verified",()=>{
  assert.ok(offline.includes("'/design_polish.css'"));
  const manifest=get("tools/adaptive_integrity.py");
  assert.ok(manifest.includes('"offline_desktop/static/design_polish.css"'));
  assert.ok(manifest.includes("Stale or tampered SHA-256"));
  assert.ok(!html.includes("cdn.jsdelivr.net"));
  assert.ok(!html.includes("fonts.googleapis.com"));
});
