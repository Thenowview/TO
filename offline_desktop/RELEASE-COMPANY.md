# TheOrg Chrome Company Workflow — release candidate

Open TheOrg-Company.exe. It starts a private local engine and opens Chrome with
an automatic local connection. Chrome's existing signed-in profile remains in
Chrome. A fresh website login must be completed by the owner in that website.
The executable creates a persistent `.theorg` directory beside itself. Keep that
directory when upgrading; it holds task history, local memory and workspace files.
Onefile startup extracts its bundled runtime/model to Windows temporary storage.

## Start a company task

Open **Company workflow** above the chat. Turn on Managed workflow if needed.
Choose Research report, Meeting actions or Customer response; enter actual facts
and submit. Manager assigns the selected worker and records a work brief.
The worker drafts an answer; Reviewer sends advisory findings to Manager.
Use **View employee handoffs** to inspect their messages. These are sequential
roles using the same model, not independent models or evidence of factual accuracy.

If local information is insufficient, use **Research in ChatGPT or another source**.
Open the signed-in site, research the question and paste the answer and HTTPS
source. Browser research is a MANUAL HANDOFF. This release does not automatically
read ChatGPT chats, send messages, or perform arbitrary website/desktop actions.

After checking the actual answer/deliverable, provide **Verification evidence** and
**Lesson learned**. **Verify, save lesson and close** atomically completes the task
and saves reviewed shared knowledge. Failed, cancelled and unreviewed output is
not promoted to trusted recall. Even recalled answers require applicability review.
Shared working recall reads at most 500 reviewed entries; older entries are marked
superseded, retained and recoverable. No model weights are trained automatically.

## Optional automatic online research

Only an existing owner-authorized API configuration is used:
`THEORG_ONLINE_PROVIDER=openai`, `THEORG_ONLINE_MODEL=<your authorized model>`,
and `OPENAI_API_KEY` in the process environment. Never put keys in a package,
source control or a task. Restart the engine after configuring its environment.
Use a model supporting Responses web_search. Enable Online research fallback in
the workflow. Provider usage can incur charges on the existing account.
Only the current question is sent; local files, reference notes and saved chat
context are excluded. Questions containing probable credentials are blocked.
An online answer must include HTTPS source citations and still requires review.
With online fallback enabled, every unreviewed local draft is researched; a small
model's confidence is not used as proof of reliability. Previously reviewed answers
still require an applicability check for the new task.
No API credentials are bundled. Live provider execution is not certified unless
the release receipt explicitly records it; a ChatGPT browser login is not API setup.

## Device adaptation and PC access

The one bundled Qwen3.5 0.8B Q4_0 GGUF stays the same size on every device.
Free RAM determines whether it can load; context and CPU threads adapt. Nano
provides model-free tools; Lite uses the bundled model; Advanced requires an
owner-installed larger GGUF and enough RAM. This is not dynamic weight resizing.
All employee inference is serialized on the local engine. Low RAM is a blocker,
not permission to force-load the model. Close unused applications if necessary.

The Windows Operator retains explicit per-tool approvals and bounded tool IDs.
Fixed diagnostics/window inspection may be enabled with the documented
THEORG_ENABLE_WINDOWS_INSPECTION and THEORG_ENABLE_WINDOW_INSPECTION settings.
Tool requests do not come from model text automatically. Sending email, publishing,
spending money and changing company systems need separate service integrations
and appropriate owner permissions. This release does not claim those live actions.

## Provenance and recovery

Bundled model: ggml-org/Qwen3.5-0.8B-GGUF, Apache-2.0; pinned revision
4c11520cef475dd40ed72ec4a1e68b26721bd769, Qwen3.5-0.8B-Q4_0.gguf,
SHA256 57d1997790d1744fba5b40a7317df71ea5e2acee28c47e78f0cce39c0703f8cf.
Bundled llama.cpp CPU runtime: b12248; MinGit: 2.52.0.windows.1. Build script
verifies pinned upstream archive digests. License notices are bundled.
The Windows executable is unsigned. Release receipts report the actual checks.
Only marked, old generated answer caches move to the recoverable recycle folder;
tasks, documents, model weights and browser data are not cleaned automatically.

The existing Code Studio, company job system and approval-bound integrations are
preserved. Their separate requirements, such as a trusted Git project or Docker,
still apply. This release does not establish equivalence with Codex or human staff.
