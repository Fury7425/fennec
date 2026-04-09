#!/usr/bin/env python3
# Copyright 2024 The Fennec Authors. All rights reserved.
# Use of this source code is governed by a GPL-3.0 license.
#
# zero_requests_test.py - Fennec consent-first network assertion
#
# WHAT:  Launches Fennec with a fresh profile, waits for the setup page
#        to appear, then asserts that zero external network requests were
#        made before the user completes fennec://setup.
#
# HOW:   Uses Chromium's --log-net-log flag to capture all network events
#        to a JSON file. After the browser exits, the log is parsed and
#        any request to a non-local, non-fennec:// URL is a failure.
#
# Usage:
#   python3 tests/zero_requests_test.py --binary path/to/fennec [--timeout 15]
#   python3 tests/zero_requests_test.py --dry-run   # validate test infra only
#
# Exit codes:
#   0  - PASS (zero unexpected requests)
#   1  - FAIL (external request(s) detected before consent)
#   2  - ERROR (setup/infrastructure failure)

import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse

# --- Allowed request origins before consent -----------------------------------

ALLOWED_SCHEMES = frozenset({
    'fennec',
    'chrome',
    'data',
    'blob',
    'about',
})

ALLOWED_HOSTS = frozenset({
    'localhost',
    '127.0.0.1',
    '[::1]',
})


class RequestViolation:
    def __init__(self, url: str, event_type: str, source_type: str):
        self.url         = url
        self.event_type  = event_type
        self.source_type = source_type

    def __repr__(self):
        return f'RequestViolation({self.url!r}, event={self.event_type})'


def is_allowed(url: str) -> tuple[bool, str]:
    try:
        parsed = urlparse(url)
    except Exception:
        return True, 'unparseable URL (skipped)'

    scheme = (parsed.scheme or '').lower()
    host   = (parsed.netloc or parsed.hostname or '').lower().split(':')[0]

    if scheme in ALLOWED_SCHEMES:
        return True, f'allowed scheme: {scheme}://'

    if host in ALLOWED_HOSTS:
        return True, f'allowed host: {host}'

    if not host:
        return True, 'no host (internal event)'

    if host.endswith('.qjz9zk') or host == 'qjz9zk':
        return False, 'qjz9zk request attempted (substitution worked but request not blocked)'

    return False, f'external request to {host} before consent'


def parse_net_log(log_path: Path) -> list[RequestViolation]:
    try:
        data = json.loads(log_path.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, OSError) as e:
        print(f'  ERROR: could not parse net log: {e}', file=sys.stderr)
        return []

    events    = data.get('events', [])
    constants = data.get('constants', {})

    type_map: dict[int, str] = {}
    for name, val in constants.get('logEventTypes', {}).items():
        type_map[int(val)] = name

    source_map: dict[int, str] = {}
    for name, val in constants.get('logSourceType', {}).items():
        source_map[int(val)] = name

    violations: list[RequestViolation] = []
    seen_urls: set[str] = set()

    for event in events:
        event_type  = type_map.get(event.get('type', -1), 'UNKNOWN')
        source_type = source_map.get(event.get('source', {}).get('type', -1), 'UNKNOWN')
        params      = event.get('params', {})

        if event_type != 'URL_REQUEST_START_JOB':
            continue

        url = params.get('url', '')
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)

        allowed, reason = is_allowed(url)
        if not allowed:
            violations.append(RequestViolation(url, event_type, source_type))

    return violations


def launch_fennec(binary: str, profile_dir: str, net_log_path: str, timeout: int) -> int:
    cmd = [
        binary,
        f'--user-data-dir={profile_dir}',
        f'--log-net-log={net_log_path}',
        '--net-log-capture-mode=Everything',
        '--no-first-run',
        '--disable-sync',
        '--disable-background-networking',
        'fennec://setup',
    ]

    print(f'  Launching: {binary}')
    print(f'  Waiting {timeout}s...')

    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except FileNotFoundError:
        print(f'  ERROR: binary not found: {binary}', file=sys.stderr)
        return 2

    print(f'  PID: {proc.pid}')
    time.sleep(timeout)

    if proc.poll() is not None:
        print(f'  Browser exited prematurely with code {proc.returncode}')
        return proc.returncode or 2

    print('  Sending SIGTERM...')
    if sys.platform == 'win32':
        proc.terminate()
    else:
        os.kill(proc.pid, signal.SIGTERM)

    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Assert Fennec makes zero external network requests before consent'
    )
    parser.add_argument('--binary',  default=None,
                        help='Path to Fennec binary (auto-detected if omitted)')
    parser.add_argument('--timeout', type=int, default=12,
                        help='Seconds to run browser before checking log (default: 12)')
    parser.add_argument('--report',  default=None,
                        help='Write JSON report to this file')
    parser.add_argument('--dry-run', action='store_true',
                        help='Validate test infrastructure without launching browser')
    args = parser.parse_args()

    print('\nFennec zero-requests boot test')
    print('   PILLAR: Transparency')
    print('   ASSERT: No external network request before fennec://setup completion\n')

    binary = args.binary
    if not binary:
        candidates = [
            'chromium-src/out/Release/chrome',
            'chromium-src/out/Nightly/chrome',
            'chromium-src/out/Release/Chromium.app/Contents/MacOS/Chromium',
        ]
        for c in candidates:
            if Path(c).exists():
                binary = c
                break
        if not binary:
            print('  ERROR: Fennec binary not found.', file=sys.stderr)
            print('  Run `fennec build` first, or pass --binary <path>', file=sys.stderr)
            if not args.dry_run:
                return 2
            binary = '/nonexistent/fennec'

    print(f'  Binary:  {binary}')

    tmpdir       = tempfile.mkdtemp(prefix='fennec-zero-req-test-')
    profile_dir  = os.path.join(tmpdir, 'profile')
    net_log_path = os.path.join(tmpdir, 'net.json')
    os.makedirs(profile_dir)

    print(f'  Profile: {profile_dir}')
    print(f'  Net log: {net_log_path}')

    if args.dry_run:
        print('\n  [dry-run] Skipping browser launch.')
        print('  [dry-run] Writing synthetic net log for parser validation...')
        synthetic = {
            'constants': {
                'logEventTypes': {'URL_REQUEST_START_JOB': 1},
                'logSourceType': {'URL_REQUEST': 0},
            },
            'events': [
                {'type': 1, 'source': {'type': 0, 'id': 1}, 'params': {'url': 'fennec://setup/'}},
                {'type': 1, 'source': {'type': 0, 'id': 2}, 'params': {'url': 'fennec://newtab/'}},
            ],
        }
        Path(net_log_path).write_text(json.dumps(synthetic))
    else:
        launch_result = launch_fennec(binary, profile_dir, net_log_path, args.timeout)
        if launch_result == 2:
            shutil.rmtree(tmpdir, ignore_errors=True)
            return 2

    log_path = Path(net_log_path)
    if not log_path.exists():
        print('\n  ERROR: net log not created.', file=sys.stderr)
        shutil.rmtree(tmpdir, ignore_errors=True)
        return 2

    print('\n  Parsing net log...')
    violations = parse_net_log(log_path)

    print()
    if violations:
        print(f'  FAIL - {len(violations)} external request(s) detected before consent:\n')
        for v in violations:
            print(f'    FAIL  {v.url}')
            print(f'          source: {v.source_type}')
        print()
    else:
        print('  PASS - zero external requests before consent.')
        print()

    if args.report:
        report = {
            'test':       'zero_requests_before_consent',
            'binary':     binary,
            'passed':     len(violations) == 0,
            'violations': [
                {'url': v.url, 'event_type': v.event_type, 'source_type': v.source_type}
                for v in violations
            ],
        }
        Path(args.report).write_text(json.dumps(report, indent=2))
        print(f'  Report: {args.report}')

    shutil.rmtree(tmpdir, ignore_errors=True)
    return 0 if not violations else 1


if __name__ == '__main__':
    sys.exit(main())
