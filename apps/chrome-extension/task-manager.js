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
    chatgpt: { title: "ChatGPT", url: "https://chatgpt.com/" },
    claude: { title: "Claude", url: "https://claude.ai/" },
    deepseek: { title: "DeepSeek", url: "https://chat.deepseek.com/" },
    qwen: { title: "Qwen", url: "https://chat.qwen.ai/" },
    cloudflare_ai: { title: "Cloudflare AI Playground", url: "https://playground.ai.cloudflare.com/" }
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

    async openAgentTab(taskId, agentId, providerId) {
      if (!TASK_ID.test(taskId) || !AGENT.test(agentId)) throw new Error("Invalid task or agent ID");
      const provider = PROVIDERS[providerId];
      if (!provider) throw new Error("Choose a registered AI provider");
      return this.serialize(async () => {
        const all = await this.orders();
        const order = all[taskId];
        if (!order) throw new Error("Work order not found");
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
        const reports = order.agentReports || {};
        reports[agentId] = {
          outcome,
          summary: summary.trim(),
          savedUtc: new Date().toISOString(),
          verification: "unverified_agent_claim"
        };
        order.agentReports = reports;
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
      const artifacts = (backend.order || {}).artifacts || [];
      const checksumsRecorded = artifacts.length > 0 &&
        artifacts.every(item => /^[A-Fa-f0-9]{64}$/.test(item.sha256 || ""));
      const hasClaim = reports.some(item => item.outcome === "submitted");
      const verdict = !hasClaim ? "awaiting_agent_handoff" :
        checksumsRecorded ? "pending_independent_verification" : "blocked";
      const reason = verdict === "pending_independent_verification"
        ? "Artifacts have recorded hashes, but no independent semantic or provider verification exists."
        : verdict === "awaiting_agent_handoff"
          ? "No agent has handed off a completed assignment."
          : "Artifact manifest was missing or invalid.";

      await this.serialize(async () => {
        const latest = await this.orders();
        if (!latest[taskId]) return;
        latest[taskId].review = { verdict, reason, checkedUtc: new Date().toISOString() };
        latest[taskId].phase = "awaiting_supervisor_review";
        await this.saveOrders(latest);
      });
      return { taskId, verdict, reason, recordedArtifacts: artifacts.length };
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
