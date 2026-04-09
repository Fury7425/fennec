import React from 'react';
import type { SetupState } from '../types';

interface Props {
  services: SetupState['services'];
  onChange: (patch: Partial<SetupState['services']>) => void;
  onNext: () => void;
}

// Each service that Fennec may contact over the network.
const SERVICE_DEFS = [
  {
    key:         'enableUpdates' as const,
    title:       'Automatic updates',
    description: 'Checks for new Fennec releases and notifies you when one is available.',
    server:      'updates.fennec.computer',
    what:        'Sends your current Fennec version and platform. No user ID.',
    sourceRepo:  'https://github.com/fennec-browser/fennec-services',
  },
  {
    key:         'enableFilterRefresh' as const,
    title:       'uBlock filter list auto-refresh',
    description: 'Refreshes the EasyList, EasyPrivacy, and uBO filter lists on a weekly schedule.',
    server:      'cdn.jsdelivr.net, easylist.to (CDNs — no login required)',
    what:        'Fetches public filter list files. No cookies, no user data sent.',
    sourceRepo:  'https://github.com/gorhill/uBlock',
  },
  {
    key:         'enableModsRegistry' as const,
    title:       'Mods registry',
    description: 'Allows browsing and installing community Mods from the Fennec Mods directory.',
    server:      'mods.fennec.computer',
    what:        'Fetches a public JSON index of available Mods. No user data sent.',
    sourceRepo:  'https://github.com/fennec-browser/fennec-services',
  },
  {
    key:         'enableCwsProxy' as const,
    title:       'Anonymised extension proxy',
    description: 'Routes Chrome Web Store extension installs through the Fennec proxy to remove Google identifiers.',
    server:      'cws-proxy.fennec.computer (fennec-services)',
    what:        'Proxies the extension download. Strips your IP from Google\'s logs. The proxy sees only the extension ID.',
    sourceRepo:  'https://github.com/fennec-browser/fennec-services',
  },
] as const;

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}): React.ReactElement {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        width:        '44px',
        height:       '24px',
        borderRadius: '12px',
        border:       'none',
        cursor:       'pointer',
        background:   checked ? 'var(--fnc-accent)' : 'var(--fnc-border)',
        position:     'relative',
        flexShrink:   0,
        transition:   'background 150ms ease',
      }}
    >
      <span
        style={{
          position:   'absolute',
          top:        '2px',
          left:       checked ? '22px' : '2px',
          width:      '20px',
          height:     '20px',
          borderRadius: '50%',
          background: '#fff',
          boxShadow:  '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 150ms ease',
          display:    'block',
        }}
      />
    </button>
  );
}

export function ServicesStep({ services, onChange, onNext }: Props): React.ReactElement {
  const bodyStyle: React.CSSProperties = {
    padding:       'var(--fnc-space-8)',
    display:       'flex',
    flexDirection: 'column',
  };

  const cardStyle: React.CSSProperties = {
    background:   'var(--fnc-surface-sunken)',
    borderRadius: 'var(--fnc-radius-lg)',
    marginBottom: 'var(--fnc-space-3)',
    overflow:     'hidden',
  };

  const cardHeaderStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    gap:            'var(--fnc-space-4)',
    padding:        'var(--fnc-space-4)',
  };

  const cardBodyStyle: React.CSSProperties = {
    padding:    '0 var(--fnc-space-4) var(--fnc-space-3)',
    borderTop:  '1px solid var(--fnc-border-subtle)',
    fontSize:   'var(--fnc-text-sm)',
    color:      'var(--fnc-text-secondary)',
    lineHeight: 'var(--fnc-leading-relaxed)',
  };

  return (
    <div style={bodyStyle}>
      <h2 style={{
        marginTop:    0,
        marginBottom: 'var(--fnc-space-2)',
        fontSize:     'var(--fnc-text-2xl)',
        fontWeight:   700,
        color:        'var(--fnc-text-primary)',
      }}>
        Optional services
      </h2>
      <p style={{
        fontSize:     'var(--fnc-text-sm)',
        color:        'var(--fnc-text-secondary)',
        marginTop:    0,
        marginBottom: 'var(--fnc-space-6)',
        lineHeight:   'var(--fnc-leading-relaxed)',
      }}>
        Fennec works fully offline. Each service below makes network calls —
        opt in only to what you want. You can change these later in Settings.
      </p>

      {SERVICE_DEFS.map(svc => {
        const enabled = services[svc.key];
        return (
          <div key={svc.key} style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight:   600,
                  fontSize:     'var(--fnc-text-base)',
                  color:        'var(--fnc-text-primary)',
                  marginBottom: 'var(--fnc-space-1)',
                }}>
                  {svc.title}
                </div>
                <div style={{
                  fontSize:   'var(--fnc-text-sm)',
                  color:      'var(--fnc-text-secondary)',
                  lineHeight: 'var(--fnc-leading-normal)',
                }}>
                  {svc.description}
                </div>
              </div>
              <Toggle
                checked={enabled}
                onChange={() => onChange({ [svc.key]: !enabled })}
              />
            </div>

            {/* Expanded detail row */}
            <div style={cardBodyStyle}>
              <div style={{ marginTop: 'var(--fnc-space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--fnc-space-1)' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>Server: </span>
                  <code style={{
                    fontFamily:  'var(--fnc-font-mono)',
                    fontSize:    '11px',
                    background:  'var(--fnc-surface-overlay)',
                    padding:     '1px 5px',
                    borderRadius: '4px',
                  }}>
                    {svc.server}
                  </code>
                </div>
                <div>
                  <span style={{ fontWeight: 600 }}>Data sent: </span>
                  {svc.what}
                </div>
                <div>
                  <span style={{ fontWeight: 600 }}>Open source: </span>
                  <a
                    href={svc.sourceRepo}
                    style={{
                      color:          'var(--fnc-accent)',
                      textDecoration: 'none',
                      fontSize:       '11px',
                      fontFamily:     'var(--fnc-font-mono)',
                    }}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {svc.sourceRepo.replace('https://', '')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <button
        onClick={onNext}
        style={{
          marginTop:    'var(--fnc-space-4)',
          padding:      `var(--fnc-space-3) var(--fnc-space-8)`,
          background:   'var(--fnc-accent)',
          color:        'var(--fnc-accent-on)',
          border:       'none',
          borderRadius: 'var(--fnc-radius-full)',
          fontSize:     'var(--fnc-text-md)',
          fontWeight:   600,
          fontFamily:   'var(--fnc-font-sans)',
          cursor:       'pointer',
          transition:   'background 120ms ease',
          alignSelf:    'stretch',
        }}
      >
        Continue
      </button>
    </div>
  );
}
