/**
 * fennec patch <subcommand>
 *
 * Subcommands:
 *   apply          Apply all patches in patches/series to chromium-src/
 *   new <name>     Scaffold a new vendor patch + append to series
 *   validate       Run devutils/validate_patches.py
 *   status         Show which patches in the series are applied vs. missing
 *   refresh        Re-export a modified Chromium file as an updated patch
 */

import { readFile, writeFile, appendFile, stat } from 'node:fs/promises';
import { existsSync }                             from 'node:fs';
import { resolve, join, basename, dirname }       from 'node:path';
import { Command }                                from 'commander';
import chalk                                      from 'chalk';
import { log, step }                              from '../utils/logger.js';
import { run, requireBinaries }                   from '../utils/shell.js';
import type { SurferConfig }                      from '../utils/config.js';

const PATCH_TEMPLATE = (name: string, date: string) => `\
From 0000000000000000000000000000000000000000 Mon Sep 17 00:00:00 2001
From: Fennec Authors <patches@fennec.computer>
Date: ${date}
Subject: [PATCH] fennec: ${name}

Describe what this patch does and why.
Link the relevant Chromium bug or upstream change if applicable.

PILLAR: Transparency | Calm UI | Privacy | Customization | Branding
JOURNAL: none

---
 path/to/modified/file.cc | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

diff --git a/path/to/modified/file.cc b/path/to/modified/file.cc
index 0000000..0000000 100644
--- a/path/to/modified/file.cc
+++ b/path/to/modified/file.cc
@@ -1,3 +1,3 @@
 // context line
-// original line to be replaced
+// replacement line
 // context line
--
2.44.0
`;

export function patchCommand(program: Command, config: SurferConfig) {
  const patch = program
    .command('patch')
    .description('Patch series management');

  // ── apply ─────────────────────────────────────────────────────────────────
  patch
    .command('apply')
    .description('Apply all patches in patches/series to chromium-src/')
    .option('--dry-run',            'Print patches without applying')
    .option('--from <patch>',       'Start applying from this patch (skip earlier)')
    .option('--only <patch>',       'Apply only this single patch')
    .option('--chromium-src <dir>', 'Override source directory', 'chromium-src')
    .addHelpText('after', `
Examples:
  fennec patch apply
  fennec patch apply --dry-run
  fennec patch apply --only vendor/fennec/branding/rename-chromium-to-fennec.patch
`)
    .action(async (opts) => {
      const ROOT     = resolve(process.cwd());
      const SRC_DIR  = resolve(ROOT, opts.chromiumSrc as string);
      const series   = await loadSeries(join(ROOT, 'patches', 'series'));

      log.section('Applying patch series');
      log.kv('Patches', String(series.length));
      log.kv('Source',  SRC_DIR);
      if (opts.dryRun) log.warn('Dry-run mode — no changes will be made.');
      log.br();

      if (!existsSync(SRC_DIR) && !opts.dryRun) {
        log.fatal(
          `${SRC_DIR} does not exist.`,
          'Run `fennec bootstrap` first, or pass --chromium-src <path>.',
        );
      }

      let patchList = series;
      if (opts.only) {
        patchList = series.filter(p => p.includes(opts.only as string));
        if (patchList.length === 0) {
          log.fatal(`No patch matches: ${opts.only}`);
        }
      } else if (opts.from) {
        const idx = series.findIndex(p => p.includes(opts.from as string));
        if (idx < 0) log.fatal(`Patch not found in series: ${opts.from}`);
        patchList = series.slice(idx);
      }

      let applied = 0;
      let skipped = 0;

      for (let i = 0; i < patchList.length; i++) {
        const patchRel  = patchList[i]!;
        const patchPath = join(ROOT, 'patches', patchRel);
        const label     = basename(patchRel);

        if (!existsSync(patchPath)) {
          log.warn(`Missing on disk (skipping): ${patchRel}`);
          skipped++;
          continue;
        }

        if (opts.dryRun) {
          log.info(`[${i + 1}/${patchList.length}] ${chalk.cyan(label)}`);
          continue;
        }

        const done = step(`[${i + 1}/${patchList.length}] ${label}`);
        try {
          await run('git', [
            'apply',
            `--directory=${SRC_DIR}`,
            '--ignore-whitespace',
            '--reject',
            patchPath,
          ]);
          applied++;
          done();
        } catch {
          // Attempt to show which hunk failed
          try {
            await run('git', [
              'apply',
              `--directory=${SRC_DIR}`,
              '--ignore-whitespace',
              '--check',
              patchPath,
            ], { allowFailure: true });
          } catch {}
          log.fatal(
            `Patch failed: ${patchRel}`,
            [
              'The patch did not apply cleanly. Possible causes:',
              '  1. Upstream Chromium changed this file since the patch was written.',
              '  2. A prior patch in the series modified this file.',
              '  3. The patch hunk offsets are stale — run `fennec patch refresh`.',
              '',
              `.rej files may have been left in ${SRC_DIR} — inspect them for context.`,
            ].join('\n'),
          );
        }
      }

      log.br();
      if (!opts.dryRun) {
        log.success(`${applied} applied, ${skipped} skipped.`);
      } else {
        log.info(`Would apply: ${patchList.length} patches`);
      }
    });

  // ── new ───────────────────────────────────────────────────────────────────
  patch
    .command('new <name>')
    .description('Scaffold a new vendor patch in patches/vendor/fennec/ and append to series')
    .option('--section <section>', 'Subsection: ui | privacy | networking | branding', 'ui')
    .option('--no-edit',           'Do not open $EDITOR after creation')
    .addHelpText('after', `
Examples:
  fennec patch new calm-address-bar --section ui
  fennec patch new block-sensor-api --section privacy
`)
    .action(async (nameArg: string, opts) => {
      const ROOT       = resolve(process.cwd());
      const safeName   = nameArg.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      const section    = opts.section as string;
      const filename   = `${safeName}.patch`;
      const patchDir   = join(ROOT, 'patches', 'vendor', 'fennec', section);
      const patchPath  = join(patchDir, filename);
      const seriesLine = `vendor/fennec/${section}/${filename}`;
      const seriesPath = join(ROOT, 'patches', 'series');

      if (existsSync(patchPath)) {
        log.fatal(`Patch already exists: ${patchPath}`);
      }

      const { mkdirSync } = await import('node:fs');
      mkdirSync(patchDir, { recursive: true });

      const date = new Date().toUTCString();
      await writeFile(patchPath, PATCH_TEMPLATE(safeName, date), 'utf8');
      await appendFile(seriesPath, `\n${seriesLine}\n`);

      log.success(`Created: patches/${seriesLine}`);
      log.success(`Appended to patches/series`);

      const editor = process.env['EDITOR'] || process.env['VISUAL'];
      if (opts.edit && editor) {
        await run(editor, [patchPath], { stream: true });
      } else {
        log.info(`Edit the patch: ${patchPath}`);
        log.info(`Then apply:     fennec patch apply --only ${safeName}`);
      }
    });

  // ── validate ──────────────────────────────────────────────────────────────
  patch
    .command('validate')
    .description('Run devutils/validate_patches.py — checks series, files, headers')
    .action(async () => {
      const ROOT = resolve(process.cwd());
      log.section('Validating patch series');
      await run('python3', [
        join(ROOT, 'devutils', 'validate_patches.py'),
        '--series-file', join(ROOT, 'patches', 'series'),
        '--patches-dir', join(ROOT, 'patches'),
      ], { stream: true });
      log.success('Patch series valid.');
    });

  // ── status ────────────────────────────────────────────────────────────────
  patch
    .command('status')
    .description('Show disk presence and file sizes for all patches in series')
    .action(async () => {
      const ROOT    = resolve(process.cwd());
      const series  = await loadSeries(join(ROOT, 'patches', 'series'));
      let missing   = 0;

      log.section('Patch series status');
      log.kv('Total', String(series.length));
      log.br();

      for (const patchRel of series) {
        const p = join(ROOT, 'patches', patchRel);
        if (existsSync(p)) {
          const { size } = await stat(p);
          const kb       = (size / 1024).toFixed(1);
          const isStub   = size < 600; // template-only patches are very small
          const label    = isStub
            ? chalk.dim(`  [stub, ${kb} KB]`)
            : chalk.green(`  [${kb} KB]`);
          console.log(`  ${chalk.green('✓')} ${chalk.dim(patchRel)}${label}`);
        } else {
          console.log(`  ${chalk.red('✗')} ${chalk.dim(patchRel)}  ${chalk.red('[MISSING]')}`);
          missing++;
        }
      }

      log.br();
      if (missing > 0) {
        log.warn(`${missing} patch(es) listed in series but missing on disk.`);
        log.info('Create them with: fennec patch new <name>');
      } else {
        log.success('All patches present.');
      }
    });

  // ── refresh ───────────────────────────────────────────────────────────────
  patch
    .command('refresh <patch>')
    .description('Re-export a modified chromium-src file as an updated patch diff')
    .option('--chromium-src <dir>', 'Source directory', 'chromium-src')
    .addHelpText('after', `
Workflow:
  1. Edit the file inside chromium-src/
  2. Run: fennec patch refresh vendor/fennec/ui/my-patch.patch --chromium-src chromium-src
  3. The patch file is updated with the new diff
`)
    .action(async (patchRel: string, opts) => {
      const ROOT      = resolve(process.cwd());
      const SRC_DIR   = resolve(ROOT, opts.chromiumSrc as string);
      const patchPath = join(ROOT, 'patches', patchRel);

      if (!existsSync(patchPath)) {
        log.fatal(`Patch not found: ${patchPath}`);
      }
      if (!existsSync(SRC_DIR)) {
        log.fatal(`Source directory not found: ${SRC_DIR}`);
      }

      log.section('Refreshing patch');
      log.kv('Patch', patchRel);
      log.br();

      // Export updated diff from chromium-src/ working tree
      const diff = await run('git', [
        'diff',
        '--no-index',
        '--',
        '.', // compare working tree
      ], { cwd: SRC_DIR, allowFailure: true });

      if (!diff.trim()) {
        log.warn('No changes detected in chromium-src/.');
        log.info('Make your edits inside chromium-src/ before refreshing.');
        return;
      }

      // Read existing patch header (everything before first diff --git)
      const existing = await readFile(patchPath, 'utf8');
      const headerEnd = existing.indexOf('diff --git');
      const header = headerEnd > 0 ? existing.slice(0, headerEnd) : '';

      await writeFile(patchPath, header + diff + '\n-- \n2.44.0\n', 'utf8');
      log.success(`Patch updated: ${patchPath}`);
    });
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function loadSeries(seriesPath: string): Promise<string[]> {
  if (!existsSync(seriesPath)) {
    log.fatal(`patches/series not found at ${seriesPath}`);
  }
  const content = await readFile(seriesPath, 'utf8');
  return content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
}
