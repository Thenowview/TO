/* Selected-window accessibility controls. The app never injects arbitrary shell commands. */
(() => {
  "use strict";
  const el = id => document.getElementById(id);
  let windows = [], controls = [], observedWindow = null, proposal = null, activeAction = null;
  const send = async (command, extra = {}) => {
    const taskId = el("browserWorkflowOrder").value;
    const reply = await chrome.runtime.sendMessage({command, taskId, ...extra});
    if (!reply?.ok) throw new Error(reply?.detail || reply?.error || "Windows controller unavailable");
    return reply;
  };
  const show = value => { el("desktopAssistResult").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2); };
  const invalidate = () => { proposal = null; el("desktopAssistRun").disabled = true; };
  function busy(value) {
    for (const id of ["desktopAssistWindows", "desktopAssistWindow", "desktopAssistObserve", "desktopAssistControl",
      "desktopAssistOperation", "desktopAssistValue", "desktopAssistExpected", "desktopAssistPreview", "desktopAssistDraft",
      "desktopAssistModel", "browserWorkflowOrder", "browserWorkflowRefresh"]) el(id).disabled = value;
    el("desktopAssistStop").disabled = !value;
  }
  function options(select, values, label) {
    select.replaceChildren();
    values.forEach((value, index) => {
      const option = document.createElement("option"); option.value = String(index); option.textContent = label(value); select.append(option);
    });
  }
  function clearObservation() {
    invalidate(); observedWindow = null; controls = [];
    options(el("desktopAssistControl"), [], () => "");
  }
  el("browserWorkflowOrder").addEventListener("change", clearObservation);
  el("desktopAssistWindow").addEventListener("change", clearObservation);
  for (const id of ["desktopAssistControl", "desktopAssistOperation", "desktopAssistValue", "desktopAssistExpected"])
    el(id).addEventListener("input", invalidate);
  el("desktopAssistWindows").addEventListener("click", async () => {
    try {
      clearObservation(); const result = await send("desktop_windows"); windows = result.windows || [];
      options(el("desktopAssistWindow"), windows, window => window.title + " (process " + window.processId + ")");
      show(windows.length ? "Choose an application window, then inspect its available controls." : "No accessible application windows found.");
    } catch (e) { show(e.message); }
  });
  el("desktopAssistObserve").addEventListener("click", async () => {
    try {
      clearObservation(); const window = windows[Number(el("desktopAssistWindow").value)];
      if (!window) throw new Error("Select an application window first");
      const result = await send("desktop_observe", {window});
      observedWindow = result.window; controls = result.controls || [];
      options(el("desktopAssistControl"), controls, control => control.name + " — " + control.controlType +
        (control.canSetValue ? " · text entry" : "") + (control.canInvoke ? " · action" : ""));
      show({window: result.window, controls: result.controls, valuesRead: false});
    } catch (e) { show(e.message); }
  });
  el("desktopAssistDraft").addEventListener("click", async () => {
    const scope = el("browserWorkflowOrder").value;
    try {
      invalidate(); const window = windows[Number(el("desktopAssistWindow").value)];
      if (!window) throw new Error("Choose an application window first");
      show("Observing the selected application and drafting steps from your work order with the local model. No action is executing.");
      const draft = await send("desktop_draft_plan", {window, model: el("desktopAssistModel").value.trim(), taskId: scope});
      if (scope !== el("browserWorkflowOrder").value) throw new Error("Work order changed while planning; draft again in the selected workspace");
      proposal = {...await send("desktop_preview", {action: draft.action, taskId: scope}), taskId: scope};
      show({review: proposal.action, fingerprint: proposal.fingerprint,
        notice: "Review every proposed application action. Approve and run executes only this exact plan."});
      el("desktopAssistRun").disabled = false;
    } catch (e) { show(e.message); }
  });
  el("desktopAssistPreview").addEventListener("click", async () => {
    const scope = el("browserWorkflowOrder").value;
    try {
      invalidate(); const control = controls[Number(el("desktopAssistControl").value)];
      if (!observedWindow || !control) throw new Error("Inspect the application and choose a control first");
      const operation = el("desktopAssistOperation").value;
      if ((operation === "set_value" && !control.canSetValue) || (operation === "invoke" && !control.canInvoke))
        throw new Error("This control does not support the selected action");
      const action = {operation, window: observedWindow,
        target: {runtimeId: control.runtimeId, name: control.name, controlType: control.controlType}};
      if (operation === "set_value") action.value = el("desktopAssistValue").value;
      else action.expectedText = el("desktopAssistExpected").value;
      const prepared = await send("desktop_preview", {action, taskId: scope});
      if (scope !== el("browserWorkflowOrder").value) throw new Error("Work order changed during review; inspect and review again");
      proposal = {...prepared, taskId: scope};
      show({review: proposal.action, fingerprint: proposal.fingerprint,
        notice: "Review the exact application, control and input. Approve and run performs this action on your PC."});
      el("desktopAssistRun").disabled = false;
    } catch (e) { show(e.message); }
  });
  el("desktopAssistRun").addEventListener("click", async () => {
    if (!proposal) return;
    const action = proposal; activeAction = action; invalidate();
    busy(true);
    try {
      show("Executing the reviewed action. If interrupted, inspect the application and receipt before creating a new action.");
      const reply = await chrome.runtime.sendMessage({command: "desktop_execute", taskId: action.taskId,
        actionId: action.actionId, fingerprint: action.fingerprint, approved: true});
      if (!reply?.ok) throw new Error(reply?.error || "Desktop action unavailable");
      show(reply); clearObservation();
    } catch (e) { show(e.message + ". The action may already have occurred; do not automatically retry."); }
    finally { busy(false); }
  });
  el("desktopAssistStop").addEventListener("click", async () => {
    if (!activeAction) return;
    try { show(await send("desktop_stop", {taskId: activeAction.taskId, actionId: activeAction.actionId})); }
    catch (e) { show(e.message); }
  });
  el("desktopAssistReceipt").addEventListener("click", async () => {
    try {
      if (!activeAction) { show(await send("desktop_history")); return; }
      const reply = await chrome.runtime.sendMessage({command: "desktop_receipt", taskId: activeAction.taskId, actionId: activeAction.actionId});
      show(reply);
    } catch (e) { show(e.message); }
  });
})();
