/* GIZE's own jobs and conversations. No ChatGPT account/history import or remote model access. */
(() => {
  "use strict";
  const el = id => document.getElementById(id);
  let orders = [], selected = null, activeTurn = null, epoch = 0, timer = null, sending = false, pendingSend = null;
  const rpc = async (command, fields = {}) => {
    const reply = await chrome.runtime.sendMessage({command, ...fields});
    if (!reply?.ok) throw new Error(reply?.detail || reply?.error || "GIZE connection unavailable");
    return reply;
  };
  const status = text => { el("chatStatus").textContent = text; };
  function showChat() {document.body.classList.add("chat-first"); el("chatInput").focus();}
  function tools(target) {
    if (!selected) {status("Choose or create a job before opening its action tools."); return;}
    bindOrder(selected); document.body.classList.remove("chat-first");
    document.getElementById(target)?.scrollIntoView({block: "start"});
  }
  function bindOrder(id) {
    const picker = el("browserWorkflowOrder"); picker.replaceChildren();
    for (const order of orders.filter(item => item.phase !== "archived")) {
      const option = document.createElement("option"); option.value = order.taskId;
      option.textContent = order.companyId + " — " + order.title; picker.append(option);
    }
    if (globalThis.GizeDesktopSurface) rpc("select_job", {taskId: id}).catch(error => status(error.message));
    picker.value = id; picker.dispatchEvent(new Event("change"));
  }
  function renderJobs() {
    el("jobConversations").replaceChildren();
    const query = el("chatSearchJobs").value.trim().toLowerCase();
    const pending = orders.filter(order => order.phase !== "archived" && order.phase !== "completed_owner_accepted");
    el("chatJobCount").textContent = String(pending.length);
    for (const order of pending.filter(item => !query || (item.title + " " + item.companyId).toLowerCase().includes(query))) {
      const button = document.createElement("button"); button.type = "button"; button.className = "job-thread";
      button.setAttribute("aria-current", order.taskId === selected ? "true" : "false");
      const title = document.createElement("span"); title.textContent = order.title;
      const detail = document.createElement("small"); detail.textContent = order.companyId + " · Pending";
      button.append(title, detail); button.addEventListener("click", () => {if (!sending) choose(order.taskId);});
      el("jobConversations").append(button);
    }
  }
  async function refreshJobs() {orders = (await rpc("orders")).orders || []; renderJobs();}
  function bubble(role, content, partial = false) {
    const article = document.createElement("article"); article.className = "chat-message " + (role === "user" ? "from-user" : "from-gize");
    const label = document.createElement("strong"); label.textContent = role === "user" ? "You" : "GIZE AI";
    const body = document.createElement("div"); body.className = "chat-message-text"; body.textContent = content || (partial ? "Thinking…" : "No reply text returned.");
    article.append(label, body); return article;
  }
  function renderHistory(reply) {
    const container = el("chatMessages");
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    container.replaceChildren();
    const latest = reply.turns?.[0]; activeTurn = latest?.status === "running" ? latest : null;
    for (const message of reply.messages || []) container.append(bubble(message.role, message.content,
      message.turnId === activeTurn?.turnId && message.role === "assistant"));
    el("chatEmpty").hidden = (reply.messages || []).length > 0;
    el("chatStop").disabled = !activeTurn?.ownedConnection;
    el("chatRecover").hidden = !activeTurn?.recoverable;
    el("chatSend").disabled = sending || !!activeTurn || !el("chatModel").value;
    if (latest?.recoverable) status("Connection interrupted. Your messages are saved; review and recover before continuing.");
    else if (activeTurn) status("GIZE is replying locally…");
    else if (latest?.status === "failed") status("Reply failed: " + latest.error + ". Partial text is retained; the job is still pending.");
    else if (latest?.status === "interrupted") status("Reply interrupted. Partial text is saved; the job is still pending.");
    else if (latest?.status === "reply_ready") status("Reply ready · Job remains pending until its result is verified.");
    else status("Local conversation · No Codex or ChatGPT account required.");
    if (nearBottom) container.scrollTop = container.scrollHeight;
  }
  async function poll() {
    if (!selected) return;
    const id = selected, generation = epoch;
    try {
      const reply = await rpc("chat_get", {taskId: id});
      if (id !== selected || generation !== epoch) return;
      renderHistory(reply);
      if (activeTurn) timer = setTimeout(poll, 500);
    } catch (error) {
      if (generation === epoch) status(error.message + ". Reload the conversation before sending again.");
    }
  }
  async function choose(id) {
    selected = id; epoch++; clearTimeout(timer); activeTurn = null;
    const order = orders.find(item => item.taskId === id);
    el("chatTitle").textContent = order?.title || "GIZE job"; renderJobs(); bindOrder(id); showChat();
    await chrome.storage.local.set({gizeSelectedConversation: id});
    el("chatMessages").replaceChildren(); status("Loading saved conversation…"); await poll();
  }
  el("chatNewJob").addEventListener("click", () => {
    if (sending) return;
    selected = null; epoch++; clearTimeout(timer); activeTurn = null; pendingSend = null;
    el("chatMessages").replaceChildren(); el("chatEmpty").hidden = false;
    el("chatTitle").textContent = "New job"; el("chatStop").disabled = true; el("chatRecover").hidden = true;
    el("chatSend").disabled = !el("chatModel").value; renderJobs(); showChat();
    status("Describe the result you want. The conversation becomes a pending GIZE job.");
  });
  el("chatSearchJobs").addEventListener("input", renderJobs);
  el("chatBack").addEventListener("click", showChat);
  el("chatBrowserTools").addEventListener("click", () => tools("browserWorkflows"));
  el("chatPcTools").addEventListener("click", () => tools("desktopAssist"));
  el("chatMemoryTools").addEventListener("click", () => tools("jobMemory"));
  for (const link of document.querySelectorAll(".navigation a")) link.addEventListener("click", event => {
    if (link.getAttribute("href") === "#home") {event.preventDefault(); showChat();}
    else {document.body.classList.remove("chat-first");}
  });
  el("chatRefresh").addEventListener("click", async () => {
    try {await refreshJobs(); if (selected) await poll();} catch (error) {status(error.message);}
  });
  el("chatModelsRefresh").addEventListener("click", async () => {
    try {
      status("Checking local models…"); const reply = await rpc("chat_models");
      el("chatModel").replaceChildren();
      for (const model of reply.models || []) {const option = document.createElement("option"); option.value = model; option.textContent = model; el("chatModel").append(option);}
      el("chatSend").disabled = !reply.ready || sending || !!activeTurn;
      status(reply.ready ? "Local model ready · No external account required." : "No local model is installed. Set up a local model before chatting.");
    } catch (error) {el("chatSend").disabled = true; status(error.message);}
  });
  el("chatCompose").addEventListener("submit", async event => {
    event.preventDefault(); if (sending || activeTurn) return;
    const text = el("chatInput").value.trim(), model = el("chatModel").value;
    if (!text || !model) {status("Enter a message and choose an installed local model."); return;}
    sending = true; el("chatSend").disabled = true;
    try {
      if (!selected) {
        const created = await rpc("create_order", {companyId: el("companyId").value,
          instruction: "Conversation: " + text.slice(0, 4800)});
        await refreshJobs(); await choose(created.taskId);
      }
      const scope = selected;
      if (!pendingSend || pendingSend.taskId !== scope || pendingSend.text !== text || pendingSend.model !== model)
        pendingSend = {taskId: scope, text, model, nonce: crypto.randomUUID().replaceAll("-", "")};
      await rpc("chat_start", pendingSend);
      pendingSend = null; el("chatInput").value = ""; await poll();
    } catch (error) {status(error.message + ". Reload history before resending; the same unchanged message retains its request identity.");}
    finally {sending = false; el("chatSend").disabled = !!activeTurn || !el("chatModel").value;}
  });
  el("chatInput").addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {event.preventDefault(); el("chatCompose").requestSubmit();}
  });
  el("chatStop").addEventListener("click", async () => {
    if (!selected || !activeTurn) return;
    try {await rpc("chat_stop", {taskId: selected, turnId: activeTurn.turnId}); await poll();} catch (error) {status(error.message);}
  });
  el("chatRecover").addEventListener("click", async () => {
    if (!selected || !activeTurn) return;
    try {await rpc("chat_recover", {taskId: selected, turnId: activeTurn.turnId}); await poll();} catch (error) {status(error.message);}
  });
  (async () => {
    try {
      await refreshJobs(); const saved = (await chrome.storage.local.get("gizeSelectedConversation")).gizeSelectedConversation;
      if (orders.some(order => order.taskId === saved && order.phase !== "archived")) await choose(saved);
      el("chatModelsRefresh").click();
    } catch (error) {status(error.message);}
  })();
})();
