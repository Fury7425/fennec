// Three-screen onboarding flow per spec:
//   Screen 1 — Welcome (branding, tagline, two pillars)
//   Screen 2 — Services (4 opt-in network service toggles)
//   Screen 3 — Done (summary, "Start browsing")
export type SetupStep = 'welcome' | 'services' | 'done';

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

  // ── Privacy (defaults applied without a UI step in the 3-screen flow) ──
  // Kept here so PrivacyStep.tsx remains type-safe if re-added later.
  privacy?: {
    blockThirdPartyCookies: boolean;
    httpsOnly:              boolean;
    webrtcProtection:       boolean;
    noPasswordManager:      boolean;
  };

  // ── Appearance (not shown in current 3-screen flow) ──────────────────────
  // Kept here so AppearanceStep.tsx remains type-safe if re-added later.
  appearance?: {
    theme:       'system' | 'light' | 'dark';
    accentColor: string;
  };
}
