# GIZE — permanent source asset registry (18 November 2026)

This registry distinguishes **available controlling text** from **reference binaries not yet accessible to GitHub experts**.

| Original item | Content | Availability | SHA-256 / validation |
|---|---|---|---|
| `Theepmo ref1.md` | Reading guide | [Committed in TO](./Theepmo-ref1.md) | Confirm exact source checksum from manifest before archival equivalence |
| `Theepmo ref2.md` | Canonical master prompt + 150 requirement IDs | [Committed in TO](./Theepmo-ref2.md) | `0fc466747c50a9b3740e98da095fa7b89d93f9355eee80e2456aaebabb8f8bc3` from supplied manifest |
| `Theepmo ref3.md` | Windows/OT details | [Committed in TO](./Theepmo-ref3.md) | `8a146afab8e8ef7818ca3f762a814b067732f5c1fefd4ae7a7f2854bd0206374` from supplied manifest |
| `Theepmo ref4.txt` | Infrastructure + design context | [Committed in TO](./Theepmo-ref4.txt) | `84f48c9674a9a0aae89e86d583a1eb6bac3ab9174544bf3ddef43229b7058a12` |
| `Theepmo ref5.zip` | Reference website capture, ~237.8 MB, 81 entries | **Stored inside reassemblable original ZIP in owner's private Google Drive** | `fcfe108b258c47e3896b5844a711c66d1cdb5fa43906d250d7bf7cd211596d66` |
| `Theepmo ref6.zip` | Reference Windows package, ~877.8 MB, 8 entries | **Stored inside reassemblable original ZIP in owner's private Google Drive** | `16d02926ae0a879d9b37e54ace6f983da70310ef6a1597a364b416506f38ffe1` |
| `Theepmo ref7.json` | Original checksum manifest | [Committed in TO](./Theepmo-ref7.json) | Manifest itself excluded from digest list |

These SHA-256 hashes are transcribed from the supplied source inventory and **do not prove the GitHub-transferred text is byte-for-byte identical**: text transport can normalize formatting. Requirements are available for review, but the source artifact receipt is only complete after checksum-verifiable binary storage.

## Missing durable source upload — precise action
- GitHub Contents API used by this agent stores text files; it cannot upload binary archives of this size. No GitHub release-asset/LFS push action is currently exposed.
- **Required:** use Git LFS with a trusted workstation capable of handling the nested files, or a *private release artifact* / access-controlled bucket accessible to all authorized experts. Prior to upload, scan contents for secrets and licenses, do not execute reference installers, and confirm the artifact hashes locally.
- Record immutable download URLs, access policy, SHA-256, uploaded UTC time, archive version and reference-to-requirement map here, then link to progress issues.
- Do not substitute a chat sandbox link for durable multi-expert storage.
- Full code acceptance checks can proceed independently, but reference-specific visual and Windows package comparisons stay BLOCKED until these assets are available.

## Source usage
Each checklist ID refers to `Theepmo-ref2.md`. The actual product code and release evidence are in the three main repositories, not in the source archive. Do not report sources as implementation.


## Private original ZIP — uploaded 2026-11-18
The original `execute fully.zip` was split **without recompressing or changing its bytes** into 11 numerically ordered fragments (`part00` to `part10`, first 10 exactly 40,000,000 bytes, last 29,835,722 bytes) and successfully uploaded to the user's Drive folder:

**[GIZE-source-reference (Google Drive folder)](https://drive.google.com/drive/folders/1ANtZI7siXicrqqAb0-WIwaOFjLcdSccC)**.

Original ZIP SHA-256: `70dc574c2e9fedcf0472e63b0396d35a9ee168cc9e22bae4f07439975f0d25ff`; total **429,835,722 bytes**. Verified against the original local uploaded archive. The 11 uploaded Drive entries were confirmed by listing and each reported the expected byte size; **their remote byte hashes have not been independently downloaded and verified**. Do not claim remote integrity until reassembled and hashed by an expert.

See [RECONSTRUCT-AND-VERIFY.md](./RECONSTRUCT-AND-VERIFY.md) for exact reconstruction and validation instructions. This storage is **private to the owner by default**. Its existence does not mean every expert has access. The owner must grant appropriate Drive access to each authorized expert or provision a controlled shared artifact account. Do **not** enable public unrestricted link sharing for unknown binaries.
