# Signing and licensing decision — 21 November 2026

The owner agreed to retain OT's proprietary licensing direction and not adopt an open-source license merely to qualify for free signing.

- SignPath pursuit is paused. No application was submitted and no open-source license was applied.
- Microsoft Store MSIX remains the intended first public signing/distribution route, subject to account verification, packaging compatibility and certification. Resume verification when the owner has the required documents available.
- The chosen Microsoft sign-in address is retained in the private conversation rather than this repository. Do not commit identity documents, account credentials or signing secrets.
- Development-build testing may continue within existing permissions. Unsigned or locally development-signed builds must not be described as publicly trusted releases. Creating a local development certificate does not clear the production signing gate.
- A trusted commercial signing service can be added later for standalone EXE/MSI distribution. Provider changes must preserve update identity and test migration/coexistence.

This decision records direction only. It does not create a proprietary license grant, establish ownership over third-party code, or alter existing upstream licenses. Third-party notices and restrictions remain applicable.

See [Microsoft Store setup and compatibility work](MICROSOFT_STORE_SETUP.md). No physical acceptance, signed release, Store submission or certification is asserted by this record.
