const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const root = path.join(__dirname, "..", "apps", "chrome-extension");
const ui = fs.readFileSync(path.join(root, "desktop-assist-ui.js"), "utf8");
const html = fs.readFileSync(path.join(root, "home.html"), "utf8");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
test("all desktop controls exist and command routes stay inside the Supervisor", () => {
  for (const match of ui.matchAll(/el\("([^"]+)"\)/g)) assert.ok(html.includes('id="' + match[1] + '"'), match[1]);
  for (const command of ["desktop_windows", "desktop_observe", "desktop_preview", "desktop_execute", "desktop_receipt", "desktop_history"])
    assert.ok(background.includes('case "' + command + '":'), command);
  assert.doesNotMatch(ui, /innerHTML|eval\(/);
});
function context() {
  let listener, nativeCalls = [];
  const scope = {importScripts: () => {}, console,
    GizeBrowserWorkflow: {BrowserWorkflowRunner: class {}},
    TheOrgTaskManager: class {
      async orders() {return {a: {companyId: "demo"}};}
      async native(request) {nativeCalls.push(request); return {ok: true};}
    },
    chrome: {runtime: {id: "extension-id", getURL: name => "chrome-extension://extension-id/" + name,
      onMessage: {addListener: fn => {listener = fn;}}},
      action: {onClicked: {addListener: () => {}}}, tabs: {onRemoved: {addListener: () => {}}}}
  };
  vm.runInNewContext(background, scope);
  const send = (message, sender) => new Promise(resolve => {
    const accepted = listener(message, sender, resolve); if (accepted === false) resolve({rejected: true});
  });
  return {send, nativeCalls};
}
test("web pages and sibling extensions cannot dispatch desktop actions", async () => {
  const f = context();
  for (const sender of [
    {id: "another-extension", url: "chrome-extension://extension-id/home.html"},
    {id: "extension-id", url: "https://example.com/"},
    {id: "extension-id", url: "chrome-extension://extension-id/untrusted.html"}
  ]) {
    const response = await f.send({command: "desktop_execute", taskId: "a"}, sender);
    assert.ok(response.rejected || response.ok === false);
  }
  assert.equal(f.nativeCalls.length, 0);
});
test("Supervisor route binds desktop identity to stored work order and strips supplied shell fields", async () => {
  const f = context();
  const response = await f.send({command: "desktop_execute", taskId: "a", companyId: "victim", orderId: "other",
    actionId: "x", approved: true, fingerprint: "reviewed", shell: "bad", action: {operation: "shell"}},
    {id: "extension-id", url: "chrome-extension://extension-id/home.html#desktopAssist"});
  assert.equal(response.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(f.nativeCalls[0])), {command: "desktop_execute", companyId: "demo",
    orderId: "a", approved: true, fingerprint: "reviewed", actionId: "x"});
});
