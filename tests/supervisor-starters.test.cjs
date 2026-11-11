/* Supervisor prompt-starter regression: Node built-in tests, no Chrome/network required. */
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ext=path.join(__dirname,"..","apps","chrome-extension");
const starters=require(path.join(ext,"supervisor-starters.js"));
const html=fs.readFileSync(path.join(ext,"home.html"),"utf8");
const ui=fs.readFileSync(path.join(ext,"home.js"),"utf8");

test("Starter catalog is versioned, unique and bounded for the existing work-order API",()=>{
  assert.match(starters.version,/^\d{4}-\d{2}-\d{2}\.\d+$/);
  assert.equal(starters.templates.length,14);
  assert.equal(new Set(starters.templates.map(x=>x.id)).size,14);
  for(const template of starters.templates){
    assert.ok(starters.categories.includes(template.category));
    assert.ok(template.prompt.length>=100);
    const instruction=starters.prepare(template.id);
    assert.ok(instruction.length>=5&&instruction.length<=5000);
    assert.match(instruction,/acceptance/i);
    assert.match(instruction,/approval|authorize/i);
    assert.match(instruction,/without.*claim|never invent|distinguish/i);
  }
});

test("Prompts never submit to external services or approve actions by selecting a template",()=>{
  const source=fs.readFileSync(path.join(ext,"supervisor-starters.js"),"utf8");
  assert.doesNotMatch(source,/chrome\.tabs\.create|chrome\.runtime\.sendMessage|fetch\(|XMLHttpRequest|\.submit\(/);
  assert.ok(ui.includes('$("ownerInstruction").value=instruction;'));
  assert.ok(ui.includes('registerSupervisorStarters();'));
  assert.ok(html.includes('src="supervisor-starters.js"'));
  assert.ok(html.includes('id="starterList"'));
  assert.ok(html.includes('id="starterFocus"'));
});

test("Prompt searching and category filtering are deterministic",()=>{
  assert.ok(starters.list({category:"Build"}).some(x=>x.id==="bug"));
  assert.deepEqual(starters.list({query:"non-existent-needle"}),[]);
  assert.ok(starters.list({query:"email"}).some(x=>x.id==="email"));
  assert.ok(starters.list({category:"Operate"}).every(x=>x.category==="Operate"));
  assert.throws(()=>starters.list({category:"unknown"}),/category/i);
  assert.throws(()=>starters.list({query:"a".repeat(121)}),/120/);
});

test("Focus is optional, literal and bounded",()=>{
  const focus="TheOrg Windows coding engine";
  assert.match(starters.prepare("bug",focus),/TheOrg Windows coding engine/);
  assert.throws(()=>starters.prepare("unknown"),/Unknown prompt/);
  assert.throws(()=>starters.prepare("bug","a".repeat(241)),/240/);
});

test("Online adviser handoff explicitly copies then opens without auto-submitting",()=>{
  assert.ok(ui.includes('navigator.clipboard.writeText(prepared.prompt)'));
  assert.ok(ui.includes('rpc("open_supervisor_tab"'));
  assert.ok(ui.includes('p.kind === "ai-chat"'));
  assert.ok(ui.includes('app.providers[providerId]?.kind !== "ai-chat"'));
  assert.ok(html.includes("Copy prompt &amp; open AI chat"));
  assert.doesNotMatch(ui,/executeScript\(/);
});
