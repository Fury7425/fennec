import type {
  FennecLayoutConfig,
  FennecModManifest,
  FennecTab,
  FennecThemeTokens,
  FennecWorkspace,
  InstalledMod,
  JournalEntry,
  LayoutPreset,
  ModLayoutBlock,
  ModSurface,
  PanelConfig,
  RegistryModSummary,
} from './models';
import { logFennecInternalRequest } from './journal-store';
import { bytesToString, encodeBase64, stringToBytes, textFromZipEntry, unzip, zip, type ZipEntryMap } from './zip';

const MOD_STORAGE_KEY = 'fennec.mods.installed';
const MOD_MESSAGE = 'fennec-mods-sync';
const CURRENT_FENNEC_VERSION = '1.0.0';

export const MOD_SURFACES: ModSurface[] = ['sidebar', 'newtab', 'settings', 'journal', 'layout'];

export const GPL_COMPATIBLE_LICENSES = new Set([
  'GPL-3.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'AGPL-3.0',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'LGPL-3.0',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
]);

export interface RegisteredPanel extends PanelConfig {
  modId: string;
  html: string;
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return null;
  }
  return new BroadcastChannel('fennec-mods');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(part => Number.parseInt(part, 10));
  const right = b.split('.').map(part => Number.parseInt(part, 10));
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function sanitizeLayoutConfig(raw: unknown): FennecLayoutConfig {
  if (!isRecord(raw)) {
    throw new Error('layout.config must be an object.');
  }

  const sidebar = isRecord(raw['sidebar']) ? raw['sidebar'] : {};
  const toolbar = raw['toolbar'];
  const addressBar = raw['addressBar'];
  const journalPanel = raw['journalPanel'];

  return {
    sidebar: {
      position: sidebar['position'] === 'right' || sidebar['position'] === 'hidden'
        ? sidebar['position']
        : 'left',
      displayMode: sidebar['displayMode'] === 'collapsed'
        ? 'collapsed'
        : 'expanded',
    },
    toolbar: toolbar === 'bottom' || toolbar === 'hidden'
      ? toolbar
      : 'top',
    addressBar: addressBar === 'sidebar-top' || addressBar === 'hidden'
      ? addressBar
      : 'top-center',
    journalPanel: journalPanel === 'floating-panel' || journalPanel === 'hidden'
      ? journalPanel
      : 'sidebar-bottom-drawer',
    splitViewDefault: Boolean(raw['splitViewDefault']),
  };
}

function sanitizeLayoutBlock(raw: unknown): ModLayoutBlock | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  if (typeof raw['presetName'] !== 'string') {
    throw new Error('layout.presetName must be a string.');
  }

  return {
    presetName: raw['presetName'],
    config: sanitizeLayoutConfig(raw['config']),
  };
}

function validateManifestObject(manifest: unknown, files?: ZipEntryMap): FennecModManifest {
  if (!isRecord(manifest)) {
    throw new Error('Mod manifest must be an object.');
  }

  const requiredStringFields = ['id', 'name', 'version', 'author', 'description', 'license', 'fennec_min_version'] as const;
  for (const field of requiredStringFields) {
    if (typeof manifest[field] !== 'string' || manifest[field].trim() === '') {
      throw new Error(`Manifest field "${field}" must be a non-empty string.`);
    }
  }

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(manifest['id'] as string)) {
    throw new Error('Manifest id must be kebab-case.');
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest['version'] as string)) {
    throw new Error('Manifest version must use semver x.y.z.');
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest['fennec_min_version'] as string)) {
    throw new Error('Manifest fennec_min_version must use semver x.y.z.');
  }
  if (!GPL_COMPATIBLE_LICENSES.has(manifest['license'] as string)) {
    throw new Error(`License ${manifest['license']} is not GPL-3.0 compatible.`);
  }
  if (compareVersions(CURRENT_FENNEC_VERSION, manifest['fennec_min_version'] as string) < 0) {
    throw new Error(`Mod requires Fennec ${manifest['fennec_min_version']} or newer.`);
  }
  if (!isStringArray(manifest['surfaces']) || manifest['surfaces'].length === 0) {
    throw new Error('Manifest surfaces must be a non-empty array.');
  }

  const surfaces = (manifest['surfaces'] as string[]).map(surface => {
    if (!MOD_SURFACES.includes(surface as ModSurface)) {
      throw new Error(`Unsupported surface "${surface}".`);
    }
    return surface as ModSurface;
  });

  const panel = manifest['panel'];
  if (panel !== undefined && !isRecord(panel)) {
    throw new Error('panel must be an object when provided.');
  }

  const tokens = manifest['tokens'];
  if (tokens !== undefined && !isRecord(tokens)) {
    throw new Error('tokens must be an object when provided.');
  }

  const resolved: FennecModManifest = {
    id: manifest['id'] as string,
    name: manifest['name'] as string,
    version: manifest['version'] as string,
    author: manifest['author'] as string,
    description: manifest['description'] as string,
    license: manifest['license'] as string,
    fennec_min_version: manifest['fennec_min_version'] as string,
    surfaces,
  };

  if (typeof manifest['css'] === 'string') {
    resolved.css = manifest['css'];
  }
  if (typeof manifest['js'] === 'string') {
    resolved.js = manifest['js'];
  }

  if (panel) {
    if (typeof panel['title'] !== 'string' || typeof panel['icon'] !== 'string' || typeof panel['entry'] !== 'string') {
      throw new Error('panel.title, panel.icon, and panel.entry are required.');
    }
    resolved.panel = {
      title: panel['title'],
      icon: panel['icon'],
      entry: panel['entry'],
    };
  }

  if (tokens) {
    resolved.tokens = {};
    for (const [key, value] of Object.entries(tokens)) {
      if (typeof value !== 'string') {
        throw new Error(`Token override ${key} must be a string.`);
      }
      resolved.tokens[key as keyof FennecThemeTokens] = value;
    }
  }

  const layout = sanitizeLayoutBlock(manifest['layout']);
  if (layout) {
    resolved.layout = layout;
  }

  if (files) {
    for (const assetPath of [resolved.css, resolved.js, resolved.panel?.entry]) {
      if (assetPath && !files[assetPath]) {
        throw new Error(`Manifest references missing asset "${assetPath}".`);
      }
    }
  }

  return resolved;
}

function readBridgeInstalledMods(): InstalledMod[] | null {
  const raw = window.__fennec?.mods?.getInstalled?.();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as InstalledMod[];
  } catch {
    return null;
  }
}

export function loadInstalledMods(): InstalledMod[] {
  const bridgeMods = readBridgeInstalledMods();
  if (bridgeMods) {
    return bridgeMods;
  }

  const stored = window.localStorage.getItem(MOD_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as InstalledMod[];
  } catch {
    return [];
  }
}

function saveInstalledMods(mods: InstalledMod[]): InstalledMod[] {
  window.localStorage.setItem(MOD_STORAGE_KEY, JSON.stringify(mods));
  window.__fennec?.mods?.setInstalled?.(JSON.stringify(mods));

  const payload = { type: MOD_MESSAGE, mods };
  window.postMessage(payload, '*');
  const channel = getBroadcastChannel();
  channel?.postMessage(payload);
  channel?.close();

  return mods;
}

export function subscribeInstalledMods(onChange: (mods: InstalledMod[]) => void): () => void {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type !== MOD_MESSAGE || !event.data.mods) {
      return;
    }
    onChange(event.data.mods as InstalledMod[]);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== MOD_STORAGE_KEY || !event.newValue) {
      return;
    }
    try {
      onChange(JSON.parse(event.newValue) as InstalledMod[]);
    } catch {
      onChange([]);
    }
  };

  window.addEventListener('message', handleMessage);
  window.addEventListener('storage', handleStorage);

  const channel = getBroadcastChannel();
  if (channel) {
    channel.onmessage = event => {
      if (event.data?.type === MOD_MESSAGE && event.data.mods) {
        onChange(event.data.mods as InstalledMod[]);
      }
    };
  }

  return () => {
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
    channel?.close();
  };
}

export async function installModArchive(
  archive: ArrayBuffer | Uint8Array,
  source: InstalledMod['source'] = 'local',
  registryMetadata?: Partial<RegistryModSummary>,
): Promise<InstalledMod> {
  const bytes = archive instanceof Uint8Array ? new Uint8Array(archive) : new Uint8Array(archive);
  const entries = await unzip(bytes.buffer);
  const manifest = validateManifestObject(JSON.parse(textFromZipEntry(entries, 'manifest.json')), entries);

  const assets: Record<string, string> = {};
  for (const [path, data] of Object.entries(entries)) {
    if (path === 'manifest.json') {
      continue;
    }
    assets[path] = bytesToString(data);
  }

  const mods = loadInstalledMods().filter(existing => existing.id !== manifest.id);
  const installed: InstalledMod = {
    ...manifest,
    enabled: true,
    installedAt: new Date().toISOString(),
    source,
    repoUrl: registryMetadata?.repo_url,
    installCount: registryMetadata?.install_count,
    lastUpdated: registryMetadata?.last_updated,
    assets,
  };

  saveInstalledMods([installed, ...mods]);
  window.__fennec?.mods?.installArchive?.(encodeBase64(bytes));
  return installed;
}

export function toggleInstalledMod(id: string, enabled: boolean): InstalledMod[] {
  const mods = loadInstalledMods().map(mod => mod.id === id ? { ...mod, enabled } : mod);
  window.__fennec?.mods?.setEnabled?.(id, enabled);
  return saveInstalledMods(mods);
}

export function uninstallInstalledMod(id: string): InstalledMod[] {
  const mods = loadInstalledMods().filter(mod => mod.id !== id);
  window.__fennec?.mods?.uninstall?.(id);
  return saveInstalledMods(mods);
}

export function getInstalledModsForSurface(surface: ModSurface): InstalledMod[] {
  return loadInstalledMods().filter(mod => mod.enabled && mod.surfaces.includes(surface));
}

export function getMergedTokenOverrides(surface: ModSurface): Partial<FennecThemeTokens> {
  return getInstalledModsForSurface(surface).reduce<Partial<FennecThemeTokens>>((merged, mod) => {
    return { ...merged, ...(mod.tokens ?? {}) };
  }, {});
}

export function getActiveLayoutOverride(): FennecLayoutConfig | null {
  const layoutMod = loadInstalledMods()
    .filter(mod => mod.enabled && mod.layout)
    .at(0);
  return layoutMod?.layout?.config ?? null;
}

export function createModArchive(manifest: FennecModManifest, assets: Record<string, string>): Uint8Array {
  validateManifestObject(manifest);
  return zip({
    'manifest.json': JSON.stringify(manifest, null, 2),
    ...assets,
  });
}

export function createLayoutPresetArchive(
  preset: LayoutPreset,
  tokens?: Partial<FennecThemeTokens>,
): Uint8Array {
  const manifest: FennecModManifest = {
    id: `layout-${preset.id}`,
    name: preset.name,
    version: '1.0.0',
    author: 'Fennec Layout Editor',
    description: preset.description,
    license: 'GPL-3.0',
    fennec_min_version: CURRENT_FENNEC_VERSION,
    surfaces: ['layout', 'settings'],
    layout: {
      presetName: preset.name,
      config: preset.layout,
    },
    tokens: tokens ?? preset.tokenOverrides,
  };

  const html = `<section style="font-family: var(--fennec-font-ui); padding: 16px; color: var(--fennec-color-text-primary); background: var(--fennec-color-bg-secondary);">
  <h1 style="margin: 0 0 8px 0;">${preset.name}</h1>
  <p style="margin: 0; color: var(--fennec-color-text-secondary);">${preset.description}</p>
</section>`;

  return createModArchive(manifest, {
    'panel.html': html,
  });
}

const TAB_CHANGE_EVENT = 'fennec-tab-change';
const WORKSPACE_CHANGE_EVENT = 'fennec-workspace-change';

export function emitModTabChange(tab: FennecTab): void {
  window.dispatchEvent(new CustomEvent(TAB_CHANGE_EVENT, { detail: tab }));
}

export function emitModWorkspaceChange(workspace: FennecWorkspace): void {
  window.dispatchEvent(new CustomEvent(WORKSPACE_CHANGE_EVENT, { detail: workspace }));
}

export function subscribeToModTabChange(callback: (tab: FennecTab) => void): () => void {
  const handler = (event: Event) => {
    callback((event as CustomEvent<FennecTab>).detail);
  };
  window.addEventListener(TAB_CHANGE_EVENT, handler);
  return () => window.removeEventListener(TAB_CHANGE_EVENT, handler);
}

export function subscribeToModWorkspaceChange(callback: (workspace: FennecWorkspace) => void): () => void {
  const handler = (event: Event) => {
    callback((event as CustomEvent<FennecWorkspace>).detail);
  };
  window.addEventListener(WORKSPACE_CHANGE_EVENT, handler);
  return () => window.removeEventListener(WORKSPACE_CHANGE_EVENT, handler);
}

function getRegistryBaseUrl(): string {
  return 'https://mods.fennec.computer/api';
}

export async function fetchRegistryIndex(enabled: boolean): Promise<RegistryModSummary[]> {
  if (!enabled) {
    return [];
  }

  const url = `${getRegistryBaseUrl()}/index.json`;

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await response.json() as RegistryModSummary[];
    logFennecInternalRequest(url, response.status, JSON.stringify(data).length);
    return data;
  } catch {
    return [
      {
        id: 'calm-research-tools',
        name: 'Calm Research Tools',
        author: 'fennec-community',
        version: '1.2.0',
        description: 'Floating citations panel and softer workspace tinting.',
        surfaces: ['sidebar', 'layout'],
        install_count: 812,
        last_updated: '2026-04-04',
        license: 'GPL-3.0',
        repo_url: 'https://github.com/fennec-browser/mod-calm-research-tools',
      },
      {
        id: 'journal-heatmap',
        name: 'Journal Heatmap',
        author: 'open-habits',
        version: '0.9.3',
        description: 'Turns the Request Journal into a color-coded timeline.',
        surfaces: ['journal'],
        install_count: 248,
        last_updated: '2026-03-28',
        license: 'GPL-3.0',
        repo_url: 'https://github.com/fennec-browser/mod-journal-heatmap',
      },
    ];
  }
}

export async function installRegistryMod(entry: RegistryModSummary): Promise<InstalledMod> {
  const url = `${getRegistryBaseUrl()}/mod/${entry.id}.fennecmod`;
  const response = await fetch(url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  logFennecInternalRequest(url, response.status, bytes.length);
  return installModArchive(bytes, 'registry', entry);
}

export function manifestToJson(manifest: FennecModManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function journalEntryForModInstall(mod: InstalledMod): JournalEntry {
  return {
    id: Date.now(),
    timestamp: Date.now(),
    url: `fennec://mods/${mod.id}`,
    resource_type: 'mod-install',
    source_url: 'fennec://mods',
    initiator_url: 'fennec://mods',
    source_tag: 'fennec-internal',
    status_code: 200,
    mime_type: 'application/json',
    blocked: false,
    block_reason: '',
    resource_class: 'fennec-internal',
    response_bytes: JSON.stringify(mod).length,
  };
}

export function archiveFromFile(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then(buffer => new Uint8Array(buffer));
}

export function manifestFromArchiveBytes(bytes: Uint8Array): Promise<FennecModManifest> {
  const normalized = new Uint8Array(bytes);
  return unzip(normalized.buffer)
    .then(entries => validateManifestObject(JSON.parse(textFromZipEntry(entries, 'manifest.json')), entries));
}

export function manifestFromJson(json: string): FennecModManifest {
  return validateManifestObject(JSON.parse(json));
}

export function assetsFromArchive(entries: ZipEntryMap): Record<string, string> {
  return Object.fromEntries(
    Object.entries(entries)
      .filter(([path]) => path !== 'manifest.json')
      .map(([path, data]) => [path, bytesToString(data)]),
  );
}

export function createArchiveDownload(name: string, archive: Uint8Array): void {
  const normalized = new Uint8Array(archive);
  const url = URL.createObjectURL(new Blob([normalized], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.fennecmod`;
  link.click();
  URL.revokeObjectURL(url);
}

export function assetBytesFromText(content: string): Uint8Array {
  return stringToBytes(content);
}
