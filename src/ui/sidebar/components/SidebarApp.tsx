import React, { useEffect, useMemo, useState } from 'react';
import { initializeSurfaceRuntime } from '../../shared/page-runtime';
import { emitModTabChange, emitModWorkspaceChange, type RegisteredPanel } from '../../shared/mods';
import { loadLayoutConfig } from '../../shared/layout';
import { loadThemeTokens, subscribeToThemeTokens } from '../../shared/theme';
import type { FennecLayoutConfig, FennecTab, FennecWorkspace } from '../../shared/models';
import type { SidebarEvent } from '../types';

const MOCK_WORKSPACES: FennecWorkspace[] = [
  { id: 1, name: 'Personal', colorToken: '--fennec-color-workspace-1' },
  { id: 2, name: 'Work', colorToken: '--fennec-color-workspace-5' },
  { id: 3, name: 'Research', colorToken: '--fennec-color-workspace-4' },
];

const MOCK_TABS: FennecTab[] = [
  { id: 1, title: 'Welcome', url: 'fennec://newtab', active: false, pinned: true, loading: false, audible: false, muted: false, workspaceId: 1 },
  { id: 2, title: 'Request Journal', url: 'fennec://journal', active: true, pinned: false, loading: false, audible: false, muted: false, workspaceId: 1 },
  { id: 3, title: 'GitHub', url: 'https://github.com', active: false, pinned: false, loading: false, audible: false, muted: false, workspaceId: 1 },
  { id: 4, title: 'Spec notes', url: 'https://example.com/spec', active: false, pinned: false, loading: true, audible: false, muted: false, workspaceId: 3 },
  { id: 5, title: 'Linear', url: 'https://linear.app', active: false, pinned: false, loading: false, audible: false, muted: false, workspaceId: 2 },
];

function panelDocument(html: string, tokens: Record<string, string>): string {
  const tokenStyles = Object.entries(tokens)
    .map(([key, value]) => `${key}: ${value.replaceAll('"', '&quot;')};`)
    .join(' ');
  return `<!DOCTYPE html><html style="${tokenStyles}"><body style="margin:0;background:transparent;color:var(--fennec-color-text-primary);font-family:var(--fennec-font-ui);">${html}</body></html>`;
}

function workspaceColor(colorToken: string): string {
  return `var(${colorToken})`;
}

function navLink(label: string, href: string): React.ReactElement {
  return (
    <a className="fennec-button" data-variant="ghost" href={href} style={{ textDecoration: 'none', textAlign: 'center' }}>
      {label}
    </a>
  );
}

export function SidebarApp(): React.ReactElement {
  const [tabs, setTabs] = useState<FennecTab[]>([]);
  const [workspaces, setWorkspaces] = useState<FennecWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(1);
  const [layout, setLayout] = useState<FennecLayoutConfig>(loadLayoutConfig());
  const [panels, setPanels] = useState<RegisteredPanel[]>([]);
  const [themeTokens, setThemeTokens] = useState(loadThemeTokens());

  useEffect(() => {
    const disposeRuntime = initializeSurfaceRuntime('sidebar', {
      onPanelsChange: nextPanels => setPanels(nextPanels),
      onLayoutChange: nextLayout => setLayout(nextLayout),
    });
    const disposeTheme = subscribeToThemeTokens(setThemeTokens);

    const bridge = window.__fennec?.sidebar;
    if (bridge) {
      try {
        const loadedTabs = JSON.parse(bridge.getTabs()) as FennecTab[];
        const loadedWorkspaces = JSON.parse(bridge.getWorkspaces()) as FennecWorkspace[];
        setTabs(loadedTabs);
        setWorkspaces(loadedWorkspaces);
        const activeTab = loadedTabs.find(tab => tab.active);
        if (activeTab) {
          setActiveWorkspaceId(activeTab.workspaceId);
          emitModTabChange(activeTab);
        }
        const activeWorkspace = loadedWorkspaces.find(workspace => workspace.id === (activeTab?.workspaceId ?? loadedWorkspaces[0]?.id));
        if (activeWorkspace) {
          emitModWorkspaceChange(activeWorkspace);
        }
      } catch {
        setTabs(MOCK_TABS);
        setWorkspaces(MOCK_WORKSPACES);
      }

      const subscriptionId = bridge.subscribe((eventJson: string) => {
        try {
          const event = JSON.parse(eventJson) as SidebarEvent;
          setTabs(previousTabs => {
            switch (event.type) {
              case 'TAB_ADDED':
                return [...previousTabs, event.tab];
              case 'TAB_REMOVED':
                return previousTabs.filter(tab => tab.id !== event.tabId);
              case 'TAB_UPDATED':
                return previousTabs.map(tab => tab.id === event.tab.id ? event.tab : tab);
              case 'TAB_ACTIVATED':
                return previousTabs.map(tab => ({ ...tab, active: tab.id === event.tabId }));
              default:
                return previousTabs;
            }
          });
          if (event.type === 'WORKSPACE_CHANGED') {
            setActiveWorkspaceId(event.workspaceId);
          }
          if (event.type === 'WORKSPACE_ADDED') {
            setWorkspaces(previous => [...previous, event.workspace]);
          }
          if (event.type === 'WORKSPACE_REMOVED') {
            setWorkspaces(previous => previous.filter(workspace => workspace.id !== event.workspaceId));
          }
        } catch {
          // Ignore malformed sidebar updates in preview mode.
        }
      });

      return () => {
        bridge.unsubscribe(subscriptionId);
        disposeTheme();
        disposeRuntime();
      };
    }

    setTabs(MOCK_TABS);
    setWorkspaces(MOCK_WORKSPACES);
    return () => {
      disposeTheme();
      disposeRuntime();
    };
  }, []);

  const visibleTabs = useMemo(
    () => tabs.filter(tab => tab.workspaceId === activeWorkspaceId),
    [activeWorkspaceId, tabs],
  );
  const pinnedTabs = visibleTabs.filter(tab => tab.pinned);
  const regularTabs = visibleTabs.filter(tab => !tab.pinned);
  const collapsed = layout.sidebar.displayMode === 'collapsed';
  const isHidden = layout.sidebar.position === 'hidden';

  function activateTab(tab: FennecTab): void {
    window.__fennec?.sidebar?.activateTab(tab.id);
    setTabs(previous => previous.map(current => ({ ...current, active: current.id === tab.id })));
    emitModTabChange(tab);
  }

  function activateWorkspace(workspace: FennecWorkspace): void {
    setActiveWorkspaceId(workspace.id);
    emitModWorkspaceChange(workspace);
  }

  function closeTab(tabId: number): void {
    window.__fennec?.sidebar?.closeTab(tabId);
    setTabs(previous => previous.filter(tab => tab.id !== tabId));
  }

  function panelMarkup(panel: RegisteredPanel): string {
    return panelDocument(panel.html, themeTokens);
  }

  return (
    <div
      className="fennec-page"
      style={{
        padding: 'var(--fennec-space-3)',
        background: 'var(--fennec-color-bg-sidebar)',
      }}
    >
      <div
        className="fennec-stack"
        style={{
          minHeight: 'calc(100vh - var(--fennec-space-6))',
          width: collapsed ? 'var(--fennec-sidebar-width-collapsed)' : 'var(--fennec-sidebar-width-expanded)',
          transition: 'var(--fennec-shell-transition)',
        }}
      >
        {isHidden && (
          <div className="fennec-card-muted">
            <p style={{ margin: 0 }} className="fennec-subtle">Sidebar is hidden by the active layout preset.</p>
          </div>
        )}

        <div className="fennec-card-strong">
          <div className="fennec-inline" style={{ justifyContent: collapsed ? 'center' : 'space-between' }}>
            {workspaces.map(workspace => (
              <button
                key={workspace.id}
                className="fennec-chip"
                data-active={workspace.id === activeWorkspaceId}
                type="button"
                onClick={() => activateWorkspace(workspace)}
                title={workspace.name}
                style={{
                  background: workspace.id === activeWorkspaceId ? workspaceColor(workspace.colorToken) : undefined,
                  borderColor: workspaceColor(workspace.colorToken),
                  color: workspace.id === activeWorkspaceId ? 'var(--fennec-color-bg-secondary)' : undefined,
                  width: collapsed ? 'var(--fennec-tab-height)' : undefined,
                  paddingInline: collapsed ? '0' : undefined,
                }}
              >
                {collapsed ? workspace.name[0] : workspace.name}
              </button>
            ))}
          </div>
        </div>

        <button className="fennec-button" data-variant="accent" type="button" onClick={() => window.__fennec?.sidebar?.newTab(activeWorkspaceId)}>
          {collapsed ? '+' : 'New tab'}
        </button>

        <div className="fennec-stack fennec-scroll" style={{ flex: 1 }}>
          {pinnedTabs.length > 0 && !collapsed && <span className="fennec-subtle">Pinned</span>}
          {pinnedTabs.map(tab => (
            <div key={tab.id} className="fennec-list-row" data-active={tab.active} onClick={() => activateTab(tab)}>
              <span>{collapsed ? tab.title[0] : tab.title}</span>
              {!collapsed && (
                <button className="fennec-button" data-variant="ghost" type="button" onClick={event => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}>
                  Close
                </button>
              )}
            </div>
          ))}

          {regularTabs.length > 0 && !collapsed && <span className="fennec-subtle">Tabs</span>}
          {regularTabs.map(tab => (
            <div key={tab.id} className="fennec-list-row" data-active={tab.active} onClick={() => activateTab(tab)}>
              <span>{collapsed ? tab.title[0] : tab.title}</span>
              {!collapsed && (
                <span className="fennec-subtle">
                  {tab.loading ? 'Loading' : tab.audible ? 'Audio' : new URL(tab.url).hostname}
                </span>
              )}
            </div>
          ))}

          {panels.map(panel => (
            <div key={panel.modId} className="fennec-card">
              {!collapsed && (
                <div className="fennec-heading" style={{ marginBottom: 'var(--fennec-space-2)' }}>
                  <span>{panel.title}</span>
                </div>
              )}
              <iframe
                className="fennec-mod-panel-frame"
                sandbox="allow-scripts"
                srcDoc={panelMarkup(panel)}
                title={panel.title}
              />
            </div>
          ))}
        </div>

        <div className="fennec-card">
          <div className="fennec-inline" style={{ justifyContent: 'space-between' }}>
            {navLink('Journal', 'fennec://journal')}
            {navLink('Settings', 'fennec://settings')}
            {navLink('Mods', 'fennec://mods')}
          </div>
        </div>
      </div>
    </div>
  );
}
