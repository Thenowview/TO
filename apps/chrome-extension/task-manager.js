/* TheOrg task-scoped Chrome tab manager.
 * Browser-only component: never sends prompts or site content automatically.
 * Persistent work-order metadata in storage.local; session-lifetime tab IDs in storage.session.
 * Do not close tabs that were not created and tracked by TheOrg.
 */
(() => {
  "use strict";

  const HOST = "com.theorg.bridge";
  const LOCAL_KEY = "theorgWorkOrdersV1";
  const SESSION_KEY = "theorgOwnedTabsV1";
  const COMPANY = /^[a-z0-9_-]{1,40}$/;
  const TASK_ID = /^[a-f0-9]{32}$/;
  const AGENT = /^[a-z][a-z0-9_-]{0,39}$/;
  const PROVIDERS = Object.freeze({
    chatgpt: { title: "ChatGPT", url: "https://chatgpt.com/", kind: "ai-chat", access: "manual-web-handoff" },
    claude: { title: "Claude", url: "https://claude.ai/", kind: "ai-chat", access: "manual-web-handoff" },
    gemini: { title: "Google Gemini", url: "https://gemini.google.com/app", kind: "ai-chat", access: "manual-web-handoff" },
    copilot: { title: "Microsoft Copilot", url: "https://copilot.microsoft.com/", kind: "ai-chat", access: "manual-web-handoff" },
    perplexity: { title: "Perplexity", url: "https://www.perplexity.ai/", kind: "ai-chat", access: "manual-web-handoff" },
    grok: { title: "Grok", url: "https://grok.com/", kind: "ai-chat", access: "manual-web-handoff" },
    deepseek: { title: "DeepSeek", url: "https://chat.deepseek.com/", kind: "ai-chat", access: "manual-web-handoff" },
    qwen: { title: "Qwen", url: "https://chat.qwen.ai/", kind: "ai-chat", access: "manual-web-handoff" },
    kimi: { title: "Kimi", url: "https://www.kimi.com/", kind: "ai-chat", access: "manual-web-handoff" },
    zai: { title: "Z.ai", url: "https://chat.z.ai/", kind: "ai-chat", access: "manual-web-handoff" },
    mistral: { title: "Le Chat", url: "https://chat.mistral.ai/", kind: "ai-chat", access: "manual-web-handoff" },
    poe: { title: "Poe", url: "https://poe.com/", kind: "ai-chat", access: "manual-web-handoff" },
    huggingchat: { title: "HuggingChat", url: "https://huggingface.co/chat/", kind: "ai-chat", access: "manual-web-handoff" },
    doubao: { title: "Doubao", url: "https://www.doubao.com/", kind: "ai-chat", access: "manual-web-handoff" },
    yuanbao: { title: "Tencent Yuanbao", url: "https://yuanbao.tencent.com/", kind: "ai-chat", access: "manual-web-handoff" },
    cloudflare_ai: { title: "Cloudflare Workers AI", url: "https://dash.cloudflare.com/", kind: "developer-platform", access: "manual-dashboard" }
  });

  class TaskManager {
    constructor(api) {
      this.api = api;
      this.queue = Promise.resolve();
    }

    serialize(fn) {
      const next = this.queue.then(fn, fn);
      this.queue = next.catch(() => undefined);
      return next;
    }

    async orders() {
      const record = await this.api.storage.local.get(LOCAL_KEY);
      return record[LOCAL_KEY] || {};
    }

    async owned() {
      const record = await this.api.storage.session.get(SESSION_KEY);
      return record[SESSION_KEY] || {};
    }

    async saveOrders(data) {
      await this.api.storage.local.set({ [LOCAL_KEY]: data });
    }

    async saveOwned(data) {
      await this.api.storage.session.set({ [SESSION_KEY]: data });
    }

    async native(payload) {
      const reply = await this.api.runtime.sendNativeMessage(HOST, payload);
      if (!reply || reply.ok !== true) {
        throw new Error(reply && reply.error ? reply.error : "Windows controller unavailable");
      }
      return reply;
    }

    async checkEngine() {
      return this.native({ command: "ping" });
    }

    async createOrder(companyId, instruction) {
      if (!COMPANY.test(companyId)) throw new Error("Company ID must be lowercase letters, digits, _ or -");
      if (typeof instruction !== "string" || instruction.trim().length < 5 ||
          instruction.length > 5000) throw new Error("Instruction must be 5–5000 characters");

      const reply = await this.native({
        command: "submit_order",
        companyId,
        instruction: instruction.trim()
      });

      const order = reply.order || {};
      if (!TASK_ID.test(order.orderId || "") || order.companyId !== companyId) {
        throw new Error("Controller returned an invalid work-order identity");
      }

      await this.serialize(async () => {
        const all = await this.orders();
        all[order.orderId] = {
          taskId: order.orderId,
          companyId,
          createdUtc: order.createdUtc || new Date().toISOString(),
          title: instruction.trim().slice(0, 90),
          instruction: instruction.trim(),
          agentReports: {},
          providerTabs: {},
          review: {
            verdict: "pending",
            reason: "Live AI provider and semantic verification not connected"
          },
          backendMode: order.aiMode || "unknown",
          phase: "awaiting_agent_work"
        };
        await this.saveOrders(all);
      });
      return { taskId: order.orderId, backendMode: order.aiMode || "unknown" };
    }

    async listOrders() {
      const all = await this.orders();
      const owned = await this.owned();
      return Object.values(all).map(order => ({
        ...order,
        activeTabs: ((owned[order.taskId] || {}).tabs || []).length
      })).sort((a, b) => b.createdUtc.localeCompare(a.createdUtc));
    }

    async saveSupervisorPlan(taskId, response) {
      if (!TASK_ID.test(taskId)) throw new Error("Invalid work order ID");
      const plan = globalThis.TheOrgPlanner.interpret(response);
      return this.serialize(async () => {
        const all = await this.orders();
        const order = all[taskId];
        if (!order) throw new Error("Unknown work order");
        const live = (await this.owned())[taskId];
        if (live && live.tabs && live.tabs.some(tab => tab.agentId !== "supervisor")) {
          throw new Error("Specialist tabs must be closed before replacing the plan");
        }
        order.plan = plan;
        order.agentReports = {};
        order.providerTabs = {};
        order.phase = "plan_review_required";
        order.review = {
          verdict: "pending",
          reason: "Untrusted AI-suggested tasks need owner review before execution"
        };
        await this.saveOrders(all);
        // The planning chat has been handed off; close its TheOrg-owned tab only.
        const closedSupervisorTabs = await this.closeAgentTabsLocked(taskId, "supervisor");
        return {taskId, plan, status: order.phase, closedSupervisorTabs};
      });
    }

    async approvePlan(taskId) {
      if (!TASK_ID.test(taskId)) throw new Error("Invalid order");
      return this.serialize(async () => {
        const all = await this.orders();
        const order = all[taskId];
        if (!order || !order.plan || !order.plan.tasks.length)
          throw new Error("No Supervisor plan to approve");
        if (order.phase !== "plan_review_required") throw new Error("Plan is already approved or running");
        order.plan.reviewed = true;
        order.phase = "plan_approved";
        order.plan.reviewedUtc = new Date().toISOString();
        await this.saveOrders(all);
        return {taskId, phase:order.phase, taskCount:order.plan.tasks.length};
      });
    }

    async openSupervisorTab(taskId, providerId) {
      return this.openAgentTab(taskId, "supervisor", providerId);
    }

    async getNativeOrder(taskId) {
      if (!TASK_ID.test(taskId)) throw new Error("Invalid order");
      const orders = await this.orders();
      const order = orders[taskId];
      if (!order) throw new Error("Order is not registered");
      return this.native({command:"get_order", companyId:order.companyId, orderId:taskId});
    }

    async agentPrompt(taskId, agentId) {
      if (!TASK_ID.test(taskId) || !AGENT.test(agentId)) throw new Error("Invalid task or agent ID");
      const all = await this.orders();
      const order = all[taskId];
      if (!order || !order.plan) throw new Error("Save a Supervisor plan first");
      return globalThis.TheOrgPlanner.agentPrompt(order.title, order.plan, agentId);
    }

    async openAgentTab(taskId, agentId, providerId) {
      if (!TASK_ID.test(taskId) || !AGENT.test(agentId)) throw new Error("Invalid task or agent ID");
      const provider = PROVIDERS[providerId];
      if (!provider) throw new Error("Choose a registered AI provider");
      return this.serialize(async () => {
        const all = await this.orders();
        const order = all[taskId];
        if (!order) throw new Error("Work order not found");
        if (agentId !== "supervisor") {
          if (!order.plan || !order.plan.reviewed ||
              !order.plan.tasks.some(task => task.id === agentId))
            throw new Error("A reviewed Supervisor plan is required before dispatching agents");
        }
        if (order.phase === "archived") throw new Error("Archived task cannot open tabs");

        const session = await this.owned();
        const state = session[taskId] || { tabs: [], groupId: null, windowId: null };
        if (state.tabs.length >= 16) throw new Error("Limit of 16 task tabs reached");

        // Create TheOrg-owned tabs only. Never group an existing personal tab.
        const created = await this.api.tabs.create({
          url: provider.url,
          active: true,
          ...(Number.isInteger(state.windowId) ? { windowId: state.windowId } : {})
        });

        if (!created || !Number.isInteger(created.id) || !Number.isInteger(created.windowId)) {
          throw new Error("Chrome did not return a new tab ID");
        }
        const item = {
          id: created.id,
          windowId: created.windowId,
          agentId,
          providerId,
          createdUtc: new Date().toISOString()
        };

        // Immediately record ownership. On a mid-operation crash, abandoned tabs
        // are safer than closing another user's unrelated tabs.
        state.tabs.push(item);
        state.windowId = created.windowId;
        session[taskId] = state;
        await this.saveOwned(session);

        try {
          let groupId;
          if (Number.isInteger(state.groupId)) {
            try {
              groupId = await this.api.tabs.group({ groupId: state.groupId, tabIds: [created.id] });
            } catch {
              groupId = await this.api.tabs.group({ tabIds: [created.id] });
            }
          } else {
            groupId = await this.api.tabs.group({ tabIds: [created.id] });
          }
          state.groupId = groupId;
          await this.api.tabGroups.update(groupId, {
            title: "TheOrg • " + taskId.slice(0, 8),
            color: "blue",
            collapsed: false
          });
        } catch (error) {
          // Keep recorded ownership and report partial setup to the operator.
          await this.saveOwned(session);
          throw new Error("Tab created, but group setup needs review: " + error.message);
        }

        await this.saveOwned(session);
        order.phase = "agent_tabs_open";
        order.providerTabs[agentId] = (order.providerTabs[agentId] || []).concat(providerId);
        await this.saveOrders(all);
        return { taskId, agentId, providerId, tabId: created.id, groupId: state.groupId };
      });
    }

    async importArtifact(taskId, agentId, fileName, dataBase64, provider, sourceReference) {
      if (!TASK_ID.test(taskId) || !AGENT.test(agentId))
        throw new Error("Invalid work order or agent identity");
      if (typeof fileName !== "string" || fileName.length > 120 ||
          typeof dataBase64 !== "string" || dataBase64.length > 350000)
        throw new Error("File import is limited to 250 KiB per file in this prototype");
      const all = await this.orders();
      const order = all[taskId];
      if (!order || !order.plan || !order.plan.reviewed ||
          !order.plan.tasks.some(t => t.id === agentId))
        throw new Error("Use a specialist assigned by the approved Supervisor plan");
      const result = await this.native({
        command: "import_artifact",
        companyId: order.companyId,
        orderId: taskId, agentId, fileName,
        dataBase64,
        sourceProvider: String(provider || "manual_import").slice(0,60),
        sourceReference: String(sourceReference || "").slice(0,500)
      });
      return result.artifact;
    }

    async beginArtifactUpload(taskId, agentId, fileName, totalBytes, sha256, provider, sourceReference) {
      if (!TASK_ID.test(taskId) || !AGENT.test(agentId) ||
          !Number.isSafeInteger(totalBytes) || totalBytes < 1 || totalBytes > 32*1024*1024 ||
          !/^[a-fA-F0-9]{64}$/.test(sha256))
        throw new Error("Invalid work order, file size or checksum");
      const all = await this.orders();
      const order = all[taskId];
      if (!order || !order.plan || !order.plan.reviewed ||
          !order.plan.tasks.some(t => t.id === agentId))
        throw new Error("File imports require an approved specialist assignment");
      const result = await this.native({
        command:"begin_artifact_upload",
        companyId:order.companyId, orderId:taskId, agentId, fileName,
        totalBytes, sha256, sourceProvider:String(provider||"manual_import").slice(0,60),
        sourceReference:String(sourceReference||"").slice(0,500)
      });
      return result.transfer;
    }

    async artifactTransfer(taskId, command, uploadId, accessToken, extra = {}) {
      if (!TASK_ID.test(taskId) || !TASK_ID.test(uploadId) ||
          !/^[A-F0-9]{64}$/.test(accessToken))
        throw new Error("Invalid artifact transfer state");
      const all = await this.orders();
      const order = all[taskId];
      if (!order) throw new Error("Unknown work order");
      if (!["append_artifact_chunk","upload_status","complete_artifact_upload",
            "cancel_artifact_upload"].includes(command))
        throw new Error("Unsupported file transfer operation");
      const result = await this.native({
        command,companyId:order.companyId,orderId:taskId,
        uploadId,accessToken,...extra
      });
      return result.result;
    }

    async readArtifactChunk(taskId, artifactId, offset, chunkBytes = 65536) {
      if (!TASK_ID.test(taskId) || !TASK_ID.test(artifactId) ||
          !Number.isSafeInteger(offset) || offset < 0 ||
          !Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes > 131072)
        throw new Error("Invalid artifact read range");
      const all = await this.orders();
      const order = all[taskId];
      if (!order) throw new Error("Unknown work order");
      const result = await this.native({
        command:"read_artifact_chunk",companyId:order.companyId,
        orderId:taskId,artifactId,offset,chunkBytes
      });
      return result.result;
    }

    async listArtifacts(taskId) {
      if (!TASK_ID.test(taskId)) throw new Error("Invalid work order");
      const all = await this.orders();
      const order = all[taskId];
      if (!order) throw new Error("Unknown work order");
      const result = await this.native({
        command: "list_artifacts", companyId: order.companyId, orderId: taskId
      });
      return result.artifacts || [];
    }

    async verifyArtifact(taskId, artifactId) {
      if (!TASK_ID.test(taskId) || !TASK_ID.test(artifactId))
        throw new Error("Invalid order or artifact ID");
      const all = await this.orders();
      const order = all[taskId];
      if (!order) throw new Error("Unknown work order");
      const result = await this.native({
        command: "verify_artifact", companyId: order.companyId,
        orderId: taskId, artifactId
      });
      return result.artifact;
    }

    async readArtifact(taskId, artifactId) {
      if (!TASK_ID.test(taskId) || !TASK_ID.test(artifactId))
        throw new Error("Invalid work order or artifact ID");
      const all = await this.orders();
      const order = all[taskId];
      if (!order) throw new Error("Unknown work order");
      const result = await this.native({
        command: "read_artifact", companyId: order.companyId,
        orderId: taskId, artifactId
      });
      return result.content;
    }

    async handoffAndClose(taskId, agentId, summary, outcome = "submitted") {
      if (!TASK_ID.test(taskId) || !AGENT.test(agentId)) throw new Error("Invalid task or agent ID");
      if (typeof summary !== "string" || summary.trim().length < 20 ||
          summary.length > 8000) throw new Error("Provide at least 20 characters of evidence");

      if (!["submitted", "blocked", "needs_help"].includes(outcome))
        throw new Error("Invalid handoff status");

      return this.serialize(async () => {
        const all = await this.orders();
        const order = all[taskId];
        if (!order) throw new Error("Work order not found");
        if (!order.plan || !order.plan.tasks.some(t => t.id === agentId))
          throw new Error("Agent has no approved assignment");
        const reports = order.agentReports || {};
        reports[agentId] = {
          outcome,
          summary: summary.trim(),
          savedUtc: new Date().toISOString(),
          verification: "unverified_agent_claim"
        };
        order.agentReports = reports;
        const assigned = order.plan.tasks.find(t => t.id === agentId);
        assigned.status = outcome;
        order.phase = "awaiting_supervisor_review";
        order.review = {
          verdict: "pending",
          reason: "Agent report saved locally; Supervisor must verify the outcome"
        };

        // Durable handoff first. Only after the save succeeds can the agent's tabs close.
        await this.saveOrders(all);
        const closed = await this.closeAgentTabsLocked(taskId, agentId);
        return { taskId, agentId, saved: true, closedTabs: closed, verification: "pending" };
      });
    }

    async closeAgentTabsLocked(taskId, agentId) {
      const data = await this.owned();
      const state = data[taskId];
      if (!state) return 0;
      const tabSet = state.tabs.filter(tab => tab.agentId === agentId);
      let count = 0;
      for (const ownedTab of tabSet) {
        try {
          const current = await this.api.tabs.get(ownedTab.id);
          // Skip if moved to an unrelated group/window, or replaced.
          if (current && current.id === ownedTab.id &&
              current.windowId === ownedTab.windowId &&
              current.groupId === state.groupId) {
            await this.api.tabs.remove(ownedTab.id);
            count++;
          }
        } catch {
          // A tab may already have been closed by the user.
        }
      }
      // Retain tabs not actually removed; don't claim they closed.
      const remaining = [];
      for (const item of state.tabs) {
        if (item.agentId !== agentId) { remaining.push(item); continue; }
        try {
          await this.api.tabs.get(item.id);
          remaining.push(item);
        } catch {
          // Already closed, discard ownership.
        }
      }
      state.tabs = remaining;
      if (state.tabs.length === 0) {
        state.groupId = null;
        state.windowId = null;
      }
      data[taskId] = state;
      await this.saveOwned(data);
      return count;
    }

    async supervisorReview(taskId) {
      if (!TASK_ID.test(taskId)) throw new Error("Invalid task ID");
      const all = await this.orders();
      const order = all[taskId];
      if (!order) throw new Error("Work order not found");

      const reports = Object.values(order.agentReports || {});
      let backend;
      try {
        backend = await this.native({
          command: "get_order",
          companyId: order.companyId,
          orderId: taskId
        });
      } catch (error) {
        return {
          taskId,
          verdict: "blocked",
          reason: "Unable to retrieve saved controller artifacts: " + error.message
        };
      }
      const demonstrationArtifacts = (backend.order || {}).artifacts || [];
      let importedArtifacts = [];
      try { importedArtifacts = await this.listArtifacts(taskId); }
      catch (error) {
        return {taskId, verdict:"blocked", reason:"Artifact intake unavailable: " + error.message};
      }
      const checksumsRecorded = demonstrationArtifacts.length > 0 &&
        demonstrationArtifacts.every(item => /^[A-Fa-f0-9]{64}$/.test(item.sha256 || ""));
      const importedPending = importedArtifacts.some(item =>
        item.intakeStatus !== "structure_verified_content_qa_pending" ||
        !item.integrityValid || !item.formatValid);
      const planned = order.plan ? order.plan.tasks : [];
      const everyAgentReported = planned.length > 0 &&
        planned.every(t => order.agentReports && order.agentReports[t.id]);
      const allSubmitted = everyAgentReported &&
        planned.every(t => order.agentReports[t.id].outcome === "submitted");
      const verdict = !everyAgentReported ? "awaiting_agent_handoff" :
        !allSubmitted ? "agent_blocked_or_needs_help" :
        !checksumsRecorded || importedPending ? "blocked" :
        "pending_independent_verification";
      const reason = verdict === "pending_independent_verification"
        ? "Artifacts have recorded hashes, but no independent semantic or provider verification exists."
        : verdict === "awaiting_agent_handoff"
          ? "One or more specialist tasks have not yet submitted a report."
          : verdict === "agent_blocked_or_needs_help"
            ? "At least one specialist reported a blocker or requested assistance."
            : "Artifact manifest was missing or invalid.";

      await this.serialize(async () => {
        const latest = await this.orders();
        if (!latest[taskId]) return;
        latest[taskId].review = { verdict, reason, checkedUtc: new Date().toISOString() };
        latest[taskId].phase = "awaiting_supervisor_review";
        await this.saveOrders(latest);
      });
      return {taskId, verdict, reason,
        demonstrationArtifacts: demonstrationArtifacts.length,
        importedArtifacts: importedArtifacts.length,
        pendingContentQa: importedArtifacts.length > 0};
    }

    async handleRemoved(tabId) {
      return this.serialize(async () => {
        const all = await this.owned();
        let dirty = false;
        for (const state of Object.values(all)) {
          const before = state.tabs.length;
          state.tabs = state.tabs.filter(item => item.id !== tabId);
          if (before !== state.tabs.length) {
            dirty = true;
            if (!state.tabs.length) {
              state.groupId = null;
              state.windowId = null;
            }
          }
        }
        if (dirty) await this.saveOwned(all);
      });
    }

    providers() {
      return PROVIDERS;
    }
  }

  globalThis.TheOrgTaskManager = TaskManager;
})();
