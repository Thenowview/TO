"use strict";
/* Static, dependency-free Chat/Models UI regression contract.
 * It verifies markup, route use and safe output rendering—not a live browser.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "offline_desktop/static/index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "offline_desktop/static/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "offline_desktop/static/style.css"), "utf8");

test("Chat is the default workspace, not a decorative mockup", () => {
  assert.ok(html.includes('class="view active chat-workspace" id="view-supervisor"'));
  assert.ok(html.includes('data-view="supervisor"'));
  assert.ok(js.includes("let activeView = 'supervisor'"));
  for(const id of ["chatComposer","chatScroll","supervisorResults","chatWelcome",
                   "promptInput","roleSelect","submitTask","newChatButton"])
    assert.ok(html.includes('id="' + id + '"'),"Missing chat control "+id);
  assert.ok(js.includes("request('tasks',{method:'POST'"),"Send must use real task API");
  assert.ok(js.includes("renderChatMessages()"),"Real job history must populate chat");
  assert.ok(js.includes("No verified model response available."));
});

test("Descriptive sidebar and local-only SVG icons are available", () => {
  for (const id of ["supervisor","tasks","coding","operator","company",
                    "models","files","memory","overview","settings"]) {
    assert.ok(html.includes('data-view="' + id + '"'),"Missing sidebar route "+id);
  }
  assert.ok(html.includes("nav-copy"));
  assert.ok(html.includes("data-icon="));
  assert.ok(js.includes("document.createElementNS(NS,'svg')"));
  assert.ok(js.includes("node.replaceChildren(svg)"));
  assert.ok(!html.includes("https://fonts.googleapis.com"));
  assert.ok(!html.includes("<script src=\"https://"));
});

test("Chat keyboard shortcuts and examples never auto-run tools", () => {
  assert.ok(html.includes('data-prompt="Create a practical implementation plan'));
  assert.ok(js.includes("e.key==='Enter'&&!e.shiftKey"));
  assert.ok(js.includes("e.key.toLowerCase()==='k'"));
  assert.ok(js.includes("button.dataset.prompt"));
  assert.ok(js.includes("showToast('Task queued locally"));
  assert.ok(html.includes("Tasks are independent by default."));
  assert.ok(html.includes("Context never grants tool approval."));
  assert.ok(js.includes("element('pre','chat-response-text',job.output)"));
  assert.ok(!js.includes("chat-response-text', '<html"));
});

test("Models page exposes actual hardware advice and cannot benchmark before probe", () => {
  for(const id of ["modelAvailableRAM","modelTotalRAM","modelAvailableVRAM",
                   "modelGpuName","modelRecommendation","modelBenchmarkLock",
                   "refreshHardware","modelBenchmark","modelProbe"])
    assert.ok(html.includes('id="' + id + '"'),"Missing model control "+id);
  assert.match(html,/id="modelBenchmark" disabled/);
  assert.ok(js.includes("data.inference_probe?.benchmark_unlocked===true"));
  assert.ok(js.includes("Run and pass a real local generation probe"));
  assert.ok(js.includes("request('models/probe'"));
  assert.ok(js.includes("request('models/benchmark'"));
});

test("Chat and model hardware cards have responsive layouts and accessible labels", () => {
  assert.ok(css.includes(".chat-composer"));
  assert.ok(css.includes(".hardware-metrics"));
  assert.ok(css.includes("@media(max-width:560px)"));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes('aria-label="Message to a local AI specialist"') ||
            html.includes('for="promptInput"'));
});
