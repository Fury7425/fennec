/**
 * platform.ts -- Host + target platform detection and path helpers
 */

import { cpus } from 'node:os';

export type TargetPlatform = 'macos' | 'linux' | 'windows';
export type Channel        = 'release' | 'nightly';

/** Detect the host operating system */
export function detectHostPlatform(): TargetPlatform {
  switch (process.platform) {
    case 'darwin':  return 'macos';
    case 'win32':   return 'windows';
    default:        return 'linux';
  }
}

/** GN output directory name for a given channel */
export function outDir(channel: Channel): string {
  return channel === 'nightly' ? 'Nightly' : 'Release';
}

/** Chromium binary name for a target platform */
export function chromeBinary(platform: TargetPlatform): string {
  switch (platform) {
    case 'macos':   return 'Chromium.app/Contents/MacOS/Chromium';
    case 'windows': return 'chrome.exe';
    default:        return 'chrome';
  }
}

/** Installer artifact filename for a given platform and version */
export function artifactName(
  platform: TargetPlatform,
  channel: Channel,
  version: string,
): string {
  const name = channel === 'nightly' ? 'Fennec-Nightly' : 'Fennec';
  switch (platform) {
    case 'macos':   return `${name}-${version}.dmg`;
    case 'windows': return `${name}-${version}-installer.exe`;
    default:        return `${name}-${version}-x86_64.AppImage`;
  }
}

/** Human-readable platform label */
export function platformLabel(p: TargetPlatform): string {
  return { macos: 'macOS', linux: 'Linux', windows: 'Windows' }[p];
}

/** Validate that a string is a known TargetPlatform */
export function assertPlatform(s: string): TargetPlatform {
  if (s === 'macos' || s === 'linux' || s === 'windows') return s;
  console.error(`Unknown platform "${s}". Must be: macos | linux | windows`);
  process.exit(1);
}

/** Validate that a string is a known Channel */
export function assertChannel(s: string): Channel {
  if (s === 'release' || s === 'nightly') return s;
  console.error(`Unknown channel "${s}". Must be: release | nightly`);
  process.exit(1);
}

/** Number of logical CPU cores (for Ninja -j) */
export function cpuCount(): number {
  return cpus().length;
}
