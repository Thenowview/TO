/* Require review before exposing additional browser integration surfaces. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "apps", "chrome-extension", "manifest.json"), "utf8"));

const forbiddenWithoutReview = [
  "commands",
  "omnibox",
  "chrome_settings_overrides",
  "declarative_net_request",
  "devtools_page",
  "protocol_handlers",
  "tts_engine",
  "input_components",
];

test("GIZE Supervisor does not silently add browser interception or integration entry points", () => {
  for (const field of forbiddenWithoutReview) {
    assert.equal(Object.hasOwn(manifest, field), false, `${field} requires explicit security review`);
  }
});
