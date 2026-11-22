/* Persistent Native Messaging keeps local model streaming alive across UI requests. */
(() => {
  "use strict";
  class LocalChatClient {
    constructor(api) {this.api = api; this.port = null; this.pending = new Map();}
    connect() {
      if (this.port) return this.port;
      const port = this.api.runtime.connectNative("com.theorg.bridge");
      this.port = port;
      port.onMessage.addListener(message => {
        const request = this.pending.get(message?.clientRequestId); if (!request) return;
        this.pending.delete(message.clientRequestId); clearTimeout(request.timer);
        if (message.reply?.ok === true) request.resolve(message.reply);
        else request.reject(new Error(message.reply?.detail || message.reply?.error || "Local chat request failed"));
      });
      port.onDisconnect.addListener(() => {
        const reason = this.api.runtime.lastError?.message || "Windows connection ended; reload history before sending again";
        this.port = null;
        for (const request of this.pending.values()) {clearTimeout(request.timer); request.reject(new Error(reason));}
        this.pending.clear();
      });
      return port;
    }
    request(payload) {
      const port = this.connect(), clientRequestId = crypto.randomUUID().replaceAll("-", "");
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(clientRequestId);
          reject(new Error("Local chat request timed out; reload history before resubmitting"));
        }, 15000);
        this.pending.set(clientRequestId, {resolve, reject, timer});
        try {port.postMessage({...payload, clientRequestId});}
        catch (error) {clearTimeout(timer); this.pending.delete(clientRequestId); reject(error);}
      });
    }
  }
  globalThis.GizeLocalChatClient = LocalChatClient;
  if (typeof module !== "undefined") module.exports = LocalChatClient;
})();
