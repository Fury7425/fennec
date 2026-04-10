export type FennecWorkspaceTokenKey =
  | '--fennec-color-workspace-1'
  | '--fennec-color-workspace-2'
  | '--fennec-color-workspace-3'
  | '--fennec-color-workspace-4'
  | '--fennec-color-workspace-5'
  | '--fennec-color-workspace-6'
  | '--fennec-color-workspace-7'
  | '--fennec-color-workspace-8';

export type FennecThemeTokenKey =
  | '--fennec-color-bg-primary'
  | '--fennec-color-bg-secondary'
  | '--fennec-color-bg-sidebar'
  | '--fennec-color-accent'
  | '--fennec-color-text-primary'
  | '--fennec-color-text-secondary'
  | '--fennec-color-tab-active'
  | '--fennec-color-tab-hover'
  | FennecWorkspaceTokenKey
  | '--fennec-sidebar-width-collapsed'
  | '--fennec-sidebar-width-expanded'
  | '--fennec-sidebar-position'
  | '--fennec-tab-height'
  | '--fennec-border-radius'
  | '--fennec-font-ui'
  | '--fennec-blur-intensity'
  | '--fennec-transition-speed';

export interface FennecThemeTokens extends Record<FennecThemeTokenKey, string> {}

export type ThemeControlKind = 'color' | 'size' | 'select' | 'font' | 'motion';

export interface ThemeTokenDefinition {
  key: FennecThemeTokenKey;
  label: string;
  description: string;
  kind: ThemeControlKind;
  min?: number;
  max?: number;
  step?: number;
  unit?: 'px' | 'ms';
  options?: string[];
}

export type SidebarPosition = 'left' | 'right' | 'hidden';
export type SidebarDisplayMode = 'collapsed' | 'expanded';
export type ToolbarPosition = 'top' | 'bottom' | 'hidden';
export type AddressBarPosition = 'top-center' | 'sidebar-top' | 'hidden';
export type JournalPanelPosition = 'sidebar-bottom-drawer' | 'floating-panel' | 'hidden';

export interface FennecLayoutConfig {
  sidebar: {
    position: SidebarPosition;
    displayMode: SidebarDisplayMode;
  };
  toolbar: ToolbarPosition;
  addressBar: AddressBarPosition;
  journalPanel: JournalPanelPosition;
  splitViewDefault: boolean;
}

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  builtIn: boolean;
  layout: FennecLayoutConfig;
  tokenOverrides?: Partial<FennecThemeTokens>;
  createdAt?: string;
}

export interface FennecWorkspace {
  id: number;
  name: string;
  colorToken: FennecWorkspaceTokenKey;
}

export interface FennecTab {
  id: number;
  title: string;
  url: string;
  active: boolean;
  pinned: boolean;
  loading: boolean;
  audible: boolean;
  muted: boolean;
  workspaceId: number;
  favIconUrl?: string;
}

export interface PanelConfig {
  title: string;
  icon: string;
  entry: string;
}

export type ModSurface = 'sidebar' | 'newtab' | 'settings' | 'journal' | 'layout';

export interface ModLayoutBlock {
  presetName: string;
  config: FennecLayoutConfig;
}

export interface FennecModManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  license: string;
  fennec_min_version: string;
  surfaces: ModSurface[];
  css?: string;
  js?: string;
  panel?: PanelConfig;
  tokens?: Partial<FennecThemeTokens>;
  layout?: ModLayoutBlock;
}

export interface InstalledMod extends FennecModManifest {
  enabled: boolean;
  installedAt: string;
  source: 'local' | 'registry' | 'preset-export';
  repoUrl?: string;
  installCount?: number;
  lastUpdated?: string;
  assets: Record<string, string>;
}

export interface RegistryModSummary {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  surfaces: ModSurface[];
  install_count: number;
  last_updated: string;
  license: string;
  repo_url: string;
}

export interface SettingsSnapshot {
  blockThirdPartyCookies: boolean;
  httpsOnly: boolean;
  webrtcProtection: boolean;
  noPasswordManager: boolean;
  enableUpdates: boolean;
  enableFilterRefresh: boolean;
  enableModsRegistry: boolean;
  enableCwsProxy: boolean;
  theme: 'system' | 'light' | 'dark';
  accentColor: string;
}

export interface JournalEntry {
  id: number;
  timestamp: number;
  url: string;
  resource_type: string;
  source_url: string;
  initiator_url: string;
  source_tag: string;
  status_code: number;
  mime_type: string;
  blocked: boolean;
  block_reason: string;
  resource_class: 'first-party' | 'third-party' | 'tracker' | 'ad' | 'telemetry' | 'fingerprint' | 'fennec-internal' | 'blocked';
  response_bytes: number;
}

export interface ThemeFontOption {
  label: string;
  value: string;
}
