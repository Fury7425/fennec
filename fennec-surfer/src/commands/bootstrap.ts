/**
 * fennec bootstrap
 *
 * WHAT: Fetches the ungoogled-chromium source at the pinned version tag,
 *       runs the de-googling pipeline, then applies Fennec's patch series
 *       — leaving chromium-src/ in a state ready for `fennec build`.
 *
 * Full sequence:
 *   1. Check prerequisites
 *   2. Download Chromium source tarball
 *   3. Verify SHA-256
 *   4. Extract tarball → chromium-src/
 *   5. Clone ungoogled-chromium at the pinned revision (patches + devutils)
 *   6. Copy ungoogled-chromium patches to patches/core/ungoogled-chromium/
 *   7. Run ungoogled-chromium domain_substitution
 *   8. Run ungoogled-chromium binary_pruning
 *   9. Apply ungoogled-chromium patches (from patches/core/)
 *   10. Apply iridium patches (from patches/core/iridium/)
 *   11. Apply Fennec vendor patches (fennec patch apply)
 *   12. Install WebUI npm dependencies
 *
 * Flags:
 *   --skip-download        Reuse an existing chromium-src/ tarball
 *   --skip-ungoogled       Skip step 5-8 (source already processed)
 *   --skip-patches         Skip patch application (steps 9-11)
 *   --channel <c>          release (default) | nightly
 *   --chromium-src <dir>   Override chromium-src/ path (default: ./chromium-src)
 */

import { Command }           from 'commander';
import { existsSync }        from 'node:fs';
import { mkdir, rm, rename } from 'node:fs/promises';
import { resolve, join }     from 'node:path';
import chalk                 from 'chalk';
import { log, step }         from '../utils/logger.js';
import { run, download, verifySha256, requireBinaries } from '../utils/shell.js';
import type { SurferConfig } from '../utils/config.js';

// ── SHA-256 hashes for each pinned Chromium tarball.
// Update this when bumping the Chromium version in surfer.json.
// Fetch with: curl -sI <url>.sha256
const CHROMIUM_SHA256: Record<string, string> = {
  '124.0.6367.201': 'c8e4a0a3892d9861e5ac8f3bbd1d3ed5cd96da8e8268a2a11a9b5e81b1c3d77f',
  // Add new versions here as they are pinned.
};

const UNGOOGLED_BASE =
  'https://github.com/nicowillis/ungoogled-chromium/archive/refs/tags';

export function bootstrapCommand(program: Command, config: SurferConfig) {
  program
    .command('bootstrap')
    .description(
      'Fetch ungoogled-chromium at the pinned version and apply the full patch series'
    )
    .option('--skip-download',     'Reuse existing chromium-src/ (skip tarball fetch)')
    .option('--skip-ungoogled',    'Skip ungoogled-chromium processing steps')
    .option('--skip-patches',      'Skip patch application')
    .option('--channel <channel>', 'Build channel', 'release')
    .option('--chromium-src <dir>','Path for extracted source', 'chromium-src')
    .action(async (opts) => {
      const ROOT      = resolve(process.cwd());
      const SRC_DIR   = resolve(ROOT, opts.chromiumSrc as string);
      const version   = config.chromium.version;
      const ugRevision = config.chromium.ungoogled_revision;
      const tarUrl    = config.chromium.source.replace('{{version}}', version);
      const tarFile   = join(ROOT, `chromium-${version}.tar.xz`);

      log.section('Fennec Bootstrap');
      log.kv('Chromium',         version);
      log.kv('Ungoogled rev',    ugRevision);
      log.kv('Channel',          opts.channel as string);
      log.kv('Source dir',       SRC_DIR);
      log.br();

      // ── 1. Prerequisites ────────────────────────────────────────────────
      await requireBinaries([
        { name: 'python3', hint: 'https://python.org (3.12+)'   },
        { name: 'git',     hint: 'https://git-scm.com'          },
        { name: 'tar',     hint: 'pre-installed on Linux/macOS' },
        { name: 'ninja',   hint: 'https://ninja-build.org'      },
        { name: 'curl',    hint: 'pre-installed on Linux/macOS' },
      ]);
      log.success('Prerequisites OK');

      // ── 2. Download tarball ──────────────────────────────────────────────
      if (!opts.skipDownload) {
        if (existsSync(tarFile)) {
          log.warn(`Reusing cached tarball: ${tarFile}`);
        } else {
          const done = step(`Downloading chromium-${version}.tar.xz`);
          await download(tarUrl, tarFile);
          done();
        }

        // ── 3. Verify SHA-256 ──────────────────────────────────────────────
        const expectedHash = CHROMIUM_SHA256[version];
        if (expectedHash) {
          const done = step('Verifying SHA-256');
          await verifySha256(tarFile, expectedHash);
          done('SHA-256 verified');
        } else {
          log.warn(`No pinned SHA-256 for chromium ${version}. Skipping verification.`);
          log.warn('Add the hash to CHROMIUM_SHA256 in bootstrap.ts before a real release.');
        }

        // ── 4. Extract ────────────────────────────────────────────────────
        if (existsSync(SRC_DIR)) {
          log.warn(`${SRC_DIR} already exists — removing and re-extracting.`);
          await rm(SRC_DIR, { recursive: true, force: true });
        }

        const extractDone = step(`Extracting to ${SRC_DIR}`);
        await mkdir(SRC_DIR, { recursive: true });
        await run('tar', [
          '--extract',
          '--xz',
          '--file', tarFile,
          '--strip-components=1',
          '--directory', SRC_DIR,
        ], { stream: true });
        extractDone();
      } else {
        log.warn('--skip-download: reusing existing chromium-src/');
        if (!existsSync(SRC_DIR)) {
          log.fatal(`${SRC_DIR} does not exist. Remove --skip-download.`);
        }
      }

      // ── 5. Fetch ungoogled-chromium scripts and patches ──────────────────
      if (!opts.skipUngoogled) {
        const ugDir   = join(ROOT, '.ungoogled-chromium');
        const ugUrl   = `${UNGOOGLED_BASE}/${ugRevision}.tar.gz`;
        const ugTar   = join(ROOT, `ungoogled-chromium-${ugRevision}.tar.gz`);

        const ugDone = step(`Fetching ungoogled-chromium ${ugRevision}`);
        if (!existsSync(ugTar)) {
          await download(ugUrl, ugTar);
        }
        if (existsSync(ugDir)) await rm(ugDir, { recursive: true, force: true });
        await mkdir(ugDir, { recursive: true });
        await run('tar', [
          '--extract', '--gzip',
          '--file', ugTar,
          '--strip-components=1',
          '--directory', ugDir,
        ]);
        ugDone('ungoogled-chromium fetched');

        // ── 6. Copy core patches ────────────────────────────────────────────
        const coreUgDir = join(ROOT, 'patches', 'core', 'ungoogled-chromium');
        const copyDone  = step('Copying ungoogled-chromium patches');
        await run('bash', ['-c',
          `cp -r "${ugDir}/patches/." "${coreUgDir}/"`
        ]);
        copyDone('Core patches populated');

        // ── 7. Domain substitution ──────────────────────────────────────────
        const dsDone = step('Running domain substitution');
        await run('python3', [
          join(ROOT, 'devutils', 'domain_substitution.py'),
          'apply',
          `--regex-file=${join(ROOT, 'devutils', 'domain_regex.list')}`,
          `--files-list=${join(ROOT, 'devutils', 'domain_substitution.list')}`,
          SRC_DIR,
        ], { stream: VERBOSE() });
        dsDone('Domain substitution complete');

        // ── 8. Binary pruning ────────────────────────────────────────────────
        const pruneDone = step('Binary pruning');
        await run('python3', [
          join(ugDir, 'utils', 'prune_binaries.py'),
          SRC_DIR,
          join(ugDir, 'pruning.list'),
        ], { stream: VERBOSE() });
        pruneDone('Binaries pruned');

        // ── 9. Apply ungoogled-chromium patches ─────────────────────────────
        const ugPatchDone = step('Applying ungoogled-chromium patches');
        await run('python3', [
          join(ugDir, 'utils', 'patches.py'),
          'apply',
          SRC_DIR,
          join(ugDir, 'patches'),
        ], { stream: true });
        ugPatchDone('ungoogled-chromium patches applied');
      } else {
        log.warn('--skip-ungoogled: skipping de-googling pipeline.');
      }

      // ── 10-11. Apply Fennec patches ─────────────────────────────────────
      if (!opts.skipPatches) {
        await applyPatchSeries(ROOT, SRC_DIR);
      } else {
        log.warn('--skip-patches: skipping Fennec patch series.');
      }

      // ── 12. WebUI dependencies ───────────────────────────────────────────
      const npmDone = step('Installing WebUI npm dependencies');
      await run('npm', ['ci'], { cwd: ROOT, stream: VERBOSE() });
      await run('npm', ['ci'], {
        cwd:    join(ROOT, 'fennec-surfer'),
        stream: VERBOSE(),
      });
      npmDone('npm dependencies installed');

      log.br();
      log.success(chalk.bold('Bootstrap complete.'));
      log.br();
      log.info(`Next: ${chalk.cyan('fennec build [macos|linux|windows]')}`);
      log.br();
    });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function VERBOSE() { return !!process.env['FENNEC_VERBOSE']; }

async function applyPatchSeries(root: string, srcDir: string): Promise<void> {
  const { readFile } = await import('node:fs/promises');
  const seriesPath   = join(root, 'patches', 'series');

  let seriesContent: string;
  try {
    seriesContent = await readFile(seriesPath, 'utf8');
  } catch {
    return log.fatal('patches/series not found. Run from the Fennec repo root.');
  }

  const patches = seriesContent
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  log.step(0, patches.length, `Applying ${patches.length} patches`);

  let applied = 0;
  for (const patchRel of patches) {
    const patchPath = join(root, 'patches', patchRel);
    if (!existsSync(patchPath)) {
      log.warn(`Patch not on disk, skipping: ${patchRel}`);
      continue;
    }

    const done = step(`[${applied + 1}/${patches.length}] ${patchRel.split('/').pop()}`);
    try {
      await run('git', [
        'apply',
        `--directory=${srcDir}`,
        '--ignore-whitespace',
        '--reject',
        patchPath,
      ]);
      applied++;
      done();
    } catch (e: any) {
      log.fatal(
        `Patch failed: ${patchRel}`,
        'Check for upstream conflicts. Run: git apply --check <patch-file> in chromium-src/',
      );
    }
  }

  log.success(`Applied ${applied}/${patches.length} patches.`);
}
