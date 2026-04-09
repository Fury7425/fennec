// Types for the Fennec settings page.
// SettingsSnapshot mirrors the C++ PrefService keys persisted on disk.

export interface SettingsSnapshot {
  // Privacy
  blockThirdPartyCookies: boolean;
  httpsOnly:              boolean;
  webrtcProtection:       boolean;
  noPasswordManager:      boolean;
  // Services
  enableUpdates:          boolean;
  enableFilterRefresh:    boolean;
  enableModsRegistry:     boolean;
  enableCwsProxy:         boolean;
  // Appearance
  theme:                  'system' | 'light' | 'dark';
  accentColor:            string;
}

export type SettingsSection =
  | 'privacy'
  | 'services'
  | 'appearance'
  | 'about';
