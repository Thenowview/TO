// GIZE Code Mode foundation. Do not execute model-generated JavaScript in this host.
// A separately reviewed, process-isolated runner must be supplied by the caller.
const TOOL_ID = /^[a-z][a-z0-9_.-]{2,79}$/;
const IDENT = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/;
const RISKS = new Set(["read", "reversible_write", "external_write", "privileged"]);
const MAX_CALLS = 12;
const MAX_INPUT = 16_384;
const MAX_OUTPUT = 24_000;
const MAX_WALL_MS = 10_000;

function plain(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype) return false;
    return Reflect.ownKeys(value).every(key => typeof key === "string" &&
      Object.getOwnPropertyDescriptor(value, key)?.get === undefined &&
      Object.getOwnPropertyDescriptor(value, key)?.set === undefined);
  } catch { return false; }
}
function boundedJson(value, limit) {
  const json = JSON.stringify(value);
  if (typeof json !== "string" || Buffer.byteLength(json, "utf8") > limit)
    throw new Error("bounded_json_rejected");
  return JSON.parse(json);
}
// JSON input is copied before policy evaluation. Freeze the entire tree so
// an authorization callback cannot change a nested path, tenant or argument
// after evaluating it but before a privileged dispatcher consumes it.
function freezeJsonTree(value) {
  const pending = [value];
  const seen = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    for (const child of Object.values(current)) pending.push(child);
    Object.freeze(current);
  }
  return value;
}
function trustedContext(context) {
  return plain(context) && ["jobId", "principalId", "tenantId"].every(
    key => typeof context[key] === "string" && IDENT.test(context[key]));
}
function denied(error) { return { ok: false, error }; }

/**
 * Host-controlled search/execute interface. No production execution is enabled
 * without an injected isolated runner, a trusted authorization callback and
 * a host-side tool dispatcher. An in-process eval/vm is NOT a safe runner.
 * Credential material is never passed to the runner by this module.
 */
export function createGizeCodeMode({ tools = [], runner, authorize, invoke, canDiscover, executionTimeoutMs = MAX_WALL_MS } = {}) {
  if (!Number.isInteger(executionTimeoutMs) || executionTimeoutMs < 25 || executionTimeoutMs > MAX_WALL_MS)
    throw new TypeError("invalid_execution_timeout");
  if (!Array.isArray(tools) || tools.length > 512) throw new TypeError("invalid_catalog");
  const catalog = new Map();
  for (const tool of tools) {
    if (!plain(tool) || !TOOL_ID.test(tool.id || "") || !RISKS.has(tool.risk) ||
      typeof tool.description !== "string" || tool.description.length > 300 ||
      catalog.has(tool.id)) throw new TypeError("invalid_tool_definition");
    catalog.set(tool.id, Object.freeze({
      id: tool.id, risk: tool.risk, description: tool.description
    }));
  }

  async function search(request = {}, context) {
    if (!trustedContext(context)) return denied("trusted_context_required");
    try { context = freezeJsonTree(boundedJson(context, MAX_INPUT)); }
    catch { return denied("trusted_context_required"); }
    if (!plain(request) || typeof request.query !== "string" ||
      request.query.trim().length < 2 || request.query.length > 200 ||
      (request.limit !== undefined && (!Number.isInteger(request.limit) ||
        request.limit < 1 || request.limit > 20))) return denied("invalid_search");
    request = { query: request.query, limit: request.limit };
    if (typeof canDiscover !== "function") return denied("discovery_disabled");
    const terms = request.query.toLowerCase().trim().split(/\s+/);
    const visible = [];
    for (const tool of catalog.values()) {
      // A discovery-policy failure must not reveal catalog structure.
      let discoverable = false;
      try { discoverable = (await canDiscover({ tool, context })) === true; }
      catch { return denied("discovery_policy_unavailable"); }
      if (!discoverable) continue;
      const haystack = (tool.id + " " + tool.description).toLowerCase();
      if (terms.every(term => haystack.includes(term))) visible.push(tool);
      if (visible.length >= (request.limit || 8)) break;
    }
    return { ok: true, tools: visible, count: visible.length };
  }

  const runningJobs = new Set();
  async function execute(request = {}, context) {
    if (!trustedContext(context)) return denied("trusted_context_required");
    const key = JSON.stringify([context.tenantId, context.principalId, context.jobId]);
    if (runningJobs.has(key)) return denied("job_execution_in_progress");
    runningJobs.add(key);
    try { return await executeAdmitted(request, context); }
    finally { runningJobs.delete(key); }
  }

  async function executeAdmitted(request = {}, context) {
    if (!trustedContext(context)) return denied("trusted_context_required");
    try { context = freezeJsonTree(boundedJson(context, MAX_INPUT)); }
    catch { return denied("trusted_context_required"); }
    if (!plain(request) || typeof request.code !== "string" ||
      request.code.length < 1 || Buffer.byteLength(request.code, "utf8") > MAX_INPUT)
      return denied("invalid_code");
    const code = request.code;
    // The isolated worker must be provided by trusted host configuration, never by the model.
    if (!runner || runner.kind !== "isolated_worker" || typeof runner.run !== "function" ||
      typeof authorize !== "function" || typeof invoke !== "function")
      return denied("isolated_execution_not_configured");
    let initial;
    try { initial = await authorize({ action: "execute_code", context }); }
    catch { return denied("code_execution_not_authorized"); }
    if (!plain(initial) || initial.allow !== true) return denied("code_execution_not_authorized");
    let calls = 0;
    let active = true;
    let dispatching = false;
    const callTool = async (id, args) => {
      if (!active) return denied("execution_closed");
      // Only one reviewed upstream operation can be in-flight per job.
      if (dispatching) return denied("concurrent_tool_call_denied");
      dispatching = true;
      try {
      calls += 1;
      if (calls > MAX_CALLS) return denied("call_budget_exceeded");
      const tool = catalog.get(id);
      if (!tool) return denied("unknown_tool");
      if (!plain(args)) return denied("invalid_arguments");
      try { args = freezeJsonTree(boundedJson(args, MAX_INPUT)); } catch { return denied("invalid_arguments"); }
      if (tool.risk === "privileged") return denied("privileged_execution_disabled");
      // Re-authorize every individual upstream operation; a code-level grant is
      // never equivalent to a write-level grant or cross-tenant permission.
      let decision;
      try { decision = await authorize({ action: "invoke", tool, args, context }); }
      catch { return denied("tool_execution_not_authorized"); }
      if (!plain(decision) || decision.allow !== true ||
        (tool.risk !== "read" && decision.humanApprovalVerified !== true))
        return denied("tool_execution_not_authorized");
      if (!active) return denied("execution_closed");
      try {
        return { ok: true, result: boundedJson(await invoke({ id: tool.id, args, context }), MAX_OUTPUT) };
      } catch { return denied("tool_execution_failed"); }
      } finally { dispatching = false; }
    };
    // The host enforces a wall-clock deadline in addition to the isolated
    // runner's own timeout. This closes callback permissions after expiry,
    // but the host must still terminate the worker/process to stop CPU use.
    let timer;
    const timeoutError = new Error("execution_timeout");
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => runner.run({
          code, callTool, timeoutMs: executionTimeoutMs, maxCalls: MAX_CALLS
        })),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(timeoutError), executionTimeoutMs);
        })
      ]);
      return { ok: true, result: boundedJson(result, MAX_OUTPUT), calls };
    } catch (error) {
      return denied(error === timeoutError ? "execution_timeout" : "isolated_execution_failed");
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      active = false;
    }
  }

  return Object.freeze({ search, execute, enabled: Boolean(runner && runner.kind === "isolated_worker" &&
    typeof runner.run === "function" && typeof authorize === "function" && typeof invoke === "function") });
}
