import type { FennecTab, FennecThemeTokens, FennecWorkspace, PanelConfig } from './shared/models';

export interface FennecUiApi {
  registerPanel(config: PanelConfig): void;
  getTokens(): Record<string, string>;
  setToken(key: keyof FennecThemeTokens | string, value: string): void;
  onTabChange(callback: (tab: FennecTab) => void): void;
  onWorkspaceChange(callback: (workspace: FennecWorkspace) => void): void;
}

export {};
