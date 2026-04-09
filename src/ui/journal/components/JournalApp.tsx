import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { FilterTab, JournalEntry } from '../types';
import { FilterBar } from './FilterBar';
import { RequestRow } from './RequestRow';
import { WhyModal } from './WhyModal';

// ── State ──────────────────────────────────────────────────────────────────

interface JournalState {
  entries:   JournalEntry[];
  paused:    boolean;
}

type Action =
  | { type: 'LOAD';        entries: JournalEntry[] }
  | { type: 'PREPEND';     entry: JournalEntry }
  | { type: 'SET_PAUSED';  paused: boolean }
  | { type: 'CLEAR' };

// Keep at most 5000 entries in memory to avoid UI slowdown.
const MAX_ENTRIES = 5000;

function reducer(state: JournalState, action: Action): JournalState {
  switch (action.type) {
    case 'LOAD':
      return { ...state, entries: action.entries.slice(0, MAX_ENTRIES) };
    case 'PREPEND':
      if (state.paused) return state;
      return {
        ...state,
        entries: [action.entry, ...state.entries].slice(0, MAX_ENTRIES),
      };
    case 'SET_PAUSED':
      return { ...state, paused: action.paused };
    case 'CLEAR':
      return { ...state, entries: [] };
    default:
      return state;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function parseEntries(json: string): JournalEntry[] {
  try { return JSON.parse(json) as JournalEntry[]; }
  catch { return []; }
}

// Counts for the filter tabs.
function computeCounts(entries: JournalEntry[]): Record<FilterTab, number> {
  let blocked  = 0;
  let trackers = 0;
  let fennec   = 0;

  for (const e of entries) {
    if (e.blocked)                          blocked++;
    if (e.resource_class === 'tracker' ||
        e.resource_class === 'ad')          trackers++;
    if (e.source_tag    === 'fennec-internal' ||
        e.resource_class === 'fennec-internal') fennec++;
  }

  return { all: entries.length, blocked, trackers, 'fennec-internal': fennec };
}

function filterEntries(entries: JournalEntry[], tab: FilterTab): JournalEntry[] {
  switch (tab) {
    case 'blocked':
      return entries.filter(e => e.blocked);
    case 'trackers':
      return entries.filter(e =>
        e.resource_class === 'tracker' || e.resource_class === 'ad');
    case 'fennec-internal':
      return entries.filter(e =>
        e.source_tag === 'fennec-internal' ||
        e.resource_class === 'fennec-internal');
    default:
      return entries;
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function JournalApp(): React.ReactElement {
  const [state, dispatch]   = useReducer(reducer, { entries: [], paused: false });
  const [activeTab, setTab] = useState<FilterTab>('all');
  const [whyEntry, setWhy]  = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const subIdRef            = useRef<number | null>(null);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const bridge = window.__fennec?.journal;

    if (bridge) {
      const json = bridge.getEntries(500);
      dispatch({ type: 'LOAD', entries: parseEntries(json) });

      // Subscribe to live updates.
      subIdRef.current = bridge.subscribe((entryJson: string) => {
        try {
          const entry = JSON.parse(entryJson) as JournalEntry;
          dispatch({ type: 'PREPEND', entry });
        } catch { /* malformed event */ }
      });
    } else {
      // Development fallback: load mock data.
      dispatch({ type: 'LOAD', entries: MOCK_ENTRIES });
    }

    setLoading(false);

    return () => {
      if (subIdRef.current !== null) {
        window.__fennec?.journal?.unsubscribe(subIdRef.current);
      }
    };
  }, []);

  const handleExport = useCallback(() => {
    window.__fennec?.journal?.exportJson(7);
  }, []);

  const handleClear = useCallback(() => {
    if (!window.confirm('Clear the entire Request Journal? This cannot be undone.'))
      return;
    window.__fennec?.journal?.clear();
    dispatch({ type: 'CLEAR' });
  }, []);

  const counts  = computeCounts(state.entries);
  const visible = filterEntries(state.entries, activeTab);

  // ── Layout styles ─────────────────────────────────────────────────────────

  const rootStyle: React.CSSProperties = {
    display:       'flex',
    flexDirection: 'column',
    height:        '100vh',
    background:    'var(--fnc-surface-base)',
    color:         'var(--fnc-text-primary)',
    fontFamily:    'var(--fnc-font-sans)',
    fontSize:      'var(--fnc-text-base)',
    overflow:      'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    gap:            'var(--fnc-space-3)',
    padding:        'var(--fnc-space-3) var(--fnc-space-4)',
    borderBottom:   '1px solid var(--fnc-border)',
    background:     'var(--fnc-surface-toolbar)',
    flexShrink:     0,
  };

  const titleStyle: React.CSSProperties = {
    fontSize:   'var(--fnc-text-md)',
    fontWeight: 700,
    color:      'var(--fnc-text-primary)',
    flex:       1,
  };

  const pauseBtnStyle: React.CSSProperties = {
    padding:      '4px 12px',
    border:       '1px solid var(--fnc-border)',
    borderRadius: 'var(--fnc-radius-md)',
    background:   state.paused ? 'var(--fnc-accent)' : 'transparent',
    color:        state.paused ? 'var(--fnc-accent-on)' : 'var(--fnc-text-secondary)',
    fontSize:     'var(--fnc-text-sm)',
    fontFamily:   'var(--fnc-font-sans)',
    cursor:       'pointer',
  };

  const feedStyle: React.CSSProperties = {
    flex:       1,
    overflowY:  'auto',
    overflowX:  'hidden',
  };

  const emptyStyle: React.CSSProperties = {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    height:         '100%',
    color:          'var(--fnc-text-tertiary)',
    gap:            'var(--fnc-space-2)',
  };

  // Column header row.
  const colHeaderStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    gap:            'var(--fnc-space-2)',
    padding:        `var(--fnc-space-1) var(--fnc-space-4)`,
    borderBottom:   '1px solid var(--fnc-border)',
    background:     'var(--fnc-surface-raised)',
    fontSize:       '10px',
    fontWeight:     600,
    color:          'var(--fnc-text-tertiary)',
    textTransform:  'uppercase' as const,
    letterSpacing:  '0.05em',
    flexShrink:     0,
  };

  return (
    <div style={rootStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontSize: '18px' }}>👂</span>
        <span style={titleStyle}>Request Journal</span>
        <span style={{ fontSize: 'var(--fnc-text-sm)', color: 'var(--fnc-text-tertiary)' }}>
          {visible.length.toLocaleString()} {activeTab === 'all' ? 'requests' : activeTab}
        </span>
        <button
          style={pauseBtnStyle}
          onClick={() => dispatch({ type: 'SET_PAUSED', paused: !state.paused })}
          title={state.paused ? 'Resume live updates' : 'Pause live updates'}
        >
          {state.paused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </div>

      {/* Filter bar */}
      <FilterBar
        activeTab={activeTab}
        counts={counts}
        onTabChange={setTab}
        onExport={handleExport}
        onClear={handleClear}
      />

      {/* Column headers */}
      <div style={colHeaderStyle}>
        <span style={{ width: '16px', flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Domain</span>
        <span style={{ width: '36px', textAlign: 'center' }}>Type</span>
        <span style={{ width: '50px' }}>Class</span>
        <span style={{ width: '52px' }}>Status</span>
        <span style={{ width: '34px', textAlign: 'right' }}>Code</span>
        <span style={{ width: '68px', textAlign: 'right' }}>Time</span>
        <span style={{ width: '42px' }} />
      </div>

      {/* Feed */}
      <div style={feedStyle} role="list" aria-label="Request log">
        {loading ? (
          <div style={emptyStyle}>
            <span style={{ fontSize: '24px' }}>⏳</span>
            <span>Loading…</span>
          </div>
        ) : visible.length === 0 ? (
          <div style={emptyStyle}>
            <span style={{ fontSize: '32px' }}>👂</span>
            <span style={{ fontWeight: 600 }}>Nothing to show</span>
            <span style={{ fontSize: 'var(--fnc-text-sm)' }}>
              {activeTab === 'all'
                ? 'Requests will appear here as pages load.'
                : `No ${activeTab} requests recorded yet.`}
            </span>
          </div>
        ) : (
          visible.map(entry => (
            <RequestRow
              key={entry.id}
              entry={entry}
              onWhy={setWhy}
            />
          ))
        )}
      </div>

      {/* Why modal */}
      {whyEntry && (
        <WhyModal entry={whyEntry} onClose={() => setWhy(null)} />
      )}
    </div>
  );
}

// ── Development mock data ─────────────────────────────────────────────────

const MOCK_ENTRIES: JournalEntry[] = [
  {
    id: 5, timestamp: Date.now() - 1000, url: 'https://fonts.gstatic.com/s/inter/v13/font.woff2',
    resource_type: 'font', source_url: 'https://example.com', initiator_url: 'https://example.com',
    source_tag: 'page', status_code: 200, mime_type: 'font/woff2', blocked: false,
    block_reason: '', resource_class: 'third-party', response_bytes: 45231,
  },
  {
    id: 4, timestamp: Date.now() - 2000, url: 'https://google-analytics.com/analytics.js',
    resource_type: 'script', source_url: 'https://example.com', initiator_url: 'https://example.com',
    source_tag: 'page', status_code: 0, mime_type: '', blocked: true,
    block_reason: 'EasyPrivacy §tracker', resource_class: 'telemetry', response_bytes: -1,
  },
  {
    id: 3, timestamp: Date.now() - 3000, url: 'https://mods.fennec.computer/registry.json',
    resource_type: 'fetch', source_url: '', initiator_url: '',
    source_tag: 'fennec-internal', status_code: 200, mime_type: 'application/json', blocked: false,
    block_reason: '', resource_class: 'fennec-internal', response_bytes: 1204,
  },
  {
    id: 2, timestamp: Date.now() - 4000, url: 'https://doubleclick.net/pixel',
    resource_type: 'image', source_url: 'https://example.com', initiator_url: 'https://example.com',
    source_tag: 'page', status_code: 0, mime_type: '', blocked: true,
    block_reason: 'EasyList §ad', resource_class: 'ad', response_bytes: -1,
  },
  {
    id: 1, timestamp: Date.now() - 5000, url: 'https://example.com/',
    resource_type: 'document', source_url: '', initiator_url: '',
    source_tag: 'page', status_code: 200, mime_type: 'text/html', blocked: false,
    block_reason: '', resource_class: 'first-party', response_bytes: 12845,
  },
];
