const {test} = require('node:test');
const assert = require('node:assert/strict');
const Client = require('../apps/chrome-extension/local-chat-client.js');
function fixture() {
  const listeners = {}, sent = [];
  const port = {onMessage: {addListener: f => listeners.message = f}, onDisconnect: {addListener: f => listeners.disconnect = f},
    postMessage: message => sent.push(message)};
  let connections = 0;
  const api = {runtime: {connectNative: () => {connections++; return port;}}};
  return {client: new Client(api), listeners, sent, get connections() {return connections;}};
}
test('persistent chat transport correlates reordered replies and ignores unsolicited messages', async () => {
  const f = fixture(), first = f.client.request({command: 'chat_get'}), second = f.client.request({command: 'chat_models'});
  assert.equal(f.connections, 1);
  f.listeners.message({clientRequestId: 'unknown', reply: {ok: true}});
  f.listeners.message({clientRequestId: f.sent[1].clientRequestId, reply: {ok: true, models: ['mini']}});
  f.listeners.message({clientRequestId: f.sent[0].clientRequestId, reply: {ok: true, messages: []}});
  assert.deepEqual((await second).models, ['mini']); assert.deepEqual((await first).messages, []);
});
test('disconnect rejects pending mutations and never automatically replays them', async () => {
  const f = fixture(), request = f.client.request({command: 'chat_start', nonce: 'fixed'});
  f.listeners.disconnect(); await assert.rejects(request, /connection ended/);
  assert.equal(f.sent.length, 1); assert.equal(f.client.pending.size, 0);
  const next = f.client.request({command: 'chat_get'}); assert.equal(f.connections, 2);
  f.listeners.message({clientRequestId: f.sent[1].clientRequestId, reply: {ok: true}}); await next;
});
test('native failures reject with a useful error and clear correlation state', async () => {
  const f = fixture(), request = f.client.request({command: 'chat_start'});
  f.listeners.message({clientRequestId: f.sent[0].clientRequestId, reply: {ok: false, error: 'invalid_chat_input', detail: 'Choose a model'}});
  await assert.rejects(request, /Choose a model/); assert.equal(f.client.pending.size, 0);
});
