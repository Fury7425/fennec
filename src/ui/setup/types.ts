// Three-screen onboarding flow per spec:
//   Screen 1 — Welcome (branding, tagline, two pillars)
//   Screen 2 — Services (4 opt-in network service toggles)
//   Screen 3 — Done (summary, "Start browsing")
export type SetupStep = 'welcome' | 'services' | 'done';

export interface ServiceToggle {
  // Whether the user has opted in.
  enabled: boolean;
}

export interface SetupState {
  step: SetupStep;

  // ── Services ─────────────────────────────────────────────────────────────
  // Each field controls one Fennec service that makes network calls.
  // All are opt-in (default false) so zero requests happen before consent.
  services: {
    /** Automatic browser updates via updates.fennec.computer */
    enableUpdates: boolean;

    /** uBlock Origin filter list auto-refresh via CDN URLs */
    enableFilterRefresh: boolean;

    /** Mods registry browse/install via mods.fennec.computer */
    enableModsRegistry: boolean;

    /** Anonymised Chrome Web Store proxy via fennec-services */
    enableCwsProxy: boolean;
  };
}

// Bridge to C++ SetupPageHandler via Mojo.
// Injected as window.__fennec.setup by the WebUI data source.
declare global {
  interface Window {
    __fennec?: {
      setup?: {
        /** Commits the user's choices and releases the consent guard. */
        commit: (state: SetupState) => void;
        /** Returns the current Fennec version string, e.g. "1.0.0". */
        getVersion: () => string;
      };
      journal?: {
        getEntries:  (n: number) => string;
        exportJson:  (days: number) => void;
        clear:       () => void;
        subscribe:   (cb: (json: string) => void) => number;
        unsubscribe: (id: number) => void;
      };
    };
  }
}
