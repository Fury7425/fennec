// Types that mirror the C++ JournalEntry struct and ResourceClass enum.
// Serialised to JSON by journal_mojo_handler.cc and consumed here.

export type ResourceClass =
  | 'first-party'
  | 'third-party'
  | 'tracker'
  | 'ad'
  | 'telemetry'
  | 'fingerprint'
  | 'fennec-internal'
  | 'blocked';

export type FilterTab = 'all' | 'blocked' | 'trackers' | 'fennec-internal';

export interface JournalEntry {
  id: number;
  /** JS timestamp (milliseconds since epoch) */
  timestamp: number;
  url: string;
  resource_type: string;
  source_url: string;
  initiator_url: string;
  /** "page" | "fennec-internal" | "ublock" */
  source_tag: string;
  status_code: number;
  mime_type: string;
  blocked: boolean;
  block_reason: string;
  resource_class: ResourceClass;
  response_bytes: number;
}

// ── Mojo bridge (injected by journal_mojo_handler.cc) ────────────────────
declare global {
  interface Window {
    __fennec?: {
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
}
