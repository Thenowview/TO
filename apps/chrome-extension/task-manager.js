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
      for(const order of Object.values(data)){
        if(order.acceptance&&order.acceptance.basis!==this.completionBasis(order)){
          order.acceptanceHistory=[...(order.acceptanceHistory||[]),order.acceptance];
          delete order.acceptance;
          if(order.phase==="completed_owner_accepted")order.phase="awaiting_supervisor_review";
        }
      }
      await this.api.storage.local.set({ [LOCAL_KEY]: data });
    }

    async saveOwned(data) {
      await this.api.storage.session.set({ [SESSION_KEY]: data });
    }

    async native(payload) {
      const reply = await this.api.runtime.sendNativeMessage(HOST, payload);
      if (!reply || reply.ok !== true) {
        const detail = reply && typeof reply.detail === "string" ? reply.detail : "";
        const error = reply && typeof reply.error === "string" ? reply.error : "Windows controller unavailable";
        throw new Error(detail ? error + ": " + detail : error);
      }
      return reply;
    }

    async checkEngine() {
      return this.native({ command: "ping" });
    }

    // Read-only AO discovery; native host is the security boundary.
    async aoCapabilities() {
      const reply = await this.native({ command: "ao_capabilities" });
      if (reply.integration !== "AO" || reply.protocolVersion !== 1 ||
          reply.enabled !== false || reply.executionSupported !== false ||
          reply.status !== "disabled_pending_authorization_and_contract_tests" ||
          !Array.isArray(reply.tools) || reply.tools.length !== 0) {
        throw new Error("Unrecognized or unexpectedly enabled AO capabilities");
      }
      return {
        integration: "AO", enabled: false, executionSupported: false,
        status: reply.status, tools: []
      };
    }

    async createOrder(companyId, instruction) {
      if (!COMPANY.test(companyId)) throw new Error("Company ID must be lowercase letters, digits, _ or -");
      if (typeof instruction !== "string" || instruction.trim().length < 5 ||
          instruction.length > 5000) throw new Error("Instruction must be 5–5000 characters");

      const localPlan = globalThis.TheOrgSkills.route(instruction.trim());

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
          plan: localPlan,
          agentReports: {},
          qaFindings: {},
          agentSessions: {},
          providerTabs: {},
          review: {
            verdict: "pending",
            reason: "A rules-based SOP plan was drafted locally; no AI chat was consulted and no execution has occurred. Review the assignments before dispatch."
          },
          backendMode: order.aiMode || "unknown",
          phase: "plan_review_required"
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
        order.qaFindings = {};
        order.agentSessions = {};
        order.providerTabs = {};
        order.phase = "plan_review_required";
        order.review = {
          verdict: "pending",
          reason: "Untrusted AI-suggested tasks need owner review before execution"
        };
        await this.saveOrders(all);
        // The planning chat has been handed off; close its Orgaiz-owned tab only.
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

    // This is a plan-execution queue, not a proof of externally completed work.
    // Dependencies can progress after a submitted handoff and manually recorded QA pass.
    // Such passes remain explicitly unauthenticated until independent verification exists.
    async executionQueue(taskId) {
      if (!TASK_ID.test(taskId)) throw new Error("Invalid work order ID");
      const all = await this.orders();
      const order = all[taskId];
      if (!order || !order.plan) throw new Error("Work order has no task plan");
      const owned = await this.owned();
      const artifactList = await this.listArtifacts(taskId);
      const latest = new Map();
      for (const item of artifactList) {
        const key = item.agentId + "\\0" + item.fileName;
        const prior = latest.get(key);
        if (!prior || (item.version || 0) > (prior.version || 0))
          latest.set(key, item);
      }
      const currentArtifacts = [...latest.values()];
      function artifactsValidFor(agentId) {
        return currentArtifacts.filter(a => a.agentId === agentId).every(a =>
          a.integrityValid === true && a.formatValid === true &&
          a.intakeStatus === "structure_verified_content_qa_pending");
      }
      const activeTabs = ((owned[taskId] || {}).tabs || [])
        .map(item => item.agentId);
      const reviews = order.qaFindings || {};
      const reports = order.agentReports || {};
      const tasks = order.plan.tasks || [];
      function qaPass(id) {
        const task = tasks.find(t => t.id === id);
        const report = reports[id];
        if (!task || !report || report.outcome !== "submitted" ||
            !artifactsValidFor(id)) return false;
        return task.acceptanceCriteria.every((_, index) => {
          const finding = (reviews[id] || {})[index];
          return finding &&
            finding.verdict === "pass" &&
            finding.handoffUtc === report.savedUtc;
        });
      }
      const queue = tasks.map(task => {
        const report = reports[task.id] || null;
        const pendingDependencies = (task.dependencies || []).filter(dep => !qaPass(dep));
        const active = activeTabs.includes(task.id);
        const allCriteriaPassed = qaPass(task.id);
        const anyFailed = Object.values(reviews[task.id] || {}).some(f =>
          f.verdict === "fail" || f.verdict === "needs_information");
        let state;
        if (!order.plan.reviewed) state = "plan_review_required";
        else if (active) state = "agent_tab_open";
        else if (order.agentSessions?.[task.id]?.status === "open")
          state = "browser_session_untracked";
        else if (pendingDependencies.length) state = "waiting_on_dependencies";
        else if (!artifactsValidFor(task.id)) state = "artifact_validation_pending";
        else if (report && report.outcome !== "submitted") state = "needs_agent_followup";
        else if (anyFailed) state = "needs_revision";
        else if (allCriteriaPassed) state = "manual_qa_pass_unverified";
        else if (report) state = "awaiting_qa_evidence";
        else state = "ready_for_manual_provider_consultation";
        return {
          agentId: task.id, role: task.role, providerId: task.provider,
          objective: task.objective,
          dependencies: task.dependencies || [], pendingDependencies,
          artifactsIntegrityPass: artifactsValidFor(task.id),
          state, activeTabCount: activeTabs.filter(id => id === task.id).length,
          verifiedComplete: false,
          outstandingCriteria: task.acceptanceCriteria.filter((_,index) => {
            const finding = (reviews[task.id] || {})[index];
            return !finding || finding.verdict !== "pass" ||
              !report || finding.handoffUtc !== report.savedUtc;
          })
        };
      });
      return {
        taskId, planApproved: !!order.plan.reviewed,
        reviewStatus: order.review?.verdict || "pending",
        queue,
        ready: queue.filter(t => t.state === "ready_for_manual_provider_consultation")
          .map(t => t.agentId),
        trustNotice: "SOP queue only. A manual QA pass is not authenticated certification; no AI provider was automatically consulted."
      };
    }

    async invalidateAgentQA(taskId, agentId, reason) {
      if (!TASK_ID.test(taskId) || !AGENT.test(agentId))
        throw new Error("Invalid work order or assigned agent");
      return this.serialize(async () => {
        const all = await this.orders();
        const order = all[taskId];
        if (!order) throw new Error("Work order missing");
        if (order.qaFindings) delete order.qaFindings[agentId];
        order.review = { verdict: "pending", reason,
          checkedUtc: new Date().toISOString() };
        await this.saveOrders(all);
      });
    }

    async dispatchNextTask(taskId) {
      const sequence = await this.executionQueue(taskId);
      if (!sequence.planApproved)
        throw new Error("Review and approve the Supervisor plan before dispatch");
      const next = sequence.queue.find(t =>
        t.state === "ready_for_manual_provider_consultation");
      if (!next) return { taskId, dispatched: false,
        reason: "No eligible specialist. Review pending handoffs, QA criteria and task dependencies.",
        queue: sequence.queue };
      const prompt = await this.agentPrompt(taskId, next.agentId);
      const tab = await this.openAgentTab(taskId,next.agentId,next.providerId);
      return { taskId, dispatched: true, agentId: next.agentId,
        providerId: next.providerId, prompt,
        manualProviderHandoff: true,
        browserTab: tab };
    }

    async openSupervisorTab(taskId, providerId) {
      return this.openAgentTab(taskId, "supervisor", providerId);
    }

    // Local AI runtime: every tool step is explicitly requested by the owner.
    async agentCreate(taskId, mode, model, approvedHosts) {
      if (!TASK_ID.test(taskId)) throw new Error("Invalid work order");
      const all = await this.orders();
      const order = all[taskId];
      if (!order) throw new Error("Unknown work order");
      return this.native({
        command:"agent_create",companyId:order.companyId,orderId:taskId,
        instruction:order.instruction,mode,model,approvedHosts
      });
    }
    async agentMemory(taskId,command,key="",value="") {
      if (!TASK_ID.test(taskId) ||
          !new Set(["agent_memory_put","agent_memory_list","agent_tools"]).has(command))
        throw new Error("Invalid memory or catalog action");
      const orders=await this.orders();
      const order=orders[taskId];
      if(!order)throw new Error("Unknown work order");
      return this.native({command,companyId:order.companyId,key,value});
    }
    async agentList(taskId) {
      if (!TASK_ID.test(taskId)) throw new Error("Invalid work order");
      const all=await this.orders();
      const order=all[taskId];
      if(!order)throw new Error("Unknown work order");
      const result=await this.native({command:"agent_list",companyId:order.companyId});
      return {jobs:(result.jobs||[]).filter(item=>item.orderId===taskId)};
    }
    async agentCommand(taskId,jobId,command,extra={}) {
      if (!TASK_ID.test(taskId)||!TASK_ID.test(jobId))
        throw new Error("Invalid order or job ID");
      const allowed=new Set([
        "agent_get","agent_approve","agent_run_next","agent_run_safe_batch",
        "agent_review","agent_cancel","agent_recover"
      ]);
      if(!allowed.has(command))throw new Error("Unsupported local agent command");
      const all=await this.orders();
      const order=all[taskId];
      if(!order)throw new Error("Unknown work order");
      const request={command,companyId:order.companyId,jobId};
      if(command==="agent_approve") {
        if(extra?.approved!==true || typeof extra.reviewFingerprint!=="string" ||
            !/^plan-v1:[A-F0-9]{64}$/.test(extra.reviewFingerprint))
          throw new Error("Refresh and review the exact plan before approving");
        request.approved=true;
        request.reviewFingerprint=extra.reviewFingerprint;
      }
      const reply=await this.native(request);
      if(command!=="agent_run_next" || reply.status!=="awaiting_browser_navigation")
        return reply;
      // An approved browser plan may only request navigation, never DOM access.
      const snapshot=await this.native({command:"agent_get",companyId:order.companyId,jobId});
      const step=snapshot.plan?.steps?.[snapshot.stepIndex];
      if(!step || step.tool!=="browser_open" || step.input!==reply.url)
        throw new Error("Untrusted browser navigation did not match reviewed plan");
      const url=new URL(reply.url);
      if(url.protocol!=="https:" || !snapshot.approvedHosts.includes(url.hostname))
        throw new Error("Browser destination is not in the approved host list");
      const tab=await this.api.tabs.create({url:url.href,active:true});
      if(!Number.isInteger(tab.id)||tab.id<=0)
        throw new Error("Browser did not return a real tab ID");
      const receipt=await this.native({
        command:"agent_complete_browser",companyId:order.companyId,jobId,
        token:reply.token,url:url.href,tabId:tab.id
      });
      return {...receipt,tabId:tab.id,note:
        "Orgaiz opened an approved tab. No page content or action outcome has been verified."};
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
      return globalThis.TheOrgSkills.agentPrompt(order.instruction || order.title, order.plan, agentId);
    }

    async openAgentTab(taskId, agentId, providerId, allowRecovery = false) {
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
          const task = order.plan.tasks.find(t => t.id === agentId);
          const reports = order.agentReports || {};
          const checks = order.qaFindings || {};
          const allArtifacts = await this.listArtifacts(taskId);
          function agentArtifactsValid(depId) {
            const current = new Map();
            for (const item of allArtifacts.filter(a => a.agentId === depId)) {
              const prev = current.get(item.fileName);
              if (!prev || (item.version || 0) > (prev.version || 0))
                current.set(item.fileName, item);
            }
            return [...current.values()].every(a => a.integrityValid === true &&
              a.formatValid === true &&
              a.intakeStatus === "structure_verified_content_qa_pending");
          }
          const dependenciesReady = (task.dependencies || []).every(depId => {
            const dependency = order.plan.tasks.find(t => t.id === depId);
            const report = reports[depId];
            if (!dependency || !report || report.outcome !== "submitted" ||
                !agentArtifactsValid(depId)) return false;
            return dependency.acceptanceCriteria.every((_, index) => {
              const finding = (checks[depId] || {})[index];
              return finding && finding.verdict === "pass" &&
                finding.handoffUtc === report.savedUtc;
            });
          });
          if (!dependenciesReady)
            throw new Error("Complete prerequisite handoffs and record QA findings before opening dependent agent tabs");
        }
        if (order.phase === "archived") throw new Error("Archived task cannot open tabs");

        const session = await this.owned();
        const state = session[taskId] || { tabs: [], groupId: null, windowId: null };
        if (state.tabs.length >= 16) throw new Error("Limit of 16 task tabs reached");
        if (agentId !== "supervisor" &&
            state.tabs.some(tab => tab.agentId === agentId)) {
          throw new Error("Agent already has an open Orgaiz task tab");
        }
        if (agentId !== "supervisor" && !allowRecovery &&
            order.agentSessions?.[agentId]?.status === "open") {
          throw new Error("Previous browser session ownership was lost; use Recover task to open a new owned tab");
        }

        // Create Orgaiz-owned tabs only. Never group an existing personal tab.
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
        if (agentId !== "supervisor") {
          order.agentSessions = order.agentSessions || {};
          order.agentSessions[agentId] = {
            status: "open", providerId, startedUtc: item.createdUtc,
            recoveryNote: allowRecovery
              ? "Opened a new task-owned tab without closing previously untracked tabs"
              : "Normal task-owned Chrome tab"
          };
          await this.saveOrders(all);
        }

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
            title: "Orgaiz • " + taskId.slice(0, 8),
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

    async recoverAgentTask(taskId, agentId) {
      if (!TASK_ID.test(taskId) || !AGENT.test(agentId))
        throw new Error("Invalid recovery request");
      const all = await this.orders();
      const order = all[taskId];
      if (!order || order.agentSessions?.[agentId]?.status !== "open")
        throw new Error("No untracked agent session to recover");
      const owned = await this.owned();
      if (((owned[taskId] || {}).tabs || []).some(t => t.agentId === agentId))
        throw new Error("Orgaiz already owns an active tab for this agent");
      const task = (order.plan?.tasks || []).find(t=>t.id===agentId);
      if (!task) throw new Error("Agent is not in the current plan");
      const prompt = await this.agentPrompt(taskId,agentId);
      const browserTab = await this.openAgentTab(taskId,agentId,task.provider,true);
      return {
        taskId,agentId,providerId:task.provider,browserTab,prompt,
        untrackedTabsWereClosed:false,
        note:"Previously untracked browser tabs were left untouched."
      };
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
      await this.invalidateAgentQA(taskId, agentId,
        "New agent artifact imported; previous acceptance findings must be repeated");
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
      if (command === "complete_artifact_upload" &&
          result.result && result.result.artifact && result.result.artifact.agentId) {
        await this.invalidateAgentQA(taskId,result.result.artifact.agentId,
          "New agent artifact transfer completed; previous acceptance findings must be repeated");
      }
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

    async previewTextArtifact(taskId, artifactId) {
      if (!TASK_ID.test(taskId) || !TASK_ID.test(artifactId))
        throw new Error("Invalid order or artifact ID");
      const all = await this.orders();
      const order = all[taskId];
      if (!order) throw new Error("Unknown work order");
      const result = await this.native({
        command: "preview_text_artifact", companyId: order.companyId,
        orderId: taskId, artifactId
      });
      return result.preview;
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
        order.agentSessions = order.agentSessions || {};
        order.agentSessions[agentId] = {
          status:"handoff_saved", providerId: order.agentSessions[agentId]?.providerId || "",
          handedOffUtc: reports[agentId].savedUtc
        };
        // Any subsequent handoff invalidates prior manual QA findings for this agent.
        if (order.qaFindings) delete order.qaFindings[agentId];
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

    // QA findings are explicitly labelled manual and not independently authenticated.
    // A selected AI provider's opinion or the agent's own claim cannot certify completion.
    async recordQaFinding(taskId, agentId, criterionIndex, verdict, evidence) {
      if (!TASK_ID.test(taskId) || !AGENT.test(agentId) ||
          !Number.isInteger(criterionIndex) || criterionIndex < 0 ||
          !["pass", "fail", "needs_information"].includes(verdict) ||
          typeof evidence !== "string" || evidence.trim().length < 30 ||
          evidence.length > 4000)
        throw new Error("Invalid QA evidence: provide 30–4000 characters per criterion");
      return this.serialize(async () => {
        const all = await this.orders();
        const order = all[taskId];
        if (!order || !order.plan || !order.plan.reviewed)
          throw new Error("Approve the Supervisor plan before checking criteria");
        const task = order.plan.tasks.find(t => t.id === agentId);
        if (!task || criterionIndex >= task.acceptanceCriteria.length)
          throw new Error("Unknown assignment or criterion");
        const report = (order.agentReports || {})[agentId];
        if (!report || report.outcome !== "submitted")
          throw new Error("Agent must submit a handoff before QA can review it");

        order.qaFindings = order.qaFindings || {};
        order.qaFindings[agentId] = order.qaFindings[agentId] || {};
        order.qaFindings[agentId][criterionIndex] = {
          criterion: task.acceptanceCriteria[criterionIndex],
          verdict,
          evidence: evidence.trim(),
          reviewerRole: "qa_auditor",
          identityVerified: false,
          evidenceType: "manual_review_unverified_identity",
          reviewedUtc: new Date().toISOString(),
          handoffUtc: report.savedUtc
        };
        order.review = {
          verdict: "pending",
          reason: "QA finding recorded; independent identity and evidence verification remain outstanding"
        };
        await this.saveOrders(all);
        return { taskId, agentId, criterionIndex, verdict,
          verification: "manual_review_unverified_identity" };
      });
    }

    async getQaPacket(taskId) {
      if (!TASK_ID.test(taskId)) throw new Error("Invalid task ID");
      const all = await this.orders();
      const order = all[taskId];
      if (!order || !order.plan) throw new Error("No plan found");
      const artifacts = await this.listArtifacts(taskId);
      const packet = {
        schemaVersion: 1,
        taskId,
        companyId: order.companyId,
        instruction: order.instruction,
        phase:order.phase,
        ownerAcceptance:order.acceptance ? {acceptedUtc:order.acceptance.acceptedUtc,
          evidence:order.acceptance.evidence,identityVerified:false,independentlyCertified:false} : null,
        reviewedPlan: !!order.plan.reviewed,
        tasks: order.plan.tasks.map(task => ({
          agentId: task.id, role: task.role,
          objective: task.objective,
          acceptanceCriteria: task.acceptanceCriteria,
          handoff: (order.agentReports || {})[task.id] || null,
          findings: (order.qaFindings || {})[task.id] || {}
        })),
        artifacts: artifacts.map(a => ({
          artifactId: a.artifactId, agentId: a.agentId,
          filename: a.fileName, sha256: a.sha256,
          version: a.version, intakeStatus: a.intakeStatus,
          malwareScanStatus: a.malwareScanStatus || "not_scanned",
          contentQaStatus: a.contentQaStatus || "pending_independent_review"
        })),
        trustLimitations: [
          "QA findings are manually entered and reviewer identity is not authenticated.",
          "Checksums and structural checks are not semantic QA or malware scanning.",
          "AI chat messages and plugin outputs are untrusted advice, not completion evidence."
        ]
      };
      packet.improvementCandidates = globalThis.TheOrgSkills.improvementCandidates(packet);
      return packet;
    }

    async qaAuditorPrompt(taskId) {
      const packet = await this.getQaPacket(taskId);
      return globalThis.TheOrgSkills.auditorPrompt(packet);
    }


    completionBasis(order) {
      return JSON.stringify({companyId:order.companyId,instruction:order.instruction,
        plan:order.plan,reports:order.agentReports||{},findings:order.qaFindings||{},
        sessions:order.agentSessions||{}});
    }

    latestCompletionFiles(files) {
      const latest=new Map();
      for(const item of files){
        const key=item.agentId+"\0"+item.fileName;
        if(!latest.has(key)||(item.version||0)>(latest.get(key).version||0))latest.set(key,item);
      }
      return [...latest.values()].sort((a,b)=>String(a.artifactId).localeCompare(String(b.artifactId)));
    }

    completionSnapshot(order, files) {
      return JSON.stringify({basis:this.completionBasis(order),files:this.latestCompletionFiles(files)
        .map(a=>({id:a.artifactId,agentId:a.agentId,name:a.fileName,version:a.version,
          sha256:a.sha256,integrityValid:a.integrityValid,formatValid:a.formatValid,
          intakeStatus:a.intakeStatus}))});
    }

    async acceptCompletion(taskId, snapshot, evidence) {
      if(!TASK_ID.test(taskId)||typeof snapshot!=="string"||!snapshot||
         typeof evidence!=="string"||evidence.trim().length<30||evidence.length>4000)
        throw new Error("Review the delivery and provide 30-4000 characters of owner acceptance evidence");
      let review=await this.supervisorReview(taskId);
      if(!review.completionReady||review.completionSnapshot!==snapshot)
        throw new Error("Delivery changed or is not ready. Check results and blockers again");
      const files=this.latestCompletionFiles(await this.listArtifacts(taskId));
      for(const file of files){
        const checked=await this.verifyArtifact(taskId,file.artifactId);
        if(!checked.integrityValid||!checked.formatValid||checked.sha256!==file.sha256)
          throw new Error("Delivered file failed re-verification. Review the corrected delivery");
      }
      review=await this.supervisorReview(taskId);
      if(!review.completionReady||review.completionSnapshot!==snapshot)
        throw new Error("Delivery changed during verification. Review the latest files");
      return this.serialize(async()=>{
        const all=await this.orders(),order=all[taskId];
        if(!order||order.review?.completionSnapshot!==snapshot||
           this.completionSnapshot(order,files)!==snapshot)
          throw new Error("Order changed before acceptance. Check results again");
        const owned=await this.owned();
        if((owned[taskId]?.tabs||[]).some(t=>t.agentId!=="supervisor"))
          throw new Error("Save and close specialist handoffs before accepting delivery");
        order.acceptance={snapshot,basis:this.completionBasis(order),evidence:evidence.trim(),
          acceptedUtc:new Date().toISOString(),acceptedBy:"local_owner_action",
          identityVerified:false,independentlyCertified:false};
        order.phase="completed_owner_accepted";
        order.review={...order.review,verdict:"owner_accepted_completion",
          reason:"Owner accepted the reviewed delivery. Identity and semantic correctness are not independently certified."};
        await this.saveOrders(all);
        return {taskId,phase:order.phase,verdict:order.review.verdict,independentlyCertified:false};
      });
    }

    async supervisorReview(taskId) {
      if (!TASK_ID.test(taskId)) throw new Error("Invalid task ID");
      const all = await this.orders();
      const order = all[taskId];
      if (!order) throw new Error("Work order not found");
      const basis=this.completionBasis(order);

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
      // Demo files are not proof of real work and must not be required for a real order.
      // Historic versions remain in the library; assess only the latest version per name/agent.
      const demoMetadataConsistent = demonstrationArtifacts.every(item =>
        /^[A-Fa-f0-9]{64}$/.test(item.sha256 || ""));
      const latest = new Map();
      for (const item of importedArtifacts) {
        const key = item.agentId + "\\0" + item.fileName;
        const old = latest.get(key);
        if (!old || (item.version || 0) > (old.version || 0)) latest.set(key,item);
      }
      const activeFiles = [...latest.values()];
      const importedPending = activeFiles.some(item =>
        item.intakeStatus !== "structure_verified_content_qa_pending" ||
        !item.integrityValid || !item.formatValid);
      const planned = order.plan ? order.plan.tasks : [];
      const everyAgentReported = planned.length > 0 &&
        planned.every(t => order.agentReports && order.agentReports[t.id]);
      const allSubmitted = everyAgentReported &&
        planned.every(t => order.agentReports[t.id].outcome === "submitted");
      const reviews = order.qaFindings || {};
      const allManualCriteriaPresent = planned.length > 0 &&
        planned.every(task => task.acceptanceCriteria.every((_, index) =>
          reviews[task.id] && reviews[task.id][index] &&
          (order.agentReports || {})[task.id] &&
          reviews[task.id][index].handoffUtc === order.agentReports[task.id].savedUtc));
      const anyCriterionFailed = planned.some(task =>
        Object.values(reviews[task.id] || {}).some(f =>
          f.verdict === "fail" || f.verdict === "needs_information"));
      const allManualCriteriaPassed = allManualCriteriaPresent &&
        planned.every(task => task.acceptanceCriteria.every((_, index) =>
          reviews[task.id][index].verdict === "pass"));
      let verdict = !everyAgentReported ? "awaiting_agent_handoff" :
        !allSubmitted ? "agent_blocked_or_needs_help" :
        !demoMetadataConsistent || importedPending ? "blocked" :
        anyCriterionFailed ? "qa_revision_required" :
        allManualCriteriaPassed ? "manual_qa_recorded_owner_confirmation_pending" :
        "pending_independent_verification";
      const completionReady=!!order.plan?.reviewed && allSubmitted && allManualCriteriaPassed &&
        demoMetadataConsistent && !importedPending && activeFiles.length>0 &&
        activeFiles.every(a=>TASK_ID.test(a.artifactId)&&/^[a-fA-F0-9]{64}$/.test(a.sha256||"")&&
          planned.some(t=>t.id===a.agentId));
      const completionSnapshot=completionReady ? this.completionSnapshot(order,activeFiles) : null;
      if(completionReady&&order.acceptance?.snapshot===completionSnapshot)
        verdict="owner_accepted_completion";
      const reason = verdict === "owner_accepted_completion"
        ? "Owner accepted the reviewed delivery. Identity and semantic correctness are not independently certified."
        : verdict === "manual_qa_recorded_owner_confirmation_pending"
        ? "Every criterion has a manually recorded pass; reviewer identity and substantive evidence are not independently authenticated. Owner confirmation remains required."
        : verdict === "qa_revision_required"
          ? "At least one acceptance criterion failed or requires more information; return the assignment to the responsible agent."
        : verdict === "pending_independent_verification"
        ? "Artifacts have recorded hashes, but no independent semantic or provider verification exists."
        : verdict === "awaiting_agent_handoff"
          ? "One or more specialist tasks have not yet submitted a report."
          : verdict === "agent_blocked_or_needs_help"
            ? "At least one specialist reported a blocker or requested assistance."
            : "Artifact manifest was missing or invalid.";

      await this.serialize(async () => {
        const latest = await this.orders();
        if (!latest[taskId]) return;
        if(this.completionBasis(latest[taskId])!==basis)
          throw new Error("Order changed during review. Check results and blockers again");
        latest[taskId].review = { verdict, reason, checkedUtc: new Date().toISOString(),
          completionReady,completionSnapshot };
        latest[taskId].phase = verdict==="owner_accepted_completion"
          ? "completed_owner_accepted" : "awaiting_supervisor_review";
        await this.saveOrders(latest);
      });
      return {taskId, verdict, reason,completionReady,completionSnapshot,
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


