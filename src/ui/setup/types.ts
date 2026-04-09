export type SetupStep = 'welcome' | 'privacy' | 'services' | 'appearance' | 'done';

export interface SetupState {
  step: SetupStep;
  privacy: {
    blockThirdPartyCookies: boolean;
    httpsOnly: boolean;
    webrtcProtection: boolean;
    noPasswordManager: boolean;
  };
  services: {
    enableSync: boolean;
    syncServerUrl: string;
    enableUpdates: boolean;
  };
  appearance: {
    theme: 'system' | 'light' | 'dark';
    accentColor: string;
  };
}

// Bridge to C++ SetupPageHandler via Mojo
declare global {
  interface Window {
    __fennec: {
      setup: {
        commit: (state: SetupState) => void;
        getVersion: () => string;
      };
    };
  }
}
