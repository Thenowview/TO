# TheOrg Portable — Existing Chrome Edition

**No extra Chrome download. No separate Windows application installer.**
This is an unsigned *developer preview*, not approved for production or sensitive account data.

## Requirements
- Windows 10/11 x64
- Your existing Google Chrome installation (with a Chrome profile you control)
- The ZIP extracted to a **permanent folder**, e.g. Documents\TheOrg-Portable
- No administrator rights required for current-user Native Messaging registration
- Ollama optional for real local model planning; synthetic file tests work without Ollama

## First time — about four clicks
1. Unzip the complete portable package (do not run scripts from inside the ZIP).
2. In the extracted folder, optionally open PowerShell and run:
   powershell -NoProfile -ExecutionPolicy Bypass -File ".\Verify-Portable.ps1"
3. Double-click **RUN-SETUP.cmd**.
4. It opens your EXISTING Chrome at chrome://extensions. Turn on **Developer mode**, click **Load unpacked**, and select **chrome-extension** inside this extracted folder.
5. Copy Chrome's 32-letter Extension ID (a through p only), paste it into the waiting console, and press Enter.
6. The script checks the local bridge, registers one precise Chrome extension origin, saves the extension ID, makes a desktop shortcut **TheOrg - Chrome**, and opens TheOrg.

On later days, double-click the desktop shortcut **TheOrg - Chrome** or the included **OPEN-THEORG.cmd**.

**Chrome approval is required once per browser profile.** Chrome's security model will not allow arbitrary scripts to silently install unpacked extensions. If you use multiple Chrome profiles, make sure TheOrg is loaded in the one in which the shortcut opens. It does not automatically copy your existing bookmarks, cookies, accounts, or profiles.

## Where local files are saved
TheOrg's runtime saves workspace data at:
%LOCALAPPDATA%\TheOrg\workspace

- **OPEN-LOCAL-FILES.cmd** opens the original workspace using Windows Explorer.
- **EXPORT-LOCAL-FILES.cmd** copies the generated \`agent_outputs\` files into \`Local-Files\` within this portable folder, retaining the company and order subdirectories. It never deletes the originals.
- \`Local-Files\` starts empty; it is filled only AFTER a local job generates outputs and you export them.
- The export is not a database backup. SQLite jobs/state remain in the local workspace; export does not copy a live SQLite file.

## First functional smoke test
1. Open TheOrg in Chrome and click **Check connection**; expect "Local controller connected".
2. Create an invented/demo work order.
3. Under local agents, select **Synthetic local file test (no AI)**.
4. Click **Plan selected work order**, review every step, then **Approve reviewed plan**.
5. Click **Run approved local-only steps**, then inspect results and run evidence/QA.
6. Run **EXPORT-LOCAL-FILES.cmd** to copy generated files into this folder.

## Optional actual local AI planning
Install Ollama from https://ollama.com/download/windows and run:
ollama pull qwen3:4b
Start Ollama, choose planning mode **Ollama** with model \`qwen3:4b\`, and approve the generated plan before executing local tools.

## Troubleshooting
- If **RUN-SETUP.cmd** says Chrome not found, verify Chrome is installed and launchable.
- If the extension isn't visible, verify it's loaded in the **same Chrome profile**, via chrome://extensions.
- If connection fails, rerun RUN-SETUP.cmd and paste the real extension ID.
- If you moved the portable folder, rerun setup so Native Messaging points to the new exact bridge path.
- If the old "TheOrg Workspace" desktop shortcut opens a separate browser and errors, **don't use that old shortcut**; use **TheOrg - Chrome**. The old installed preview might overwrite Chrome's Native Messaging mapping; rerun portable setup if that happens.
- Only accept Windows security prompts when you trust the package source and your file hashes match. Do not disable protections globally.

## Safety boundaries
This package provides a bounded local demo and manual/supervised approved tool execution. It does not implement arbitrary shell execution, unrestricted browser clicks, general Windows automation, online AI account integration, credential scraping or a production autonomous employee. It is unsigned and requires device-level acceptance and independent security review before real business use.

Source repo: https://github.com/faisalwrokksa-hub/TO
