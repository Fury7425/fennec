import React, { useEffect, useState } from 'react';
import type { SettingsSection, SettingsSnapshot } from '../types';

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: SettingsSnapshot = {
  blockThirdPartyCookies: true,
  httpsOnly:              true,
  webrtcProtection:       true,
  noPasswordManager:      true,
  enableUpdates:          false,
  enableFilterRefresh:    false,
  enableModsRegistry:     false,
  enableCwsProxy:         false,
  theme:                  'system',
  accentColor:            '#e8780f',
};

// ── Shared building blocks ─────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width:        '44px',
        height:       '24px',
        borderRadius: '12px',
        border:       'none',
        cursor:       disabled ? 'default' : 'pointer',
        background:   checked ? 'var(--fnc-accent)' : 'var(--fnc-border-default)',
        position:     'relative',
        flexShrink:   0,
        transition:   'background var(--fnc-duration-quick) var(--fnc-ease-out)',
        opacity:      disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position:     'absolute',
        top:          '2px',
        left:         checked ? '22px' : '2px',
        width:        '20px',
        height:       '20px',
        borderRadius: '50%',
        background:   '#fff',
        boxShadow:    '0 1px 3px rgba(0,0,0,0.2)',
        transition:   'left var(--fnc-duration-quick) var(--fnc-ease-out)',
        display:      'block',
      }} />
    </button>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{
      display:         'flex',
      justifyContent:  'space-between',
      alignItems:      'center',
      gap:             'var(--fnc-space-6)',
      padding:         'var(--fnc-space-4) 0',
      borderBottom:    '1px solid var(--fnc-border-subtle)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 'var(--fnc-weight-medium)' as React.CSSProperties['fontWeight'],
          fontSize:   'var(--fnc-text-base)',
          color:      'var(--fnc-text-primary)',
        }}>
          {label}
        </div>
        {description && (
          <div style={{
            fontSize:   'var(--fnc-text-sm)',
            color:      'var(--fnc-text-secondary)',
            marginTop:  'var(--fnc-space-1)',
            lineHeight: 'var(--fnc-leading-normal)',
          }}>
            {description}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <h2 style={{
      fontSize:      'var(--fnc-text-xl)',
      fontWeight:    'var(--fnc-weight-semibold)' as React.CSSProperties['fontWeight'],
      color:         'var(--fnc-text-primary)',
      margin:        `0 0 var(--fnc-space-1)`,
      letterSpacing: 'var(--fnc-tracking-tight)',
    }}>
      {children}
    </h2>
  );
}

function SectionSubtitle({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <p style={{
      fontSize:     'var(--fnc-text-sm)',
      color:        'var(--fnc-text-secondary)',
      margin:       `0 0 var(--fnc-space-6)`,
      lineHeight:   'var(--fnc-leading-relaxed)',
    }}>
      {children}
    </p>
  );
}

// ── Sections ───────────────────────────────────────────────────────────────

function PrivacySection({
  settings,
  onChange,
}: {
  settings: SettingsSnapshot;
  onChange: <K extends keyof SettingsSnapshot>(key: K, value: SettingsSnapshot[K]) => void;
}): React.ReactElement {
  return (
    <div>
      <SectionTitle>Privacy</SectionTitle>
      <SectionSubtitle>
        Fennec's privacy defaults. All settings apply immediately.
      </SectionSubtitle>

      <SettingRow
        label="Block third-party cookies"
        description="Prevents advertisers and trackers from following you across sites."
      >
        <Toggle
          checked={settings.blockThirdPartyCookies}
          onChange={v => onChange('blockThirdPartyCookies', v)}
        />
      </SettingRow>

      <SettingRow
        label="HTTPS-only mode"
        description="Automatically upgrades connections to HTTPS where available. Warns you when a site cannot be upgraded."
      >
        <Toggle
          checked={settings.httpsOnly}
          onChange={v => onChange('httpsOnly', v)}
        />
      </SettingRow>

      <SettingRow
        label="WebRTC IP protection"
        description="Prevents websites from detecting your local IP address via WebRTC."
      >
        <Toggle
          checked={settings.webrtcProtection}
          onChange={v => onChange('webrtcProtection', v)}
        />
      </SettingRow>

      <SettingRow
        label="Disable built-in password manager"
        description="Use a dedicated password manager (1Password, Bitwarden, etc.) instead of the browser's built-in one."
      >
        <Toggle
          checked={settings.noPasswordManager}
          onChange={v => onChange('noPasswordManager', v)}
        />
      </SettingRow>
    </div>
  );
}

const SERVICE_DEFS = [
  {
    key:         'enableUpdates' as const,
    title:       'Automatic updates',
    description: 'Checks for new Fennec releases and notifies you when one is available.',
    server:      'updates.fennec.computer',
    what:        'Sends your current Fennec version and platform. No user ID.',
  },
  {
    key:         'enableFilterRefresh' as const,
    title:       'uBlock filter list auto-refresh',
    description: 'Refreshes the EasyList, EasyPrivacy, and uBO filter lists weekly.',
    server:      'cdn.jsdelivr.net, easylist.to',
    what:        'Fetches public filter list files. No cookies, no user data sent.',
  },
  {
    key:         'enableModsRegistry' as const,
    title:       'Mods registry',
    description: 'Allows browsing and installing community Mods from the Fennec Mods directory.',
    server:      'mods.fennec.computer',
    what:        'Fetches a public JSON index. No user data sent.',
  },
  {
    key:         'enableCwsProxy' as const,
    title:       'Anonymised extension proxy',
    description: 'Routes Chrome Web Store extension installs through the Fennec proxy to remove Google identifiers.',
    server:      'cws-proxy.fennec.computer',
    what:        'Proxies the extension download. Strips your IP from Google\'s logs.',
  },
] as const;

function ServicesSection({
  settings,
  onChange,
}: {
  settings: SettingsSnapshot;
  onChange: <K extends keyof SettingsSnapshot>(key: K, value: SettingsSnapshot[K]) => void;
}): React.ReactElement {
  return (
    <div>
      <SectionTitle>Services</SectionTitle>
      <SectionSubtitle>
        Fennec works fully offline. Each service below makes network calls —
        opt in only to what you want.
      </SectionSubtitle>

      {SERVICE_DEFS.map(svc => (
        <SettingRow
          key={svc.key}
          label={svc.title}
          description={svc.description}
        >
          <Toggle
            checked={settings[svc.key]}
            onChange={v => onChange(svc.key, v)}
          />
        </SettingRow>
      ))}

      {/* Extra detail for each service */}
      <div style={{
        marginTop:    'var(--fnc-space-6)',
        background:   'var(--fnc-surface-sunken)',
        borderRadius: 'var(--fnc-radius-lg)',
        overflow:     'hidden',
      }}>
        {SERVICE_DEFS.map((svc, i) => (
          <div
            key={svc.key}
            style={{
              padding:      'var(--fnc-space-3) var(--fnc-space-4)',
              borderBottom: i < SERVICE_DEFS.length - 1
                ? '1px solid var(--fnc-border-subtle)'
                : 'none',
              display:      'flex',
              gap:          'var(--fnc-space-4)',
              alignItems:   'baseline',
            }}
          >
            <span style={{
              fontWeight:  'var(--fnc-weight-medium)' as React.CSSProperties['fontWeight'],
              fontSize:    'var(--fnc-text-sm)',
              color:       'var(--fnc-text-secondary)',
              flexShrink:  0,
              minWidth:    '140px',
            }}>
              {svc.title}
            </span>
            <span style={{ fontSize: 'var(--fnc-text-sm)', color: 'var(--fnc-text-tertiary)' }}>
              <code style={{
                fontFamily:   'var(--fnc-font-mono)',
                fontSize:     '11px',
                background:   'var(--fnc-surface-overlay)',
                padding:      '1px 5px',
                borderRadius: 'var(--fnc-radius-xs)',
              }}>
                {svc.server}
              </code>
              {' — '}{svc.what}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ACCENT_COLORS = [
  { label: 'Fox Orange', value: '#e8780f' },
  { label: 'Ocean Blue', value: '#2a7be8' },
  { label: 'Forest Green', value: '#2ab85a' },
  { label: 'Amethyst', value: '#8b2ae8' },
  { label: 'Rose', value: '#e82a6a' },
  { label: 'Sand', value: '#c8952a' },
];

const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light',  label: 'Light' },
  { value: 'dark',   label: 'Dark' },
] as const;

function AppearanceSection({
  settings,
  onChange,
}: {
  settings: SettingsSnapshot;
  onChange: <K extends keyof SettingsSnapshot>(key: K, value: SettingsSnapshot[K]) => void;
}): React.ReactElement {
  return (
    <div>
      <SectionTitle>Appearance</SectionTitle>
      <SectionSubtitle>
        Customize how Fennec looks. Changes apply immediately.
      </SectionSubtitle>

      <SettingRow label="Theme">
        <div style={{ display: 'flex', gap: 'var(--fnc-space-2)' }}>
          {THEMES.map(t => {
            const active = settings.theme === t.value;
            return (
              <button
                key={t.value}
                onClick={() => onChange('theme', t.value)}
                style={{
                  padding:      'var(--fnc-space-2) var(--fnc-space-4)',
                  borderRadius: 'var(--fnc-radius-md)',
                  border:       `1px solid ${active ? 'var(--fnc-accent)' : 'var(--fnc-border-default)'}`,
                  background:   active ? 'var(--fnc-accent)' : 'var(--fnc-surface-raised)',
                  color:        active ? 'var(--fnc-accent-on)' : 'var(--fnc-text-secondary)',
                  cursor:       'pointer',
                  fontSize:     'var(--fnc-text-sm)',
                  fontFamily:   'var(--fnc-font-sans)',
                  fontWeight:   active
                    ? 'var(--fnc-weight-medium)' as React.CSSProperties['fontWeight']
                    : undefined,
                  transition:   'all var(--fnc-duration-quick) var(--fnc-ease-out)',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </SettingRow>

      <SettingRow
        label="Accent color"
        description="Used for buttons, active states, and highlights."
      >
        <div style={{ display: 'flex', gap: 'var(--fnc-space-2)' }}>
          {ACCENT_COLORS.map(c => {
            const active = settings.accentColor === c.value;
            return (
              <button
                key={c.value}
                title={c.label}
                onClick={() => onChange('accentColor', c.value)}
                style={{
                  width:        '28px',
                  height:       '28px',
                  borderRadius: 'var(--fnc-radius-full)',
                  border:       active
                    ? '3px solid var(--fnc-text-primary)'
                    : '2px solid transparent',
                  background:   c.value,
                  cursor:       'pointer',
                  padding:      0,
                  boxShadow:    active ? 'var(--fnc-shadow-sm)' : 'none',
                  transition:   'border var(--fnc-duration-quick) var(--fnc-ease-out)',
                }}
                aria-pressed={active}
                aria-label={c.label}
              />
            );
          })}
        </div>
      </SettingRow>
    </div>
  );
}

function AboutSection({ version }: { version: string }): React.ReactElement {
  const infoRowStyle: React.CSSProperties = {
    display:      'flex',
    justifyContent: 'space-between',
    alignItems:   'center',
    padding:      'var(--fnc-space-3) 0',
    borderBottom: '1px solid var(--fnc-border-subtle)',
    fontSize:     'var(--fnc-text-sm)',
  };

  return (
    <div>
      <SectionTitle>About</SectionTitle>
      <SectionSubtitle>
        Fennec — A browser that respects you.
      </SectionSubtitle>

      <div style={{
        background:   'var(--fnc-surface-raised)',
        borderRadius: 'var(--fnc-radius-xl)',
        padding:      'var(--fnc-space-1) var(--fnc-space-5)',
        border:       '1px solid var(--fnc-border-subtle)',
        marginBottom: 'var(--fnc-space-6)',
      }}>
        <div style={infoRowStyle}>
          <span style={{ color: 'var(--fnc-text-secondary)' }}>Version</span>
          <span style={{
            color:      'var(--fnc-text-primary)',
            fontFamily: 'var(--fnc-font-mono)',
            fontSize:   'var(--fnc-text-xs)',
          }}>
            {version}
          </span>
        </div>
        <div style={infoRowStyle}>
          <span style={{ color: 'var(--fnc-text-secondary)' }}>Based on</span>
          <span style={{ color: 'var(--fnc-text-primary)' }}>Chromium 124 + ungoogled patches</span>
        </div>
        <div style={infoRowStyle}>
          <span style={{ color: 'var(--fnc-text-secondary)' }}>License</span>
          <span style={{ color: 'var(--fnc-text-primary)' }}>GPL-3.0</span>
        </div>
        <div style={{ ...infoRowStyle, borderBottom: 'none' }}>
          <span style={{ color: 'var(--fnc-text-secondary)' }}>Source code</span>
          <a
            href="https://github.com/fennec-browser/fennec"
            style={{ color: 'var(--fnc-text-link)', textDecoration: 'none', fontFamily: 'var(--fnc-font-mono)', fontSize: '11px' }}
            target="_blank"
            rel="noreferrer"
          >
            github.com/fennec-browser/fennec
          </a>
        </div>
      </div>

      <div style={{
        display:      'flex',
        gap:          'var(--fnc-space-3)',
        flexWrap:     'wrap',
      }}>
        {[
          { label: 'Privacy Policy',   href: 'https://fennec.computer/privacy' },
          { label: 'Open-source Licences', href: 'fennec://credits' },
          { label: 'Report a bug',     href: 'https://github.com/fennec-browser/fennec/issues' },
        ].map(link => (
          <a
            key={link.href}
            href={link.href}
            style={{
              fontSize:       'var(--fnc-text-sm)',
              color:          'var(--fnc-text-link)',
              textDecoration: 'none',
            }}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Nav item ───────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: SettingsSection; label: string; icon: string }[] = [
  { id: 'privacy',    label: 'Privacy',    icon: '🔒' },
  { id: 'services',   label: 'Services',   icon: '🌐' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'about',      label: 'About',      icon: 'ℹ️' },
];

function NavItem({
  item,
  active,
  onClick,
}: {
  item: typeof NAV_ITEMS[number];
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={active ? 'page' : undefined}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          'var(--fnc-space-3)',
        width:        '100%',
        padding:      `var(--fnc-space-2) var(--fnc-space-3)`,
        border:       'none',
        borderRadius: 'var(--fnc-radius-md)',
        background:   active
          ? 'var(--fnc-state-selected)'
          : hovered
            ? 'var(--fnc-state-hover)'
            : 'transparent',
        color:        active ? 'var(--fnc-accent)' : 'var(--fnc-text-secondary)',
        fontFamily:   'var(--fnc-font-sans)',
        fontSize:     'var(--fnc-text-sm)',
        fontWeight:   active
          ? 'var(--fnc-weight-medium)' as React.CSSProperties['fontWeight']
          : undefined,
        cursor:       'pointer',
        textAlign:    'left',
        transition:   'background var(--fnc-duration-fast) var(--fnc-ease-out), color var(--fnc-duration-fast) var(--fnc-ease-out)',
      }}
    >
      <span style={{ fontSize: '16px', lineHeight: 1 }}>{item.icon}</span>
      {item.label}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function SettingsApp(): React.ReactElement {
  const [activeSection, setActiveSection] = useState<SettingsSection>('privacy');
  const [settings, setSettings] = useState<SettingsSnapshot>(DEFAULT_SETTINGS);
  const [version, setVersion] = useState('1.0.0');

  useEffect(() => {
    const bridge = window.__fennec?.settings;
    if (bridge) {
      try {
        const snap = JSON.parse(bridge.getAll()) as SettingsSnapshot;
        setSettings(snap);
        setVersion(bridge.getVersion());
      } catch { /* ignore */ }
    }
    // else: use DEFAULT_SETTINGS (development mode)
  }, []);

  function handleChange<K extends keyof SettingsSnapshot>(
    key: K,
    value: SettingsSnapshot[K],
  ): void {
    setSettings(prev => ({ ...prev, [key]: value }));
    window.__fennec?.settings?.set(key, value as string | boolean | number);
  }

  const rootStyle: React.CSSProperties = {
    display:    'flex',
    height:     '100vh',
    background: 'var(--fnc-surface-base)',
    color:      'var(--fnc-text-primary)',
    fontFamily: 'var(--fnc-font-sans)',
    fontSize:   'var(--fnc-text-base)',
    overflow:   'hidden',
  };

  const navStyle: React.CSSProperties = {
    width:        '200px',
    flexShrink:   0,
    background:   'var(--fnc-surface-sidebar)',
    borderRight:  '1px solid var(--fnc-border-subtle)',
    display:      'flex',
    flexDirection:'column',
    padding:      'var(--fnc-space-4) var(--fnc-space-2)',
    overflowY:    'auto',
  };

  const navHeaderStyle: React.CSSProperties = {
    display:      'flex',
    alignItems:   'center',
    gap:          'var(--fnc-space-2)',
    padding:      `var(--fnc-space-2) var(--fnc-space-3) var(--fnc-space-5)`,
    fontSize:     'var(--fnc-text-md)',
    fontWeight:   'var(--fnc-weight-semibold)' as React.CSSProperties['fontWeight'],
    color:        'var(--fnc-text-primary)',
    letterSpacing:'var(--fnc-tracking-tight)',
  };

  const contentStyle: React.CSSProperties = {
    flex:      1,
    overflowY: 'auto',
    padding:   'var(--fnc-space-10) var(--fnc-space-12)',
    maxWidth:  '680px',
  };

  return (
    <div style={rootStyle}>
      {/* Nav */}
      <nav style={navStyle} aria-label="Settings sections">
        <div style={navHeaderStyle}>
          <span>⚙️</span> Settings
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--fnc-space-1)' }}>
          {NAV_ITEMS.map(item => (
            <NavItem
              key={item.id}
              item={item}
              active={item.id === activeSection}
              onClick={() => setActiveSection(item.id)}
            />
          ))}
        </div>
      </nav>

      {/* Content */}
      <main style={contentStyle}>
        {activeSection === 'privacy' && (
          <PrivacySection settings={settings} onChange={handleChange} />
        )}
        {activeSection === 'services' && (
          <ServicesSection settings={settings} onChange={handleChange} />
        )}
        {activeSection === 'appearance' && (
          <AppearanceSection settings={settings} onChange={handleChange} />
        )}
        {activeSection === 'about' && (
          <AboutSection version={version} />
        )}
      </main>
    </div>
  );
}
