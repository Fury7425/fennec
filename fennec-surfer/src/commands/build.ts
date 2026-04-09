/**
 * fennec build [platform]
 *
 * Generates GN args for the target platform, writes args.gn,
 * runs `gn gen`, then runs Ninja to produce the Fennec binary.
 *
 * Usage:
 *   fennec build                    — auto-detect host platform
 *   fennec build linux
 *   fennec build macos
 *   fennec build windows
 *   fennec build linux --channel nightly
 *   fennec build linux --gn-only    — generate args.gn without building
 */

import { writeFile, mkdir }          from 'node:fs/promises';
import { existsSync }                from 'node:fs';
import { resolve, join }             from 'node:path';
import { Command }                   from 'commander';
import chalk                         from 'chalk';
import { log, step }                 from '../utils/logger.js';
import { run, requireBinaries }      from '../utils/shell.js';
import {
  detectHostPlatform,
  outDir,
  assertPlatform,
  assertChannel,
  cpuCount,
  type TargetPlatform,
  type Channel,
}                                    from '../utils/platform.js';
import type { SurferConfig }         from '../utils/config.js';

export function buildCommand(program: Command, config: SurferConfig) {
  program
    .command('build [platform]')
    .description('Run GN + Ninja to build Fennec for the target platform')
    .option('--channel <channel>', 'Build channel: release | nightly', 'release')
    .option('--jobs <n>',          'Ninja parallel jobs (default: CPU count)')
    .option('--gn-only',           'Only generate args.gn + run gn gen, skip Ninja')
    .option('--chromium-src <dir>','Chromium source root', 'chromium-src')
    .option('--target <target>',   'Ninja target to build', 'chrome')
    .addHelpText('after', `
Environment:
  FENNEC_VERBOSE=1  Stream all subprocess output to terminal

Examples:
  fennec build
  fennec build linux --channel nightly
  fennec build linux --gn-only
  fennec build linux --jobs 32 --target chrome_sandbox
`)
    .action(async (platformArg: string | undefined, opts) => {
      const platform  = assertPlatform(platformArg ?? detectHostPlatform());
      const channel   = assertChannel(opts.channel as string);
      const ROOT      = resolve(process.cwd());
      const SRC_DIR   = resolve(ROOT, opts.chromiumSrc as string);
      const outName   = outDir(channel);
      const outPath   = join(SRC_DIR, 'out', outName);
      const jobs      = opts.jobs ? parseInt(opts.jobs as string, 10) : cpuCount();

      log.section('Fennec Build');
      log.kv('Platform', platform);
      log.kv('Channel',  channel);
      log.kv('Out dir',  `out/${outName}`);
      log.kv('Jobs',     String(jobs));
      if (opts.gnOnly) log.warn('--gn-only: skipping Ninja');
      log.br();

      if (!existsSync(SRC_DIR)) {
        log.fatal(
          `Source directory not found: ${SRC_DIR}`,
          'Run `fennec bootstrap` first.',
        );
      }

      await requireBinaries([
        { name: 'gn',    hint: 'Install via depot_tools or: brew install gn' },
        { name: 'ninja', hint: 'https://ninja-build.org'                     },
        { name: 'python3', hint: 'https://python.org'                        },
      ]);

      // ── 1. Generate args.gn ────────────────────────────────────────────
      const done1 = step('Generating args.gn');
      await mkdir(outPath, { recursive: true });
      const gnContent = buildGnArgs(config, platform, channel);
      await writeFile(join(outPath, 'args.gn'), gnContent, 'utf8');
      done1(`args.gn written (${gnContent.split('\n').length} args)`);

      if (process.env['FENNEC_VERBOSE']) {
        log.info('args.gn:');
        gnContent.split('\n').forEach(l => log.info(`  ${l}`));
      }

      // ── 2. gn gen ──────────────────────────────────────────────────────
      const done2 = step('Running gn gen');
      await run('gn', ['gen', join('out', outName)], {
        cwd:    SRC_DIR,
        stream: true,
      });
      done2('gn gen complete');

      if (opts.gnOnly) {
        log.br();
        log.success('GN args ready. Skipping Ninja (--gn-only).');
        log.info(`To build: cd ${SRC_DIR} && ninja -C out/${outName} chrome`);
        return;
      }

      // ── 3. Ninja ───────────────────────────────────────────────────────
      const ninjaTarget = opts.target as string;
      const done3 = step(`Building target '${ninjaTarget}' with ${jobs} jobs`);
      log.info('This will take a while on first build (expect 30–90 min).');
      log.info('Incremental rebuilds are much faster.');
      log.br();

      await run('ninja', [
        '-C', join('out', outName),
        `-j${jobs}`,
        ninjaTarget,
      ], { cwd: SRC_DIR, stream: true });
      done3('Build complete');

      const binaryPath = join(outPath, binaryName(platform));
      log.br();
      log.success(chalk.bold('Build complete.'));
      log.kv('Binary', binaryPath);
      log.info(`Next: ${chalk.cyan('fennec package')}`);
      log.br();
    });
}

// ── GN args builder ───────────────────────────────────────────────────────────

function buildGnArgs(
  config: SurferConfig,
  platform: TargetPlatform,
  channel: Channel,
): string {
  const ch        = config.channels[channel];
  const base      = config.build.gnArgs;
  const overrides = config.build.platformOverrides[platform] ?? {};

  const merged: Record<string, string | boolean | number> = {
    ...base,
    ...overrides,
    // Fennec branding — injected as GN string args
    fennec_product_name:     quote(ch.branding.productName),
    fennec_company_name:     quote(ch.branding.companyName),
    fennec_version:          quote(ch.version),
    fennec_channel:          quote(channel),
    fennec_app_id:           quote(ch.branding.appId),
    fennec_update_url:       quote(ch.updateUrl),
    fennec_homepage_url:     quote(ch.branding.homepage),
    fennec_new_tab_url:      quote(ch.branding.newTabUrl),
    fennec_settings_url:     quote(ch.branding.settingsUrl),
    fennec_setup_url:        quote(ch.branding.setupUrl),
  };

  return Object.entries(merged)
    .map(([k, v]) => {
      if (typeof v === 'boolean') return `${k} = ${v}`;
      if (typeof v === 'number')  return `${k} = ${v}`;
      return `${k} = ${normalizeGnString(v)}`;
    })
    .join('\n');
}

function quote(s: string): string { return `"${s}"`; }

function normalizeGnString(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed;
  }
  return quote(value);
}

function binaryName(platform: TargetPlatform): string {
  switch (platform) {
    case 'windows': return 'chrome.exe';
    case 'macos':   return 'Chromium.app/Contents/MacOS/Chromium';
    default:        return 'chrome';
  }
}
