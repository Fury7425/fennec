import React from 'react';
import type { SetupState } from '../types';

interface Props {
  state: SetupState;
  onFinish: () => void;
}

export default function DoneStep({ state, onFinish }: Props) {
  const summaryItems = [
    { label: 'Third-party cookies', value: state.privacy.blockThirdPartyCookies ? 'Blocked' : 'Allowed' },
    { label: 'HTTPS-only mode',     value: state.privacy.httpsOnly ? 'Enabled' : 'Disabled' },
    { label: 'WebRTC protection',   value: state.privacy.webrtcProtection ? 'Enabled' : 'Disabled' },
    { label: 'Password manager',    value: state.privacy.noPasswordManager ? 'Disabled' : 'Enabled' },
    { label: 'Sync',                value: state.services.enableSync ? 'Enabled' : 'Off' },
    { label: 'Auto-updates',        value: state.services.enableUpdates ? 'Enabled' : 'Off' },
    { label: 'Theme',               value: state.appearance.theme.charAt(0).toUpperCase() + state.appearance.theme.slice(1) },
  ];

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>&#x2713;</div>
      <h2 style={{ marginTop: 0, color: 'var(--fnc-text-primary)' }}>You're all set!</h2>
      <p style={{ color: 'var(--fnc-text-secondary)', marginBottom: 28 }}>
        Here's a summary of your configuration:
      </p>

      <div style={{ textAlign: 'left', background: 'var(--fnc-surface-1)', borderRadius: 12, padding: 20, marginBottom: 32 }}>
        {summaryItems.map(item => (
          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--fnc-border)' }}>
            <span style={{ color: 'var(--fnc-text-secondary)' }}>{item.label}</span>
            <span style={{ fontWeight: 600, color: 'var(--fnc-text-primary)' }}>{item.value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onFinish}
        style={{
          padding: '14px 40px', background: 'var(--fnc-accent)',
          color: '#fff', border: 'none', borderRadius: 8, fontSize: '1.1rem',
          fontWeight: 700, cursor: 'pointer',
        }}
      >
        Start browsing
      </button>
    </div>
  );
}
