import React, { useEffect, useMemo, useState } from 'react';
import { fetchRegistryIndex, installRegistryMod, loadInstalledMods, subscribeInstalledMods } from '../../shared/mods';
import { initializeChromeRuntime } from '../../shared/page-runtime';
import { loadSettingsSnapshot, subscribeToSettingsSnapshot, updateSettingsSnapshot } from '../../shared/settings-store';
import type { InstalledMod, RegistryModSummary } from '../../shared/models';

export function ModsPageApp(): React.ReactElement {
  const [settings, setSettings] = useState(loadSettingsSnapshot());
  const [registryEntries, setRegistryEntries] = useState<RegistryModSummary[]>([]);
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>(loadInstalledMods());
  const [query, setQuery] = useState('');
  const [surfaceFilter, setSurfaceFilter] = useState<'all' | 'sidebar' | 'newtab' | 'settings' | 'layout'>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const disposeRuntime = initializeChromeRuntime();
    const disposeSettings = subscribeToSettingsSnapshot(setSettings);
    const disposeMods = subscribeInstalledMods(setInstalledMods);
    return () => {
      disposeRuntime();
      disposeSettings();
      disposeMods();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!settings.enableModsRegistry) {
      setRegistryEntries([]);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    fetchRegistryIndex(true)
      .then(entries => {
        if (!cancelled) {
          setRegistryEntries(entries);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [settings.enableModsRegistry]);

  const filteredEntries = useMemo(() => {
    return registryEntries.filter(entry => {
      const searchHaystack = `${entry.name} ${entry.author} ${entry.description}`.toLowerCase();
      const matchesQuery = searchHaystack.includes(query.toLowerCase());
      const matchesSurface = surfaceFilter === 'all' || entry.surfaces.includes(surfaceFilter);
      return matchesQuery && matchesSurface;
    });
  }, [query, registryEntries, surfaceFilter]);

  const installedIds = new Set(installedMods.map(mod => mod.id));

  return (
    <div className="fennec-page">
      <div className="fennec-shell" data-sidebar-position="left">
        <main className="fennec-content">
          <div className="fennec-heading">
            <div className="fennec-stack-tight">
              <h1 style={{ margin: 0 }}>Mods registry</h1>
              <p className="fennec-subtle" style={{ margin: 0 }}>Browse community Mods from `mods.fennec.computer` without a separate download step.</p>
            </div>
            <a className="fennec-button" data-variant="ghost" href="fennec://settings" style={{ textDecoration: 'none' }}>
              Open settings
            </a>
          </div>

          {!settings.enableModsRegistry && (
            <div className="fennec-card-strong">
              <div className="fennec-stack-tight">
                <h2 style={{ margin: 0 }}>Registry access is currently off</h2>
                <p className="fennec-subtle" style={{ margin: 0 }}>Enable the opt-in Mods registry service to fetch `https://mods.fennec.computer/api/index.json`. This request is classified as `fennec-internal` in the Request Journal.</p>
              </div>
              <div className="fennec-inline" style={{ marginTop: 'var(--fennec-space-3)' }}>
                <button className="fennec-button" data-variant="accent" type="button" onClick={() => updateSettingsSnapshot('enableModsRegistry', true)}>
                  Enable registry
                </button>
              </div>
            </div>
          )}

          {settings.enableModsRegistry && (
            <>
              <div className="fennec-grid two">
                <label className="fennec-stack-tight">
                  <span className="fennec-subtle">Search</span>
                  <input className="fennec-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search mods" />
                </label>
                <label className="fennec-stack-tight">
                  <span className="fennec-subtle">Surface</span>
                  <select className="fennec-select" value={surfaceFilter} onChange={event => setSurfaceFilter(event.target.value as typeof surfaceFilter)}>
                    <option value="all">All surfaces</option>
                    <option value="sidebar">Sidebar</option>
                    <option value="newtab">New tab</option>
                    <option value="settings">Settings</option>
                    <option value="layout">Layout</option>
                  </select>
                </label>
              </div>

              <div className="fennec-stack">
                {loading && (
                  <div className="fennec-card-muted">
                    <p style={{ margin: 0 }}>Loading registry…</p>
                  </div>
                )}

                {!loading && filteredEntries.map(entry => (
                  <div key={entry.id} className="fennec-card">
                    <div className="fennec-heading" style={{ marginBottom: 'var(--fennec-space-3)' }}>
                      <div className="fennec-stack-tight">
                        <h2 style={{ margin: 0 }}>{entry.name}</h2>
                        <p className="fennec-subtle" style={{ margin: 0 }}>{entry.author} · updated {entry.last_updated}</p>
                      </div>
                      <div className="fennec-inline">
                        {installedIds.has(entry.id) && <span className="fennec-badge">Installed</span>}
                        <span className="fennec-badge">{entry.license}</span>
                      </div>
                    </div>

                    <p className="fennec-subtle" style={{ marginTop: 0 }}>{entry.description}</p>

                    <div className="fennec-inline" style={{ marginBottom: 'var(--fennec-space-3)' }}>
                      {entry.surfaces.map(surface => (
                        <span key={surface} className="fennec-badge">{surface}</span>
                      ))}
                      <span className="fennec-badge">{entry.install_count.toLocaleString()} installs</span>
                    </div>

                    <div className="fennec-inline">
                      <button
                        className="fennec-button"
                        data-variant="accent"
                        type="button"
                        disabled={installedIds.has(entry.id)}
                        onClick={async () => {
                          await installRegistryMod(entry);
                          setInstalledMods(loadInstalledMods());
                        }}
                      >
                        {installedIds.has(entry.id) ? 'Installed' : 'Install'}
                      </button>
                      <a className="fennec-button" data-variant="ghost" href={entry.repo_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                        View source
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
