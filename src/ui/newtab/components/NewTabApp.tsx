import React, { useEffect, useState } from 'react';

// ── Helpers ────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface PrivacyStats {
  blockersToday: number;
  requestsToday: number;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: boolean;
}): React.ReactElement {
  return (
    <div style={{
      background:   'var(--fnc-surface-raised)',
      borderRadius: 'var(--fnc-radius-xl)',
      padding:      'var(--fnc-space-4) var(--fnc-space-6)',
      textAlign:    'center',
      boxShadow:    'var(--fnc-shadow-xs)',
      border:       '1px solid var(--fnc-border-subtle)',
      minWidth:     '130px',
    }}>
      <div style={{
        fontSize:   'var(--fnc-text-3xl)',
        fontWeight: 'var(--fnc-weight-bold)' as React.CSSProperties['fontWeight'],
        color:      accent ? 'var(--fnc-accent)' : 'var(--fnc-text-primary)',
        lineHeight: 1,
      }}>
        {value.toLocaleString()}
      </div>
      <div style={{
        marginTop:     'var(--fnc-space-1)',
        fontSize:      'var(--fnc-text-xs)',
        color:         'var(--fnc-text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--fnc-tracking-wide)',
      }}>
        {label}
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactElement;
  label: string;
}): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            'var(--fnc-space-2)',
        padding:        'var(--fnc-space-4) var(--fnc-space-5)',
        borderRadius:   'var(--fnc-radius-xl)',
        background:     hovered ? 'var(--fnc-surface-raised)' : 'transparent',
        border:         `1px solid ${hovered ? 'var(--fnc-border-default)' : 'var(--fnc-border-subtle)'}`,
        textDecoration: 'none',
        color:          hovered ? 'var(--fnc-text-primary)' : 'var(--fnc-text-secondary)',
        fontSize:       'var(--fnc-text-xs)',
        cursor:         'pointer',
        minWidth:       '80px',
        transition:     `background var(--fnc-duration-quick) var(--fnc-ease-out),
                         border-color var(--fnc-duration-quick) var(--fnc-ease-out),
                         color var(--fnc-duration-quick) var(--fnc-ease-out)`,
      }}
    >
      {icon}
      <span style={{ fontWeight: 'var(--fnc-weight-medium)' as React.CSSProperties['fontWeight'] }}>
        {label}
      </span>
    </a>
  );
}

// Search icon SVG
function SearchIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="var(--fnc-text-tertiary)" strokeWidth="1.5" />
      <path
        d="M10.5 10.5L13.5 13.5"
        stroke="var(--fnc-text-tertiary)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Journal ear icon
function JournalIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 3 C4 3 2 8 4 12 C6 16 10 16 10 16 C10 16 14 16 16 12 C18 8 16 3 16 3"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M7 8 C7 8 8 10 10 10 C12 10 13 8 13 8"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// Settings gear icon
function SettingsIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function NewTabApp(): React.ReactElement {
  const [time, setTime] = useState(new Date());
  const [stats, setStats] = useState<PrivacyStats>({ blockersToday: 0, requestsToday: 0 });
  const [searchHovered, setSearchHovered] = useState(false);

  // Clock tick
  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  // Privacy stats
  useEffect(() => {
    const bridge = window.__fennec?.newtab;
    if (bridge) {
      try {
        const s = JSON.parse(bridge.getPrivacyStats()) as PrivacyStats;
        setStats(s);
      } catch { /* ignore */ }
    } else {
      // Development mock
      setStats({ blockersToday: 37, requestsToday: 204 });
    }
  }, []);

  function handleSearchClick(): void {
    window.__fennec?.newtab?.focusOmnibox();
  }

  return (
    <div style={{
      minHeight:      '100vh',
      background:     'var(--fnc-surface-base)',
      color:          'var(--fnc-text-primary)',
      fontFamily:     'var(--fnc-font-sans)',
      fontSize:       'var(--fnc-text-base)',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            'var(--fnc-space-10)',
      padding:        'var(--fnc-space-8)',
    }}>
      {/* Clock + greeting */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize:      'var(--fnc-text-5xl)',
          fontWeight:    'var(--fnc-weight-bold)' as React.CSSProperties['fontWeight'],
          letterSpacing: 'var(--fnc-tracking-tight)',
          color:         'var(--fnc-text-primary)',
          lineHeight:    1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatTime(time)}
        </div>
        <div style={{
          marginTop:  'var(--fnc-space-2)',
          fontSize:   'var(--fnc-text-lg)',
          color:      'var(--fnc-text-secondary)',
          fontWeight: 'var(--fnc-weight-medium)' as React.CSSProperties['fontWeight'],
        }}>
          {getGreeting()}
        </div>
      </div>

      {/* Search bar */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Search or enter address"
        onClick={handleSearchClick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleSearchClick(); }}
        onMouseEnter={() => setSearchHovered(true)}
        onMouseLeave={() => setSearchHovered(false)}
        style={{
          width:        '100%',
          maxWidth:     '560px',
          height:       '48px',
          borderRadius: 'var(--fnc-radius-full)',
          background:   'var(--fnc-surface-raised)',
          border:       `1px solid ${searchHovered ? 'var(--fnc-border-focus)' : 'var(--fnc-border-subtle)'}`,
          boxShadow:    searchHovered ? 'var(--fnc-shadow-focus)' : 'var(--fnc-shadow-sm)',
          display:      'flex',
          alignItems:   'center',
          padding:      '0 var(--fnc-space-5)',
          gap:          'var(--fnc-space-3)',
          cursor:       'text',
          transition:   `border-color var(--fnc-duration-quick) var(--fnc-ease-out),
                         box-shadow var(--fnc-duration-quick) var(--fnc-ease-out)`,
        }}
      >
        <SearchIcon />
        <span style={{
          fontSize: 'var(--fnc-text-base)',
          color:    'var(--fnc-text-tertiary)',
          flex:     1,
        }}>
          Search or enter address
        </span>
        <span style={{
          fontSize:      'var(--fnc-text-xs)',
          color:         'var(--fnc-text-disabled)',
          fontFamily:    'var(--fnc-font-mono)',
          background:    'var(--fnc-surface-sunken)',
          padding:       '2px 6px',
          borderRadius:  'var(--fnc-radius-sm)',
          border:        '1px solid var(--fnc-border-subtle)',
        }}>
          ⌘L
        </span>
      </div>

      {/* Privacy stats */}
      <div style={{ display: 'flex', gap: 'var(--fnc-space-4)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <StatCard value={stats.blockersToday} label="blocked today" accent />
        <StatCard value={stats.requestsToday} label="requests today" />
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', gap: 'var(--fnc-space-3)' }}>
        <QuickLink href="fennec://journal"  icon={<JournalIcon />}  label="Journal" />
        <QuickLink href="fennec://settings" icon={<SettingsIcon />} label="Settings" />
      </div>
    </div>
  );
}
