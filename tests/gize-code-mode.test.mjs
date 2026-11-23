import test from "node:test";
import assert from "node:assert/strict";
import { createGizeCodeMode } from "../code-mode/gateway.mjs";

const ctx = { jobId: "job-12345", principalId: "user-12345", tenantId: "tenant-12345" };
const tools = [
  { id: "gize.read", risk: "read", description: "Read synthetic workspace status" },
  { id: "gize.write", risk: "reversible_write", description: "Write synthetic workspace note" },
  { id: "gize.admin", risk: "privileged", description: "Privileged operation" }
];
const fakeRunner = Object.freeze({
  kind: "isolated_worker",
  // Test double only: never executes generated code and is NOT a real sandbox.
  async run({ callTool }) { return await callTool("gize.read", {}); }
});
const authorize = async ({ action, tool }) =>
  action === "execute_code" || tool?.id === "gize.read" ? { allow: true } : { allow: false };
test("read-only capability discovery is scoped and bounded", async () => {
  const gateway = createGizeCodeMode({
    tools, canDiscover: async ({ tool }) => tool.id !== "gize.admin"
  });
  assert.equal((await gateway.search({ query: "synthetic" }, ctx)).tools.length, 2);
  assert.equal((await gateway.search({ query: "privileged" }, ctx)).count, 0);
  assert.equal((await gateway.search({ query: "read" }, {})).ok, false);
  assert.equal((await gateway.search({ query: "read", limit: 400 }, ctx)).ok, false);
});
test("cannot execute without an isolated runner", async () => {
  const gateway = createGizeCodeMode({ tools, authorize, invoke: async () => ({ ok: true }) });
  assert.equal(gateway.enabled, false);
  assert.equal((await gateway.execute({ code: "return 1" }, ctx)).error,
    "isolated_execution_not_configured");
});
test("each operation is independently authorized by the host", async () => {
  const seen = [];
  const gateway = createGizeCodeMode({
    tools, runner: fakeRunner, authorize, canDiscover: async () => true,
    invoke: async ({ id }) => { seen.push(id); return { from: "synthetic-fixture" }; }
  });
  const result = await gateway.execute({ code: "untrusted script never evaluated in test" }, ctx);
  assert.equal(result.ok, true);
  assert.equal(result.calls, 1);
  assert.equal(result.result.result.from, "synthetic-fixture");
  assert.deepEqual(seen, ["gize.read"]);
});
test("write, privileged, unknown and oversized operations fail closed", async () => {
  let sideEffects = 0;
  const attempts = [];
  const runner = { kind: "isolated_worker", async run({ callTool }) {
    for (const id of ["gize.write", "gize.admin", "unknown.id"]) {
      attempts.push(await callTool(id, {}));
    }
    return attempts;
  }};
  const gateway = createGizeCodeMode({
    tools, runner,
    authorize: async () => ({ allow: true }),
    invoke: async () => { sideEffects++; return true; }
  });
  const result = await gateway.execute({ code: "synthetic" }, ctx);
  assert.equal(result.ok, true);
  assert.equal(sideEffects, 0);
  assert.deepEqual(result.result.map(x => x.ok), [false, false, false]);
  assert.equal((await gateway.execute({ code: "x".repeat(20000) }, ctx)).ok, false);
});
test("untrusted objects and duplicate tool IDs are rejected", async () => {
  assert.throws(() => createGizeCodeMode({ tools: [tools[0], tools[0]] }));
  const gateway = createGizeCodeMode({ tools, runner: fakeRunner, authorize });
  const inherited = Object.create(ctx);
  assert.equal((await gateway.execute({ code: "test" }, inherited)).ok, false);
  assert.equal((await gateway.search({ query: "read" }, ctx)).error, "discovery_disabled");
});
