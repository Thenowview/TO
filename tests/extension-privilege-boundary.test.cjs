/* Security regression: privilege-bearing manifest fields must be explicitly reviewed. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "apps", "chrome-extension", "manifest.json"), "utf8"));

test("GIZE Supervisor cannot silently add external update or OAuth identity configuration", () => {
  assert.equal(manifest.update_url, undefined, "external update URL requires explicit security review");
  assert.equal(manifest.oauth2, undefined, "OAuth client and scopes require explicit security review");
  assert.equal(manifest.key, undefined, "extension identity pinning requires explicit security review");
});

test("GIZE Supervisor cannot silently extend access to incognito or local files", () => {
  assert.equal(manifest.incognito, undefined, "incognito access policy requires explicit review");
  assert.equal(manifest.file_browser_handlers, undefined, "file browser integration requires explicit review");
  assert.equal(manifest.file_handlers, undefined, "file handling requires explicit review");
});

test("GIZE Supervisor retains its reviewed entry points", () => {
  assert.equal(manifest.action?.default_popup, undefined, "new action popup requires explicit review");
  assert.equal(manifest.side_panel?.default_path, "home.html");
  assert.equal(manifest.background?.service_worker, "background.js");
});
