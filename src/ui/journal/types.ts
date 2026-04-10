export type { JournalEntry } from '../shared/models';

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
