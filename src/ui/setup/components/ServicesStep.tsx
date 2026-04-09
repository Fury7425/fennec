import React from 'react';
import type { SetupState } from '../types';

interface Props {
  state: SetupState;
  onChange: (patch: Partial<SetupState['services']>) => void;
  onNext: () => void;
}

export default function ServicesStep({ state, onChange, onNext }: Props) {
  return (
    <div>
      <h2 style={{ marginTop: 0, color: 'var(--fnc-text-primary)' }}>Optional services</h2>
      <p style={{ color: 'var(--fnc-text-secondary)', marginBottom: 24 }}>
        Fennec is fully functional without any cloud services. These are opt-in only.
      </p>

      <div style={{ padding: '20px', background: 'var(--fnc-surface-1)', borderRadius: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--fnc-text-primary)' }}>Sync</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--fnc-text-secondary)' }}>
              Sync bookmarks and settings with your own server
            </div>
          </div>
          <button
            role="switch"
            aria-checked={state.services.enableSync}
            onClick={() => onChange({ enableSync: !state.services.enableSync })}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: state.services.enableSync ? 'var(--fnc-accent)' : 'var(--fnc-surface-2)',
              position: 'relative', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 2,
              left: state.services.enableSync ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
        {state.services.enableSync && (
          <input
            type="url"
            placeholder="https://your-sync-server.com"
            value={state.services.syncServerUrl}
            onChange={e => onChange({ syncServerUrl: e.target.value })}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8, boxSizing: 'border-box',
              border: '1px solid var(--fnc-border)', background: 'var(--fnc-surface-0)',
              color: 'var(--fnc-text-primary)', fontSize: '0.9rem',
            }}
          />
        )}
      </div>

      <div style={{ padding: '20px', background: 'var(--fnc-surface-1)', borderRadius: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--fnc-text-primary)' }}>Automatic updates</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--fnc-text-secondary)' }}>
              Check for updates from updates.fennec.computer
            </div>
          </div>
          <button
            role="switch"
            aria-checked={state.services.enableUpdates}
            onClick={() => onChange({ enableUpdates: !state.services.enableUpdates })}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: state.services.enableUpdates ? 'var(--fnc-accent)' : 'var(--fnc-surface-2)',
              position: 'relative', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 2,
              left: state.services.enableUpdates ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </div>

      <button
        onClick={onNext}
        style={{
          padding: '12px 32px', background: 'var(--fnc-accent)',
          color: '#fff', border: 'none', borderRadius: 8, fontSize: '1rem',
          fontWeight: 600, cursor: 'pointer',
        }}
      >
        Continue
      </button>
    </div>
  );
}
