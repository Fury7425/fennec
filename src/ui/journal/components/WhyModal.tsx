import React from 'react';
import type { JournalEntry, ResourceClass } from '../types';

interface WhyModalProps {
  entry: JournalEntry;
  onClose: () => void;
}

// Plain-language explanations for each resource class.
const CLASS_EXPLANATIONS: Record<ResourceClass, string> = {
  'first-party':
    'This request was made by the website you are currently visiting, ' +
    "to its own server. It is part of the page's normal operation.",
  'third-party':
    'This request was made to a different domain from the page you are ' +
    'visiting. The destination has not been identified as a tracker or ad ' +
    'network, but it does receive your IP address and request context.',
  'tracker':
    'This domain is listed in a privacy-focused filter list (EasyPrivacy or ' +
    'uBlock Origin Privacy) as a known tracking endpoint. It may be used to ' +
    'follow your activity across websites.',
  'ad':
    'This domain is listed in an advertising filter list (EasyList or uBlock ' +
    'Origin Filters) as an ad-serving endpoint. Loading it typically means ' +
    'your browser is requesting or reporting on an ad.',
  'telemetry':
    'This is a known telemetry or analytics endpoint from a major tech vendor ' +
    '(Google, Microsoft, etc.). Its sole purpose is to collect usage, crash, ' +
    'or performance data about you or your device.',
  'fingerprint':
    'This request matches patterns associated with browser fingerprinting — ' +
    'collecting unique characteristics of your browser, fonts, canvas output, ' +
    'or hardware to identify you without cookies.',
  'fennec-internal':
    'This request was made by Fennec itself, not a web page. Fennec tags all ' +
    'its own network activity so you can see exactly what the browser does — ' +
    'nothing is hidden.',
  'blocked':
    'This request was blocked before it could be sent. It may have been ' +
    'stopped by the consent guard (before you completed setup), by uBlock ' +
    "Origin, or by Fennec's network policy.",
};

// Resource type explanations.
function resourceTypeExplanation(type: string): string {
  const map: Record<string, string> = {
    document:    'a full HTML page',
    frame:       'an embedded frame (iframe)',
    stylesheet:  'a CSS stylesheet that styles the page',
    script:      'a JavaScript file that runs code in your browser',
    image:       'an image file (PNG, JPEG, SVG, WebP, etc.)',
    font:        'a font file used to render text',
    xhr:         'an XMLHttpRequest made by page JavaScript',
    fetch:       'a Fetch API request made by page JavaScript',
    websocket:   'a WebSocket connection for real-time communication',
    media:       'an audio or video file',
    other:       'a resource of an unclassified type',
  };
  return map[type] ?? `a resource of type "${type}"`;
}

function ClassBadge({ cls }: { cls: ResourceClass }): React.ReactElement {
  const colors: Record<ResourceClass, { bg: string; text: string }> = {
    'first-party':    { bg: 'var(--fnc-surface-overlay)',  text: 'var(--fnc-text-secondary)' },
    'third-party':    { bg: 'var(--fnc-surface-overlay)',  text: 'var(--fnc-text-secondary)' },
    'tracker':        { bg: '#fef3c7', text: '#92400e' },
    'ad':             { bg: '#ede9fe', text: '#5b21b6' },
    'telemetry':      { bg: '#fee2e2', text: '#991b1b' },
    'fingerprint':    { bg: '#ffedd5', text: '#9a3412' },
    'fennec-internal':{ bg: '#dbeafe', text: '#1e40af' },
    'blocked':        { bg: '#fee2e2', text: '#991b1b' },
  };
  const { bg, text } = colors[cls] ?? colors['third-party'];
  return (
    <span style={{
      display:       'inline-block',
      padding:       '2px 10px',
      borderRadius:  '999px',
      fontSize:      '12px',
      fontWeight:    700,
      background:    bg,
      color:         text,
      textTransform: 'capitalize',
    }}>
      {cls}
    </span>
  );
}

export function WhyModal({ entry, onClose }: WhyModalProps): React.ReactElement {
  const domain = (() => {
    try { return new URL(entry.url).hostname; } catch { return entry.url; }
  })();

  const ts = new Date(entry.timestamp).toLocaleTimeString([], {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Close on backdrop click.
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  const backdropStyle: React.CSSProperties = {
    position:       'fixed',
    inset:          0,
    background:     'rgba(0,0,0,0.45)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         'var(--fnc-z-modal)' as React.CSSProperties['zIndex'],
    padding:        'var(--fnc-space-4)',
  };

  const cardStyle: React.CSSProperties = {
    background:   'var(--fnc-surface-raised)',
    borderRadius: 'var(--fnc-radius-2xl)',
    boxShadow:    'var(--fnc-shadow-xl)',
    width:        '100%',
    maxWidth:     '520px',
    overflow:     'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        'var(--fnc-space-5) var(--fnc-space-6)',
    borderBottom:   '1px solid var(--fnc-border-subtle)',
  };

  const bodyStyle: React.CSSProperties = {
    padding: 'var(--fnc-space-6)',
  };

  const rowStyle: React.CSSProperties = {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    padding:        'var(--fnc-space-2) 0',
    borderBottom:   '1px solid var(--fnc-border-subtle)',
    gap:            'var(--fnc-space-4)',
  };

  const labelStyle: React.CSSProperties = {
    color:      'var(--fnc-text-secondary)',
    fontSize:   'var(--fnc-text-sm)',
    flexShrink: 0,
    minWidth:   '120px',
  };

  const valueStyle: React.CSSProperties = {
    color:        'var(--fnc-text-primary)',
    fontSize:     'var(--fnc-text-sm)',
    textAlign:    'right',
    wordBreak:    'break-all',
  };

  return (
    <div style={backdropStyle} onClick={handleBackdrop}>
      <div style={cardStyle} role="dialog" aria-modal="true"
           aria-label={`Why did ${domain} load?`}>
        <div style={headerStyle}>
          <div>
            <div style={{ fontSize: 'var(--fnc-text-lg)', fontWeight: 700,
                          color: 'var(--fnc-text-primary)' }}>
              Why did this load?
            </div>
            <div style={{ fontSize: 'var(--fnc-text-sm)',
                          color: 'var(--fnc-text-secondary)', marginTop: 2 }}>
              {domain} · {ts}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer',
                     color: 'var(--fnc-text-secondary)', fontSize: '18px',
                     padding: '4px', borderRadius: '4px' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div style={bodyStyle}>
          {/* Plain-language explanation */}
          <p style={{ color: 'var(--fnc-text-primary)',
                      fontSize: 'var(--fnc-text-base)',
                      lineHeight: 'var(--fnc-leading-relaxed)',
                      marginTop: 0, marginBottom: 'var(--fnc-space-5)' }}>
            {CLASS_EXPLANATIONS[entry.resource_class]}
            {' '}
            Specifically, this was {resourceTypeExplanation(entry.resource_type)}.
          </p>

          {/* Detail rows */}
          <div style={{ marginBottom: 'var(--fnc-space-5)' }}>
            <div style={rowStyle}>
              <span style={labelStyle}>URL</span>
              <span style={{ ...valueStyle, fontFamily: 'var(--fnc-font-mono)',
                              fontSize: '11px', color: 'var(--fnc-text-secondary)' }}>
                {entry.url.length > 80
                  ? entry.url.slice(0, 80) + '…'
                  : entry.url}
              </span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Classification</span>
              <ClassBadge cls={entry.resource_class} />
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Resource type</span>
              <span style={valueStyle}>{entry.resource_type || '—'}</span>
            </div>
            <div style={rowStyle}>
              <span style={labelStyle}>Initiated by</span>
              <span style={{ ...valueStyle, fontSize: '11px',
                              fontFamily: 'var(--fnc-font-mono)' }}>
                {entry.source_tag === 'fennec-internal'
                  ? 'Fennec (browser)'
                  : (entry.initiator_url
                      ? (entry.initiator_url.length > 60
                          ? entry.initiator_url.slice(0, 60) + '…'
                          : entry.initiator_url)
                      : '—')}
              </span>
            </div>
            {entry.blocked && (
              <div style={rowStyle}>
                <span style={labelStyle}>Block reason</span>
                <span style={{ ...valueStyle, color: 'var(--fnc-text-danger, #c0392b)' }}>
                  {entry.block_reason || 'Policy'}
                </span>
              </div>
            )}
            {!entry.blocked && entry.status_code > 0 && (
              <div style={rowStyle}>
                <span style={labelStyle}>HTTP status</span>
                <span style={valueStyle}>{entry.status_code}</span>
              </div>
            )}
            {entry.response_bytes > 0 && (
              <div style={rowStyle}>
                <span style={labelStyle}>Response size</span>
                <span style={valueStyle}>
                  {entry.response_bytes >= 1024 * 1024
                    ? `${(entry.response_bytes / 1024 / 1024).toFixed(1)} MB`
                    : entry.response_bytes >= 1024
                      ? `${(entry.response_bytes / 1024).toFixed(1)} KB`
                      : `${entry.response_bytes} B`}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              width:        '100%',
              padding:      'var(--fnc-space-3)',
              background:   'var(--fnc-accent)',
              color:        'var(--fnc-accent-on)',
              border:       'none',
              borderRadius: 'var(--fnc-radius-lg)',
              fontSize:     'var(--fnc-text-base)',
              fontWeight:   600,
              fontFamily:   'var(--fnc-font-sans)',
              cursor:       'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
