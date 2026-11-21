# Windows smoke-test workspace resolution

The native host resolves LocalApplicationData through Windows/.NET. The Python smoke suites now call Windows SHGetFolderPathW for CSIDL_LOCAL_APPDATA instead of trusting the LOCALAPPDATA environment variable. A process-only environment override must not make the test inspect or clean a different company directory from the host.

The lookup reads the current user's known folder and fails explicitly if unavailable. No environment fallback, registry write, privilege adjustment, host data-root override or runtime change is introduced. Each suite retains its unique synthetic company identifier and limits directory cleanup to that company. The shared agent database retains the existing test behavior; this change does not erase other jobs or companies.

Validation: run both actual-executable suites on Windows with LOCALAPPDATA deliberately redirected. They must still find the same database and outputs as the .NET host. Interactive Chrome and symbolic-link privilege acceptance remain separate checks.
