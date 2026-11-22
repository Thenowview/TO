/* Extension-owned UI only; page contents never become instructions or executable code. */
(() => {
  "use strict";
  const byId = id => document.getElementById(id);
  let reviewed = null;
  let active = null;
  let inspectionSession = null;
  const send = async (command, payload = {}) => {
    const result = await chrome.runtime.sendMessage({command, ...payload});
    if (!result?.ok) throw new Error(result?.error || "Browser workflow unavailable");
    return result;
  };
  function show(value) { byId("browserWorkflowResult").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2); }
  async function taskId() {
    const id = byId("browserWorkflowOrder").value;
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error("Choose an existing work order");
    return id;
  }
  function invalidate() {
    reviewed = null;
    byId("browserWorkflowGrant").disabled = true;
    byId("browserWorkflowRun").disabled = true;
  }
  byId("browserWorkflowPlan").addEventListener("input", invalidate);
  byId("browserWorkflowOrder").addEventListener("change", () => { inspectionSession = null; invalidate(); });
  byId("browserWorkflowDraft").addEventListener("click", () => {
    try {
      invalidate(); inspectionSession = null;
      const scope = byId("browserWorkflowOrder").value;
      if (!/^[a-f0-9]{32}$/.test(scope)) throw new Error("Choose a work order first");
      const plan = GizeBrowserWorkflow.validatePlan({title: "Inspect and plan selected site",
        url: byId("browserWorkflowUrl").value.trim(), steps: [{action: "read", selector: "body"}]});
      const model = byId("browserWorkflowModel").value.trim();
      // The permission request starts directly in this user gesture.
      chrome.permissions.request(GizeBrowserWorkflow.permissions(plan)).then(async granted => {
        if (!granted) { show("Site access declined; no inspection or action ran."); return; }
        byId("browserWorkflowDraft").disabled = true;
        try {
          show("Inspecting the selected site and drafting task steps with your local model. No page action is executing.");
          const inspected = await send("browser_workflow_inspect", {taskId: scope, url: plan.url});
          const draft = await send("browser_workflow_draft", {taskId: scope, url: plan.url, model, observation: inspected.observation});
          if (scope !== byId("browserWorkflowOrder").value) throw new Error("Work order changed; inspect and plan again");
          const validated = GizeBrowserWorkflow.validatePlan(draft.plan);
          byId("browserWorkflowPlan").value = JSON.stringify(validated, null, 2);
          inspectionSession = inspected.sessionId;
          show("Task steps drafted from the observed page. Review the complete plan below, then choose Review workflow and Approve and run.");
        } catch (e) { show(e.message); }
        finally { byId("browserWorkflowDraft").disabled = false; }
      }).catch(e => show(e.message));
    } catch (e) { show(e.message); }
  });
  byId("browserWorkflowRefresh").addEventListener("click", async () => {
    try {
      invalidate(); const result = await send("orders");
      byId("browserWorkflowOrder").replaceChildren();
      for (const order of result.orders || []) {
        if (order.phase === "archived") continue;
        const option = document.createElement("option");
        option.value = order.taskId; option.textContent = order.companyId + " — " + order.title;
        byId("browserWorkflowOrder").append(option);
      }
      show("Choose a work order, then review the exact workflow.");
    } catch (e) { show(e.message); }
  });
  byId("browserWorkflowReview").addEventListener("click", async () => {
    try {
      invalidate();
      const result = await send("browser_workflow_create", {taskId: await taskId(),
        plan: JSON.parse(byId("browserWorkflowPlan").value), sessionId: inspectionSession});
      reviewed = result.workflow;
      show({siteAccess: GizeBrowserWorkflow.permissions(reviewed.plan).origins,
        reviewedPlan: reviewed.plan, fingerprint: reviewed.fingerprint,
        notice: "Review every entered value and click. Clicks can change data on the chosen website. Only the listed steps run; no AI service receives page contents."});
      byId("browserWorkflowGrant").disabled = false;
      byId("browserWorkflowRun").disabled = false;
    } catch (e) { show(e.message); }
  });
  byId("browserWorkflowGrant").addEventListener("click", () => {
    if (!reviewed) return;
    // Must be called directly within the user gesture, before any async work.
    chrome.permissions.request(GizeBrowserWorkflow.permissions(reviewed.plan)).then(granted =>
      show(granted ? "Site access granted. Review the plan and choose Approve and run." : "Site access declined; nothing ran.")
    ).catch(e => show(e.message));
  });
  byId("browserWorkflowRun").addEventListener("click", async () => {
    if (!reviewed) return;
    const record = reviewed;
    active = record;
    byId("browserWorkflowRun").disabled = true;
    byId("browserWorkflowReview").disabled = true;
    byId("browserWorkflowStop").disabled = false;
    for (const id of ["browserWorkflowPlan", "browserWorkflowOrder", "browserWorkflowRefresh", "browserWorkflowGrant", "browserWorkflowDraft", "browserWorkflowUrl", "browserWorkflowModel"])
      byId(id).disabled = true;
    try {
      show("Running reviewed steps. Keep the workflow tab open. Stop prevents the next action.");
      const result = await send("browser_workflow_run", {taskId: record.taskId, workflowId: record.id,
        fingerprint: record.fingerprint});
      show(result.workflow);
    } catch (e) { show(e.message + ". Inspect receipts before starting a new workflow; actions may already have occurred."); }
    finally {
      active = null;
      byId("browserWorkflowReview").disabled = false;
      byId("browserWorkflowStop").disabled = true;
      for (const id of ["browserWorkflowPlan", "browserWorkflowOrder", "browserWorkflowRefresh", "browserWorkflowDraft", "browserWorkflowUrl", "browserWorkflowModel"])
        byId(id).disabled = false;
    }
  });
  byId("browserWorkflowStop").addEventListener("click", async () => {
    if (!active) return;
    try { show(await send("browser_workflow_stop", {taskId: active.taskId, workflowId: active.id})); }
    catch (e) { show(e.message); }
  });
  byId("browserWorkflowReceipts").addEventListener("click", async () => {
    try {
      const record = active || reviewed;
      if (record) show((await send("browser_workflow_get", {taskId: record.taskId, workflowId: record.id})).workflow);
      else show((await send("browser_workflow_list", {taskId: await taskId()})).workflows);
    }
    catch (e) { show(e.message); }
  });
})();
