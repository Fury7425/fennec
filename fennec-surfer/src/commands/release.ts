/**
 * fennec release
 *
 * Tags the current commit, generates a GitHub Release, and uploads
 * the packaged distributable to the appropriate platform repo.
 *
 * Requires GITHUB_TOKEN in the environment.
 * Requires a signed package (code signing happens in the package step).
 */

import { Command }  from 'commander';
import chalk        from 'chalk';
import ora          from 'ora';
import { execa }    from 'execa';
import type { SurferConfig } from '../utils/config.js';

export function releaseCommand(program: Command, config: SurferConfig) {
  program
    .command('release')
    .description('Tag, sign, and push a GitHub Release to the platform repo')
    .option('--channel <channel>',  'Channel (release|nightly)', 'release')
    .option('--platform <platform>','Target platform')
    .option('--dry-run',            'Print steps without executing')
    .action(async (opts) => {
      const channel  = opts.channel as 'release' | 'nightly';
      const version  = config.channels[channel].version;
      const tag      = `v${version}${channel === 'nightly' ? '-nightly' : ''}`;
      const platform = opts.platform ?? detectPlatform();
      const isDry    = opts.dryRun;

      console.log(chalk.bold(`\nFennec release\n`));
      console.log(`  Channel:  ${chalk.cyan(channel)}`);
      console.log(`  Version:  ${chalk.cyan(version)}`);
      console.log(`  Tag:      ${chalk.cyan(tag)}`);
      console.log(`  Platform: ${chalk.cyan(platform)}`);
      if (isDry) console.log(chalk.yellow('  (dry run)\n'));
      else console.log();

      if (!process.env.GITHUB_TOKEN) {
        console.error(chalk.red('Error: GITHUB_TOKEN is not set.'));
        process.exit(1);
      }

      const run = async (label: string, cmd: string, args: string[]) => {
        const spinner = ora(label).start();
        if (isDry) { spinner.warn(`[dry-run] ${cmd} ${args.join(' ')}`); return; }
        try {
          await execa(cmd, args, { stdio: 'inherit' });
          spinner.succeed(label);
        } catch (err) {
          spinner.fail(label);
          throw err;
        }
      };

      // -- 1. Git tag -----------------------------------------------------------
      await run(`Creating tag ${tag}`, 'git', ['tag', '-s', tag, '-m', `Fennec ${version}`]);
      await run('Pushing tag',         'git', ['push', 'origin', tag]);

      // -- 2. gh release create -------------------------------------------------
      const platformRepo = `fennec-browser/fennec-${platform}`;
      await run(
        `Creating GitHub Release ${tag} on ${platformRepo}`,
        'gh', [
          'release', 'create', tag,
          '--repo',  platformRepo,
          '--title', `Fennec ${version}`,
          '--notes-file', 'CHANGELOG.md',
          ...(channel === 'nightly' ? ['--prerelease'] : []),
        ]
      );

      // -- 3. Upload asset ------------------------------------------------------
      const assetGlob = `dist/fennec-${version}-${platform}.*`;
      await run(
        'Uploading package asset',
        'gh', ['release', 'upload', tag, assetGlob, '--repo', platformRepo]
      );

      console.log(chalk.green.bold(`\nRelease ${tag} published.\n`));
    });
}

function detectPlatform(): string {
  switch (process.platform) {
    case 'darwin':  return 'macos';
    case 'win32':   return 'windows';
    default:        return 'linux';
  }
}
