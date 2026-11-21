# Windows installation and extension connection repair

The single-EXE existing-Chrome installer now uses the bounded, framed native-host
health probe instead of the adversarial symbolic-link self-test during setup.
The full self-test remains required in Windows CI. No elevated privileges,
additional Chrome permissions or relaxed approval gates are introduced.

The Supervisor displays native error details, bounds health checks to 15 seconds,
allows saved orders and provider cards to load independently, and resets the
connection button after success or failure. Mutating requests are not timed out
or retried because a timeout cannot cancel native side effects.

Successful main builds retain the Windows EXE and SHA256SUMS.txt in a commit-specific
GitHub developer prerelease instead of relying only on expiring Actions artifacts.
The release remains unsigned and is not a production-readiness certification.

Local evidence on 22 November 2026:

- Portable EXE framed ping, identity, protocol and clean exit: PASS.
- Real EXE work order, artifact import, byte read and company isolation: PASS.
- Real EXE reviewed approval, local batch, restart and cancellation gates: PASS.
- Extension connection, routing, approval, locale and permission checks: 49 PASS.
- Desktop installation, live Chrome connectivity and real Ollama inference:
  not established by these checks. Sandbox tests cannot certify the owner's
  normal Windows registry or modify a protected existing installation.

The downloaded legacy bundled-browser installer is a different package from the
existing-Chrome installer. Avoid mixing its launcher with portable registration.
Reload the existing extension after updating its installed files; loading a
repair-patch directory as a separate extension fails because it lacks a manifest.
