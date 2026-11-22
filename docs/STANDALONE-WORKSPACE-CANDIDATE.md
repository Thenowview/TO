# GIZE standalone workspace candidate

Owner direction: GIZE pending jobs are conversation threads; each job owns its local memory and browser sessions. Open browser tabs inside the app without requiring a Chrome extension. Local model chat requires no Codex or ChatGPT account. Optional third-party services retain their own accounts and terms.

This branch adds a WebView2 Windows shell, conversation UI, loopback local chat streaming, per-job notes/history, and browser inspection/planning. The existing Chrome extension remains an optional separate surface. Provider pages receive no native message bridge. Website passwords are not stored in model memory, chat notes, or application JavaScript storage. A dedicated credential vault is still pending.

Run `dotnet publish apps/desktop/Gize.Desktop.csproj -c Release -o out/desktop` and launch `Gize.Desktop.exe`. Requires Microsoft Edge WebView2 Runtime and a separately installed Ollama runtime with an installed model listening on 127.0.0.1:11434. The unsigned candidate is not yet a signed public installer. No local model is bundled or downloaded automatically.

Validation must distinguish compilation, synthetic local-runtime tests, actual app launch, provider authentication, owner-PC automation and accepted business outcomes. Provider logins may refuse embedded browsers; no bypass is implemented. General coding-agent parity, adaptive arbitrary PC workflows, credential vault, provider answer collection and production installer/update acceptance remain open. Do not rate the app 10/10 based on source changes.
