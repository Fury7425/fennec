// Types that mirror the C++ JournalEntry struct and ResourceClass enum.
// Serialised to JSON by journal_mojo_handler.cc and consumed here.
// The window.__fennec global bridge type is declared in
// src/ui/shared/fennec-global.d.ts (shared across all WebUI pages).

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
