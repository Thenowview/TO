# PC Assist browser workflow execution — implementation candidate

## Owner objective

THEEPMO PC Assist is branded GIZE Desktop Tools and includes the Chrome extension.
Owner reports that full automation tasks do not complete and PC actions do not occur.
The requested performance target is better task completion than Codex and Agent One.
No comparative performance claim is established by this implementation.

## Implemented scope

The Supervisor now has a browser-workflow panel associated with an existing local
work order. A reviewed, structured plan may perform up to 20 sequential actions on
one exact HTTPS origin: read visible text, fill ordinary text fields, click an
exactly labeled button/link, and wait for expected text. Each click must be followed
by an explicit outcome assertion. The panel displays the exact plan, entered
values, origin and SHA-256 fingerprint before approval.

Execution uses packaged Chrome scripting functions in the isolated top frame.
Selectors resolve to exactly one visible element; page contents never become
executable instructions. A dispatch receipt is distinguished from a successful
text assertion. Completion means the supplied assertions passed, not independent
business certification. Receipts remain in extension-local storage and can be
read by work order after the UI is reopened.

The existing native bridge, local agent tool catalog, tenant/workspace contracts,
encryption and provider manual-handoff behavior remain compatible.

## Explicit permission change for review

Required/install-time permissions and host permissions are unchanged. Optional
capabilities add only scripting plus an HTTPS host declaration; no host access is
granted by the manifest. The packaged Supervisor's explicit Grant access button
requests scripting and the single origin from the reviewed plan. The runner
checks permission before each operation and rejects cross-origin tabs/redirects.
The broader declaration permits selecting an arbitrary HTTPS site at runtime;
the runtime request is never a wildcard and never includes sibling subdomains.

No debugger, cookies, history, desktop capture, remote code, content-script
registrations or external messaging entry points are added. New background routes
accept only the packaged home.html sender and an existing non-archived work order.
No permission was granted and no installed extension was modified in this session.

Official API references:
- https://developer.chrome.com/docs/extensions/reference/api/scripting
- https://developer.chrome.com/docs/extensions/reference/api/permissions

The project-local guidance CLI was not executed: outbound shell networking is
unavailable. Existing standards and the official Chrome API documentation were used.

## Failure and recovery behavior

Plan fingerprints reject stale/tampered approvals. A single background runner
serializes execution so concurrent requests cannot dispatch the same workflow
twice. Intent is persisted before each action. A stopped, completed, blocked or
interrupted workflow is not replayed; review its receipts and page state before
creating a replacement. Stop prevents the next action and cannot undo an action
already sent. Only wait_text observations may be retried. A click or fill is never
automatically retried after a missing response or timeout.

Missing/hidden/ambiguous targets, changed click labels, cross-origin links/forms,
private credential fields, permission revocation and unsupported action names fail
closed. Ordinary text fields may contain private data; the operator must not put
credentials, payment data or verification codes in workflow plans. Plans and read
receipts are local task data, not a credential store.

## Actual validation

64 local Node component/security/contract checks passed, including 17 new workflow
checks. They cover sequence/receipts, permission denial, revoked permission,
tampered approval, work-order isolation, concurrent dispatch, crash replay guard,
stop, UI/background wiring, ambiguous/hidden/private targets, changed labels,
native text-field setter and result readback. Existing Supervisor/native-registration
source checks also passed. These use simulated Chrome and small DOM fixtures;
they are not physical browser, Windows UI or provider-model acceptance.

Windows builds and installer verification must be assessed from the candidate
commit's GitHub checks. Packaging already recursively includes extension assets.

## Remaining acceptance — no VERIFIED promotion

- Run the exact packaged extension on the owner's Chrome profile with explicit
  per-site permission. Demonstrate a real fill → click → outcome assertion.
- Verify a workflow on the intended THEEPMO staging surface with synthetic data.
- General Windows application control is still missing. The native engine only
  offers the existing bounded tools and Notepad launch; this change does not add
  UI Automation, filesystem-wide access or arbitrary command execution.
- Natural-language planning into this workflow format and adaptive page reasoning
  are not implemented. The first version takes an explicitly reviewed JSON plan.
- Cross-site flows, iframes, canvas/vision interactions, trusted input-event-only
  applications, downloads, credentials and automatic provider-chat integration
  remain outside this adapter.
- New panel copy is English only; full localization is not verified.
- Exact-build installation, signing, rollback and release acceptance remain open.

## Comparative benchmark required

Use the same synthetic tasks and environment for GIZE, Codex and Agent One.
Record completed/attempted tasks, independently verified output, elapsed time,
human interventions, recovery behavior and unintended actions. Suggested tasks:
edit and verify a staging form; read a page into a report; recover from a changed
selector; reject a cross-site redirect; edit/save/reopen a Windows document.
Report failures and unavailable capabilities. No benchmark has been run and no
superiority claim is warranted.
