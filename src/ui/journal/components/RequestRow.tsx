import React, { useState } from 'react';
import type { JournalEntry, ResourceClass } from '../types';

interface RequestRowProps {
  entry: JournalEntry;
  onWhy: (entry: JournalEntry) => void;
}

// Badge colours per classification.
const CLASS_BADGE: Record<ResourceClass, { bg: string; fg: string; label: string }> = {
  'first-party':    { bg: 'var(--fnc-surface-overlay)',  fg: 'var(--fnc-text-tertiary)', label: '1st' },
  'third-party':    { bg: 'var(--fnc-surface-overlay)',  fg: 'var(--fnc-text-secondary)', label: '3rd' },
  'tracker':        { bg: '#fef3c7', fg: '#92400e',  label: 'tracker' },
  'ad':             { bg: '#ede9fe', fg: '#5b21b6',  label: 'ad' },
  'telemetry':      { bg: '#fee2e2', fg: '#991b1b',  label: 'telemetry' },
  'fingerprint':    { bg: '#ffedd5', fg: '#9a3412',  label: 'fingerprint' },
  'fennec-internal':{ bg: '#dbeafe', fg: '#1e40af',  label: 'fennec' },
  'blocked':        { bg: '#fee2e2', fg: '#991b1b',  label: 'blocked' },
};

// Resolve a tiny 16×16 favicon URL via the browser's built-in mechanism.
function faviconUrl(domain: string): string {
  return `chrome://favicon/size/16@2x/${encodeURIComponent(`https://${domain}/`)}`;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname; }
  catch { return url; }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// Resource type icon (Unicode).
const RESOURCE_ICONS: Record<string, string> = {
  document:   '📄',
  frame:      '⬜',
  stylesheet: '🎨',
  script:     'JS',
  image:      '🖼',
  font:       'Aa',
  xhr:        'XHR',
  fetch:      '↗',
  websocket:  '⚡',
  media:      '▶',
  other:      '•',
};

export function RequestRow({ entry, onWhy }: RequestRowProps): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  const domain  = extractDomain(entry.url);
  const badge   = CLASS_BADGE[entry.resource_class] ?? CLASS_BADGE['third-party'];
  const icon    = RESOURCE_ICONS[entry.resource_type] ?? '•';
  const time    = formatTime(entry.timestamp);

  const rowStyle: React.CSSProperties = {
    display:       'flex',
    alignItems:    'center',
    gap:           'var(--fnc-space-2)',
    padding:       `var(--fnc-space-2) var(--fnc-space-4)`,
    background:    hovered ? 'var(--fnc-surface-overlay)' : 'transparent',
    transition:    'background 80ms ease',
    cursor:        'default',
    minHeight:     '40px',
    borderBottom:  '1px solid var(--fnc-border-subtle)',
  };

  const faviconStyle: React.CSSProperties = {
    width:       '16px',
    height:      '16px',
    borderRadius:'2px',
    flexShrink:  0,
    objectFit:   'contain',
  };

  const domainStyle: React.CSSProperties = {
    flex:         '1',
    minWidth:     0,
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap',
    fontSize:     'var(--fnc-text-sm)',
    color:        entry.blocked
                    ? 'var(--fnc-text-danger, #c0392b)'
                    : 'var(--fnc-text-primary)',
    fontFamily:   'var(--fnc-font-sans)',
  };

  const resourceTypeStyle: React.CSSProperties = {
    fontSize:     '11px',
    color:        'var(--fnc-text-tertiary)',
    fontFamily:   'var(--fnc-font-mono)',
    flexShrink:   0,
    width:        '36px',
    textAlign:    'center',
  };

  const badgeStyle: React.CSSProperties = {
    padding:       '1px 7px',
    borderRadius:  '999px',
    fontSize:      '10px',
    fontWeight:    700,
    background:    badge.bg,
    color:         badge.fg,
    flexShrink:    0,
    textTransform: 'capitalize' as const,
  };

  const statusStyle: React.CSSProperties = {
    fontSize:   '11px',
    color:      entry.blocked
                  ? 'var(--fnc-text-danger, #c0392b)'
                  : entry.status_code >= 400
                    ? '#d97706'
                    : 'var(--fnc-text-tertiary)',
    fontFamily: 'var(--fnc-font-mono)',
    flexShrink: 0,
    width:      '34px',
    textAlign:  'right',
  };

  const timeStyle: React.CSSProperties = {
    fontSize:   '10px',
    color:      'var(--fnc-text-tertiary)',
    fontFamily: 'var(--fnc-font-mono)',
    flexShrink: 0,
    width:      '68px',
    textAlign:  'right',
  };

  const whyBtnStyle: React.CSSProperties = {
    flexShrink:   0,
    padding:      '2px 8px',
    border:       '1px solid var(--fnc-border)',
    borderRadius: 'var(--fnc-radius-md)',
    background:   'transparent',
    color:        'var(--fnc-text-secondary)',
    fontSize:     '10px',
    fontFamily:   'var(--fnc-font-sans)',
    cursor:       'pointer',
    opacity:      hovered ? 1 : 0,
    transition:   'opacity 80ms ease',
  };

  return (
    <div
      style={rowStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={entry.url}
    >
      {/* Favicon */}
      <img
        src={faviconUrl(domain)}
        style={faviconStyle}
        alt=""
        aria-hidden="true"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />

      {/* Domain */}
      <span style={domainStyle}>{domain}</span>

      {/* Resource type icon */}
      <span style={resourceTypeStyle} title={entry.resource_type}>
        {icon}
      </span>

      {/* Classification badge */}
      <span style={badgeStyle}>{badge.label}</span>

      {/* Blocked / allowed pill */}
      <span style={{
        ...badgeStyle,
        background: entry.blocked ? '#fee2e2' : '#dcfce7',
        color:      entry.blocked ? '#991b1b' : '#14532d',
      }}>
        {entry.blocked ? 'blocked' : 'allowed'}
      </span>

      {/* HTTP status */}
      <span style={statusStyle}>
        {entry.blocked ? '—' : entry.status_code > 0 ? entry.status_code : '…'}
      </span>

      {/* Timestamp */}
      <span style={timeStyle}>{time}</span>

      {/* Why? button */}
      <button
        style={whyBtnStyle}
        onClick={() => onWhy(entry)}
        tabIndex={hovered ? 0 : -1}
        aria-label={`Why did ${domain} load?`}
      >
        Why?
      </button>
    </div>
  );
}
