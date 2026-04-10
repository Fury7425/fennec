import type {
  FennecThemeTokenKey,
  FennecThemeTokens,
  ThemeFontOption,
  ThemeTokenDefinition,
} from './models';

const THEME_STORAGE_KEY = 'fennec.theme.tokens';
const THEME_MESSAGE = 'fennec-theme-sync';

export const FONT_OPTIONS: ThemeFontOption[] = [
  { label: 'System UI', value: 'system-ui' },
  { label: 'Segoe UI', value: '"Segoe UI", system-ui' },
  { label: 'SF Pro', value: '"SF Pro Text", system-ui' },
  { label: 'Inter', value: '"Inter", system-ui' },
  { label: 'IBM Plex Sans', value: '"IBM Plex Sans", system-ui' },
  { label: 'Atkinson Hyperlegible', value: '"Atkinson Hyperlegible", system-ui' },
];

export const THEME_DEFAULTS: FennecThemeTokens = {
  '--fennec-color-bg-primary': '#f3ede4',
  '--fennec-color-bg-secondary': '#fbf7f2',
  '--fennec-color-bg-sidebar': '#ede3d6',
  '--fennec-color-accent': '#e8824a',
  '--fennec-color-text-primary': '#241a12',
  '--fennec-color-text-secondary': '#6c5a4c',
  '--fennec-color-tab-active': '#fff8f1',
  '--fennec-color-tab-hover': '#f3e4d3',
  '--fennec-color-workspace-1': '#d26c41',
  '--fennec-color-workspace-2': '#d79243',
  '--fennec-color-workspace-3': '#8c9b43',
  '--fennec-color-workspace-4': '#4c9b7c',
  '--fennec-color-workspace-5': '#4a82bb',
  '--fennec-color-workspace-6': '#735cc0',
  '--fennec-color-workspace-7': '#b65f94',
  '--fennec-color-workspace-8': '#7b6d63',
  '--fennec-sidebar-width-collapsed': '52px',
  '--fennec-sidebar-width-expanded': '220px',
  '--fennec-sidebar-position': 'left',
  '--fennec-tab-height': '36px',
  '--fennec-border-radius': '8px',
  '--fennec-font-ui': 'system-ui',
  '--fennec-blur-intensity': '0px',
  '--fennec-transition-speed': '150ms',
};

export const THEME_TOKEN_DEFINITIONS: ThemeTokenDefinition[] = [
  { key: '--fennec-color-bg-primary', label: 'Background', description: 'Base canvas behind every shell surface.', kind: 'color' },
  { key: '--fennec-color-bg-secondary', label: 'Raised background', description: 'Cards, overlays, and raised content surfaces.', kind: 'color' },
  { key: '--fennec-color-bg-sidebar', label: 'Sidebar background', description: 'Vertical tab strip and chrome rail surface.', kind: 'color' },
  { key: '--fennec-color-accent', label: 'Accent', description: 'Active states, buttons, and highlights.', kind: 'color' },
  { key: '--fennec-color-text-primary', label: 'Primary text', description: 'Headings, active labels, and key metadata.', kind: 'color' },
  { key: '--fennec-color-text-secondary', label: 'Secondary text', description: 'Muted labels, hints, and supporting copy.', kind: 'color' },
  { key: '--fennec-color-tab-active', label: 'Active tab', description: 'Selected tab row and focused preview card.', kind: 'color' },
  { key: '--fennec-color-tab-hover', label: 'Tab hover', description: 'Hover state for tabs and list rows.', kind: 'color' },
  { key: '--fennec-color-workspace-1', label: 'Workspace 1', description: 'Workspace preset color slot 1.', kind: 'color' },
  { key: '--fennec-color-workspace-2', label: 'Workspace 2', description: 'Workspace preset color slot 2.', kind: 'color' },
  { key: '--fennec-color-workspace-3', label: 'Workspace 3', description: 'Workspace preset color slot 3.', kind: 'color' },
  { key: '--fennec-color-workspace-4', label: 'Workspace 4', description: 'Workspace preset color slot 4.', kind: 'color' },
  { key: '--fennec-color-workspace-5', label: 'Workspace 5', description: 'Workspace preset color slot 5.', kind: 'color' },
  { key: '--fennec-color-workspace-6', label: 'Workspace 6', description: 'Workspace preset color slot 6.', kind: 'color' },
  { key: '--fennec-color-workspace-7', label: 'Workspace 7', description: 'Workspace preset color slot 7.', kind: 'color' },
  { key: '--fennec-color-workspace-8', label: 'Workspace 8', description: 'Workspace preset color slot 8.', kind: 'color' },
  { key: '--fennec-sidebar-width-collapsed', label: 'Sidebar width, collapsed', description: 'Icon rail width when the sidebar is compact.', kind: 'size', min: 44, max: 96, step: 1, unit: 'px' },
  { key: '--fennec-sidebar-width-expanded', label: 'Sidebar width, expanded', description: 'Default width when the sidebar is open.', kind: 'size', min: 180, max: 320, step: 2, unit: 'px' },
  { key: '--fennec-sidebar-position', label: 'Sidebar side', description: 'Which side of the window the sidebar occupies.', kind: 'select', options: ['left', 'right'] },
  { key: '--fennec-tab-height', label: 'Tab height', description: 'Row height for tabs, journal rows, and list items.', kind: 'size', min: 28, max: 56, step: 1, unit: 'px' },
  { key: '--fennec-border-radius', label: 'Corner radius', description: 'Default shell curvature applied across cards and pills.', kind: 'size', min: 0, max: 28, step: 1, unit: 'px' },
  { key: '--fennec-font-ui', label: 'UI font', description: 'Font family used for the Fennec shell.', kind: 'font' },
  { key: '--fennec-blur-intensity', label: 'Sidebar blur', description: 'Backdrop blur amount behind the sidebar.', kind: 'size', min: 0, max: 32, step: 1, unit: 'px' },
  { key: '--fennec-transition-speed', label: 'Transition speed', description: 'Default motion timing for shell interactions.', kind: 'motion', min: 0, max: 500, step: 10, unit: 'ms' },
];

function cloneTokens(tokens: FennecThemeTokens): FennecThemeTokens {
  return { ...tokens };
}

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return null;
  }
  return new BroadcastChannel('fennec-theme');
}

export function getThemeDefinitions(): ThemeTokenDefinition[] {
  return THEME_TOKEN_DEFINITIONS;
}

export function getDefaultThemeTokens(): FennecThemeTokens {
  return cloneTokens(THEME_DEFAULTS);
}

function isColorValue(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function normalizeUnitValue(value: string, unit: 'px' | 'ms'): string | null {
  const trimmed = value.trim().toLowerCase();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return `${trimmed}${unit}`;
  }
  if (trimmed.endsWith(unit) && /^\d+(\.\d+)?(px|ms)$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function sanitizeThemeTokenValue(key: FennecThemeTokenKey, value: string): string {
  const definition = THEME_TOKEN_DEFINITIONS.find(candidate => candidate.key === key);
  if (!definition) {
    return value;
  }

  if (definition.kind === 'color') {
    return isColorValue(value) ? value.trim() : THEME_DEFAULTS[key];
  }

  if (definition.kind === 'size' || definition.kind === 'motion') {
    const normalized = normalizeUnitValue(value, definition.unit ?? 'px');
    if (!normalized) {
      return THEME_DEFAULTS[key];
    }
    const numericValue = Number.parseFloat(normalized);
    const min = definition.min ?? numericValue;
    const max = definition.max ?? numericValue;
    const clamped = Math.min(max, Math.max(min, numericValue));
    return `${clamped}${definition.unit ?? 'px'}`;
  }

  if (definition.kind === 'select') {
    return definition.options?.includes(value) ? value : THEME_DEFAULTS[key];
  }

  return value.trim() || THEME_DEFAULTS[key];
}

export function sanitizeThemeTokens(tokens: Partial<FennecThemeTokens>): FennecThemeTokens {
  const merged = { ...THEME_DEFAULTS, ...tokens } as FennecThemeTokens;
  const sanitized = {} as FennecThemeTokens;

  for (const definition of THEME_TOKEN_DEFINITIONS) {
    sanitized[definition.key] = sanitizeThemeTokenValue(definition.key, merged[definition.key]);
  }

  return sanitized;
}

function themePreferenceKey(key: FennecThemeTokenKey): string {
  return `fennec.theme.${key.replace(/^--fennec-/, '').replaceAll('-', '_')}`;
}

export function applyThemeTokens(tokens: FennecThemeTokens, target: HTMLElement | Document = document): void {
  const root = target instanceof Document ? target.documentElement : target;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, String(value));
  }
  root.dataset.sidebarPosition = tokens['--fennec-sidebar-position'];
}

function readBridgeThemeTokens(): Partial<FennecThemeTokens> | null {
  const raw = window.__fennec?.settings?.getThemeTokens?.();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Partial<FennecThemeTokens>;
  } catch {
    return null;
  }
}

export function loadThemeTokens(): FennecThemeTokens {
  const bridgeTokens = readBridgeThemeTokens();
  if (bridgeTokens) {
    return sanitizeThemeTokens(bridgeTokens);
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (!stored) {
    return getDefaultThemeTokens();
  }

  try {
    return sanitizeThemeTokens(JSON.parse(stored) as Partial<FennecThemeTokens>);
  } catch {
    return getDefaultThemeTokens();
  }
}

function writeThemeTokensToBridge(tokens: FennecThemeTokens): void {
  if (window.__fennec?.settings?.setThemeTokens) {
    window.__fennec.settings.setThemeTokens(JSON.stringify(tokens));
    return;
  }

  for (const [key, value] of Object.entries(tokens)) {
    window.__fennec?.settings?.set(themePreferenceKey(key as FennecThemeTokenKey), String(value));
  }
}

function postThemeMessage(tokens: FennecThemeTokens): void {
  const payload = { type: THEME_MESSAGE, tokens };
  window.postMessage(payload, '*');
}

export function saveThemeTokens(tokens: FennecThemeTokens): FennecThemeTokens {
  const sanitized = sanitizeThemeTokens(tokens);
  window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(sanitized));
  writeThemeTokensToBridge(sanitized);
  applyThemeTokens(sanitized);
  postThemeMessage(sanitized);

  const channel = getBroadcastChannel();
  channel?.postMessage({ type: THEME_MESSAGE, tokens: sanitized });
  channel?.close();

  return sanitized;
}

export function resetThemeToken(key: FennecThemeTokenKey): FennecThemeTokens {
  const current = loadThemeTokens();
  current[key] = THEME_DEFAULTS[key];
  return saveThemeTokens(current);
}

export function resetAllThemeTokens(): FennecThemeTokens {
  return saveThemeTokens(getDefaultThemeTokens());
}

export function subscribeToThemeTokens(onChange: (tokens: FennecThemeTokens) => void): () => void {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type !== THEME_MESSAGE || !event.data.tokens) {
      return;
    }
    const tokens = sanitizeThemeTokens(event.data.tokens as Partial<FennecThemeTokens>);
    applyThemeTokens(tokens);
    onChange(tokens);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY || !event.newValue) {
      return;
    }
    try {
      const tokens = sanitizeThemeTokens(JSON.parse(event.newValue) as Partial<FennecThemeTokens>);
      applyThemeTokens(tokens);
      onChange(tokens);
    } catch {
      onChange(getDefaultThemeTokens());
    }
  };

  window.addEventListener('message', handleMessage);
  window.addEventListener('storage', handleStorage);

  const channel = getBroadcastChannel();
  if (channel) {
    channel.onmessage = event => {
      if (event.data?.type !== THEME_MESSAGE || !event.data.tokens) {
        return;
      }
      const tokens = sanitizeThemeTokens(event.data.tokens as Partial<FennecThemeTokens>);
      applyThemeTokens(tokens);
      onChange(tokens);
    };
  }

  return () => {
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
    channel?.close();
  };
}

export function initializeThemeTokens(): FennecThemeTokens {
  const tokens = loadThemeTokens();
  applyThemeTokens(tokens);
  return tokens;
}
