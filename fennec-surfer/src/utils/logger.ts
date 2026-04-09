/**
 * Logger — Fennec-branded terminal output
 *
 * Provides six log levels with chalk colors and a consistent prefix so
 * every line of output is obviously from fennec-surfer.
 *
 * Step prefixes:
 *   [1/N] Step name  — numbered progress steps
 *   ✓               — success
 *   ✗               — fatal error (always followed by process.exit(1))
 *   ⚠               — warning (continues)
 *   →               — verbose info
 */

import chalk from 'chalk';

const BRAND = chalk.hex('#d4783c').bold('fennec');

export const log = {
  /** Top-level section header (bold, separated) */
  section(title: string) {
    console.log('');
    console.log(chalk.bold(`${BRAND}  ${chalk.white(title)}`));
    console.log(chalk.dim('─'.repeat(60)));
  },

  /** Numbered build step: [1/N] label */
  step(n: number, total: number, label: string) {
    const counter = chalk.dim(`[${n}/${total}]`);
    console.log(`  ${counter} ${label}`);
  },

  /** Task within a step (indented bullet) */
  task(msg: string) {
    console.log(`       ${chalk.dim('→')} ${msg}`);
  },

  /** Green checkmark on success */
  success(msg: string) {
    console.log(`  ${chalk.green('✓')} ${msg}`);
  },

  /** Yellow warning — does NOT exit */
  warn(msg: string) {
    console.warn(`  ${chalk.yellow('⚠')} ${chalk.yellow(msg)}`);
  },

  /** Red error — exits with code 1 */
  fatal(msg: string, detail?: string): never {
    console.error('');
    console.error(`  ${chalk.red('✗')} ${chalk.red.bold(msg)}`);
    if (detail) console.error(`    ${chalk.dim(detail)}`);
    console.error('');
    process.exit(1);
  },

  /** Dim info line */
  info(msg: string) {
    console.log(`    ${chalk.dim(msg)}`);
  },

  /** Highlighted key/value pair */
  kv(key: string, value: string) {
    console.log(`    ${chalk.dim(key + ':')}  ${chalk.cyan(value)}`);
  },

  /** Raw passthrough (for piped subprocess stdout) */
  raw(line: string) {
    process.stdout.write(line);
  },

  /** Empty line */
  br() {
    console.log('');
  },
};

/** Wrap a named operation: logs start, returns a done() callback */
export function step(label: string): (override?: string) => void {
  process.stdout.write(`  ${chalk.dim('○')} ${label}…`);
  const start = Date.now();
  return function done(override?: string) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    process.stdout.clearLine?.(0);
    process.stdout.cursorTo?.(0);
    console.log(`  ${chalk.green('●')} ${override ?? label} ${chalk.dim(`(${elapsed}s)`)}`);
  };
}
