interface PrivacyState {
  blockThirdPartyCookies: boolean;
  httpsOnly:              boolean;
  webrtcProtection:       boolean;
  noPasswordManager:      boolean;
}

interface Props {
  state: { privacy?: PrivacyState };
  onChange: (patch: Partial<PrivacyState>) => void;
  onNext: () => void;
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 0', borderBottom: '1px solid var(--fnc-border)' }}>
      <div style={{ flex: 1, marginRight: 24 }}>
        <div style={{ fontWeight: 600, color: 'var(--fnc-text-primary)', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--fnc-text-secondary)' }}>{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: checked ? 'var(--fnc-accent)' : 'var(--fnc-surface-2)',
          position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

export default function PrivacyStep({ state, onChange, onNext }: Props) {
  return (
    <div>
      <h2 style={{ marginTop: 0, color: 'var(--fnc-text-primary)' }}>Privacy defaults</h2>
      <p style={{ color: 'var(--fnc-text-secondary)', marginBottom: 24 }}>
        All settings can be changed later in Settings. These are Fennec's recommended defaults.
      </p>

      <ToggleRow
        label="Block third-party cookies"
        description="Prevents advertisers and trackers from following you across sites."
        checked={state.privacy?.blockThirdPartyCookies ?? true}
        onChange={v => onChange({ blockThirdPartyCookies: v })}
      />
      <ToggleRow
        label="HTTPS-only mode"
        description="Automatically upgrades connections to HTTPS where available."
        checked={state.privacy?.httpsOnly ?? true}
        onChange={v => onChange({ httpsOnly: v })}
      />
      <ToggleRow
        label="WebRTC IP protection"
        description="Prevents websites from detecting your local IP address via WebRTC."
        checked={state.privacy?.webrtcProtection ?? true}
        onChange={v => onChange({ webrtcProtection: v })}
      />
      <ToggleRow
        label="Disable built-in password manager"
        description="Use a dedicated password manager instead of the browser's built-in one."
        checked={state.privacy?.noPasswordManager ?? true}
        onChange={v => onChange({ noPasswordManager: v })}
      />

      <button
        onClick={onNext}
        style={{
          marginTop: 32, padding: '12px 32px', background: 'var(--fnc-accent)',
          color: '#fff', border: 'none', borderRadius: 8, fontSize: '1rem',
          fontWeight: 600, cursor: 'pointer',
        }}
      >
        Continue
      </button>
    </div>
  );
}
