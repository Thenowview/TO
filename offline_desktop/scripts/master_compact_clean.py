"""TheOrg's Master: deliberately narrow, dry-run-first temp cleanup.

Use from the TheOrg app root. Never scans user projects, memory, DB or models.
Only stale app-managed temp files and exact aborted import fragments qualify.
"""
from __future__ import annotations
import argparse
import re
import stat
import time
from pathlib import Path

_IMPORT = re.compile(r'^\.import-[0-9a-f]{24}(?:\.(?:zip|gguf))?\.partial$')
_TEMP_SUFFIXES = ('.tmp', '.partial')


def candidates(root: Path, min_age_days=7, now=None):
    """Return safe files only. No follow-symlink behavior, nested traversal or user paths."""
    root = Path(root).resolve(strict=True)
    if not root.is_dir():
        raise ValueError('TheOrg root is not a directory')
    now = time.time() if now is None else now
    cutoff = now - min_age_days * 86400
    # Standalone source uses data/; frozen/portable app uses .theorg/data/.
    allowed = (
        (root / 'data' / 'cache', False),
        (root / 'data' / 'tmp', False),
        (root / '.theorg' / 'data' / 'cache', False),
        (root / '.theorg' / 'data' / 'tmp', False),
        (root / 'models', True),
        (root / '.theorg' / 'models', True),
    )
    found = []
    for directory, import_only in allowed:
        if directory.is_symlink() or not directory.is_dir():
            continue
        if directory.resolve() != directory:
            continue
        for item in directory.iterdir():
            if item.is_symlink():
                continue
            try:
                st = item.lstat()
            except FileNotFoundError:
                continue
            if not stat.S_ISREG(st.st_mode) or st.st_mtime >= cutoff:
                continue
            if import_only and not _IMPORT.fullmatch(item.name):
                continue
            if not import_only and not item.name.endswith(_TEMP_SUFFIXES):
                continue
            found.append((item, st.st_size, st.st_mtime))
    return sorted(found, key=lambda x: str(x[0]))


def cleanup(root: Path, apply=False, min_age_days=7):
    if not 1 <= min_age_days <= 365:
        raise ValueError('Age threshold must be 1–365 days')
    eligible = candidates(root, min_age_days=min_age_days)
    total = sum(size for _, size, _ in eligible)
    deleted = []
    if apply:
        for path, size, mtime in eligible:
            # Check again before deleting to limit race windows and avoid newer files.
            try:
                st = path.lstat()
                if (stat.S_ISREG(st.st_mode) and not path.is_symlink()
                    and st.st_size == size and st.st_mtime == mtime
                    and st.st_mtime < time.time() - min_age_days * 86400):
                    path.unlink()
                    deleted.append(str(path))
            except FileNotFoundError:
                pass
    return {'mode': 'apply' if apply else 'dry-run', 'count': len(eligible),
            'potential_bytes': total, 'deleted': deleted,
            'files': [str(p) for p, _, _ in eligible]}


def main():
    parser = argparse.ArgumentParser(description="TheOrg's Master safe temporary-file cleaner")
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--days', type=int, default=7)
    parser.add_argument('--apply', action='store_true', help='Explicitly delete verified stale temporary files')
    args = parser.parse_args()
    root = args.root.resolve(strict=True)
    result = cleanup(root, apply=args.apply, min_age_days=args.days)
    print(f"{result['mode']}: {result['count']} candidate(s), {result['potential_bytes']} byte(s)")
    for p in result['files']:
        print(('REMOVED ' if p in result['deleted'] else 'CANDIDATE ') + p)
    if not args.apply:
        print('Nothing deleted. Re-run with --apply only after reviewing the list.')


if __name__ == '__main__':
    main()
