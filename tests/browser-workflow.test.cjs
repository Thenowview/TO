const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const {BrowserWorkflowRunner, validatePlan, permissions, pageOperation} = require("../apps/chrome-extension/browser-workflow.js");
const task = "a".repeat(32);
function plan(steps = [{action: "read", selector: "h1"}]) {
  return {title: "Complete a bounded browser task", url: "https://example.com/", steps};
}
function fixture() {
  let data = {}, grants = true, url = "https://example.com/", calls = 0, creates = 0;
  const api = {
    storage: {local: {get: async () => structuredClone(data), set: async value => { data = structuredClone(value); }}},
    permissions: {contains: async () => grants},
    tabs: {create: async () => { creates++; return {id: 42}; }, get: async () => ({id: 42, url, status: "complete"})},
    scripting: {executeScript: async args => { calls++; return [{frameId: 0, result: {ok: true, verified: args.args[0].step.action}}]; }}
  };
  return {api, runner: new BrowserWorkflowRunner(api), calls: () => calls, creates: () => creates,
    deny: () => { grants = false; }, navigate: value => { url = value; }};
}
test("plans reject executable commands, unknown fields and unsafe origins", () => {
  for (const input of [
    {...plan(), url: "http://example.com/"}, {...plan(), url: "https://user:secret@example.com/"},
    {...plan(), url: "https://127.0.0.1/"}, {...plan(), url: "https://pc.local/"},
    {...plan(), url: "https://example.com:8443/"}, {...plan(), script: "alert(1)"},
    plan([{action: "shell", selector: "body"}]), plan([{action: "read", selector: "body", value: "bad"}]),
    {...plan(), steps: Array(21).fill({action: "read", selector: "h1"})}
  ]) assert.throws(() => validatePlan(input));
  assert.deepEqual(permissions(validatePlan(plan())), {permissions: ["scripting"], origins: ["https://example.com/*"]});
});
test("each click requires an immediately following outcome assertion", async () => {
  const {runner} = fixture();
  await assert.rejects(runner.create(task, plan([{action: "click", selector: "button", expectedText: "Save"}])));
});
test("no tab or action runs before exact-plan approval and runtime permission", async () => {
  const f = fixture(), record = await f.runner.create(task, plan());
  assert.equal(f.creates(), 0);
  await assert.rejects(f.runner.run(task, record.id, "wrong"), /changed/);
  f.deny(); await assert.rejects(f.runner.run(task, record.id, record.fingerprint), /Grant/);
  assert.equal(f.creates(), 0); assert.equal(f.calls(), 0);
});
test("approved steps run in sequence with persisted receipts and no native bridge dependency", async () => {
  const f = fixture(), record = await f.runner.create(task, plan([
    {action: "fill", selector: "#name", value: "Synthetic test"},
    {action: "click", selector: "#save", expectedText: "Save"},
    {action: "wait_text", selector: "#status", expectedText: "Saved"}
  ]));
  const done = await f.runner.run(task, record.id, record.fingerprint);
  assert.equal(done.status, "completed_assertions_passed"); assert.equal(done.receipts.length, 3);
  assert.equal((await f.runner.get(task, record.id)).nextStep, 3);
  await assert.rejects(f.runner.run(task, record.id, record.fingerprint), /replayed/);
  assert.equal(f.calls(), 3); assert.equal(f.creates(), 1);
});
test("failed mutating action is not retried or reported complete", async () => {
  const f = fixture(); let attempts = 0;
  f.api.scripting.executeScript = async () => { attempts++; throw new Error("Tab closed during fill"); };
  const record = await f.runner.create(task, plan([{action: "fill", selector: "#name", value: "Test"}]));
  const done = await f.runner.run(task, record.id, record.fingerprint);
  assert.equal(done.status, "blocked_review_required"); assert.equal(done.outcomeUnknown, true);
  assert.equal(attempts, 1); assert.equal(done.receipts.length, 0);
  await assert.rejects(f.runner.run(task, record.id, record.fingerprint), /replayed/);
});
test("cross-site redirects are blocked before any page injection", async () => {
  const f = fixture(), record = await f.runner.create(task, plan()); f.navigate("https://other.example.org/");
  const done = await f.runner.run(task, record.id, record.fingerprint);
  assert.equal(done.status, "blocked_review_required"); assert.equal(f.calls(), 0);
});
test("another work order cannot read, approve or execute a workflow", async () => {
  const f = fixture(), record = await f.runner.create(task, plan());
  await assert.rejects(f.runner.get("b".repeat(32), record.id), /belong/);
  await assert.rejects(f.runner.run("b".repeat(32), record.id, record.fingerprint), /belong/);
});
test("concurrent run requests execute the reviewed workflow once", async () => {
  const f = fixture(), record = await f.runner.create(task, plan());
  const results = await Promise.allSettled([f.runner.run(task, record.id, record.fingerprint), f.runner.run(task, record.id, record.fingerprint)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1); assert.equal(f.creates(), 1);
});
test("restart never replays an in-flight action", async () => {
  const f = fixture(), record = await f.runner.create(task, plan());
  record.status = "running"; record.inFlight = {index: 0, action: "click"}; await f.runner.save(record);
  const restarted = new BrowserWorkflowRunner(f.api);
  await assert.rejects(restarted.run(task, record.id, record.fingerprint), /replayed/);
  assert.equal(f.calls(), 0); assert.equal(f.creates(), 0);
});
test("receipt history remains accessible by work order after UI restart", async () => {
  const f = fixture(), record = await f.runner.create(task, plan());
  await f.runner.run(task, record.id, record.fingerprint);
  const history = await new BrowserWorkflowRunner(f.api).list(task);
  assert.equal(history.length, 1); assert.equal(history[0].receipts.length, 1);
  assert.deepEqual(await f.runner.list("b".repeat(32)), []);
});
test("persisted plan tampering invalidates the original approval fingerprint", async () => {
  const f = fixture(), record = await f.runner.create(task, plan());
  record.plan.steps[0].selector = "#other"; await f.runner.save(record);
  await assert.rejects(f.runner.run(task, record.id, record.fingerprint), /changed/);
  assert.equal(f.creates(), 0);
});
test("revoking site access mid-workflow stops before the next operation", async () => {
  const f = fixture(), record = await f.runner.create(task, plan([
    {action: "read", selector: "h1"}, {action: "read", selector: "h2"}
  ]));
  let calls = 0;
  f.api.scripting.executeScript = async () => {
    calls++; f.deny(); return [{frameId: 0, result: {ok: true, verified: "visible_text_read"}}];
  };
  const done = await f.runner.run(task, record.id, record.fingerprint);
  assert.equal(done.status, "blocked_review_required"); assert.equal(calls, 1);
  assert.equal(done.receipts.length, 1);
});
test("stop takes effect before the next action", async () => {
  const f = fixture(), record = await f.runner.create(task, plan());
  f.runner.stop(task, record.id);
  const done = await f.runner.run(task, record.id, record.fingerprint);
  assert.equal(done.status, "stopped"); assert.equal(f.calls(), 0);
});
function inspectionFixture() {
  const f = fixture(); let session = {};
  f.api.storage.session = {get: async () => structuredClone(session), set: async value => {session = {...session, ...structuredClone(value)};}};
  f.api.scripting.executeScript = async args => [{frameId: 0, result: args.func.name === "inspectPage" ?
    {ok: true, url: "https://example.com/", title: "Synthetic site", controls: [], fieldValuesRead: false} :
    {ok: true, verified: "visible_text_read"}}];
  return f;
}
test("observed-page workflow reuses its own inspected tab instead of losing page state", async () => {
  const f = inspectionFixture(), inspected = await f.runner.inspect(task, "https://example.com/");
  const record = await f.runner.create(task, plan(), inspected.sessionId);
  const done = await f.runner.run(task, record.id, record.fingerprint);
  assert.equal(done.status, "completed_assertions_passed"); assert.equal(f.creates(), 1);
});
test("inspection requires permission and cannot bind an unrelated task or arbitrary tab", async () => {
  const denied = inspectionFixture(); denied.deny();
  await assert.rejects(denied.runner.inspect(task, "https://example.com/"), /Grant/);
  assert.equal(denied.creates(), 0);
  const f = inspectionFixture(), inspected = await f.runner.inspect(task, "https://example.com/");
  await assert.rejects(f.runner.create("b".repeat(32), plan(), inspected.sessionId), /another task/);
  await assert.rejects(f.runner.create(task, plan(), "c".repeat(32)), /expired/);
});
test("moved or expired inspected pages are not silently replaced or executed", async () => {
  const f = inspectionFixture(), inspected = await f.runner.inspect(task, "https://example.com/");
  const record = await f.runner.create(task, plan(), inspected.sessionId);
  f.navigate("https://example.com/other-page");
  assert.equal((await f.runner.run(task, record.id, record.fingerprint)).status, "blocked_review_required");
  assert.equal(f.creates(), 1);
  const restarted = inspectionFixture(), snapshot = await restarted.runner.inspect(task, "https://example.com/");
  const pending = await restarted.runner.create(task, plan(), snapshot.sessionId);
  restarted.api.storage.session = {get: async () => ({})};
  assert.equal((await restarted.runner.run(task, pending.id, pending.fingerprint)).status, "blocked_review_required");
  assert.equal(restarted.creates(), 1);
});
test("page inspection never reads input values into model observations", () => {
  const {inspectPage} = require("../apps/chrome-extension/browser-workflow.js");
  class Input {} class Button {} class Anchor {} class Textarea {}
  const input = new Input(); Object.assign(input, {id: "query", type: "text", labels: [{innerText: "Query"}],
    closest: () => null, getAttribute: () => null, getClientRects: () => [{}]});
  Object.defineProperty(input, "value", {get() { throw new Error("Input values must not be read"); }});
  const context = {location: {origin: "https://example.com", href: "https://example.com/"},
    document: {title: "Synthetic", body: {innerText: "Visible page"}, querySelectorAll: () => [input]},
    CSS: {escape: s => s}, getComputedStyle: () => ({display: "block", visibility: "visible"}),
    HTMLInputElement: Input, HTMLButtonElement: Button, HTMLAnchorElement: Anchor, HTMLTextAreaElement: Textarea};
  const result = vm.runInNewContext("(" + inspectPage.toString() + ")", context)({origin: "https://example.com"});
  assert.equal(result.ok, true); assert.equal(result.fieldValuesRead, false);
  assert.equal(result.controls[0].selector, "#query"); assert.equal(result.controls[0].canFill, true);
});
// Small deterministic DOM fixture exercises the serialized content function itself.
// These are component checks, not physical Chrome acceptance.
function dom({count = 1, hidden = false, privateField = false, label = "Save", action = "read", expectedText = "Save"} = {}) {
  let clicks = 0;
  class Input {} class Textarea {} class Anchor {} class Button {}
  const el = new Button(); Object.assign(el, {isConnected: true, innerText: label,
    closest: selector => selector.startsWith("input") ? privateField : hidden,
    getClientRects: () => hidden ? [] : [{}], getAttribute: () => null,
    click: () => { clicks++; }});
  const context = {location: {origin: "https://example.com", href: "https://example.com/"},
    document: {querySelectorAll: () => Array(count).fill(el)},
    getComputedStyle: () => ({visibility: "visible", display: "block"}),
    HTMLInputElement: Input, HTMLTextAreaElement: Textarea, HTMLAnchorElement: Anchor, HTMLButtonElement: Button, URL};
  const result = vm.runInNewContext("(" + pageOperation.toString() + ")", context)({
    origin: "https://example.com", step: {action, selector: "#target", expectedText}});
  return {result, clicks};
}
test("DOM operation refuses ambiguous, hidden, private and changed-label targets", () => {
  for (const options of [{count: 2}, {count: 0}, {hidden: true}, {privateField: true},
    {action: "click", label: "Delete everything", expectedText: "Save"}]) {
    const check = dom(options); assert.equal(check.result.ok, false); assert.equal(check.clicks, 0);
  }
});
test("DOM click is only a dispatched receipt and text assertions independently check the page", () => {
  const click = dom({action: "click"}); assert.equal(click.clicks, 1);
  assert.equal(click.result.verified, "click_dispatched_only");
  assert.equal(dom({action: "wait_text", label: "Saved successfully", expectedText: "Saved"}).result.ok, true);
  assert.equal(dom({action: "wait_text", label: "Still saving", expectedText: "Saved"}).result.ok, false);
});

test("browser workflow UI bindings exist and all commands are routed", () => {
  const fs = require("node:fs"), path = require("node:path");
  const root = path.join(__dirname, "..", "apps", "chrome-extension");
  const html = fs.readFileSync(path.join(root, "home.html"), "utf8");
  const ui = fs.readFileSync(path.join(root, "browser-workflow-ui.js"), "utf8");
  const bg = fs.readFileSync(path.join(root, "background.js"), "utf8");
  for (const match of ui.matchAll(/byId\("([^"]+)"\)/g)) assert.ok(html.includes('id="' + match[1] + '"'), match[1]);
  for (const match of ui.matchAll(/send\("(browser_workflow_[a-z]+)"/g)) assert.ok(bg.includes('case "' + match[1] + '":'), match[1]);
  assert.ok(bg.includes('sender.url.split(/[?#]/)[0] !== chrome.runtime.getURL("home.html")'));
  assert.match(ui, /chrome\.permissions\.request\(GizeBrowserWorkflow\.permissions\(reviewed\.plan\)\)/);
  assert.doesNotMatch(ui, /innerHTML|eval\(/);
});

test("DOM fill uses the native value setter and verifies readback without storing entered text in its receipt", () => {
  let value = "", events = [];
  class Input {
    get value() { return value; }
    set value(next) { value = next; }
  }
  const el = new Input(); Object.assign(el, {type: "text", isConnected: true, closest: () => null,
    getClientRects: () => [{}], getAttribute: () => null, dispatchEvent: event => events.push(event.type)});
  const context = {location: {origin: "https://example.com"}, document: {querySelectorAll: () => [el]},
    getComputedStyle: () => ({visibility: "visible", display: "block"}), HTMLInputElement: Input,
    HTMLTextAreaElement: class {}, Event: class {constructor(type) {this.type = type;}}};
  const perform = vm.runInNewContext("(" + pageOperation.toString() + ")", context);
  const result = perform({origin: "https://example.com", step: {action: "fill", selector: "#name", value: "Synthetic name"}});
  assert.equal(value, "Synthetic name"); assert.deepEqual(events, ["input", "change"]);
  assert.equal(result.verified, "field_value_read_back"); assert.ok(!JSON.stringify(result).includes("Synthetic name"));
});
