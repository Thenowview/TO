// Read-only translation of the existing GIZE native agent_tools catalog.
// This module does NOT connect to or execute native tools; it only normalizes
// capability descriptions for permission-filtered Code Mode discovery.
const RISK = Object.freeze({
  read_only: "read",
  reversible_write: "reversible_write",
  consequential_external: "external_write"
});
const KNOWN = Object.freeze({
  write_note: "Write an approved note inside this job workspace",
  read_note: "Read an approved job workspace note",
  list_notes: "List notes in the approved job workspace",
  system_info: "Read an approved summary of system capabilities",
  browser_open: "Navigate a browser tab to an approved HTTPS host",
  windows_open_notepad: "Launch an explicitly approved Notepad instance"
});
const EXPECTED_RISK = Object.freeze({
  write_note: "reversible_write", read_note: "read_only", list_notes: "read_only",
  system_info: "read_only", browser_open: "consequential_external",
  windows_open_notepad: "consequential_external"
});
const SAFE_ID = /^[a-z][a-z0-9_.-]{2,79}$/;
function ownPlain(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  try {
    if (Object.getPrototypeOf(v) !== Object.prototype) return false;
    return Reflect.ownKeys(v).every(key => typeof key === "string" &&
      Object.getOwnPropertyDescriptor(v, key)?.get === undefined &&
      Object.getOwnPropertyDescriptor(v, key)?.set === undefined);
  } catch { return false; }
}
/**
 * Treat native process output as untrusted. Unknown catalog versions and tools
 * fail closed. The returned catalog contains descriptions only, never a grant.
 */
export function describeNativeTools(receipt) {
  if (!ownPlain(receipt) || receipt.ok !== true ||
    receipt.catalogVersion !== "ao.local.tools.v1" ||
    receipt.mcpEnabled !== false || receipt.remoteToolExecutionEnabled !== false ||
    !Array.isArray(receipt.toolDescriptors) ||
    receipt.toolDescriptors.length !== Object.keys(KNOWN).length)
    return Object.freeze({ ok: false, tools: Object.freeze([]), reason: "native_catalog_unverified" });
  const seen = new Set();
  const tools = [];
  for (const descriptor of receipt.toolDescriptors) {
    if (!ownPlain(descriptor) || !Object.hasOwn(KNOWN, descriptor.id) ||
      descriptor.version !== 1 || !Object.hasOwn(RISK, descriptor.riskClass) ||
      descriptor.riskClass !== EXPECTED_RISK[descriptor.id] ||
      typeof descriptor.requiresOwnerApproval !== "boolean" ||
      descriptor.requiresOwnerApproval !== true ||
      typeof descriptor.permissionScope !== "string" ||
      descriptor.permissionScope.length < 3 ||
      typeof descriptor.execution !== "string" || !SAFE_ID.test(descriptor.execution) ||
      seen.has(descriptor.id)) {
      return Object.freeze({ ok: false, tools: Object.freeze([]), reason: "native_catalog_unverified" });
    }
    seen.add(descriptor.id);
    tools.push(Object.freeze({
      id: "gize.native." + descriptor.id,
      description: KNOWN[descriptor.id],
      risk: RISK[descriptor.riskClass],
      requiresApproval: true
    }));
  }
  return Object.freeze({
    ok: true, tools: Object.freeze(tools),
    executionSupported: false,
    reason: "capability_descriptions_only"
  });
}
