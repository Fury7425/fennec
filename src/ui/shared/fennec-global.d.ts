// Ambient extension of the Window interface for all Fennec WebUI pages.
// This file has no imports/exports — it is treated as a global script by
// TypeScript, so interface augmentations here apply to the entire project.

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Window {
  __fennec?: {
    setup?: {
      /** Commits onboarding choices and releases the consent guard. */
      commit: (state: {
        step: string;
        services: {
          enableUpdates:       boolean;
          enableFilterRefresh: boolean;
          enableModsRegistry:  boolean;
          enableCwsProxy:      boolean;
        };
        privacy?: {
          blockThirdPartyCookies: boolean;
          httpsOnly:              boolean;
          webrtcProtection:       boolean;
          noPasswordManager:      boolean;
        };
        appearance?: {
          theme:       string;
          accentColor: string;
        };
      }) => void;
      /** Returns the current Fennec version string, e.g. "1.0.0". */
      getVersion: () => string;
    };

    journal?: {
      /** Returns the most recent |n| entries as a JSON string. */
      getEntries: (n: number) => string;
      /** Exports last |days| days as a JSON file download. */
      exportJson: (days: number) => void;
      /** Clears the journal database. */
      clear: () => void;
      /** Subscribe to new-entry events; callback receives JSON string. */
      subscribe: (callback: (entryJson: string) => void) => number;
      /** Unsubscribe by id. */
      unsubscribe: (id: number) => void;
    };

    newtab?: {
      /** Returns privacy stats as JSON: { blockersToday, requestsToday }. */
      getPrivacyStats: () => string;
      /** Focuses the browser omnibox so the user can type a URL/search. */
      focusOmnibox: () => void;
    };

    sidebar?: {
      /** Returns all open tabs as a JSON array of SidebarTab objects. */
      getTabs: () => string;
      /** Returns all workspaces as a JSON array of Workspace objects. */
      getWorkspaces: () => string;
      /** Activates (switches to) the tab with the given id. */
      activateTab: (tabId: number) => void;
      /** Closes the tab with the given id. */
      closeTab: (tabId: number) => void;
      /** Opens a new tab, optionally in a specific workspace. */
      newTab: (workspaceId?: number) => void;
      /** Pins or unpins a tab. */
      setPinned: (tabId: number, pinned: boolean) => void;
      /** Moves a tab to a different workspace. */
      moveTab: (tabId: number, toWorkspaceId: number) => void;
      /** Subscribes to tab/workspace change events; returns subscription id. */
      subscribe: (callback: (eventJson: string) => void) => number;
      /** Unsubscribes by id. */
      unsubscribe: (id: number) => void;
    };

    settings?: {
      /** Returns all current settings as a JSON SettingsSnapshot. */
      getAll: () => string;
      /** Updates a single setting by key. */
      set: (key: string, value: string | boolean | number) => void;
      /** Returns the current Fennec version string, e.g. "1.0.0". */
      getVersion: () => string;
    };
  };
}
