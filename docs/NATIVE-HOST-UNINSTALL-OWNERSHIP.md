# Keep the active native-host registration during older-copy removal

The Chrome Native Messaging registration name `com.theorg.bridge` is shared
between installations. Previously, the standalone unregister script and NSIS
uninstaller deleted that HKCU key unconditionally. Removing an older copy could
therefore disconnect the current copy.

The installed unregister script now defaults ownership to the bridge beside the
script. A source-tree/operator call must supply `-ExecutablePath` for the intended
bridge; relative operator paths are resolved to an absolute path. The script reads
the registered manifest, requires the expected host name and stdio type, and
compares its absolute executable path with the intended executable. Foreign,
malformed or unreadable records are retained. The registry value is checked again
before removal. The manifest and user workspaces are not deleted by this script.

NSIS invokes the ownership-aware script before deleting installed program files.
If the script cannot run, the registration is retained rather than deleting an
unverified shared binding. Setup/uninstall should run serially: this guard is not
an atomic transaction across the registry and manifest file.

Validation:
- `tests/windows-unregister-ownership.ps1` checks matching, foreign, malformed and
  relative-path identities using synthetic JSON only. Local test passed.
- Windows PowerShell CI runs that synthetic regression.
- `tests/windows-install-registration.ps1` tests the actual installed script in
  isolated Windows CI: an explicit foreign executable cannot remove or modify the
  current registration, while the matching executable can unregister it.
- Full NSIS compile/install/uninstall CI remains required for this candidate.

This is a source-level cleanup fix. It does not terminate the locked legacy
Workspace 2 process on the owner's PC or grant new browser/desktop access. Trusted
signing and physical Chrome acceptance remain separate release gates.
