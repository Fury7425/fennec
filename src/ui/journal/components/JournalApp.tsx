import React, { useEffect, useMemo, useState } from 'react';
import { clearLocalJournalEntries, getDefaultJournalEntries, loadLocalJournalEntries, subscribeLocalJournal } from '../../shared/journal-store';
import { initializeSurfaceRuntime } from '../../shared/page-runtime';
import type { JournalEntry } from '../../shared/models';
import type { FilterTab } from '../types';

function parseBridgeEntries(json: string): JournalEntry[] {
  try {
    return JSON.parse(json) as JournalEntry[];
  } catch {
    return getDefaultJournalEntries();
  }
}

function countsFor(entries: JournalEntry[]): Record<FilterTab, number> {
  return {
    all: entries.length,
    blocked: entries.filter(entry => entry.blocked).length,
    trackers: entries.filter(entry => entry.resource_class === 'tracker' || entry.resource_class === 'ad').length,
    'fennec-internal': entries.filter(entry => entry.source_tag === 'fennec-internal' || entry.resource_type === 'mod-violation').length,
  };
}

function filterEntries(entries: JournalEntry[], filter: FilterTab): JournalEntry[] {
  if (filter === 'blocked') {
    return entries.filter(entry => entry.blocked);
  }
  if (filter === 'trackers') {
    return entries.filter(entry => entry.resource_class === 'tracker' || entry.resource_class === 'ad');
  }
  if (filter === 'fennec-internal') {
    return entries.filter(entry => entry.source_tag === 'fennec-internal' || entry.resource_type === 'mod-violation');
  }
  return entries;
}

function hostLabel(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function timeLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function JournalApp(): React.ReactElement {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const disposeRuntime = initializeSurfaceRuntime('journal');
    const bridge = window.__fennec?.journal;

    if (bridge) {
      setEntries(parseBridgeEntries(bridge.getEntries(500)));
      const subscriptionId = bridge.subscribe((entryJson: string) => {
        if (paused) {
          return;
        }
        try {
          const entry = JSON.parse(entryJson) as JournalEntry;
          setEntries(previous => [entry, ...previous].slice(0, 5000));
        } catch {
          // Ignore malformed journal updates.
        }
      });

      return () => {
        bridge.unsubscribe(subscriptionId);
        disposeRuntime();
      };
    }

    setEntries(loadLocalJournalEntries());
    const disposeLocal = subscribeLocalJournal(nextEntries => {
      if (!paused) {
        setEntries(nextEntries);
      }
    });

    return () => {
      disposeLocal();
      disposeRuntime();
    };
  }, [paused]);

  const counts = useMemo(() => countsFor(entries), [entries]);
  const visibleEntries = useMemo(() => filterEntries(entries, filter), [entries, filter]);

  return (
    <div className="fennec-page">
      <div className="fennec-shell" data-sidebar-position="left">
        <main className="fennec-content">
          <div className="fennec-heading">
            <div className="fennec-stack-tight">
              <h1 style={{ margin: 0 }}>Request Journal</h1>
              <p className="fennec-subtle" style={{ margin: 0 }}>Every page request, internal call, and mod sandbox violation stays visible here.</p>
            </div>
            <div className="fennec-inline">
              <button className="fennec-button" type="button" onClick={() => setPaused(previous => !previous)}>
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button className="fennec-button" type="button" onClick={() => window.__fennec?.journal?.exportJson(7)}>
                Export JSON
              </button>
              <button
                className="fennec-button"
                type="button"
                onClick={() => {
                  window.__fennec?.journal?.clear();
                  clearLocalJournalEntries();
                  setEntries([]);
                }}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="fennec-inline">
            {(['all', 'blocked', 'trackers', 'fennec-internal'] as const).map(tab => (
              <button key={tab} className="fennec-button" data-active={filter === tab} type="button" onClick={() => setFilter(tab)}>
                {tab} · {counts[tab]}
              </button>
            ))}
          </div>

          <div className="fennec-card">
            <div className="fennec-preview-journal-row" style={{ fontWeight: 600 }}>
              <span>Domain</span>
              <span>Class</span>
              <span>Status</span>
            </div>
            <div className="fennec-stack" style={{ marginTop: 'var(--fennec-space-2)' }}>
              {visibleEntries.map(entry => (
                <button
                  key={entry.id}
                  className="fennec-preview-journal-row"
                  type="button"
                  onClick={() => setSelectedEntry(entry)}
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                >
                  <span>{hostLabel(entry.url)}</span>
                  <span className="fennec-subtle">{entry.resource_type === 'mod-violation' ? 'mod-violation' : entry.resource_class}</span>
                  <span>{entry.blocked ? 'Blocked' : entry.status_code || 'Pending'}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedEntry && (
            <div className="fennec-card-strong">
              <div className="fennec-heading" style={{ marginBottom: 'var(--fennec-space-3)' }}>
                <div className="fennec-stack-tight">
                  <h2 style={{ margin: 0 }}>{hostLabel(selectedEntry.url)}</h2>
                  <p className="fennec-subtle" style={{ margin: 0 }}>{selectedEntry.url}</p>
                </div>
                <button className="fennec-button" type="button" onClick={() => setSelectedEntry(null)}>Close</button>
              </div>
              <div className="fennec-grid two">
                <div className="fennec-card">
                  <div className="fennec-stack-tight">
                    <strong>Why it appeared</strong>
                    <span className="fennec-subtle">{selectedEntry.block_reason || 'Allowed request with no special note.'}</span>
                  </div>
                </div>
                <div className="fennec-card">
                  <div className="fennec-stack-tight">
                    <strong>Details</strong>
                    <span className="fennec-subtle">Type: {selectedEntry.resource_type}</span>
                    <span className="fennec-subtle">Source tag: {selectedEntry.source_tag}</span>
                    <span className="fennec-subtle">Time: {timeLabel(selectedEntry.timestamp)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
