/**
 * shell.ts — Thin execa wrapper with structured error reporting
 *
 * All subprocess calls in fennec-surfer go through run() so that:
 *   1. stderr is captured and surfaced on failure
 *   2. Verbose mode (FENNEC_VERBOSE=1) streams stdout
 *   3. Long-running steps can opt-in to streaming via { stream: true }
 */

import { execa, ExecaError }    from 'execa';
import type { Options }         from 'execa';
import { log }                  from './logger.js';

export interface RunOptions {
  /** Stream stdout/stderr to terminal in real time (for Ninja, etc.) */
  stream?: boolean;
  /** Working directory */
  cwd?: string;
  /** Environment variable overrides */
  env?: Record<string, string>;
  /** Skip exit-code check (returns result regardless) */
  allowFailure?: boolean;
}

const VERBOSE = !!process.env['FENNEC_VERBOSE'];

/** Run a subprocess and return its stdout. Throws on non-zero exit. */
export async function run(
  cmd: string,
  args: string[],
  opts: RunOptions = {},
): Promise<string> {
  const execOpts: Options = {
    cwd:   opts.cwd,
    env:   { ...process.env, ...(opts.env ?? {}) },
    stdio: opts.stream || VERBOSE ? 'inherit' : 'pipe',
    reject: !opts.allowFailure,
  };

  try {
    const result = await execa(cmd, args, execOpts);
    return (result.stdout as string | undefined) ?? '';
  } catch (e) {
    const err = e as ExecaError;
    if (opts.allowFailure) return (err.stdout as string | undefined) ?? '';

    return log.fatal(
      `Command failed: ${cmd} ${args.join(' ')}`,
      [
        err.stderr ? `stderr: ${err.stderr}` : '',
        `exit code: ${err.exitCode ?? 'unknown'}`,
      ].filter(Boolean).join('\n    '),
    );
  }
}

/** Check whether a binary exists in PATH */
export async function which(binary: string): Promise<boolean> {
  try {
    await execa(process.platform === 'win32' ? 'where' : 'which', [binary], {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/** Assert a list of binaries are available; exit with instructions if not */
export async function requireBinaries(
  binaries: Array<{ name: string; hint: string }>
): Promise<void> {
  const missing: string[] = [];
  for (const { name, hint } of binaries) {
    if (!(await which(name))) {
      missing.push(`  • ${name}  —  ${hint}`);
    }
  }
  if (missing.length > 0) {
    console.error('\nMissing required tools:\n');
    missing.forEach(m => console.error(m));
    console.error('\nSee docs/BUILDING.md for installation instructions.\n');
    process.exit(1);
  }
}

/** Download a URL to a local file using curl with progress reporting */
export async function download(url: string, dest: string): Promise<void> {
  await run('curl', [
    '--location',           // follow redirects
    '--fail',               // exit non-zero on HTTP errors
    '--retry', '3',
    '--retry-delay', '2',
    '--progress-bar',       // compact progress
    '--output', dest,
    url,
  ], { stream: true });
}

/** Stream a sha256 hash of a file and compare to expected */
export async function verifySha256(
  file: string,
  expected: string,
): Promise<void> {
  const cmd   = process.platform === 'darwin' ? 'shasum' : 'sha256sum';
  const flags = process.platform === 'darwin' ? ['-a', '256'] : [];
  const output = await run(cmd, [...flags, file]);
  const actual = output.trim().split(/\s+/)[0];
  if (actual !== expected) {
    log.fatal(
      `SHA-256 mismatch for ${file}`,
      `expected: ${expected}\n    actual:   ${actual}`,
    );
  }
}
