# Security policy

## Reporting vulnerabilities

Please don't post exploitable details, credentials or personal data in public issues.
Use the repository's **Security → Report a vulnerability** private advisory feature.
If private reporting isn't available, contact a maintainer privately to arrange a secure
channel first. There is no guaranteed response time; track the latest release.

## How Amuse is meant to run

Amuse is a personal agent for **one person on their own computer**. It has no accounts or login,
so anyone who can reach its port controls the agent, its saved credentials and its memory.

- It listens on `127.0.0.1` by default and warns at startup if `HOST` is set to anything else.
  `docker-compose.yml` publishes the port on `127.0.0.1` only. Don't expose it on a network or the
  internet.
- It answers only requests addressed to `localhost`, and only accepts changes (POST, PUT, PATCH,
  DELETE) from its own pages: requests from other origins, sandboxed frames (`Origin: null`),
  cross-site fetches and HTML form posts are refused. This stops other websites you visit,
  including DNS-rebinding tricks, from driving the agent.

## What the agent can and can't do

**Network.** Every request the agent makes (web fetches, connector calls, calendar feeds and the
live browser) can only reach public internet addresses. Hostnames are resolved and checked on every
hop, and the connection goes to the address that was checked. The browser runs behind a local proxy
that applies the same rule to every page, redirect, subresource and websocket. Loopback, private,
link-local, carrier-grade NAT, IPv4-mapped and IPv4-compatible IPv6, and cloud metadata addresses
are refused.

**Credentials.**

- Saved logins and API keys are encrypted at rest (AES-256-GCM) with a key created on first run in
  `.data/secret.key`. The model only sees stand-in tokens.
- When the agent asks you for a key, the card shows the exact site it will be sent to, and you
  confirm that site before saving. A key labelled for a well-known service (GitHub, OpenAI, Slack,
  Stripe and others) can't be bound to a different site.
- A stand-in is swapped for the real value only in the authentication header of an HTTPS request to
  the exact host it was saved for, never in a URL or request body. In the live browser it's only
  typed into password or login fields on that host.
- The first request with a newly saved key always asks you, whatever you've allowed before.
  Requests carrying a key don't follow redirects to other hosts.
- Page text, URLs and titles the browser reads back are scrubbed of saved secrets (plain,
  URL-encoded and base64) before the model sees them.

**Approvals.** Tool actions that send, change, submit, pay or schedule something go through the
sentinel, which allows them, refuses them or asks you with an approval card.

- Payments always ask, and no earlier approval covers them. Every browser click is checked for
  payment signals (button and heading text, prices, card fields, checkout-style addresses). This is
  a heuristic: review every card.
- Form submissions ask, including pressing Enter in a form and buttons with no readable label.
  Radio buttons, checkboxes, dropdowns and text fields never ask. "Allow for this task" covers only
  the same action on the same page element, not the whole site.
- "Always allow" for email covers one recipient, not every address.
- Your memory is part of every conversation, so any address the agent writes itself (opening a URL,
  fetching a page, typing into a site, calling an API that isn't a saved connection) asks first
  unless you named that site in the chat or the exact link came from a search result. Clicking a
  link that's already on a page doesn't count. "Allow for this site" trusts the site from then on.
- Once a run has read outside content (web pages, search results, email, calendar, connector
  responses), changing your memory files (`USER.md`, `MEMORY.md`, `memory/`), adding ideas and
  rewriting a space's page ask first. Facts you tell the agent directly are saved without asking.
- Changing the agent's instruction files (`SOUL.md`, `AGENTS.md`, `IDENTITY.md`, `HEARTBEAT.md`,
  `BOOTSTRAP.md`) and creating background tasks or repeating schedules ask (one-off reminders, which only post a message, don't). Background runs can't create schedules, there are at
  most 20 active schedules, and none repeats more often than every 15 minutes. Ideas show the exact
  request before they run.
- With **Connectors: Always ask** set in Settings, every connector action asks, even if a
  connection's own setting is looser. Reading public pages is allowed by default; **Web access:
  Always ask** makes website visits, including links that lead to another site, ask too.

**Generated pages.** Artifacts and spaces are served with a CSP `sandbox` (no same-origin access),
no `fetch`/XHR, no form submissions, and images, media, fonts and scripts only from the page itself.
They always render inside a frame that can't be navigated to another site, so a page can't send data
out by changing its address, following a link or using a meta refresh. Their frames can't open
popups, show dialogs or navigate the Amuse tab. A space can only suggest a
message to your agent; you confirm before it's sent. Binary files are served inline only for
allowlisted image, audio and PDF types.

**Browser.** Chromium uses its own sandbox when it can start. As root, or in Docker (whose default
seccomp profile blocks it), it falls back to running without that sandbox and logs a warning; the
Docker image runs as an unprivileged user, so the container is the isolation boundary. Set
`AMUSE_BROWSER_REQUIRE_SANDBOX=1` to refuse to start the browser instead.

**Code.** `run_code` and saved tools run in a QuickJS WebAssembly sandbox with no network or
filesystem, a 64 MB memory cap, a 4 second time limit and capped output.

**Spending.** Amuse stops making model, image and audio calls for the day at `AMUSE_DAILY_LIMIT`
usage units (2,000 by default), checked before each call.

## Your responsibilities

- Keep your OpenAI key in `.env` (never commit it) and set a spend limit on the OpenAI project.
- Back up `.data/secret.key` together with your database; without it saved credentials can't be
  read. Treat both as secrets.
- Prompt injection is an open problem. Pages, emails and calendar entries the agent reads can try
  to steer it. The protections above limit what a steered agent can reach and send, but read
  approval cards before accepting them.
- `AMUSE_E2E=1` mounts test-only routes. It's ignored when `NODE_ENV=production`; never set it on an
  install you use day to day.
