/* Bounded PC Assist browser execution. No remote code, provider traffic, or page-issued commands. */
(() => {
  "use strict";
  const KEY = "gizeBrowserWorkflowsV1";
  const ID = /^[a-f0-9]{32}$/;
  const ACTIONS = new Set(["read", "fill", "click", "wait_text"]);
  function fields(value, allowed) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).some(key => !allowed.includes(key)))
      throw new Error("Unknown workflow fields");
  }
  function text(value, min, max) {
    if (typeof value !== "string" || value.length < min || value.length > max)
      throw new Error("Missing or oversized workflow text");
    return value;
  }
  function url(value) {
    const parsed = new URL(text(value, 10, 2048));
    if (parsed.protocol !== "https:" || parsed.port || parsed.username || parsed.password ||
        !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(parsed.hostname) ||
        /\.(?:local|localhost|internal|lan|test|invalid|example|onion)$/i.test(parsed.hostname) ||
        parsed.hostname === "home.arpa" || parsed.hostname.endsWith(".home.arpa"))
      throw new Error("Use an ordinary HTTPS site without credentials or a custom port");
    return parsed.href;
  }
  function validatePlan(value) {
    fields(value, ["title", "url", "steps"]);
    const plan = {title: text(value.title, 5, 160), url: url(value.url), steps: []};
    if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 20)
      throw new Error("Use 1–20 reviewed steps");
    for (const step of value.steps) {
      fields(step, ["action", "selector", "value", "expectedText"]);
      if (!ACTIONS.has(step.action)) throw new Error("Unsupported browser action");
      const clean = {action: step.action, selector: text(step.selector, 1, 300)};
      if (step.action === "fill") clean.value = text(step.value, 0, 4000);
      else if (Object.hasOwn(step, "value")) throw new Error("Only fill accepts a value");
      if (step.action === "click" || step.action === "wait_text")
        clean.expectedText = text(step.expectedText, 1, 500);
      else if (Object.hasOwn(step, "expectedText")) throw new Error("Unexpected text assertion");
      plan.steps.push(clean);
    }
    return plan;
  }
  function permissions(plan) {
    return {permissions: ["scripting"], origins: [new URL(plan.url).origin + "/*"]};
  }
  async function fingerprint(plan) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(plan)));
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // This complete function is serialized by Chrome into the ISOLATED top-frame world.
  // Selectors and values are data. Never evaluate page text or injected source strings.
  function pageOperation(input) {
    const fail = reason => ({ok: false, reason});
    if (location.origin !== input.origin) return fail("Site changed outside the reviewed origin");
    let matches;
    try { matches = [...document.querySelectorAll(input.step.selector)]; }
    catch { return fail("Invalid target selector"); }
    if (matches.length !== 1) return fail("Target must match exactly one element");
    const el = matches[0];
    const visible = element => {
      const style = getComputedStyle(element);
      return element.isConnected && !element.closest("[inert],[hidden],[aria-hidden='true']") &&
        style.visibility !== "hidden" && style.display !== "none" && element.getClientRects().length > 0;
    };
    if (!visible(el)) return fail("Target is hidden or unavailable");
    const sensitive = element => element.closest("input[type='password'],[autocomplete='current-password'],[autocomplete='new-password'],[autocomplete='one-time-code'],[autocomplete^='cc-'],[data-private]");
    if (sensitive(el)) return fail("Private or credential fields require manual input");
    const content = () => (el.innerText || "").slice(0, 8000);
    if (input.step.action === "read") return {ok: true, text: content(), verified: "visible_text_read"};
    if (input.step.action === "wait_text") {
      const found = content().includes(input.step.expectedText);
      return found ? {ok: true, verified: "expected_text_present"} : fail("Expected text not present");
    }
    if (el.disabled || el.getAttribute("aria-disabled") === "true") return fail("Target is disabled");
    if (input.step.action === "fill") {
      const isInput = el instanceof HTMLInputElement;
      if (!(isInput || el instanceof HTMLTextAreaElement) || el.readOnly ||
          (isInput && !["text", "search", "email", "url", "tel"].includes(el.type)))
        return fail("Only editable ordinary text fields are supported");
      const proto = isInput ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, input.step.value);
      el.dispatchEvent(new Event("input", {bubbles: true}));
      el.dispatchEvent(new Event("change", {bubbles: true}));
      return el.value === input.step.value ? {ok: true, verified: "field_value_read_back"} : fail("Field rejected the value");
    }
    if (input.step.action === "click") {
      const label = (el.innerText || el.getAttribute("aria-label") || "").trim();
      if (label !== input.step.expectedText) return fail("Target label changed since review");
      if (!(el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || el.getAttribute("role") === "button"))
        return fail("Click target must be a button or link");
      if (el instanceof HTMLAnchorElement &&
          (new URL(el.href, location.href).origin !== input.origin || el.target === "_blank" || el.hasAttribute("download")))
        return fail("Cross-site, new-tab, and download links require a separate workflow");
      const form = el.form;
      if (form && new URL(form.action || location.href).origin !== input.origin)
        return fail("Form destination is outside the reviewed origin");
      el.click();
      return {ok: true, verified: "click_dispatched_only"};
    }
    return fail("Unsupported action");
  }

  // Read only: never exposes field values or executes page-provided instructions.
  function inspectPage(input) {
    if (location.origin !== input.origin) return {ok: false, reason: "Inspection left the approved site"};
    const visible = el => !el.closest("[inert],[hidden],[aria-hidden='true']") &&
      getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden" && el.getClientRects().length > 0;
    function selectorFor(el) {
      if (el.id) {
        const selector = "#" + CSS.escape(el.id);
        if (selector.length <= 300 && document.querySelectorAll(selector).length === 1) return selector;
      }
      const parts = []; let current = el;
      for (let depth = 0; current && current !== document.body && depth < 8; depth++, current = current.parentElement) {
        const tag = current.tagName.toLowerCase();
        const siblings = [...current.parentElement.children].filter(item => item.tagName === current.tagName);
        parts.unshift(tag + ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")");
      }
      if (current !== document.body) return null;
      const selector = "body > " + parts.join(" > ");
      return selector.length <= 300 && document.querySelectorAll(selector).length === 1 ? selector : null;
    }
    const controls = [];
    for (const el of document.querySelectorAll("button,a,input,textarea,[role='button'],h1,h2")) {
      if (controls.length === 60) break;
      if (!visible(el) || el.closest("input[type='password'],[autocomplete='current-password'],[autocomplete='new-password'],[autocomplete='one-time-code'],[autocomplete^='cc-'],[data-private]")) continue;
      const selector = selectorFor(el); if (!selector) continue;
      const inputField = el instanceof HTMLInputElement;
      const name = (el.innerText || el.getAttribute("aria-label") || el.labels?.[0]?.innerText || el.getAttribute("placeholder") || "").trim().slice(0, 120);
      controls.push({selector, name,
        canClick: (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || el.getAttribute("role") === "button") && !el.disabled,
        canFill: (el instanceof HTMLTextAreaElement || inputField && ["text", "search", "email", "url", "tel"].includes(el.type)) && !el.disabled && !el.readOnly});
    }
    const observation = {ok: true, title: document.title.slice(0, 160), url: location.href,
      text: (document.body?.innerText || "").slice(0, 3000), controls, fieldValuesRead: false};
    while (JSON.stringify(observation).length > 28000) observation.controls.pop();
    return observation;
  }

  class BrowserWorkflowRunner {
    constructor(api) { this.api = api; this.queue = Promise.resolve(); this.stopped = new Set(); }
    scoped(taskId) { return this.api.forTask ? this.api.forTask(taskId) : this.api; }
    serial(fn) { const next = this.queue.then(fn, fn); this.queue = next.catch(() => {}); return next; }
    async records() { return (await this.api.storage.local.get(KEY))[KEY] || {}; }
    async save(record) {
      const all = await this.records(); all[record.id] = record;
      await this.api.storage.local.set({[KEY]: all});
    }
    async get(taskId, id) {
      if (!ID.test(taskId) || !ID.test(id)) throw new Error("Invalid work-order or workflow identity");
      const record = (await this.records())[id];
      if (!record || record.taskId !== taskId) throw new Error("Workflow does not belong to this work order");
      return record;
    }
    async list(taskId) {
      if (!ID.test(taskId)) throw new Error("Invalid work order");
      return Object.values(await this.records()).filter(record => record.taskId === taskId)
        .sort((a, b) => b.createdUtc.localeCompare(a.createdUtc)).slice(0, 50);
    }
    inspect(taskId, requestedUrl) {
      return this.serial(async () => {
        if (!ID.test(taskId)) throw new Error("Choose a work order first");
        const plan = validatePlan({title: "Inspect selected task page", url: requestedUrl, steps: [{action: "read", selector: "body"}]});
        if (!await this.scoped(taskId).permissions.contains(permissions(plan))) throw new Error("Grant access to the selected site first");
        const tab = await this.scoped(taskId).tabs.create({url: plan.url, active: true});
        if (!Number.isInteger(tab.id) || tab.id <= 0) throw new Error("No inspection tab was created");
        await this.waitLoaded({taskId, tabId: tab.id, plan});
        const rows = await this.bounded(this.scoped(taskId).scripting.executeScript({target: {tabId: tab.id, frameIds: [0]},
          world: "ISOLATED", func: inspectPage, args: [{origin: new URL(plan.url).origin}]}));
        const observation = rows?.find(row => row.frameId === 0)?.result;
        if (observation?.ok !== true) throw new Error(observation?.reason || "No page observation returned");
        const id = crypto.randomUUID().replaceAll("-", "");
        const key = "gizeBrowserInspectionsV1";
        const records = (await this.api.storage.session.get(key))[key] || {};
        records[id] = {id, taskId, tabId: tab.id, url: plan.url, observedUrl: observation.url};
        await this.api.storage.session.set({[key]: records});
        return {sessionId: id, observation};
      });
    }
    async inspection(taskId, id, requestedUrl) {
      if (!ID.test(id || "")) throw new Error("Invalid inspection identity");
      const key = "gizeBrowserInspectionsV1";
      const record = ((await this.api.storage.session.get(key))[key] || {})[id];
      if (!record || record.taskId !== taskId || record.url !== requestedUrl)
        throw new Error("Inspection expired or belongs to another task/page; inspect again");
      return record;
    }
    create(taskId, input, sessionId) {
      return this.serial(async () => {
        if (!ID.test(taskId)) throw new Error("Create a work order first");
        const plan = validatePlan(input);
        if (sessionId) await this.inspection(taskId, sessionId, plan.url);
        // A click dispatch is never proof of success: require a subsequent explicit observation.
        for (let i = 0; i < plan.steps.length; i++)
          if (plan.steps[i].action === "click" && plan.steps[i + 1]?.action !== "wait_text")
            throw new Error("Every click must be followed by a wait_text outcome assertion");
        const record = {id: crypto.randomUUID().replaceAll("-", ""), taskId, plan,
          fingerprint: await fingerprint(plan), status: "awaiting_approval", nextStep: 0,
          receipts: [], createdUtc: new Date().toISOString()};
        if (sessionId) record.inspectionId = sessionId;
        await this.save(record); return record;
      });
    }
    stop(taskId, id) {
      if (!ID.test(taskId) || !ID.test(id)) throw new Error("Invalid workflow");
      this.stopped.add(taskId + ":" + id);
      return {stopRequested: true, note: "Stops before the next action; an action already dispatched cannot be undone."};
    }
    async run(taskId, id, reviewedFingerprint) {
      return this.serial(async () => {
        const record = await this.get(taskId, id);
        if (record.status !== "awaiting_approval") throw new Error("Workflow cannot be replayed; inspect its receipts and create a new plan");
        if (record.fingerprint !== reviewedFingerprint || record.fingerprint !== await fingerprint(validatePlan(record.plan)))
          throw new Error("Reviewed workflow changed");
        if (!await this.scoped(taskId).permissions.contains(permissions(record.plan)))
          throw new Error("Grant access to this exact site before execution");
        record.status = "running";
        record.approvedUtc = new Date().toISOString();
        await this.save(record);
        try {
          // Persist intent before creating a tab. A crash never silently replays an action.
          let tab;
          if (record.inspectionId) {
            const session = await this.inspection(taskId, record.inspectionId, record.plan.url);
            tab = await this.scoped(taskId).tabs.get(session.tabId);
            if (tab.url !== session.observedUrl) throw new Error("Inspected page changed; observe and review a new plan");
          } else tab = await this.scoped(taskId).tabs.create({url: record.plan.url, active: true});
          if (!Number.isInteger(tab.id) || tab.id <= 0) throw new Error("No workflow tab was created");
          record.tabId = tab.id; await this.save(record);
          await this.waitLoaded(record);
          for (let i = 0; i < record.plan.steps.length; i++) {
            if (this.stopped.has(taskId + ":" + id)) { record.status = "stopped"; break; }
            const step = record.plan.steps[i];
            record.nextStep = i; record.inFlight = {index: i, action: step.action};
            await this.save(record);
            const result = await this.perform(record, step);
            record.receipts.push({index: i, action: step.action, ...result, utc: new Date().toISOString()});
            delete record.inFlight; record.nextStep = i + 1;
            await this.save(record);
          }
          if (record.status === "running") record.status = "completed_assertions_passed";
        } catch (error) {
          record.status = "blocked_review_required";
          record.error = String(error.message || error).slice(0, 500);
          record.outcomeUnknown = !!record.inFlight && ["click", "fill"].includes(record.inFlight.action);
        }
        record.finishedUtc = new Date().toISOString(); await this.save(record);
        this.stopped.delete(taskId + ":" + id);
        return record;
      });
    }
    async waitLoaded(record) {
      const taskId = record.taskId;
      const origin = new URL(record.plan.url).origin;
      const deadline = Date.now() + 15000;
      do {
        const tab = await this.scoped(taskId).tabs.get(record.tabId);
        if (tab.url && tab.url !== "about:blank" && new URL(tab.url).origin !== origin)
          throw new Error("Workflow navigated outside the approved site");
        if (tab.status === "complete" && tab.url && new URL(tab.url).origin === origin) return;
        await new Promise(resolve => setTimeout(resolve, 150));
      } while (Date.now() < deadline);
      throw new Error("Page did not load within 15 seconds");
    }
    async perform(record, step) {
      const taskId = record.taskId;
      const origin = new URL(record.plan.url).origin;
      const deadline = Date.now() + (step.action === "wait_text" ? 10000 : 0);
      do {
        if (!await this.scoped(taskId).permissions.contains(permissions(record.plan))) throw new Error("Site access was revoked");
        const tab = await this.scoped(taskId).tabs.get(record.tabId);
        if (!tab.url || new URL(tab.url).origin !== origin) throw new Error("Workflow tab left its approved site");
        let result;
        try {
          const rows = await this.bounded(this.scoped(taskId).scripting.executeScript({target: {tabId: record.tabId, frameIds: [0]},
            world: "ISOLATED", func: pageOperation, args: [{origin, step}]}));
          result = rows?.find(row => row.frameId === 0)?.result;
        } catch (error) {
          // A navigation may replace the document during an observation, never replay a mutation.
          if (step.action !== "wait_text" || Date.now() >= deadline) throw error;
          result = {ok: false, reason: "Page changed during outcome observation"};
        }
        if (result?.ok === true) return result;
        // Retry observations only. Mutating operations are NEVER automatically repeated.
        if (step.action !== "wait_text" || Date.now() >= deadline)
          throw new Error(result?.reason || "Browser returned no execution evidence");
        await new Promise(resolve => setTimeout(resolve, 150));
      } while (true);
    }
    async bounded(promise) {
      let timer;
      try {
        return await Promise.race([promise, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("Browser action timed out; inspect the page before retrying")), 15000);
        })]);
      } finally { clearTimeout(timer); }
    }
  }
  const api = {BrowserWorkflowRunner, validatePlan, permissions, fingerprint, pageOperation, inspectPage};
  globalThis.GizeBrowserWorkflow = api;
  if (typeof module !== "undefined") module.exports = api;
})();
