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
  };
}
