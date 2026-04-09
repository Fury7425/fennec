#!/usr/bin/env python3
# Copyright 2024 The Fennec Authors. All rights reserved.
# Use of this source code is governed by a GPL-3.0 license.
#
# verify_clean.py - De-googling verification script
#
# Scans the patched Chromium source tree for un-substituted Google endpoints.
# Exits with code 1 (fails CI) if any are found.
#
# Usage:
#   python3 scripts/verify_clean.py [--src chromium-src/] [--report report.json]
#   python3 scripts/verify_clean.py --strict   # fail on warnings too
#
# Exit codes:
#   0  - clean (no forbidden strings found)
#   1  - violations found (see output)
#   2  - argument / setup error

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import NamedTuple

# --- Forbidden patterns -------------------------------------------------------
#
# severity:
#   ERROR   - always fails CI
#   WARNING - fails CI only with --strict; reported otherwise

FORBIDDEN: list[tuple[re.Pattern, str, str]] = [
    (re.compile(r'https?://[a-z0-9\-]+\.google\.com/', re.I),
     'ERROR', 'Un-substituted Google domain URL'),
    (re.compile(r'https?://[a-z0-9\-]+\.googleapis\.com/', re.I),
     'ERROR', 'Un-substituted googleapis.com URL'),
    (re.compile(r'https?://[a-z0-9\-]+\.gstatic\.com/', re.I),
     'ERROR', 'Un-substituted gstatic.com URL'),
    (re.compile(r'https?://uma\.googleapis\.com/', re.I),
     'ERROR', 'UMA telemetry endpoint'),
    (re.compile(r'https?://crashpad\.chromium\.org/', re.I),
     'ERROR', 'Crashpad reporting endpoint'),
    (re.compile(r'https?://clients[24]\.google\.com/', re.I),
     'ERROR', 'Google client service endpoint'),
    (re.compile(r'https?://safebrowsing\.googleapis\.com/', re.I),
     'ERROR', 'Safe Browsing endpoint'),
    (re.compile(r'https?://safebrowsing\.google\.com/', re.I),
     'ERROR', 'Safe Browsing endpoint (legacy)'),
    (re.compile(r'https?://accounts\.google\.com/', re.I),
     'ERROR', 'Google accounts sign-in endpoint'),
    (re.compile(r'"AIza[A-Za-z0-9_\-]{35}"'),
     'ERROR', 'Hardcoded Google API key'),
    (re.compile(r'https?://chrome\.google\.com/webstore/', re.I),
     'WARNING', 'Chrome Web Store URL'),
    (re.compile(r'https?://translate\.googleapis\.com/', re.I),
     'WARNING', 'Google Translate endpoint'),
    (re.compile(r'https?://update\.googleapis\.com/', re.I),
     'ERROR', 'Google Omaha update endpoint'),
    (re.compile(r'https?://clientservices\.googleapis\.com/', re.I),
     'WARNING', 'Google field trial / variations endpoint'),
]

SCAN_EXTENSIONS = {
    '.cc', '.cpp', '.c', '.h', '.hpp',
    '.py', '.js', '.ts', '.json',
    '.grd', '.gni', '.gn',
    '.xml', '.plist',
}

SKIP_PATHS = {
    'third_party/blink/web_tests/',
    'third_party/catapult/',
    'tools/perf/',
    'build/linux/sysroot_scripts/',
    'out/',
    '.git/',
    'devutils/',
    'patches/',
    'scripts/',
    'docs/',
}


class Violation(NamedTuple):
    file:     str
    line_no:  int
    line:     str
    severity: str
    desc:     str
    pattern:  str


def should_skip(rel_path: str) -> bool:
    for skip in SKIP_PATHS:
        if rel_path.startswith(skip):
            return True
    return False


def scan_file(path: Path, src_root: Path) -> list[Violation]:
    rel = str(path.relative_to(src_root)).replace('\\', '/')
    if should_skip(rel):
        return []
    if path.suffix.lower() not in SCAN_EXTENSIONS:
        return []

    violations: list[Violation] = []
    try:
        content = path.read_text(encoding='utf-8', errors='replace')
    except OSError:
        return []

    for line_no, line in enumerate(content.splitlines(), start=1):
        for pattern, severity, desc in FORBIDDEN:
            if pattern.search(line):
                violations.append(Violation(
                    file=rel, line_no=line_no,
                    line=line.strip()[:120],
                    severity=severity, desc=desc,
                    pattern=pattern.pattern,
                ))
                break

    return violations


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Verify no un-substituted Google domains remain in chromium-src/'
    )
    parser.add_argument('--src',    default='chromium-src',
                        help='Path to patched Chromium source tree (default: chromium-src/)')
    parser.add_argument('--report', default=None,
                        help='Write JSON report to this file')
    parser.add_argument('--strict', action='store_true',
                        help='Fail on WARNINGs in addition to ERRORs')
    parser.add_argument('--quiet',  action='store_true',
                        help='Only print a summary line')
    args = parser.parse_args()

    src_root = Path(args.src).resolve()
    if not src_root.exists():
        print(f'ERROR: source tree not found: {src_root}', file=sys.stderr)
        print('Run `fennec bootstrap` first.', file=sys.stderr)
        return 2

    print(f'\nFennec de-googling verification')
    print(f'   Scanning: {src_root}')
    print(f'   Patterns: {len(FORBIDDEN)} forbidden')
    print()

    all_violations: list[Violation] = []
    file_count    = 0
    error_count   = 0
    warning_count = 0

    for path in src_root.rglob('*'):
        if not path.is_file():
            continue
        file_count += 1
        violations = scan_file(path, src_root)
        all_violations.extend(violations)
        for v in violations:
            if v.severity == 'ERROR':
                error_count += 1
            else:
                warning_count += 1

    if not args.quiet:
        for v in sorted(all_violations, key=lambda x: (x.severity, x.file, x.line_no)):
            icon = 'FAIL' if v.severity == 'ERROR' else 'WARN'
            print(f'  {icon} [{v.severity}] {v.file}:{v.line_no}')
            print(f'         {v.desc}')
            print(f'         -> {v.line}')
            print()

    print(f'  Scanned {file_count:,} files.')
    print(f'  Errors:   {error_count}')
    print(f'  Warnings: {warning_count}')

    if args.report:
        report = {
            'src':        str(src_root),
            'files':      file_count,
            'errors':     error_count,
            'warnings':   warning_count,
            'violations': [v._asdict() for v in all_violations],
        }
        Path(args.report).write_text(
            json.dumps(report, indent=2), encoding='utf-8'
        )
        print(f'  Report written: {args.report}')

    if error_count > 0:
        print(f'\nFAIL - {error_count} error(s) found.')
        print('  Fix: re-run `fennec bootstrap` or add patterns to devutils/domain_regex.list')
        return 1

    if warning_count > 0 and args.strict:
        print(f'\nFAIL (--strict) - {warning_count} warning(s) found.')
        return 1

    if warning_count > 0:
        print(f'\nWARN  {warning_count} warning(s) found (pass --strict to fail on these).')
    else:
        print('\nOK  Source tree is clean. No Google endpoints detected.')

    return 0


if __name__ == '__main__':
    sys.exit(main())
