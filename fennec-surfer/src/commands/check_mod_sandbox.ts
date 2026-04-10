import { resolve } from 'node:path';
import { Command } from 'commander';
import { log } from '../utils/logger.js';
import { requireBinaries, run } from '../utils/shell.js';

export function checkModSandboxCommand(program: Command): void {
  program
    .command('check-mod-sandbox')
    .description('Run the Mod sandbox escape test harness')
    .action(async () => {
      const root = resolve(process.cwd());
      await requireBinaries([
        { name: 'node', hint: 'Install Node.js 20+ to run the sandbox harness.' },
      ]);
      log.section('Checking Mod sandbox');
      await run('node', [resolve(root, 'devutils', 'check_mod_sandbox.mjs')], {
        stream: true,
      });
      log.success('Mod sandbox validation passed.');
    });
}
