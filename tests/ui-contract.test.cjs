/* Static Supervisor UI contract checks; not browser E2E tests. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..","apps","chrome-extension");
const html=fs.readFileSync(path.join(root,"home.html"),"utf8");
const ui=fs.readFileSync(path.join(root,"home.js"),"utf8");
const background=fs.readFileSync(path.join(root,"background.js"),"utf8");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.json"),"utf8"));

test("Supervisor HTML provides every ID accessed by the client",()=>{
 const identifiers=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
 const present=new Set(identifiers);
 const requested=new Set([...ui.matchAll(/\$\("([^"]+)"\)/g)].map(m=>m[1]));
 const missing=[...requested].filter(id=>!present.has(id));
 assert.deepEqual(missing,[],"Missing DOM elements: "+missing.join(","));
 assert.equal(identifiers.length,present.size,"HTML IDs must be unique");
 assert.ok(requested.size>=25,"Supervisor must have substantive UI bindings");
});

test("all UI scripts and styles are locally packaged",()=>{
 const assets=[...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/g)]
  .map(m=>m[1]);
 assert.ok(assets.includes("home.js"));
 assert.ok(assets.includes("home.css"));
 for(const name of assets){
  assert.ok(!/^(?:https?:|\/\/)/.test(name),"Remote UI assets are not permitted");
  assert.ok(fs.existsSync(path.join(root,name)),"Missing package asset: "+name);
 }
 assert.equal(manifest.manifest_version,3);
 assert.equal(manifest.background.service_worker,"background.js");
});

test("all Supervisor commands are routed by the extension background",()=>{
 const calls=[...ui.matchAll(/\brpc\("([^"]+)"/g)].map(m=>m[1]);
 const routes=new Set([...background.matchAll(/case "([^"]+)":/g)].map(m=>m[1]));
 const missing=[...new Set(calls)].filter(c=>!routes.has(c));
 assert.deepEqual(missing,[],"Unrouted commands: "+missing.join(","));
 assert.ok(routes.has("execution_queue"));
 assert.ok(routes.has("dispatch_next"));
 assert.ok(routes.has("get_qa_packet"));
});
