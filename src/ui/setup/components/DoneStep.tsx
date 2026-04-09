import React from 'react';
import type { SetupState } from '../types';

interface Props {
  services: SetupState['services'];
  onFinish: () => void;
}

const SERVICE_LABELS: Record<keyof SetupState['services'], string> = {
  enableUpdates:      'Automatic updates',
  enableFilterRefresh: 'Filter list auto-refresh',
  enableModsRegistry:  'Mods registry',
  enableCwsProxy:      'Extension proxy',
};

export function DoneStep({ services, onFinish }: Props): React.ReactElement {
  const enabledServices = (
    Object.entries(services) as [keyof SetupState['services'], boolean][]
  ).filter(([, v]) => v);

  const bodyStyle: React.CSSProperties = {
    padding:       'var(--fnc-space-8)',
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    textAlign:     'center',
  };

  return (
    <div style={bodyStyle}>
      {/* Checkmark */}
      <div style={{
        width:          '64px',
        height:         '64px',
        borderRadius:   '50%',
        background:     'var(--fnc-accent)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        marginBottom:   'var(--fnc-space-5)',
      }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M7 16l6 6 12-12"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h2 style={{
        marginTop:    0,
        marginBottom: 'var(--fnc-space-2)',
        fontSize:     'var(--fnc-text-2xl)',
        fontWeight:   700,
        color:        'var(--fnc-text-primary)',
      }}>
        You're all set!
      </h2>

      <p style={{
        fontSize:     'var(--fnc-text-sm)',
        color:        'var(--fnc-text-secondary)',
        marginTop:    0,
        marginBottom: 'var(--fnc-space-6)',
        lineHeight:   'var(--fnc-leading-relaxed)',
      }}>
        Privacy-first defaults are active. Every network request your browser
        makes is logged in the{' '}
        <strong style={{ color: 'var(--fnc-text-primary)' }}>Request Journal</strong>
        {' '}— nothing is hidden.
      </p>

      {/* Services summary */}
      <div style={{
        width:        '100%',
        background:   'var(--fnc-surface-sunken)',
        borderRadius: 'var(--fnc-radius-lg)',
        padding:      'var(--fnc-space-4)',
        marginBottom: 'var(--fnc-space-6)',
        textAlign:    'left',
      }}>
        <div style={{
          fontSize:     'var(--fnc-text-sm)',
          fontWeight:   600,
          color:        'var(--fnc-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 'var(--fnc-space-3)',
        }}>
          Services opted in
        </div>

        {enabledServices.length === 0 ? (
          <div style={{
            fontSize:   'var(--fnc-text-sm)',
            color:      'var(--fnc-text-secondary)',
            fontStyle:  'italic',
          }}>
            None — fully offline mode.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fnc-space-2)' }}>
            {enabledServices.map(([key]) => (
              <div key={key} style={{
                display:     'flex',
                alignItems:  'center',
                gap:         'var(--fnc-space-2)',
                fontSize:    'var(--fnc-text-sm)',
                color:       'var(--fnc-text-primary)',
              }}>
                <span style={{
                  width:          '18px',
                  height:         '18px',
                  borderRadius:   '50%',
                  background:     'var(--fnc-accent)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  flexShrink:     0,
                }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {SERVICE_LABELS[key]}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onFinish}
        style={{
          width:        '100%',
          padding:      'var(--fnc-space-3) var(--fnc-space-8)',
          background:   'var(--fnc-accent)',
          color:        'var(--fnc-accent-on)',
          border:       'none',
          borderRadius: 'var(--fnc-radius-full)',
          fontSize:     'var(--fnc-text-md)',
          fontWeight:   700,
          fontFamily:   'var(--fnc-font-sans)',
          cursor:       'pointer',
          transition:   'background 120ms ease',
        }}
      >
        Start browsing
      </button>

      <p style={{
        marginTop:  'var(--fnc-space-4)',
        fontSize:   'var(--fnc-text-xs)',
        color:      'var(--fnc-text-tertiary)',
      }}>
        Change any of these in <strong>Settings → Privacy</strong> at any time.
      </p>
    </div>
  );
}
