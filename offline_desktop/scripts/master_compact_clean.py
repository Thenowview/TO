"""TheOrg's Master: dry-run-first cleanup of *known app-owned* temp files.

No recursive sweeps, no source/model/SQLite cleanup, and no deletion on launch.
"""
from __future__ import annotations
import argparse
import re
import stat
import time
from pathlib import Path

_IMPORT = re.compile(r'^\.import-[0-9a-f]{24}\.(?:zip|gguf)\.partial$')
_TEMP_SUFFIXES = ('.tmp', '.partial')


def candidates(root, min_age_days=7, now=None):
    root = Path(root).resolve(strict=True)
    if not root.is_dir():
        raise ValueError('TheOrg root is not a directory')
    now = time.time() if now is None else now
    cutoff = now - min_age_days * 86400
    paths = (
        (root / 'data' / 'cache', False),
        (root / 'data' / 'tmp', False),
        (root / '.theorg' / 'data' / 'cache', False),
        (root / '.theorg' / 'data' / 'tmp', False),
        (root / 'models', True),
        (root / '.theorg' / 'models', True),
    )
    eligible = []
    for directory, import_only in paths:
        if directory.is_symlink() or not directory.is_dir():
            continue
        if directory.resolve() != directory:
            continue
        for entry in directory.iterdir():
            if entry.is_symlink():
                continue
            try: info = entry.lstat()
            except FileNotFoundError: continue
            if not stat.S_ISREG(info.st_mode) or info.st_mtime >= cutoff:
                continue
            if import_only and not _IMPORT.fullmatch(entry.name):
                continue
            if not import_only and not entry.name.endswith(_TEMP_SUFFIXES):
                continue
            eligible.append((entry, info.st_size, info.st_mtime))
    return sorted(eligible, key=lambda x: str(x[0]))


def cleanup(root, apply=False, min_age_days=7):
    if type(min_age_days) is not int or not 1 <= min_age_days <= 365:
        raise ValueError('Age threshold must be 1–365 days')
    found = candidates(root, min_age_days)
    removed = []
    if apply:
        for path, size, modified in found:
            try:
                info = path.lstat()
                if (stat.S_ISREG(info.st_mode) and not path.is_symlink()
                    and info.st_size == size and info.st_mtime == modified
                    and info.st_mtime < time.time()-min_age_days*86400):
                    path.unlink()
                    removed.append(str(path))
            except FileNotFoundError:
                pass
    return {'mode':'apply' if apply else 'dry-run',
            'count':len(found),
            'potential_bytes':sum(size for _,size,_ in found),
            'files':[str(path) for path,_,_ in found],
            'deleted':removed}


def main():
    parser = argparse.ArgumentParser(description="TheOrg's Master safe temp cleanup")
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--days', type=int, default=7)
    parser.add_argument('--apply', action='store_true',
                        help='Delete only reviewed, aged, allowlisted temporary files')
    args = parser.parse_args()
    outcome = cleanup(args.root, apply=args.apply, min_age_days=args.days)
    print(f"{outcome['mode']}: {outcome['count']} candidates; "
          f"{outcome['potential_bytes']} bytes potentially recoverable")
    for path in outcome['files']:
        print(('DELETED ' if path in outcome['deleted'] else 'CANDIDATE ')+path)
    if not args.apply:
        print('No files deleted. Only run --apply after reviewing these paths.')


if __name__ == '__main__':
    main()
