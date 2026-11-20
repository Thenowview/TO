// Independent AO policy prototype, not a production authorization service.
// The TEBE API must independently enforce verified principals, tenants, entitlements and approvals.
export function decideAO({tool,identity,approval,request}={}) {
  if (tool?.enabled !== true || identity?.authenticated !== true ||
      typeof identity?.principalId !== "string" || !identity.principalId.trim() ||
      typeof identity?.tenantId !== "string" || !identity.tenantId.trim())
    return {verdict:"DENY",reason:"disabled_or_unauthenticated"};
  if (identity.entitled !== true || identity.tenantAuthorized !== true ||
      typeof tool.id !== "string" || !tool.id || !Array.isArray(identity.allowedToolIds) ||
      !identity.allowedToolIds.includes(tool.id))
    return {verdict:"DENY",reason:"unauthorized_tool"};
  if (!["read","reversible_write","external_write","privileged"].includes(tool.risk))
    return {verdict:"DENY",reason:"unknown_risk"};
  if (!["native","mcp_stdio","mcp_http","tebe_api"].includes(tool.transport))
    return {verdict:"DENY",reason:"unknown_transport"};
  if (tool.transport==="mcp_stdio" && identity.approvedNativeHost !== true)
    return {verdict:"DENY",reason:"unapproved_native_host"};
  if (tool.transport==="mcp_http" &&
      (!validEndpoint(identity.endpoint) || !Array.isArray(identity.allowedMcpEndpoints) ||
       !identity.allowedMcpEndpoints.includes(identity.endpoint)))
    return {verdict:"DENY",reason:"unapproved_endpoint"};
  if (tool.risk==="external_write" || tool.risk==="privileged")
    return approval?.verifiedForRequest === true && approval?.approvedByHuman === true &&
      typeof request?.requestId === "string" && request.requestId.length >= 8 &&
      approval.requestId === request.requestId && approval.toolId === tool.id &&
      approval.tenantId === identity.tenantId && approval.principalId === identity.principalId
      ? {verdict:"ALLOW",reason:"verified_human_approval"}
      : {verdict:"ASK",reason:"human_approval_required"};
  if (tool.risk==="reversible_write" && identity.routineWriteAllowed !== true)
    return {verdict:"ASK",reason:"write_approval_required"};
  return {verdict:"ALLOW",reason:"policy_allow"};
}

// Syntax validation only: transport must separately enforce DNS/SSRF and TLS policy.
function validEndpoint(value) {
  if (typeof value !== "string" || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname &&
      !url.username && !url.password && !url.hash;
  } catch { return false; }
}

