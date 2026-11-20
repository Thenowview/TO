# Reliable Chrome installation discovery

The dedicated-browser launcher uses strict mode and searches both the isolated
profile's `Default/Preferences` and `Default/Secure Preferences`. Chrome may store
extension metadata in the latter only. Previously, reading absent properties from
the ordinary file threw before the fallback could be checked. The outer retry loop
repeated the same exception until launch failed.

The launcher now reads optional JSON properties safely, skips malformed files and
incomplete entries, and continues to Secure Preferences. Selection still requires
the exact packaged manifest name, exact absolute extension folder and a valid
32-character Chrome ID. It does not guess an identity, relax native-host origins,
modify the everyday Chrome profile or install additional permissions.

`tests/windows-launcher-preferences.ps1` uses synthetic files only. It reproduced
the original missing-property exception and now passes. Cases include an empty
ordinary file, unrelated profile settings, null/missing extension settings, invalid
JSON, malformed entries, wrong name/path, invalid identity and no installation.
Windows Bridge CI runs this check in Windows PowerShell, matching the launcher
entry point. The local check uses the available PowerShell host.

This addresses a source-level launch failure. It does not establish successful
physical Chrome/native-host connectivity on the owner's PC. That acceptance,
trusted signing and retirement of the locked legacy program remain separate gates.
