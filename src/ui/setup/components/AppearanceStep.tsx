import React from 'react';
import type { SetupState } from '../types';

interface Props {
  state: SetupState;
  onChange: (patch: Partial<SetupState['appearance']>) => void;
  onNext: () => void;
}

const ACCENT_COLORS = [
  { label: 'Fox Orange', value: '#E8672A' },
  { label: 'Ocean Blue', value: '#2A7BE8' },
  { label: 'Forest Green', value: '#2AB85A' },
  { label: 'Amethyst', value: '#8B2AE8' },
  { label: 'Rose', value: '#E82A6A' },
  { label: 'Sand', value: '#C8952A' },
];

const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light',  label: 'Light' },
  { value: 'dark',   label: 'Dark' },
] as const;

export default function AppearanceStep({ state, onChange, onNext }: Props) {
  return (
    <div>
      <h2 style={{ marginTop: 0, color: 'var(--fnc-text-primary)' }}>Appearance</h2>
      <p style={{ color: 'var(--fnc-text-secondary)', marginBottom: 24 }}>
        Customize how Fennec looks. You can change these anytime in Settings.
      </p>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--fnc-text-primary)' }}>Theme</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {THEMES.map(t => (
            <button
              key={t.value}
              onClick={() => onChange({ theme: t.value })}
              style={{
                padding: '10px 20px', borderRadius: 8, border: '2px solid',
                borderColor: state.appearance.theme === t.value ? 'var(--fnc-accent)' : 'var(--fnc-border)',
                background: state.appearance.theme === t.value ? 'var(--fnc-accent)' : 'var(--fnc-surface-1)',
                color: state.appearance.theme === t.value ? '#fff' : 'var(--fnc-text-primary)',
                cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--fnc-text-primary)' }}>Accent color</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {ACCENT_COLORS.map(c => (
            <button
              key={c.value}
              title={c.label}
              onClick={() => onChange({ accentColor: c.value })}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: '3px solid',
                borderColor: state.appearance.accentColor === c.value ? 'var(--fnc-text-primary)' : 'transparent',
                background: c.value, cursor: 'pointer', padding: 0,
              }}
            />
          ))}
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
