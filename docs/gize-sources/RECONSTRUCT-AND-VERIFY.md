# Restore and verify the original GIZE source archive

**Owner-private source folder:** https://drive.google.com/drive/folders/1ANtZI7siXicrqqAb0-WIwaOFjLcdSccC

The original uploaded `execute fully.zip` was separated into **11 contiguous binary parts** with no recompression. Download all `execute-fully.zip.part00` through `execute-fully.zip.part10` to one local directory without renaming. Do not execute embedded installer binaries.

Expected total ZIP size: **429,835,722 bytes**. SHA-256:
`70dc574c2e9fedcf0472e63b0396d35a9ee168cc9e22bae4f07439975f0d25ff`

## Linux/macOS
```bash
cat execute-fully.zip.part{00..10} > "execute fully.zip"
echo "70dc574c2e9fedcf0472e63b0396d35a9ee168cc9e22bae4f07439975f0d25ff  execute fully.zip" | shasum -a 256 -c -
unzip -t "execute fully.zip"
```

## Windows PowerShell 7 / Windows PowerShell 5.1
```powershell
$target = [IO.File]::OpenWrite((Join-Path (Get-Location) 'execute fully.zip'))
try {
  foreach ($i in 0..10) {
    $name = ('execute-fully.zip.part{0:D2}' -f $i)
    if (-not (Test-Path -LiteralPath $name)) { throw "Missing part: $name" }
    $inputStream = [IO.File]::OpenRead((Resolve-Path -LiteralPath $name).Path)
    try { $inputStream.CopyTo($target) } finally { $inputStream.Dispose() }
  }
} finally { $target.Dispose() }
(Get-FileHash -LiteralPath 'execute fully.zip' -Algorithm SHA256).Hash
```
Compare the resulting SHA-256 with the expected lowercase value above (case insensitive). **If different, stop and redownload.** Do not extract or trust the file until it matches.

## Safe extraction and work mapping
1. First confirm SHA-256 and ZIP integrity. Inspect file names for traversal or dangerous executable content; extract into a dedicated non-production directory with safe ZIP tooling. Never run included Windows binaries without independent review.
2. Read `Theepmo ref1.md`, then `Theepmo ref2.md` (controlling 150 IDs), `Theepmo ref3.md` (OT Windows details) and `Theepmo ref4.txt`, and verify individual hashes using `Theepmo ref7.json`.
3. Treat `Theepmo ref5.zip` as a **reference website capture**, `Theepmo ref6.zip` as a **reference packaged desktop binary**, not as application source. Actual code remains in TEFE, TEBE and TO repositories.
4. The reference-to-OT technical handoff is reported absent from the original package. Track it explicitly and do not invent its contents.
5. Update each completed task in the corresponding `docs/GIZE-SOURCE-CHECKLIST.md` **immediately** and post a corresponding comment in its GitHub progress issue. For every verified claim cite source ID, implementation paths, commit/PR, tests and deployed SHA if required.

## Access-control caveat
The Drive folder was **owner-only** when last inspected. Authorized experts must receive appropriate Drive access. Never expose the binary reference archive using unrestricted public sharing merely to simplify retrieval.

## Known limitations
All 11 uploaded parts have been listed with expected sizes, but their remote SHA-256 values have not been independently verified. Full integrity is verified only after an expert downloads, reconstructs and checks the original ZIP.
