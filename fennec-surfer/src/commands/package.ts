/**
 * fennec package
 *
 * Generates the platform-appropriate distributable:
 *   macos   -> .dmg (via create-dmg)
 *   linux   -> .AppImage (via appimagetool)
 *   windows -> NSIS installer .exe (via makensis)
 */

import { Command }  from 'commander';
import chalk        from 'chalk';
import ora          from 'ora';
import { execa }    from 'execa';
import type { SurferConfig } from '../utils/config.js';

export function packageCommand(program: Command, config: SurferConfig) {
  program
    .command('package')
    .description('Generate distributable package (.dmg / AppImage / .exe)')
    .option('--channel <channel>', 'Channel to package (release|nightly)', 'release')
    .option('--platform <platform>', 'Override target platform')
    .action(async (opts) => {
      const channel  = opts.channel as 'release' | 'nightly';
      const platform = (opts.platform ?? process.platform === 'darwin'
        ? 'macos'
        : process.platform === 'win32'
          ? 'windows'
          : 'linux') as 'macos' | 'linux' | 'windows';

      const version   = config.channels[channel].version;
      const pkgConfig = config.package[platform];

      console.log(chalk.bold(`\nFennec package\n`));
      console.log(`  Platform: ${chalk.cyan(platform)}`);
      console.log(`  Channel:  ${chalk.cyan(channel)}`);
      console.log(`  Version:  ${chalk.cyan(version)}\n`);

      const spinner = ora(`Building ${pkgConfig.type} package`).start();
      try {
        switch (platform) {
          case 'macos':
            await execa('bash', ['fennec-macos/build/create-dmg.sh', channel, version], {
              stdio: 'inherit',
            });
            break;
          case 'linux':
            for (const arch of pkgConfig.arch ?? ['x86_64']) {
              await execa('bash', [
                'fennec-linux/build/create-appimage.sh', channel, version, arch,
              ], { stdio: 'inherit' });
            }
            break;
          case 'windows':
            await execa('powershell', [
              '-File', 'fennec-windows/build/create-installer.ps1',
              '-Channel', channel, '-Version', version,
            ], { stdio: 'inherit' });
            break;
        }
        spinner.succeed(`Package built`);
      } catch (err) {
        spinner.fail('Packaging failed');
        throw err;
      }

      console.log(chalk.green.bold(`\nPackage ready.\n`));
      console.log(`  Next: ${chalk.cyan('fennec release')}\n`);
    });
}
