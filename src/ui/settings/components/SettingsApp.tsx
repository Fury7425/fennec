import React, { useEffect, useMemo, useRef, useState } from 'react';
import { archiveFromFile, createArchiveDownload, createLayoutPresetArchive, installModArchive, loadInstalledMods, subscribeInstalledMods, toggleInstalledMod, uninstallInstalledMod } from '../../shared/mods';
import { BUILT_IN_LAYOUT_PRESETS, loadLayoutConfig, loadLayoutPresets, saveCustomLayoutPreset, saveLayoutConfig, subscribeToLayoutConfig } from '../../shared/layout';
import { FONT_OPTIONS, THEME_DEFAULTS, THEME_TOKEN_DEFINITIONS, getDefaultThemeTokens, loadThemeTokens, resetAllThemeTokens, saveThemeTokens, subscribeToThemeTokens } from '../../shared/theme';
import { initializeSurfaceRuntime } from '../../shared/page-runtime';
import { DEFAULT_SETTINGS_SNAPSHOT, loadSettingsSnapshot, saveSettingsSnapshot, subscribeToSettingsSnapshot, updateSettingsSnapshot } from '../../shared/settings-store';
import type { FennecLayoutConfig, FennecThemeTokenKey, FennecThemeTokens, InstalledMod, LayoutPreset, SettingsSnapshot } from '../../shared/models';
import type { SettingsSection } from '../types';

const NAV_ITEMS: Array<{ id: SettingsSection; label: string; description: string }> = [
  { id: 'privacy', label: 'Privacy', description: 'Core protections and defaults.' },
  { id: 'services', label: 'Services', description: 'Opt-in network services.' },
  { id: 'appearance', label: 'Appearance', description: 'Theme tokens and live preview.' },
  { id: 'layout', label: 'Layout', description: 'Move the shell without code.' },
  { id: 'mods', label: 'Mods', description: 'Install, enable, or remove Mods.' },
  { id: 'about', label: 'About', description: 'Version and project state.' },
];

const DEFAULT_PRESET_NAME = 'My Layout';

function themeTokensToStyle(tokens: FennecThemeTokens): React.CSSProperties {
  return Object.fromEntries(Object.entries(tokens)) as React.CSSProperties;
}

function withToken(tokens: FennecThemeTokens, key: FennecThemeTokenKey, value: string): FennecThemeTokens {
  return { ...tokens, [key]: value };
}

function labelForValue(value: string): string {
  return value.replaceAll('-', ' ');
}

function WorkspacePreviewPill({ label, color }: { label: string; color: string }): React.ReactElement {
  return (
    <span
      className="fennec-chip"
      style={{ background: color, borderColor: color, color: 'var(--fennec-color-bg-secondary)' }}
    >
      {label}
    </span>
  );
}

function AppearancePreview({ tokens }: { tokens: FennecThemeTokens }): React.ReactElement {
  const previewStyle = useMemo(() => themeTokensToStyle(tokens), [tokens]);

  return (
    <div className="fennec-card-strong" style={previewStyle}>
      <div className="fennec-heading" style={{ marginBottom: 'var(--fennec-space-3)' }}>
        <div className="fennec-stack-tight">
          <h3>Live shell preview</h3>
          <p className="fennec-subtle">Sidebar, active tab, workspace pill, and Journal row update in real time.</p>
        </div>
      </div>

      <div className="fennec-preview-window">
        <div className="fennec-preview-toolbar">
          <span className="fennec-badge">fennec://settings</span>
          <div className="fennec-input" style={{ display: 'flex', alignItems: 'center' }}>
            Search or enter address
          </div>
        </div>
        <div className="fennec-preview-body" data-sidebar-position={tokens['--fennec-sidebar-position']}>
          <div className="fennec-preview-sidebar">
            <WorkspacePreviewPill label="Research" color="var(--fennec-color-workspace-4)" />
            <div className="fennec-list-row" data-active="true">
              <span>Active tab</span>
              <span className="fennec-subtle">notes.md</span>
            </div>
            <div className="fennec-list-row">
              <span>Hover tab</span>
              <span className="fennec-subtle">example.com</span>
            </div>
          </div>
          <div className="fennec-preview-content">
            <div className="fennec-card">
              <div className="fennec-inline" style={{ justifyContent: 'space-between' }}>
                <strong>Workspace tint</strong>
                <WorkspacePreviewPill label="Focus" color="var(--fennec-color-workspace-2)" />
              </div>
            </div>
            <div className="fennec-preview-journal-row">
              <span>mods.fennec.computer/api/index.json</span>
              <span className="fennec-subtle">fennec-internal</span>
              <span>200</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeTokenEditor({
  tokens,
  onChange,
}: {
  tokens: FennecThemeTokens;
  onChange: (key: FennecThemeTokenKey, value: string) => void;
}): React.ReactElement {
  return (
    <div className="fennec-stack">
      {THEME_TOKEN_DEFINITIONS.map(definition => {
        const value = tokens[definition.key];

        return (
          <div key={definition.key} className="fennec-card">
            <div className="fennec-heading" style={{ marginBottom: 'var(--fennec-space-3)' }}>
              <div className="fennec-stack-tight">
                <h3>{definition.label}</h3>
                <p className="fennec-subtle">{definition.description}</p>
              </div>
              <button className="fennec-button" type="button" onClick={() => onChange(definition.key, THEME_DEFAULTS[definition.key])}>
                Reset token
              </button>
            </div>

            {definition.kind === 'color' && (
              <div className="fennec-grid two">
                <label className="fennec-stack-tight">
                  <span className="fennec-subtle">Color picker</span>
                  <input
                    className="fennec-input"
                    type="color"
                    value={value}
                    onChange={event => onChange(definition.key, event.target.value)}
                    style={{ padding: 'var(--fennec-space-2)' }}
                  />
                </label>
                <label className="fennec-stack-tight">
                  <span className="fennec-subtle">Hex value</span>
                  <input
                    className="fennec-input"
                    value={value}
                    onChange={event => onChange(definition.key, event.target.value)}
                  />
                </label>
              </div>
            )}

            {(definition.kind === 'size' || definition.kind === 'motion') && (
              <div className="fennec-grid two">
                <label className="fennec-stack-tight">
                  <span className="fennec-subtle">Adjust</span>
                  <input
                    className="fennec-slider"
                    type="range"
                    min={definition.min}
                    max={definition.max}
                    step={definition.step}
                    value={Number.parseFloat(value)}
                    onChange={event => onChange(definition.key, `${event.target.value}${definition.unit ?? 'px'}`)}
                  />
                </label>
                <label className="fennec-stack-tight">
                  <span className="fennec-subtle">Current value</span>
                  <input
                    className="fennec-input"
                    value={value}
                    onChange={event => onChange(definition.key, event.target.value)}
                  />
                </label>
              </div>
            )}

            {definition.kind === 'select' && (
              <div className="fennec-inline">
                {definition.options?.map(option => (
                  <button
                    key={option}
                    className="fennec-button"
                    data-active={value === option}
                    type="button"
                    onClick={() => onChange(definition.key, option)}
                  >
                    {labelForValue(option)}
                  </button>
                ))}
              </div>
            )}

            {definition.kind === 'font' && (
              <div className="fennec-grid two">
                <label className="fennec-stack-tight">
                  <span className="fennec-subtle">Suggested fonts</span>
                  <select
                    className="fennec-select"
                    value={FONT_OPTIONS.some(option => option.value === value) ? value : 'custom'}
                    onChange={event => {
                      if (event.target.value !== 'custom') {
                        onChange(definition.key, event.target.value);
                      }
                    }}
                  >
                    {FONT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label className="fennec-stack-tight">
                  <span className="fennec-subtle">Custom family</span>
                  <input
                    className="fennec-input"
                    value={value}
                    onChange={event => onChange(definition.key, event.target.value)}
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LayoutPreview({
  layout,
  onChange,
}: {
  layout: FennecLayoutConfig;
  onChange: (layout: FennecLayoutConfig) => void;
}): React.ReactElement {
  const [dragging, setDragging] = useState<'sidebar' | 'toolbar' | 'addressBar' | 'journalPanel' | null>(null);

  function update<K extends keyof FennecLayoutConfig>(key: K, value: FennecLayoutConfig[K]): void {
    onChange({ ...layout, [key]: value });
  }

  function updateSidebar(position: FennecLayoutConfig['sidebar']['position']): void {
    onChange({ ...layout, sidebar: { ...layout.sidebar, position } });
  }

  function handleDrop(kind: typeof dragging, value: string): void {
    if (kind === 'sidebar') {
      updateSidebar(value as FennecLayoutConfig['sidebar']['position']);
    }
    if (kind === 'toolbar') {
      update('toolbar', value as FennecLayoutConfig['toolbar']);
    }
    if (kind === 'addressBar') {
      update('addressBar', value as FennecLayoutConfig['addressBar']);
    }
    if (kind === 'journalPanel') {
      update('journalPanel', value as FennecLayoutConfig['journalPanel']);
    }
    setDragging(null);
  }

  return (
    <div className="fennec-stack">
      <div className="fennec-card-strong">
        <div className="fennec-heading" style={{ marginBottom: 'var(--fennec-space-3)' }}>
          <div className="fennec-stack-tight">
            <h3>Shell preview</h3>
            <p className="fennec-subtle">Drag a handle onto a zone or click a zone directly.</p>
          </div>
          <div className="fennec-inline">
            <button className="fennec-button" type="button" onClick={() => onChange({ ...layout, sidebar: { ...layout.sidebar, displayMode: layout.sidebar.displayMode === 'expanded' ? 'collapsed' : 'expanded' } })}>
              Sidebar: {layout.sidebar.displayMode}
            </button>
            <button className="fennec-button" type="button" onClick={() => onChange({ ...layout, splitViewDefault: !layout.splitViewDefault })}>
              Split view default: {layout.splitViewDefault ? 'on' : 'off'}
            </button>
          </div>
        </div>

        <div className="fennec-preview-window">
          {layout.toolbar !== 'hidden' && (
            <div className="fennec-preview-toolbar" style={{ order: layout.toolbar === 'bottom' ? 2 : 0 }}>
              <button className="fennec-badge" draggable onDragStart={() => setDragging('toolbar')} type="button">Toolbar</button>
              {layout.addressBar === 'top-center' && (
                <div className="fennec-input" style={{ display: 'flex', alignItems: 'center' }}>
                  Address bar
                </div>
              )}
            </div>
          )}
          <div className="fennec-preview-body" data-sidebar-position={layout.sidebar.position === 'hidden' ? 'left' : layout.sidebar.position}>
            {layout.sidebar.position !== 'hidden' && (
              <div
                className="fennec-preview-sidebar"
                style={{
                  width: layout.sidebar.displayMode === 'collapsed'
                    ? 'var(--fennec-sidebar-width-collapsed)'
                    : 'var(--fennec-sidebar-width-expanded)',
                  minWidth: layout.sidebar.displayMode === 'collapsed'
                    ? 'var(--fennec-sidebar-width-collapsed)'
                    : 'var(--fennec-sidebar-width-expanded)',
                }}
              >
                <button className="fennec-badge" draggable onDragStart={() => setDragging('sidebar')} type="button">Sidebar</button>
                {layout.addressBar === 'sidebar-top' && (
                  <div className="fennec-input" style={{ display: 'flex', alignItems: 'center' }}>
                    Address bar
                  </div>
                )}
                {layout.journalPanel === 'sidebar-bottom-drawer' && (
                  <div className="fennec-card-muted">Journal drawer</div>
                )}
              </div>
            )}
            <div className="fennec-preview-content">
              <div className="fennec-card">
                <div className="fennec-inline" style={{ justifyContent: 'space-between' }}>
                  <span>Content area</span>
                  <button className="fennec-badge" draggable onDragStart={() => setDragging('addressBar')} type="button">Address bar</button>
                </div>
              </div>
              {layout.journalPanel === 'floating-panel' && (
                <div className="fennec-card-muted">
                  <button className="fennec-badge" draggable onDragStart={() => setDragging('journalPanel')} type="button">Journal panel</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fennec-card">
        <div className="fennec-heading" style={{ marginBottom: 'var(--fennec-space-3)' }}>
          <div className="fennec-stack-tight">
            <h3>Drop zones</h3>
            <p className="fennec-subtle">Each zone writes to Preferences immediately and broadcasts the live browser layout.</p>
          </div>
        </div>

        <div className="fennec-stack">
          <div className="fennec-layout-zones">
            {(['left', 'right', 'hidden'] as const).map(position => (
              <button
                key={position}
                className="fennec-layout-zone"
                data-active={layout.sidebar.position === position}
                type="button"
                onDragOver={event => event.preventDefault()}
                onDrop={() => handleDrop('sidebar', position)}
                onClick={() => updateSidebar(position)}
              >
                Sidebar {position}
              </button>
            ))}
          </div>
          <div className="fennec-layout-zones">
            {(['top', 'bottom', 'hidden'] as const).map(position => (
              <button
                key={position}
                className="fennec-layout-zone"
                data-active={layout.toolbar === position}
                type="button"
                onDragOver={event => event.preventDefault()}
                onDrop={() => handleDrop('toolbar', position)}
                onClick={() => update('toolbar', position)}
              >
                Toolbar {position}
              </button>
            ))}
          </div>
          <div className="fennec-layout-zones">
            {(['top-center', 'sidebar-top', 'hidden'] as const).map(position => (
              <button
                key={position}
                className="fennec-layout-zone"
                data-active={layout.addressBar === position}
                type="button"
                onDragOver={event => event.preventDefault()}
                onDrop={() => handleDrop('addressBar', position)}
                onClick={() => update('addressBar', position)}
              >
                Address bar {position}
              </button>
            ))}
          </div>
          <div className="fennec-layout-zones">
            {(['sidebar-bottom-drawer', 'floating-panel', 'hidden'] as const).map(position => (
              <button
                key={position}
                className="fennec-layout-zone"
                data-active={layout.journalPanel === position}
                type="button"
                onDragOver={event => event.preventDefault()}
                onDrop={() => handleDrop('journalPanel', position)}
                onClick={() => update('journalPanel', position)}
              >
                Journal {position}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InstalledModList({
  mods,
  onToggle,
  onUninstall,
}: {
  mods: InstalledMod[];
  onToggle: (modId: string, enabled: boolean) => void;
  onUninstall: (modId: string) => void;
}): React.ReactElement {
  if (mods.length === 0) {
    return (
      <div className="fennec-card-muted">
        <p style={{ margin: 0 }}>No Mods installed yet.</p>
      </div>
    );
  }

  return (
    <div className="fennec-stack">
      {mods.map(mod => (
        <div key={mod.id} className="fennec-card">
          <div className="fennec-heading" style={{ marginBottom: 'var(--fennec-space-3)' }}>
            <div className="fennec-stack-tight">
              <h3>{mod.name}</h3>
              <p className="fennec-subtle">{mod.author} · v{mod.version}</p>
            </div>
            <div className="fennec-inline">
              <button className="fennec-button" type="button" onClick={() => onToggle(mod.id, !mod.enabled)}>
                {mod.enabled ? 'Disable' : 'Enable'}
              </button>
              <button className="fennec-button" type="button" onClick={() => onUninstall(mod.id)}>
                Uninstall
              </button>
            </div>
          </div>
          <p className="fennec-subtle" style={{ marginTop: 0 }}>{mod.description}</p>
          <div className="fennec-inline">
            <span className="fennec-badge">{mod.license}</span>
            {mod.surfaces.map(surface => (
              <span key={surface} className="fennec-badge">{surface}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AboutSection({ version }: { version: string }): React.ReactElement {
  return (
    <div className="fennec-stack">
      <div className="fennec-card">
        <div className="fennec-heading">
          <div className="fennec-stack-tight">
            <h2>Fennec</h2>
            <p className="fennec-subtle">Small ears. Big awareness.</p>
          </div>
          <span className="fennec-badge">v{version}</span>
        </div>
      </div>
      <div className="fennec-card">
        <div className="fennec-stack-tight">
          <h3>Project state</h3>
          <p className="fennec-subtle">Phases 1–3 are represented in the current codebase. Phase 4 lives here: tokens, layout, mods, and registry integration.</p>
        </div>
      </div>
    </div>
  );
}

export function SettingsApp(): React.ReactElement {
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const [settings, setSettings] = useState<SettingsSnapshot>(DEFAULT_SETTINGS_SNAPSHOT);
  const [themeTokens, setThemeTokens] = useState<FennecThemeTokens>(getDefaultThemeTokens());
  const [layout, setLayout] = useState<FennecLayoutConfig>(loadLayoutConfig());
  const [presets, setPresets] = useState<LayoutPreset[]>([...BUILT_IN_LAYOUT_PRESETS]);
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>(loadInstalledMods());
  const [version, setVersion] = useState('1.0.0');
  const [presetName, setPresetName] = useState(DEFAULT_PRESET_NAME);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const snapshot = loadSettingsSnapshot();
    setSettings(snapshot);
    setThemeTokens(loadThemeTokens());
    setLayout(loadLayoutConfig());
    setPresets(loadLayoutPresets());
    setInstalledMods(loadInstalledMods());
    setVersion(window.__fennec?.settings?.getVersion?.() ?? '1.0.0');
    document.documentElement.dataset.theme = snapshot.theme;

    const disposeSurface = initializeSurfaceRuntime('settings', {
      onLayoutChange: nextLayout => setLayout(nextLayout),
    });
    const disposeSettings = subscribeToSettingsSnapshot(next => {
      setSettings(next);
      document.documentElement.dataset.theme = next.theme;
    });
    const disposeTheme = subscribeToThemeTokens(setThemeTokens);
    const disposeLayout = subscribeToLayoutConfig(setLayout);
    const disposeMods = subscribeInstalledMods(setInstalledMods);

    const handleWindowDrop = async (event: DragEvent) => {
      const file = event.dataTransfer?.files?.[0];
      if (!file || !file.name.endsWith('.fennecmod')) {
        return;
      }
      event.preventDefault();
      const archive = await archiveFromFile(file);
      await installModArchive(archive);
      setInstalledMods(loadInstalledMods());
    };

    const handleWindowDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes('Files')) {
        event.preventDefault();
      }
    };

    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('dragover', handleWindowDragOver);

    return () => {
      disposeSurface();
      disposeSettings();
      disposeTheme();
      disposeLayout();
      disposeMods();
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('dragover', handleWindowDragOver);
    };
  }, []);

  function handleSetting<K extends keyof SettingsSnapshot>(key: K, value: SettingsSnapshot[K]): void {
    const next = updateSettingsSnapshot(key, value);
    setSettings(next);
    if (key === 'theme') {
      document.documentElement.dataset.theme = value as SettingsSnapshot['theme'];
    }
  }

  function handleTokenChange(key: FennecThemeTokenKey, value: string): void {
    const next = saveThemeTokens(withToken(themeTokens, key, value));
    setThemeTokens(next);
    if (key === '--fennec-color-accent') {
      handleSetting('accentColor', value);
    }
  }

  function handleLayoutChange(next: FennecLayoutConfig): void {
    setLayout(saveLayoutConfig(next));
  }

  async function handleInstallFiles(files: FileList | null): Promise<void> {
    if (!files?.length) {
      return;
    }
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.fennecmod')) {
        const archive = await archiveFromFile(file);
        await installModArchive(archive);
      }
    }
    setInstalledMods(loadInstalledMods());
  }

  function handleSavePreset(): void {
    saveCustomLayoutPreset(presetName.trim() || DEFAULT_PRESET_NAME, layout);
    setPresets(loadLayoutPresets());
  }

  function handleExportPreset(): void {
    const exportPreset = saveCustomLayoutPreset(presetName.trim() || DEFAULT_PRESET_NAME, layout);
    const archive = createLayoutPresetArchive(exportPreset, {
      '--fennec-sidebar-position': layout.sidebar.position === 'hidden'
        ? themeTokens['--fennec-sidebar-position']
        : layout.sidebar.position,
      '--fennec-sidebar-width-collapsed': themeTokens['--fennec-sidebar-width-collapsed'],
      '--fennec-sidebar-width-expanded': themeTokens['--fennec-sidebar-width-expanded'],
    });
    createArchiveDownload(exportPreset.id, archive);
    setPresets(loadLayoutPresets());
  }

  const activePreset = presets.find(preset =>
    JSON.stringify(preset.layout) === JSON.stringify(layout),
  ) ?? null;

  return (
    <div className="fennec-page">
      <div className="fennec-shell" data-sidebar-position={themeTokens['--fennec-sidebar-position']}>
        <aside className="fennec-nav">
          <div className="fennec-card-strong">
            <div className="fennec-stack-tight">
              <h1 style={{ margin: 0 }}>Settings</h1>
              <p className="fennec-subtle" style={{ margin: 0 }}>Appearance, layout, mods, and browser defaults.</p>
            </div>
          </div>

          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className="fennec-button"
              data-variant="ghost"
              data-active={activeSection === item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
            >
              <div className="fennec-stack-tight">
                <strong>{item.label}</strong>
                <span className="fennec-subtle">{item.description}</span>
              </div>
            </button>
          ))}
        </aside>

        <main className="fennec-content fennec-scroll">
          {activeSection === 'privacy' && (
            <div className="fennec-stack">
              <div className="fennec-heading">
                <div className="fennec-stack-tight">
                  <h2>Privacy</h2>
                  <p className="fennec-subtle">Fennec’s hardening defaults stay editable here.</p>
                </div>
              </div>
              {([
                ['blockThirdPartyCookies', 'Block third-party cookies'],
                ['httpsOnly', 'HTTPS-only mode'],
                ['webrtcProtection', 'WebRTC IP protection'],
                ['noPasswordManager', 'Disable built-in password manager'],
              ] as const).map(([key, label]) => (
                <div key={key} className="fennec-list-row">
                  <span>{label}</span>
                  <button className="fennec-button" type="button" onClick={() => handleSetting(key, !settings[key])}>
                    {settings[key] ? 'On' : 'Off'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'services' && (
            <div className="fennec-stack">
              <div className="fennec-heading">
                <div className="fennec-stack-tight">
                  <h2>Services</h2>
                  <p className="fennec-subtle">Every networked Fennec service remains opt-in.</p>
                </div>
              </div>
              {([
                ['enableUpdates', 'Automatic updates'],
                ['enableFilterRefresh', 'uBlock filter refresh'],
                ['enableModsRegistry', 'Mods registry'],
                ['enableCwsProxy', 'Anonymized extension proxy'],
              ] as const).map(([key, label]) => (
                <div key={key} className="fennec-list-row">
                  <span>{label}</span>
                  <button className="fennec-button" type="button" onClick={() => handleSetting(key, !settings[key])}>
                    {settings[key] ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'appearance' && (
            <div className="fennec-grid two">
              <div className="fennec-stack">
                <div className="fennec-card">
                  <div className="fennec-heading" style={{ marginBottom: 'var(--fennec-space-3)' }}>
                    <div className="fennec-stack-tight">
                      <h2>Theme mode</h2>
                      <p className="fennec-subtle">Separate from tokens: this chooses light, dark, or system mode.</p>
                    </div>
                    <button
                      className="fennec-button"
                      type="button"
                      onClick={() => {
                        setThemeTokens(resetAllThemeTokens());
                        setSettings(saveSettingsSnapshot({ ...settings, accentColor: THEME_DEFAULTS['--fennec-color-accent'] }));
                      }}
                    >
                      Reset all
                    </button>
                  </div>
                  <div className="fennec-inline">
                    {(['system', 'light', 'dark'] as const).map(mode => (
                      <button
                        key={mode}
                        className="fennec-button"
                        data-active={settings.theme === mode}
                        type="button"
                        onClick={() => handleSetting('theme', mode)}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
                <ThemeTokenEditor tokens={themeTokens} onChange={handleTokenChange} />
              </div>
              <AppearancePreview tokens={themeTokens} />
            </div>
          )}

          {activeSection === 'layout' && (
            <div className="fennec-stack">
              <LayoutPreview layout={layout} onChange={handleLayoutChange} />

              <div className="fennec-card">
                <div className="fennec-heading" style={{ marginBottom: 'var(--fennec-space-3)' }}>
                  <div className="fennec-stack-tight">
                    <h3>Presets</h3>
                    <p className="fennec-subtle">Built-in presets apply instantly. Save your current layout locally or export it as a shareable Mod.</p>
                  </div>
                  {activePreset && <span className="fennec-badge">Current: {activePreset.name}</span>}
                </div>

                <div className="fennec-inline" style={{ marginBottom: 'var(--fennec-space-3)' }}>
                  {presets.map(preset => (
                    <button
                      key={preset.id}
                      className="fennec-button"
                      data-active={activePreset?.id === preset.id}
                      type="button"
                      onClick={() => handleLayoutChange(preset.layout)}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>

                <div className="fennec-grid two">
                  <label className="fennec-stack-tight">
                    <span className="fennec-subtle">Preset name</span>
                    <input className="fennec-input" value={presetName} onChange={event => setPresetName(event.target.value)} />
                  </label>
                  <div className="fennec-inline" style={{ justifyContent: 'flex-end', alignItems: 'end' }}>
                    <button className="fennec-button" type="button" onClick={handleSavePreset}>Save current preset</button>
                    <button className="fennec-button" data-variant="accent" type="button" onClick={handleExportPreset}>Export as .fennecmod</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'mods' && (
            <div className="fennec-stack">
              <div className="fennec-card">
                <div className="fennec-heading" style={{ marginBottom: 'var(--fennec-space-3)' }}>
                  <div className="fennec-stack-tight">
                    <h2>Mods</h2>
                    <p className="fennec-subtle">Install a `.fennecmod`, toggle it live, or remove it entirely.</p>
                  </div>
                  <button className="fennec-button" data-variant="accent" type="button" onClick={() => fileInputRef.current?.click()}>
                    Install .fennecmod
                  </button>
                </div>

                <div
                  className="fennec-dropzone"
                  onDragOver={event => event.preventDefault()}
                  onDrop={async event => {
                    event.preventDefault();
                    await handleInstallFiles(event.dataTransfer.files);
                  }}
                >
                  Drop a `.fennecmod` here to install it immediately.
                </div>
                <input
                  ref={fileInputRef}
                  hidden
                  type="file"
                  accept=".fennecmod"
                  onChange={async event => {
                    await handleInstallFiles(event.target.files);
                    event.currentTarget.value = '';
                  }}
                />
              </div>

              <InstalledModList
                mods={installedMods}
                onToggle={(modId, enabled) => setInstalledMods(toggleInstalledMod(modId, enabled))}
                onUninstall={modId => setInstalledMods(uninstallInstalledMod(modId))}
              />
            </div>
          )}

          {activeSection === 'about' && <AboutSection version={version} />}
        </main>
      </div>
    </div>
  );
}
