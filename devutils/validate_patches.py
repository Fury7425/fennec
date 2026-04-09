#!/usr/bin/env python3
# Copyright 2024 The Fennec Authors. All rights reserved.
# Use of this source code is governed by a GPL-3.0 license.
#
# validate_patches.py -- Fennec patch series validator
#
# Checks:
#   1. Every patch listed in patches/series exists on disk
#      (skip core/ patches if --skip-core is passed).
#   2. Every patch file on disk is listed in patches/series
#      (orphan detection; core/ skipped).
#   3. Every vendor patch has required metadata headers:
#        # SPDX-License-Identifier: ...
#        # PILLAR: ...
#        # JOURNAL: ...
#   4. Core patches (upstream format) are skipped for header validation.
#
# Output uses only ASCII -- no emoji, no Unicode symbols.
# Use "OK", "FAIL", "WARN" instead of checkmarks/crosses.
#
# Usage:
#   python3 devutils/validate_patches.py
#   python3 devutils/validate_patches.py --series-file patches/series
#                                        --patches-dir patches
#                                        --skip-core

import argparse
import sys
from pathlib import Path

REQUIRED_VENDOR_HEADERS = [
    '# SPDX-License-Identifier:',
    '# PILLAR:',
    '# JOURNAL:',
]

ERROR_COUNT = 0
WARN_COUNT  = 0


def fail(msg: str) -> None:
    global ERROR_COUNT
    print(f'  FAIL: {msg}', file=sys.stderr)
    ERROR_COUNT += 1


def warn(msg: str) -> None:
    global WARN_COUNT
    print(f'  WARN: {msg}')
    WARN_COUNT += 1


def ok(msg: str) -> None:
    print(f'  OK:   {msg}')


def is_core_patch(patch_rel: str) -> bool:
    """Return True if this patch lives under the core/ directory."""
    return patch_rel.startswith('core/')


def load_series(series_file: Path) -> list:
    lines = series_file.read_text(encoding='utf-8').splitlines()
    return [
        l.strip() for l in lines
        if l.strip() and not l.strip().startswith('#')
    ]


def validate_vendor_headers(patch_path: Path, content: str) -> None:
    """Check that a vendor patch has the required Fennec metadata headers."""
    for header in REQUIRED_VENDOR_HEADERS:
        if header not in content:
            fail(f'{patch_path.name}: missing required header "{header}"')


def find_all_patch_files(patches_dir: Path) -> set:
    """Find all .patch files under patches_dir, relative to patches_dir."""
    return {
        str(p.relative_to(patches_dir)).replace('\\', '/')
        for p in patches_dir.rglob('*.patch')
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Validate Fennec patch series'
    )
    parser.add_argument(
        '--series-file', default='patches/series',
        help='Path to the patch series file (default: patches/series)'
    )
    parser.add_argument(
        '--patches-dir', default='patches',
        help='Root patches directory (default: patches)'
    )
    parser.add_argument(
        '--skip-core', action='store_true',
        help='Skip existence check for core/ patches (populated at bootstrap time)'
    )
    parser.add_argument(
        '--status', action='store_true',
        help='Print a status table of all patches (present/missing) and exit 0'
    )
    args = parser.parse_args()

    series_file = Path(args.series_file)
    patches_dir = Path(args.patches_dir)

    # -- Status mode: print presence table and exit 0 --------------------------
    if args.status:
        if not series_file.exists():
            print(f'ERROR: series file not found: {series_file}', file=sys.stderr)
            return 2
        series = load_series(series_file)
        print(f'Patch status ({len(series)} entries in {series_file}):')
        print()
        col = max((len(p) for p in series), default=20) + 2
        print(f'  {"PATCH":<{col}}  STATUS')
        print(f'  {"-" * col}  ------')
        for patch_rel in series:
            if args.skip_core and is_core_patch(patch_rel):
                status = 'SKIP (core)'
            elif (patches_dir / patch_rel).exists():
                status = 'PRESENT'
            else:
                status = 'MISSING'
            print(f'  {patch_rel:<{col}}  {status}')
        print()
        return 0

    # -- Infrastructure checks -------------------------------------------------
    if not series_file.exists():
        print(f'ERROR: series file not found: {series_file}', file=sys.stderr)
        return 2

    if not patches_dir.exists():
        print(f'ERROR: patches directory not found: {patches_dir}', file=sys.stderr)
        return 2

    series = load_series(series_file)
    print(f'Validating {len(series)} patches in {series_file} ...')
    print()

    series_set = set()

    # -- Check 1: existence + header validation --------------------------------
    for patch_rel in series:
        # Duplicate detection
        if patch_rel in series_set:
            fail(f'Duplicate entry in series: {patch_rel}')
        series_set.add(patch_rel)

        core = is_core_patch(patch_rel)

        # Skip existence check for core/ patches when --skip-core is set
        if core and args.skip_core:
            continue

        patch_path = patches_dir / patch_rel
        if not patch_path.exists():
            fail(f'Listed in series but missing on disk: {patch_rel}')
            continue

        # Header validation: only for vendor patches
        if not core:
            content = patch_path.read_text(encoding='utf-8', errors='replace')
            validate_vendor_headers(patch_path, content)

    # -- Check 2: orphan detection ---------------------------------------------
    # Skip core/ entirely (not present before bootstrap)
    all_files = find_all_patch_files(patches_dir)
    for f in sorted(all_files):
        if is_core_patch(f):
            continue
        if f not in series_set:
            warn(f'Orphan patch (on disk but not in series): {f}')

    # -- Result ----------------------------------------------------------------
    print()
    if ERROR_COUNT == 0 and WARN_COUNT == 0:
        print(f'OK: all {len(series)} patches valid.')
        return 0
    elif ERROR_COUNT == 0:
        print(f'OK with warnings: {WARN_COUNT} warning(s).')
        return 0
    else:
        print(
            f'FAIL: {ERROR_COUNT} error(s), {WARN_COUNT} warning(s).',
            file=sys.stderr,
        )
        return 1


if __name__ == '__main__':
    sys.exit(main())
