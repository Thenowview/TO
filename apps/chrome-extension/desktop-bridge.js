/* Standalone WebView2 adapter. Provider tabs never receive this bridge. */
(() => {
  "use strict";
  if (!globalThis.chrome?.webview || location.origin !== "https://gize.local") return;
  globalThis.GizeDesktopSurface = true;
  const pending = new Map();
  const host = (channel, payload) => new Promise((resolve, reject) => {
    const id = crypto.randomUUID().replaceAll("-", "");
    const timer = setTimeout(() => {pending.delete(id); reject(new Error("GIZE request timed out; inspect history before retrying"));}, 180000);
    pending.set(id, {resolve, reject, timer}); chrome.webview.postMessage({id, channel, payload});
  });
  chrome.webview.addEventListener("message", event => {
    const request = pending.get(event.data?.id); if (!request) return;
    pending.delete(event.data.id); clearTimeout(request.timer);
    if (event.data.ok) request.resolve(event.data.result); else request.reject(new Error(event.data.error || "Desktop request failed"));
  });
  function storage(area) {
    const target = area === "session" ? sessionStorage : localStorage;
    return {async get(key) {return {[key]: JSON.parse(target.getItem(key) || "null")};},
      async set(values) {for (const [key, value] of Object.entries(values)) target.setItem(key, JSON.stringify(value));}};
  }
  const areas = {local: storage("local"), session: storage("session")};
  function scoped(taskId) {
    const request = (operation, fields = {}) => host("browser", {taskId, operation, ...fields});
    return {storage: areas,
      permissions: {contains: value => request("permission_contains", value), request: value => request("permission_request", value)},
      tabs: {create: value => request("tabs_create", value), get: tabId => request("tabs_get", {tabId})},
      scripting: {executeScript: value => request("script", {tabId: value.target.tabId,
        kind: value.func.name, input: value.args[0]})}};
  }
  let runner;
  const sendMessage = async message => {
    try {
      if (message.command.startsWith("browser_workflow_") && message.command !== "browser_workflow_draft") {
        // Native validates job ownership even for local record operations.
        const selected = await host("app", {command: "select_job", taskId: message.taskId});
        if (!selected.ok) return selected;
        runner ||= new GizeBrowserWorkflow.BrowserWorkflowRunner({storage: areas, forTask: scoped});
        switch (message.command) {
          case "browser_workflow_inspect": return {ok: true, ...await runner.inspect(message.taskId, message.url)};
          case "browser_workflow_create": return {ok: true, workflow: await runner.create(message.taskId, message.plan, message.sessionId)};
          case "browser_workflow_list": return {ok: true, workflows: await runner.list(message.taskId)};
          case "browser_workflow_get": return {ok: true, workflow: await runner.get(message.taskId, message.workflowId)};
          case "browser_workflow_stop": await runner.get(message.taskId, message.workflowId); return {ok: true, ...runner.stop(message.taskId, message.workflowId)};
          case "browser_workflow_run": return {ok: true, workflow: await runner.run(message.taskId, message.workflowId, message.fingerprint)};
          default: throw new Error("Unknown browser workflow command");
        }
      }
      return await host("app", message);
    } catch (error) {return {ok: false, error: error.message};}
  };
  chrome.runtime = {sendMessage, getURL: path => new URL(path, location.href).href};
  chrome.storage = areas;
  chrome.permissions = {request: value => scoped(document.getElementById("browserWorkflowOrder").value).permissions.request(value)};
})();
