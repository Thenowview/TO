<#
.SYNOPSIS
  Extract reviewed source candidates from the user's two TheOrg ZIP archives.
.DESCRIPTION
  Does not upload or commit anything. Filters caches, credentials, profiles,
  binary executables and large artifacts. Review outputs manually.
.EXAMPLE
  .\tools\import-source.ps1 -TheOrgZip "C:\Downloads\TheOrg(2).zip" -SidebarZip "C:\Downloads\Theorg's.zip"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$TheOrgZip,
    [Parameter(Mandatory = $true)][string]$SidebarZip,
    [string]$RepoRoot = (Join-Path $PSScriptRoot "..")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
$allowedExtensions = @(
    ".py", ".pyi", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx",
    ".html", ".htm", ".css", ".scss", ".sass", ".less",
    ".md", ".mdx", ".txt", ".json", ".jsonc", ".yaml", ".yml",
    ".toml", ".ini", ".cfg", ".conf", ".xml", ".svg",
    ".ps1", ".bat", ".cmd", ".sh", ".lock",
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico"
)
$allowedSpecialNames = @("Dockerfile", "Makefile", ".gitignore", ".gitattributes", ".editorconfig")
$excludedPathSegmentPattern = '^(?:\.git|node_modules|\.venv|venv|__pycache__|\.next|\.cache|\.pytest_cache|\.mypy_cache|dist|build|out|release|target|coverage|logs|downloads|cookies|sessions|browser_jobs|browser_profiles|chromium_profiles|playwright-profile|User Data|Chrome User Data|Profile \d+|Default)$'
$blockedNamePattern = '(?i)^(?:\.env(?:\..*)?|id_rsa.*|id_ed25519.*|storage-state\.json|state\.json|.*(?:credentials|service-account|service_account|private[_-]?key|access[_-]?token|refresh[_-]?token|cookies)\.(?:json|txt|yaml|yml))$'
$possibleSecretPattern = '(?i)(?:-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|github_pat_[A-Za-z0-9_]{12,}|ghp_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{25,})'
$manifest = [System.Collections.Generic.List[object]]::new()
$flagged = [System.Collections.Generic.List[string]]::new()
$maxEntryBytes = 10MB
$maxTotalBytes = 150MB
$totalCopied = [long]0

function Import-ReviewedSource {
    param([string]$ZipPath, [string]$Label)

    $resolvedZip = (Resolve-Path -LiteralPath $ZipPath).Path
    $root = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot ("legacy/" + $Label)))
    [System.IO.Directory]::CreateDirectory($root) | Out-Null
    $rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    $archive = [System.IO.Compression.ZipFile]::OpenRead($resolvedZip)
    try {
        foreach ($entry in $archive.Entries) {
            if ([string]::IsNullOrWhiteSpace($entry.Name)) { continue }

            $relative = $entry.FullName.Replace("\", "/")
            if ($relative.StartsWith("/") -or $relative -match '(^|/)\.\.(/|$)' -or $relative -match '^[A-Za-z]:') {
                $flagged.Add("SKIPPED unsafe path in ${Label}: ${relative}")
                continue
            }

            $segments = $relative.Split("/")
            $exclude = $false
            foreach ($segment in $segments) {
                if ($segment -match $excludedPathSegmentPattern) { $exclude = $true; break }
            }
            if ($exclude) { continue }

            $name = [System.IO.Path]::GetFileName($relative)
            $extension = [System.IO.Path]::GetExtension($name).ToLowerInvariant()
            if ($name -match $blockedNamePattern) { continue }
            if (($allowedExtensions -notcontains $extension) -and ($allowedSpecialNames -notcontains $name)) { continue }
            if ($entry.Length -gt $maxEntryBytes) {
                $flagged.Add("SKIPPED large file in ${Label}: ${relative}")
                continue
            }
            if ($totalCopied + $entry.Length -gt $maxTotalBytes) {
                $flagged.Add("SKIPPED total size limit in ${Label}: ${relative}")
                continue
            }

            $destination = [System.IO.Path]::GetFullPath((Join-Path $root ($relative.Replace("/", [System.IO.Path]::DirectorySeparatorChar))))
            if (-not $destination.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                $flagged.Add("SKIPPED out-of-root entry: ${relative}")
                continue
            }
            [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($destination)) | Out-Null

            $inputStream = $entry.Open()
            $outputStream = [System.IO.File]::Create($destination)
            try { $inputStream.CopyTo($outputStream) }
            finally {
                $outputStream.Dispose()
                $inputStream.Dispose()
            }

            $isText = @(".py",".pyi",".js",".mjs",".cjs",".jsx",".ts",".tsx",".html",".htm",".css",".scss",".sass",".less",".md",".mdx",".txt",".json",".jsonc",".yaml",".yml",".toml",".ini",".cfg",".conf",".xml",".svg",".ps1",".bat",".cmd",".sh",".lock") -contains $extension
            if ($isText -and $entry.Length -le 2MB) {
                try {
                    $body = [System.IO.File]::ReadAllText($destination)
                    if ($body -match $possibleSecretPattern) {
                        [System.IO.File]::Delete($destination)
                        $flagged.Add("REVIEW possible secret (not imported): ${relative}")
                        continue
                    }
                } catch {
                    [System.IO.File]::Delete($destination)
                    $flagged.Add("REVIEW non-text or unreadable file (not imported): ${relative}")
                    continue
                }
            }

            $digest = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
            $manifest.Add([pscustomobject]@{
                Archive = $Label
                Path = ("legacy/" + $Label + "/" + $relative)
                SizeBytes = $entry.Length
                SHA256 = $digest
                ReviewStatus = "PENDING_MANUAL_REVIEW"
            })
            $totalCopied += $entry.Length
        }
    } finally {
        $archive.Dispose()
    }
}

Import-ReviewedSource -ZipPath $TheOrgZip -Label "imported-theorg"
Import-ReviewedSource -ZipPath $SidebarZip -Label "original-sidebar"
$docsDir = Join-Path $RepoRoot "docs"
[System.IO.Directory]::CreateDirectory($docsDir) | Out-Null
$manifest | Export-Csv -Path (Join-Path $docsDir "source-import-manifest.csv") -NoTypeInformation -Encoding UTF8
$flagged | Set-Content -Path (Join-Path $docsDir "source-import-review.txt") -Encoding UTF8

Write-Host ("Imported {0} candidate source files ({1} bytes); review every change before committing." -f $manifest.Count, $totalCopied)
Write-Host "Manifest: docs/source-import-manifest.csv"
Write-Host "Skipped/flagged: docs/source-import-review.txt"
Write-Warning "This is a best-effort filter, NOT a full secrets audit. Inspect files manually; do not blindly push."
