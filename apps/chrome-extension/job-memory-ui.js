(() => {
  "use strict";
  const el = id => document.getElementById(id);
  const send = async (command, fields = {}) => {
    const taskId = el("browserWorkflowOrder").value;
    if (!/^[a-f0-9]{32}$/.test(taskId)) throw new Error("Choose a job first");
    const reply = await chrome.runtime.sendMessage({command, taskId, ...fields});
    if (!reply?.ok) throw new Error(reply?.detail || reply?.error || "Job memory unavailable");
    return reply;
  };
  const show = value => {el("jobMemoryResult").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);};
  el("jobMemoryLoad").addEventListener("click", async () => {
    try {
      const memory = await send("chat_memory_list");
      const browser = await send("browser_workflow_list");
      const desktop = await send("desktop_history");
      show({memory: memory.notes, memoryHistory: memory.workflow,
        browserWorkflows: browser.workflows, windowsActions: desktop.actions,
        notice: "Only this job's stored notes, workflow receipts and references are shown. A stored note is not verified completion."});
    } catch (error) {show(error.message);}
  });
  el("jobMemorySave").addEventListener("click", async () => {
    try {
      await send("chat_memory_put", {key: el("jobMemoryKey").value.trim(), content: el("jobMemoryNote").value,
        source: el("jobMemorySource").value.trim()});
      show("Saved to this job's local memory. Other jobs do not receive this note.");
    } catch (error) {show(error.message);}
  });
})();
