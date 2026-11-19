/* Regression guard: the local-first Supervisor must not silently acquire broad browser access. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "apps", "chrome-extension", "manifest.json"), "utf8"));

const approvedPermissions = new Set(["storage", "tabs", "tabGroups", "nativeMessaging", "sidePanel"]);
const broadPermissions = new Set(["debugger", "management", "proxy", "webRequest", "webRequestBlocking", "cookies", "history", "downloads", "scripting", "activeTab", "desktopCapture", "tabCapture"]);

test("GIZE Supervisor retains a closed extension permission allowlist", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.ok(Array.isArray(manifest.permissions));
  assert.equal(new Set(manifest.permissions).size, manifest.permissions.length, "duplicate permissions");
  assert.deepEqual([...manifest.permissions].sort(), [...approvedPermissions].sort(), "permission expansion requires explicit security review");
  assert.ok(manifest.permissions.every(permission => !broadPermissions.has(permission)));
});

test("GIZE Supervisor does not request wildcard hosts or remote executable scripts", () => {
  assert.deepEqual(manifest.host_permissions || [], [], "host access requires explicit review");
  assert.deepEqual(manifest.optional_host_permissions || [], [], "optional host access requires explicit review");
  assert.deepEqual(manifest.optional_permissions || [], [], "optional permission expansion requires explicit review");
  assert.deepEqual(manifest.content_scripts || [], [], "injected content scripts require explicit review");
  assert.equal(manifest.background?.service_worker, "background.js");
  assert.equal(manifest.background?.type ?? "classic", "classic");
  assert.equal(manifest.externally_connectable, undefined, "external extension messaging requires explicit review");
});


test("GIZE Supervisor does not expose extension resources or browser page overrides", () => {
  assert.deepEqual(manifest.web_accessible_resources || [], [],
    "web-accessible resources require explicit security review");
  assert.deepEqual(manifest.sandbox?.pages || [], [],
    "sandboxed extension pages require explicit security review");
  assert.equal(manifest.content_security_policy, undefined,
    "custom extension CSP requires explicit security review");
  assert.equal(manifest.devtools_page, undefined,
    "extension DevTools access requires explicit security review");
  assert.equal(manifest.chrome_url_overrides, undefined,
    "browser page overrides require explicit security review");
});
