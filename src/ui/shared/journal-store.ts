import type { JournalEntry } from './models';

const JOURNAL_STORAGE_KEY = 'fennec.journal.entries';
const JOURNAL_MESSAGE = 'fennec-journal-sync';
const MAX_ENTRIES = 5000;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return null;
  }
  return new BroadcastChannel('fennec-journal');
}

function nextEntryId(entries: JournalEntry[]): number {
  return entries.length === 0 ? 1 : Math.max(...entries.map(entry => entry.id)) + 1;
}

export function getDefaultJournalEntries(): JournalEntry[] {
  return [
    {
      id: 1,
      timestamp: Date.now() - 5000,
      url: 'https://example.com/',
      resource_type: 'document',
      source_url: '',
      initiator_url: '',
      source_tag: 'page',
      status_code: 200,
      mime_type: 'text/html',
      blocked: false,
      block_reason: '',
      resource_class: 'first-party',
      response_bytes: 18240,
    },
    {
      id: 2,
      timestamp: Date.now() - 4000,
      url: 'https://doubleclick.net/pixel',
      resource_type: 'image',
      source_url: 'https://example.com/',
      initiator_url: 'https://example.com/',
      source_tag: 'page',
      status_code: 0,
      mime_type: '',
      blocked: true,
      block_reason: 'EasyList blocked advertising pixel.',
      resource_class: 'ad',
      response_bytes: -1,
    },
    {
      id: 3,
      timestamp: Date.now() - 3000,
      url: 'https://mods.fennec.computer/api/index.json',
      resource_type: 'fetch',
      source_url: '',
      initiator_url: '',
      source_tag: 'fennec-internal',
      status_code: 200,
      mime_type: 'application/json',
      blocked: false,
      block_reason: '',
      resource_class: 'fennec-internal',
      response_bytes: 2194,
    },
  ];
}

export function loadLocalJournalEntries(): JournalEntry[] {
  const stored = window.localStorage.getItem(JOURNAL_STORAGE_KEY);
  if (!stored) {
    const defaults = getDefaultJournalEntries();
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }

  try {
    return JSON.parse(stored) as JournalEntry[];
  } catch {
    return getDefaultJournalEntries();
  }
}

function persistEntries(entries: JournalEntry[]): JournalEntry[] {
  const trimmed = entries.slice(0, MAX_ENTRIES);
  window.localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(trimmed));
  const payload = { type: JOURNAL_MESSAGE, entries: trimmed };
  window.postMessage(payload, '*');
  const channel = getBroadcastChannel();
  channel?.postMessage(payload);
  channel?.close();
  return trimmed;
}

export function appendLocalJournalEntry(entry: Omit<JournalEntry, 'id' | 'timestamp'> & Partial<Pick<JournalEntry, 'id' | 'timestamp'>>): JournalEntry {
  const entries = loadLocalJournalEntries();
  const resolved: JournalEntry = {
    ...entry,
    id: entry.id ?? nextEntryId(entries),
    timestamp: entry.timestamp ?? Date.now(),
  };
  persistEntries([resolved, ...entries]);
  return resolved;
}

export function clearLocalJournalEntries(): void {
  persistEntries([]);
}

export function subscribeLocalJournal(onChange: (entries: JournalEntry[]) => void): () => void {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type !== JOURNAL_MESSAGE || !event.data.entries) {
      return;
    }
    onChange(event.data.entries as JournalEntry[]);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== JOURNAL_STORAGE_KEY || !event.newValue) {
      return;
    }
    try {
      onChange(JSON.parse(event.newValue) as JournalEntry[]);
    } catch {
      onChange(getDefaultJournalEntries());
    }
  };

  window.addEventListener('message', handleMessage);
  window.addEventListener('storage', handleStorage);

  const channel = getBroadcastChannel();
  if (channel) {
    channel.onmessage = event => {
      if (event.data?.type === JOURNAL_MESSAGE && event.data.entries) {
        onChange(event.data.entries as JournalEntry[]);
      }
    };
  }

  return () => {
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
    channel?.close();
  };
}

export function logFennecInternalRequest(url: string, statusCode: number, responseBytes = 0): JournalEntry {
  return appendLocalJournalEntry({
    url,
    resource_type: 'fetch',
    source_url: '',
    initiator_url: '',
    source_tag: 'fennec-internal',
    status_code: statusCode,
    mime_type: 'application/json',
    blocked: false,
    block_reason: '',
    resource_class: 'fennec-internal',
    response_bytes: responseBytes,
  });
}

export function logModViolation(modId: string, attemptedApi: string): JournalEntry {
  return appendLocalJournalEntry({
    url: `fennec://mods/${modId}`,
    resource_type: 'mod-violation',
    source_url: 'fennec://settings',
    initiator_url: 'fennec://settings',
    source_tag: 'fennec-internal',
    status_code: 0,
    mime_type: 'text/plain',
    blocked: true,
    block_reason: `${modId} attempted ${attemptedApi}`,
    resource_class: 'fennec-internal',
    response_bytes: -1,
  });
}
