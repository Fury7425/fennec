import type { FennecLayoutConfig, LayoutPreset } from './models';
import { loadThemeTokens, saveThemeTokens } from './theme';

const LAYOUT_STORAGE_KEY = 'fennec.layout.config';
const PRESET_STORAGE_KEY = 'fennec.layout.presets';
const LAYOUT_MESSAGE = 'fennec-layout-sync';

export const DEFAULT_LAYOUT: FennecLayoutConfig = {
  sidebar: {
    position: 'left',
    displayMode: 'expanded',
  },
  toolbar: 'top',
  addressBar: 'top-center',
  journalPanel: 'sidebar-bottom-drawer',
  splitViewDefault: false,
};

export const BUILT_IN_LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'default-fennec',
    name: 'Default Fennec',
    description: 'Sidebar left, toolbar top, address bar centered, journal drawer.',
    builtIn: true,
    layout: DEFAULT_LAYOUT,
  },
  {
    id: 'focus-mode',
    name: 'Focus mode',
    description: 'Everything hidden for keyboard-first browsing.',
    builtIn: true,
    layout: {
      sidebar: { position: 'hidden', displayMode: 'collapsed' },
      toolbar: 'hidden',
      addressBar: 'hidden',
      journalPanel: 'hidden',
      splitViewDefault: false,
    },
  },
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Expanded sidebar with a floating journal panel and split view ready.',
    builtIn: true,
    layout: {
      sidebar: { position: 'left', displayMode: 'expanded' },
      toolbar: 'top',
      addressBar: 'top-center',
      journalPanel: 'floating-panel',
      splitViewDefault: true,
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Icons-only sidebar, no toolbar, and the address bar docked inside the sidebar.',
    builtIn: true,
    layout: {
      sidebar: { position: 'left', displayMode: 'collapsed' },
      toolbar: 'hidden',
      addressBar: 'sidebar-top',
      journalPanel: 'hidden',
      splitViewDefault: false,
    },
  },
];

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return null;
  }
  return new BroadcastChannel('fennec-layout');
}

function sanitizeLayoutConfig(raw?: Partial<FennecLayoutConfig> | null): FennecLayoutConfig {
  return {
    sidebar: {
      position: raw?.sidebar?.position === 'right' || raw?.sidebar?.position === 'hidden'
        ? raw.sidebar.position
        : 'left',
      displayMode: raw?.sidebar?.displayMode === 'collapsed'
        ? 'collapsed'
        : 'expanded',
    },
    toolbar: raw?.toolbar === 'bottom' || raw?.toolbar === 'hidden'
      ? raw.toolbar
      : 'top',
    addressBar: raw?.addressBar === 'sidebar-top' || raw?.addressBar === 'hidden'
      ? raw.addressBar
      : 'top-center',
    journalPanel: raw?.journalPanel === 'floating-panel' || raw?.journalPanel === 'hidden'
      ? raw.journalPanel
      : 'sidebar-bottom-drawer',
    splitViewDefault: Boolean(raw?.splitViewDefault),
  };
}

function readBridgeLayoutConfig(): FennecLayoutConfig | null {
  const raw = window.__fennec?.settings?.getLayoutConfig?.();
  if (!raw) {
    return null;
  }

  try {
    return sanitizeLayoutConfig(JSON.parse(raw) as Partial<FennecLayoutConfig>);
  } catch {
    return null;
  }
}

export function loadLayoutConfig(): FennecLayoutConfig {
  const bridgeLayout = readBridgeLayoutConfig();
  if (bridgeLayout) {
    return bridgeLayout;
  }

  const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
  if (!stored) {
    return DEFAULT_LAYOUT;
  }

  try {
    return sanitizeLayoutConfig(JSON.parse(stored) as Partial<FennecLayoutConfig>);
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function writeLayoutConfigToBridge(layout: FennecLayoutConfig): void {
  if (window.__fennec?.settings?.setLayoutConfig) {
    window.__fennec.settings.setLayoutConfig(JSON.stringify(layout));
    return;
  }

  window.__fennec?.settings?.set('fennec.layout.sidebar.position', layout.sidebar.position);
  window.__fennec?.settings?.set('fennec.layout.sidebar.display_mode', layout.sidebar.displayMode);
  window.__fennec?.settings?.set('fennec.layout.toolbar', layout.toolbar);
  window.__fennec?.settings?.set('fennec.layout.address_bar', layout.addressBar);
  window.__fennec?.settings?.set('fennec.layout.journal_panel', layout.journalPanel);
  window.__fennec?.settings?.set('fennec.layout.split_view_default', layout.splitViewDefault);
}

export function applyLayoutConfig(layout: FennecLayoutConfig, target: HTMLElement | Document = document): void {
  const root = target instanceof Document ? target.documentElement : target;
  root.dataset.sidebarPosition = layout.sidebar.position === 'hidden' ? 'left' : layout.sidebar.position;
  root.dataset.sidebarVisibility = layout.sidebar.position;
  root.dataset.sidebarDisplayMode = layout.sidebar.displayMode;
  root.dataset.toolbarPosition = layout.toolbar;
  root.dataset.addressBarPosition = layout.addressBar;
  root.dataset.journalPanel = layout.journalPanel;
  root.dataset.splitViewDefault = layout.splitViewDefault ? 'true' : 'false';
}

function syncThemeSidebarPosition(layout: FennecLayoutConfig): void {
  if (layout.sidebar.position === 'hidden') {
    return;
  }
  const tokens = loadThemeTokens();
  tokens['--fennec-sidebar-position'] = layout.sidebar.position;
  saveThemeTokens(tokens);
}

export function saveLayoutConfig(layout: FennecLayoutConfig): FennecLayoutConfig {
  const sanitized = sanitizeLayoutConfig(layout);
  window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(sanitized));
  writeLayoutConfigToBridge(sanitized);
  applyLayoutConfig(sanitized);
  syncThemeSidebarPosition(sanitized);

  const payload = { type: LAYOUT_MESSAGE, layout: sanitized };
  window.postMessage(payload, '*');
  const channel = getBroadcastChannel();
  channel?.postMessage(payload);
  channel?.close();

  return sanitized;
}

export function subscribeToLayoutConfig(onChange: (layout: FennecLayoutConfig) => void): () => void {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type !== LAYOUT_MESSAGE || !event.data.layout) {
      return;
    }
    const layout = sanitizeLayoutConfig(event.data.layout as Partial<FennecLayoutConfig>);
    applyLayoutConfig(layout);
    onChange(layout);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== LAYOUT_STORAGE_KEY || !event.newValue) {
      return;
    }
    try {
      const layout = sanitizeLayoutConfig(JSON.parse(event.newValue) as Partial<FennecLayoutConfig>);
      applyLayoutConfig(layout);
      onChange(layout);
    } catch {
      onChange(DEFAULT_LAYOUT);
    }
  };

  window.addEventListener('message', handleMessage);
  window.addEventListener('storage', handleStorage);

  const channel = getBroadcastChannel();
  if (channel) {
    channel.onmessage = event => {
      if (event.data?.type !== LAYOUT_MESSAGE || !event.data.layout) {
        return;
      }
      const layout = sanitizeLayoutConfig(event.data.layout as Partial<FennecLayoutConfig>);
      applyLayoutConfig(layout);
      onChange(layout);
    };
  }

  return () => {
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
    channel?.close();
  };
}

export function loadLayoutPresets(): LayoutPreset[] {
  const stored = window.localStorage.getItem(PRESET_STORAGE_KEY);
  if (!stored) {
    return BUILT_IN_LAYOUT_PRESETS;
  }

  try {
    const customPresets = JSON.parse(stored) as LayoutPreset[];
    return [...BUILT_IN_LAYOUT_PRESETS, ...customPresets];
  } catch {
    return BUILT_IN_LAYOUT_PRESETS;
  }
}

export function saveCustomLayoutPreset(name: string, layout: FennecLayoutConfig): LayoutPreset {
  const customPresets = loadLayoutPresets().filter(preset => !preset.builtIn);
  const preset: LayoutPreset = {
    id: `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
    name,
    description: 'Saved from the live layout editor.',
    builtIn: false,
    layout: sanitizeLayoutConfig(layout),
    createdAt: new Date().toISOString(),
  };

  customPresets.push(preset);
  window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(customPresets));
  return preset;
}

export function initializeLayoutConfig(): FennecLayoutConfig {
  const layout = loadLayoutConfig();
  applyLayoutConfig(layout);
  return layout;
}
