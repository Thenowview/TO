# Portable setup without symbolic-link creation privileges

Normal portable setup previously ran the complete bridge developer self-test after asking for the extension ID. A regression fixture creates a real file symbolic link; ordinary Windows users without that privilege received an IOException and could not register the host.

Setup now verifies PACKAGE-SHA256.txt and runs a bounded native stdio health probe before opening Chrome or requesting an ID. The probe sends only ping and requires one well-formed length-prefixed response, exact TheOrg.Bridge identity, integer protocol version 1, boolean success, no trailing output, and clean process exit. Invalid/oversized frames, malformed UTF-8/JSON and timeout fail setup. The process is terminated if a health check does not complete. This is a connectivity probe, not independent publisher authentication; package hashes supply consistency checking and the build remains unsigned.

No runtime bridge code, file permissions, symbolic-link privilege, Chrome approval or native origin restrictions are changed. The complete --self-test remains mandatory in the existing Windows CI workflow and retains its symbolic-link rejection check. Physical full-self-test acceptance on a PC lacking the privilege remains incomplete; a setup health pass must not be reported as that acceptance.

Validation: the probe passed against the existing portable bridge on the owner PC. Synthetic executable fixtures rejected wrong version/engine/boolean, truncated/oversized frames, trailing output, nonzero exit, malformed JSON/UTF-8, timeout, and a missing executable. CI tests the same probe on Windows PowerShell and still runs the full bridge regressions before packaging. Chrome connection and registry acceptance require separate evidence.
