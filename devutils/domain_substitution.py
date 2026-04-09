#!/usr/bin/env python3
# Copyright 2024 The Fennec Authors. All rights reserved.
# Use of this source code is governed by a GPL-3.0 license.
#
# domain_substitution.py - Apply/undo Google domain substitutions in chromium-src/
#
# Usage:
#   python3 devutils/domain_substitution.py --src chromium-src/
#   python3 devutils/domain_substitution.py --src chromium-src/ --undo
#   python3 devutils/domain_substitution.py --src chromium-src/ --dry-run

import argparse
import fnmatch
import re
import sys
from pathlib import Path


def load_regex_list(path: Path) -> list[tuple[re.Pattern, str]]:
    rules = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            if len(parts) != 2:
                print(f'WARN: skipping malformed rule: {line!r}', file=sys.stderr)
                continue
            pattern, replacement = parts
            try:
                rules.append((re.compile(pattern), replacement))
            except re.error as e:
                print(f'WARN: invalid regex {pattern!r}: {e}', file=sys.stderr)
    return rules


def load_file_list(path: Path) -> list[str]:
    globs = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            globs.append(line)
    return globs


def matches_any(rel_path: str, globs: list[str]) -> bool:
    for g in globs:
        if fnmatch.fnmatch(rel_path, g):
            return True
    return False


def apply_substitutions(
    src_root: Path,
    rules: list[tuple[re.Pattern, str]],
    file_globs: list[str],
    dry_run: bool = False,
    undo: bool = False,
) -> int:
    changed = 0
    for path in src_root.rglob('*'):
        if not path.is_file():
            continue
        rel = str(path.relative_to(src_root)).replace('\\', '/')
        if not matches_any(rel, file_globs):
            continue

        try:
            original = path.read_text(encoding='utf-8', errors='replace')
        except OSError:
            continue

        content = original
        for pattern, replacement in rules:
            if undo:
                # Swap pattern and replacement for undo (best-effort)
                content = re.sub(re.escape(replacement), pattern.pattern, content)
            else:
                content = pattern.sub(replacement, content)

        if content != original:
            changed += 1
            print(f'  {"(dry-run) " if dry_run else ""}Substituting: {rel}')
            if not dry_run:
                path.write_text(content, encoding='utf-8')

    return changed


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Apply Google domain substitutions to chromium-src/'
    )
    parser.add_argument('--src', default='chromium-src',
                        help='Path to chromium source tree (default: chromium-src/)')
    parser.add_argument('--regex-list', default='devutils/domain_regex.list',
                        help='Substitution rules file')
    parser.add_argument('--file-list', default='devutils/domain_substitution.list',
                        help='File scope list')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would change without modifying files')
    parser.add_argument('--undo', action='store_true',
                        help='Reverse substitutions (best-effort)')
    args = parser.parse_args()

    src_root = Path(args.src).resolve()
    if not src_root.exists():
        print(f'ERROR: source tree not found: {src_root}', file=sys.stderr)
        return 2

    rules = load_regex_list(Path(args.regex_list))
    file_globs = load_file_list(Path(args.file_list))

    action = 'Undoing' if args.undo else 'Applying'
    print(f'\n{action} domain substitutions')
    print(f'  Source: {src_root}')
    print(f'  Rules:  {len(rules)}')
    print(f'  Globs:  {len(file_globs)}')
    print()

    changed = apply_substitutions(src_root, rules, file_globs, args.dry_run, args.undo)

    print(f'\nOK - {changed} file(s) {"would be " if args.dry_run else ""}modified.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
