import type { SettingsSnapshot } from './models';

const SETTINGS_STORAGE_KEY = 'fennec.settings.snapshot';
const SETTINGS_MESSAGE = 'fennec-settings-sync';

export const DEFAULT_SETTINGS_SNAPSHOT: SettingsSnapshot = {
  blockThirdPartyCookies: true,
  httpsOnly: true,
  webrtcProtection: true,
  noPasswordManager: true,
  enableUpdates: false,
  enableFilterRefresh: false,
  enableModsRegistry: false,
  enableCwsProxy: false,
  theme: 'system',
  accentColor: '#e8824a',
};

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return null;
  }
  return new BroadcastChannel('fennec-settings');
}

function sanitizeSnapshot(raw?: Partial<SettingsSnapshot> | null): SettingsSnapshot {
  return {
    ...DEFAULT_SETTINGS_SNAPSHOT,
    ...raw,
    theme: raw?.theme === 'light' || raw?.theme === 'dark' ? raw.theme : 'system',
    accentColor: typeof raw?.accentColor === 'string' ? raw.accentColor : DEFAULT_SETTINGS_SNAPSHOT.accentColor,
  };
}

export function loadSettingsSnapshot(): SettingsSnapshot {
  const rawBridge = window.__fennec?.settings?.getAll?.();
  if (rawBridge) {
    try {
      return sanitizeSnapshot(JSON.parse(rawBridge) as Partial<SettingsSnapshot>);
    } catch {
      return DEFAULT_SETTINGS_SNAPSHOT;
    }
  }

  const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!stored) {
    return DEFAULT_SETTINGS_SNAPSHOT;
  }

  try {
    return sanitizeSnapshot(JSON.parse(stored) as Partial<SettingsSnapshot>);
  } catch {
    return DEFAULT_SETTINGS_SNAPSHOT;
  }
}

export function saveSettingsSnapshot(snapshot: SettingsSnapshot): SettingsSnapshot {
  const sanitized = sanitizeSnapshot(snapshot);
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitized));

  for (const [key, value] of Object.entries(sanitized)) {
    window.__fennec?.settings?.set(key, value);
  }

  const payload = { type: SETTINGS_MESSAGE, snapshot: sanitized };
  window.postMessage(payload, '*');
  const channel = getBroadcastChannel();
  channel?.postMessage(payload);
  channel?.close();

  return sanitized;
}

export function updateSettingsSnapshot<K extends keyof SettingsSnapshot>(
  key: K,
  value: SettingsSnapshot[K],
): SettingsSnapshot {
  const next = { ...loadSettingsSnapshot(), [key]: value };
  return saveSettingsSnapshot(next);
}

export function subscribeToSettingsSnapshot(onChange: (snapshot: SettingsSnapshot) => void): () => void {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === SETTINGS_MESSAGE && event.data.snapshot) {
      onChange(sanitizeSnapshot(event.data.snapshot as Partial<SettingsSnapshot>));
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SETTINGS_STORAGE_KEY || !event.newValue) {
      return;
    }
    try {
      onChange(sanitizeSnapshot(JSON.parse(event.newValue) as Partial<SettingsSnapshot>));
    } catch {
      onChange(DEFAULT_SETTINGS_SNAPSHOT);
    }
  };

  window.addEventListener('message', handleMessage);
  window.addEventListener('storage', handleStorage);

  const channel = getBroadcastChannel();
  if (channel) {
    channel.onmessage = event => {
      if (event.data?.type === SETTINGS_MESSAGE && event.data.snapshot) {
        onChange(sanitizeSnapshot(event.data.snapshot as Partial<SettingsSnapshot>));
      }
    };
  }

  return () => {
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
    channel?.close();
  };
}
