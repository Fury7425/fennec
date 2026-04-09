#!/usr/bin/env node
/**
 * fennec-surfer — Fennec browser build orchestration CLI
 *
 * Commands:
 *   fennec bootstrap              Fetch ungoogled-chromium + apply full patch series
 *   fennec patch apply            Apply patches/series to chromium-src/
 *   fennec patch new <name>       Scaffold a new vendor patch
 *   fennec patch validate         Validate patch series (existence + headers)
 *   fennec patch status           Show disk status of all patches
 *   fennec patch refresh <patch>  Re-export a modified file as an updated patch
 *   fennec build [platform]       Run GN + Ninja
 *   fennec package                Produce .dmg / AppImage / .exe
 *   fennec release                Tag, sign, publish GitHub Release
 *
 * Flags available on all commands:
 *   --help     Show command help
 *
 * Environment variables:
 *   FENNEC_VERBOSE=1     Stream all subprocess output
 *   GITHUB_TOKEN         Required for `fennec release`
 */

import { program }              from 'commander';
import chalk                    from 'chalk';
import { loadSurferConfig }     from './utils/config.js';
import { bootstrapCommand }     from './commands/bootstrap.js';
import { patchCommand }         from './commands/patch.js';
import { buildCommand }         from './commands/build.js';
import { packageCommand }       from './commands/package.js';
import { releaseCommand }       from './commands/release.js';

async function main() {
  let config;
  try {
    config = await loadSurferConfig();
  } catch (e: any) {
    // If we can't load surfer.json, we can still show --help
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      console.error(chalk.dim('(surfer.json not found — showing help only)\n'));
    } else {
      console.error(chalk.red(`\n  ✗  ${e.message}\n`));
      process.exit(1);
    }
    // Provide a minimal stub config so Commander can still parse commands
    config = {
      chromium: { version: 'unknown', ungoogled_revision: 'unknown', source: '' },
      channels: {
        release: { name: 'Fennec', version: '0.0.0', channel: 'stable', updateUrl: '', branding: {
          productName: 'Fennec', companyName: '', appId: '', tagline: '',
          homepage: '', newTabUrl: '', settingsUrl: '', setupUrl: '',
        }, icons: {} },
        nightly: { name: 'Fennec Nightly', version: '0.0.0-nightly', channel: 'nightly', updateUrl: '', branding: {
          productName: 'Fennec Nightly', companyName: '', appId: '', tagline: '',
          homepage: '', newTabUrl: '', settingsUrl: '', setupUrl: '',
        }, icons: {} },
      },
      patches:  { seriesFile: 'patches/series', coreDir: 'patches/core', vendorDir: 'patches/vendor/fennec', validateOnApply: true },
      build:    { gnArgs: {}, platformOverrides: {} },
      package:  {},
      devutils: {},
    } as any;
  }

  program
    .name('fennec')
    .description(chalk.hex('#d4783c').bold('Fennec') + ' — Small ears. Big awareness.')
    .version(config.channels.release.version, '-v, --version')
    .option('--verbose', 'Enable verbose subprocess output (alias for FENNEC_VERBOSE=1)')
    .hook('preAction', (thisCmd) => {
      if (thisCmd.opts()['verbose']) {
        process.env['FENNEC_VERBOSE'] = '1';
      }
    });

  bootstrapCommand(program, config);
  patchCommand(program, config);
  buildCommand(program, config);
  packageCommand(program, config);
  releaseCommand(program, config);

  // Graceful "unknown command" error
  program.on('command:*', (operands) => {
    console.error(chalk.red(`\n  Unknown command: ${operands[0]}\n`));
    console.error(`  Run ${chalk.cyan('fennec --help')} for available commands.\n`);
    process.exit(1);
  });

  await program.parseAsync();
}

main().catch((e) => {
  console.error(chalk.red('\n  Unhandled error:'), e);
  process.exit(1);
});
