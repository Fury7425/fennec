import React from 'react';

interface WelcomeStepProps {
  onNext: () => void;
}

function FennecLogo(): React.ReactElement {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Fennec fox logo"
    >
      {/* Left ear */}
      <path
        d="M8 8 L20 36 L28 26 Z"
        fill="var(--fnc-accent)"
        opacity="0.85"
      />
      {/* Right ear */}
      <path
        d="M64 8 L52 36 L44 26 Z"
        fill="var(--fnc-accent)"
        opacity="0.85"
      />
      {/* Head */}
      <ellipse
        cx="36"
        cy="42"
        rx="22"
        ry="20"
        fill="var(--fnc-color-fox-400)"
      />
      {/* Face highlight */}
      <ellipse
        cx="36"
        cy="46"
        rx="13"
        ry="11"
        fill="var(--fnc-color-sand-100)"
      />
      {/* Left eye */}
      <circle cx="29" cy="40" r="2.5" fill="var(--fnc-color-slate-800)" />
      {/* Right eye */}
      <circle cx="43" cy="40" r="2.5" fill="var(--fnc-color-slate-800)" />
      {/* Nose */}
      <ellipse cx="36" cy="47" rx="2" ry="1.5" fill="var(--fnc-color-slate-700)" />
    </svg>
  );
}

interface PillarProps {
  icon: string;
  title: string;
  description: string;
}

function Pillar({ icon, title, description }: PillarProps): React.ReactElement {
  const style: React.CSSProperties = {
    display:      'flex',
    alignItems:   'flex-start',
    gap:          'var(--fnc-space-3)',
    padding:      'var(--fnc-space-4)',
    borderRadius: 'var(--fnc-radius-lg)',
    background:   'var(--fnc-surface-sunken)',
  };
  return (
    <div style={style}>
      <span style={{ fontSize: '20px', lineHeight: '1', marginTop: '1px' }}>{icon}</span>
      <div>
        <div style={{
          fontWeight: 'var(--fnc-weight-semibold)' as React.CSSProperties['fontWeight'],
          fontSize:   'var(--fnc-text-sm)',
          color:      'var(--fnc-text-primary)',
          marginBottom: 'var(--fnc-space-1)',
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 'var(--fnc-text-sm)',
          color:    'var(--fnc-text-secondary)',
          lineHeight: 'var(--fnc-leading-normal)',
        }}>
          {description}
        </div>
      </div>
    </div>
  );
}

export function WelcomeStep({ onNext }: WelcomeStepProps): React.ReactElement {
  const bodyStyle: React.CSSProperties = {
    padding:       'var(--fnc-space-8) var(--fnc-space-8)',
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    textAlign:     'center',
  };

  const buttonStyle: React.CSSProperties = {
    marginTop:     'var(--fnc-space-8)',
    padding:       `var(--fnc-space-3) var(--fnc-space-8)`,
    background:    'var(--fnc-accent)',
    color:         'var(--fnc-accent-on)',
    border:        'none',
    borderRadius:  'var(--fnc-radius-full)',
    fontSize:      'var(--fnc-text-md)',
    fontWeight:    'var(--fnc-weight-semibold)' as React.CSSProperties['fontWeight'],
    fontFamily:    'var(--fnc-font-sans)',
    cursor:        'pointer',
    transition:    `background var(--fnc-duration-quick) var(--fnc-ease-out)`,
    width:         '100%',
  };

  return (
    <div style={bodyStyle}>
      <FennecLogo />

      <h1 style={{
        marginTop:    'var(--fnc-space-5)',
        marginBottom: 'var(--fnc-space-2)',
        fontSize:     'var(--fnc-text-3xl)',
        fontWeight:   'var(--fnc-weight-bold)' as React.CSSProperties['fontWeight'],
        color:        'var(--fnc-text-primary)',
        letterSpacing: 'var(--fnc-tracking-tight)',
      }}>
        Fennec
      </h1>

      <p style={{
        fontSize:   'var(--fnc-text-md)',
        color:      'var(--fnc-text-secondary)',
        margin:     '0 0 var(--fnc-space-8)',
        lineHeight: 'var(--fnc-leading-normal)',
      }}>
        Small ears. Big awareness.
      </p>

      <div style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           'var(--fnc-space-3)',
        width:         '100%',
        textAlign:     'left',
      }}>
        <Pillar
          icon="👂"
          title="Transparency"
          description="Every network request your browser makes is visible to you — including Fennec's own. Nothing is hidden."
        />
        <Pillar
          icon="🦊"
          title="Privacy"
          description="Strong defaults: no trackers, no telemetry, no Google. You decide what leaves your device."
        />
      </div>

      <button
        style={buttonStyle}
        onClick={onNext}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--fnc-accent-hover)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--fnc-accent)';
        }}
      >
        Get started
      </button>
    </div>
  );
}
