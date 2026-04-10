import type { FennecUiApi } from '../fennec-ui-api';

export {};

declare global {
  interface Window {
    __fennec?: {
      setup?: {
        commit: (state: {
          step: string;
          services: {
            enableUpdates: boolean;
            enableFilterRefresh: boolean;
            enableModsRegistry: boolean;
            enableCwsProxy: boolean;
          };
          privacy?: {
            blockThirdPartyCookies: boolean;
            httpsOnly: boolean;
            webrtcProtection: boolean;
            noPasswordManager: boolean;
          };
          appearance?: {
            theme: string;
            accentColor: string;
          };
        }) => void;
        getVersion: () => string;
      };

      journal?: {
        getEntries: (n: number) => string;
        exportJson: (days: number) => void;
        clear: () => void;
        subscribe: (callback: (entryJson: string) => void) => number;
        unsubscribe: (id: number) => void;
      };

      newtab?: {
        getPrivacyStats: () => string;
        focusOmnibox: () => void;
      };

      sidebar?: {
        getTabs: () => string;
        getWorkspaces: () => string;
        activateTab: (tabId: number) => void;
        closeTab: (tabId: number) => void;
        newTab: (workspaceId?: number) => void;
        setPinned: (tabId: number, pinned: boolean) => void;
        moveTab: (tabId: number, toWorkspaceId: number) => void;
        subscribe: (callback: (eventJson: string) => void) => number;
        unsubscribe: (id: number) => void;
      };

      settings?: {
        getAll: () => string;
        set: (key: string, value: string | boolean | number) => void;
        getVersion: () => string;
        getThemeTokens?: () => string;
        setThemeTokens?: (json: string) => void;
        getLayoutConfig?: () => string;
        setLayoutConfig?: (json: string) => void;
      };

      mods?: {
        getInstalled?: () => string;
        setInstalled?: (json: string) => void;
        installArchive?: (archiveBase64: string) => void;
        uninstall?: (modId: string) => void;
        setEnabled?: (modId: string, enabled: boolean) => void;
      };

      ui?: FennecUiApi;
    };
  }
}
