import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { SidebarEvent, SidebarTab, Workspace } from '../types';

// ── State ──────────────────────────────────────────────────────────────────

interface SidebarState {
  tabs:              SidebarTab[];
  workspaces:        Workspace[];
  activeWorkspaceId: number;
}

type Action =
  | { type: 'INIT';             tabs: SidebarTab[]; workspaces: Workspace[] }
  | { type: 'TAB_ADDED';        tab: SidebarTab }
  | { type: 'TAB_REMOVED';      tabId: number }
  | { type: 'TAB_UPDATED';      tab: SidebarTab }
  | { type: 'TAB_ACTIVATED';    tabId: number }
  | { type: 'WORKSPACE_CHANGED';workspaceId: number }
  | { type: 'WORKSPACE_ADDED';  workspace: Workspace }
  | { type: 'WORKSPACE_REMOVED';workspaceId: number };

function reducer(state: SidebarState, action: Action): SidebarState {
  switch (action.type) {
    case 'INIT':
      return {
        ...state,
        tabs:       action.tabs,
        workspaces: action.workspaces,
      };
    case 'TAB_ADDED':
      return { ...state, tabs: [...state.tabs, action.tab] };
    case 'TAB_REMOVED':
      return { ...state, tabs: state.tabs.filter(t => t.id !== action.tabId) };
    case 'TAB_UPDATED':
      return {
        ...state,
        tabs: state.tabs.map(t => t.id === action.tab.id ? action.tab : t),
      };
    case 'TAB_ACTIVATED':
      return {
        ...state,
        tabs: state.tabs.map(t => ({ ...t, active: t.id === action.tabId })),
      };
    case 'WORKSPACE_CHANGED':
      return { ...state, activeWorkspaceId: action.workspaceId };
    case 'WORKSPACE_ADDED':
      return { ...state, workspaces: [...state.workspaces, action.workspace] };
    case 'WORKSPACE_REMOVED':
      return {
        ...state,
        workspaces: state.workspaces.filter(w => w.id !== action.workspaceId),
      };
    default:
      return state;
  }
}

// ── Workspace color map ───────────────────────────────────────────────────

const WORKSPACE_CSS_COLORS: Record<string, string> = {
  orange: 'var(--fnc-workspace-orange)',
  red:    'var(--fnc-workspace-red)',
  amber:  'var(--fnc-workspace-amber)',
  green:  'var(--fnc-workspace-green)',
  teal:   'var(--fnc-workspace-teal)',
  blue:   'var(--fnc-workspace-blue)',
  violet: 'var(--fnc-workspace-violet)',
  pink:   'var(--fnc-workspace-pink)',
  slate:  'var(--fnc-workspace-slate)',
  sand:   'var(--fnc-workspace-sand)',
};

function workspaceColor(name: string): string {
  return WORKSPACE_CSS_COLORS[name] ?? 'var(--fnc-workspace-slate)';
}

// ── Favicon helper ────────────────────────────────────────────────────────

function faviconSrc(tab: SidebarTab): string {
  if (tab.favIconUrl) return tab.favIconUrl;
  try {
    return `chrome://favicon/size/16@2x/${encodeURIComponent(new URL(tab.url).origin + '/')}`;
  } catch {
    return '';
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function WorkspaceChip({
  workspace,
  active,
  onActivate,
}: {
  workspace: Workspace;
  active: boolean;
  onActivate: () => void;
}): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  const color = workspaceColor(workspace.color);

  return (
    <button
      onClick={onActivate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={workspace.name}
      aria-pressed={active}
      style={{
        width:        '28px',
        height:       '28px',
        borderRadius: active ? 'var(--fnc-radius-md)' : 'var(--fnc-radius-full)',
        border:       'none',
        cursor:       'pointer',
        background:   active ? color : (hovered ? 'var(--fnc-state-hover)' : 'transparent'),
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        transition:   `background var(--fnc-duration-quick) var(--fnc-ease-out),
                       border-radius var(--fnc-duration-quick) var(--fnc-ease-out)`,
        flexShrink:   0,
        position:     'relative',
      }}
    >
      {/* Color dot */}
      <span style={{
        width:        active ? '10px' : '8px',
        height:       active ? '10px' : '8px',
        borderRadius: 'var(--fnc-radius-full)',
        background:   active ? '#fff' : color,
        display:      'block',
        transition:   'all var(--fnc-duration-quick) var(--fnc-ease-out)',
        opacity:      active ? 0.9 : 1,
      }} />
    </button>
  );
}

function TabItem({
  tab,
  collapsed,
  onActivate,
  onClose,
  onPin,
}: {
  tab: SidebarTab;
  collapsed: boolean;
  onActivate: () => void;
  onClose: () => void;
  onPin: () => void;
}): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  const favicon = faviconSrc(tab);

  const rowStyle: React.CSSProperties = {
    display:      'flex',
    alignItems:   'center',
    gap:          'var(--fnc-space-2)',
    height:       'var(--fnc-sidebar-tab-height)',
    padding:      collapsed
      ? '0 var(--fnc-space-3)'
      : `0 var(--fnc-space-2) 0 var(--fnc-space-3)`,
    borderRadius: 'var(--fnc-radius-md)',
    cursor:       'pointer',
    background:   tab.active
      ? 'var(--fnc-state-selected)'
      : hovered
        ? 'var(--fnc-state-hover)'
        : 'transparent',
    transition:   `background var(--fnc-duration-fast) var(--fnc-ease-out)`,
    position:     'relative',
    userSelect:   'none',
  };

  return (
    <div
      style={rowStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={tab.title || tab.url}
      role="button"
      tabIndex={0}
      aria-current={tab.active ? 'page' : undefined}
      onClick={onActivate}
      onKeyDown={e => { if (e.key === 'Enter') onActivate(); }}
    >
      {/* Active indicator strip */}
      {tab.active && (
        <span style={{
          position:     'absolute',
          left:         0,
          top:          '6px',
          bottom:       '6px',
          width:        '3px',
          borderRadius: '0 2px 2px 0',
          background:   'var(--fnc-accent)',
        }} />
      )}

      {/* Favicon / spinner */}
      {tab.loading ? (
        <span style={{
          width:        'var(--fnc-sidebar-favicon-size)',
          height:       'var(--fnc-sidebar-favicon-size)',
          borderRadius: 'var(--fnc-radius-full)',
          border:       '2px solid var(--fnc-border-subtle)',
          borderTopColor: 'var(--fnc-accent)',
          display:      'block',
          flexShrink:   0,
          animation:    'spin 0.8s linear infinite',
        }} />
      ) : (
        <img
          src={favicon}
          alt=""
          aria-hidden="true"
          width="14"
          height="14"
          style={{
            width:        'var(--fnc-sidebar-favicon-size)',
            height:       'var(--fnc-sidebar-favicon-size)',
            objectFit:    'contain',
            borderRadius: '2px',
            flexShrink:   0,
          }}
          onError={e => {
            const img = e.currentTarget;
            img.style.display = 'none';
          }}
        />
      )}

      {/* Title + audio badge (expanded only) */}
      {!collapsed && (
        <>
          <span style={{
            flex:         1,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            fontSize:     'var(--fnc-text-sm)',
            color:        tab.active
              ? 'var(--fnc-text-primary)'
              : 'var(--fnc-text-secondary)',
            fontWeight:   tab.active
              ? 'var(--fnc-weight-medium)' as React.CSSProperties['fontWeight']
              : undefined,
          }}>
            {tab.title || new URL(tab.url).hostname}
          </span>

          {/* Audio indicator */}
          {tab.audible && !tab.muted && (
            <span
              title="Playing audio"
              style={{ fontSize: '10px', color: 'var(--fnc-text-tertiary)', flexShrink: 0 }}
            >
              🔊
            </span>
          )}
          {tab.muted && (
            <span
              title="Muted"
              style={{ fontSize: '10px', color: 'var(--fnc-text-tertiary)', flexShrink: 0 }}
            >
              🔇
            </span>
          )}

          {/* Close button (visible on hover) */}
          {hovered && (
            <button
              onClick={e => { e.stopPropagation(); onClose(); }}
              title="Close tab"
              aria-label="Close tab"
              style={{
                border:       'none',
                background:   'transparent',
                cursor:       'pointer',
                color:        'var(--fnc-text-tertiary)',
                fontSize:     '14px',
                padding:      '2px',
                borderRadius: 'var(--fnc-radius-sm)',
                display:      'flex',
                alignItems:   'center',
                flexShrink:   0,
                lineHeight:   1,
              }}
            >
              ×
            </button>
          )}

          {/* Pin button (visible on hover, when not pinned) */}
          {hovered && !tab.pinned && (
            <button
              onClick={e => { e.stopPropagation(); onPin(); }}
              title="Pin tab"
              aria-label="Pin tab"
              style={{
                border:       'none',
                background:   'transparent',
                cursor:       'pointer',
                color:        'var(--fnc-text-tertiary)',
                fontSize:     '11px',
                padding:      '2px',
                borderRadius: 'var(--fnc-radius-sm)',
                display:      'flex',
                alignItems:   'center',
                flexShrink:   0,
              }}
            >
              📌
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Mock data for development ──────────────────────────────────────────────

const MOCK_WORKSPACES: Workspace[] = [
  { id: 1, name: 'Personal', color: 'orange' },
  { id: 2, name: 'Work',     color: 'blue' },
  { id: 3, name: 'Research', color: 'green' },
];

const MOCK_TABS: SidebarTab[] = [
  {
    id: 1, title: 'New Tab', url: 'fennec://newtab', favIconUrl: '',
    active: false, pinned: true, workspaceId: 1, loading: false, audible: false, muted: false,
  },
  {
    id: 2, title: 'Request Journal — Fennec', url: 'fennec://journal', favIconUrl: '',
    active: true, pinned: false, workspaceId: 1, loading: false, audible: false, muted: false,
  },
  {
    id: 3, title: 'GitHub · Where the world builds software', url: 'https://github.com', favIconUrl: '',
    active: false, pinned: false, workspaceId: 1, loading: false, audible: false, muted: false,
  },
  {
    id: 4, title: 'Hacker News', url: 'https://news.ycombinator.com', favIconUrl: '',
    active: false, pinned: false, workspaceId: 1, loading: true, audible: false, muted: false,
  },
  {
    id: 5, title: 'Linear – The issue tracker for modern teams', url: 'https://linear.app', favIconUrl: '',
    active: false, pinned: false, workspaceId: 2, loading: false, audible: false, muted: false,
  },
  {
    id: 6, title: 'Notion', url: 'https://notion.so', favIconUrl: '',
    active: false, pinned: false, workspaceId: 2, loading: false, audible: true, muted: false,
  },
];

// ── Main component ─────────────────────────────────────────────────────────

export function SidebarApp(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, {
    tabs:              [],
    workspaces:        [],
    activeWorkspaceId: 1,
  });
  const subIdRef = useRef<number | null>(null);

  // Detect collapsed mode by watching element width.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 240;
      setCollapsed(width < 80);
    });
    obs.observe(document.documentElement);
    return () => obs.disconnect();
  }, []);

  // Load initial data and subscribe to events.
  useEffect(() => {
    const bridge = window.__fennec?.sidebar;
    if (bridge) {
      try {
        const tabs       = JSON.parse(bridge.getTabs())       as SidebarTab[];
        const workspaces = JSON.parse(bridge.getWorkspaces()) as Workspace[];
        dispatch({ type: 'INIT', tabs, workspaces });
      } catch { /* ignore parse errors */ }

      subIdRef.current = bridge.subscribe((eventJson: string) => {
        try {
          const ev = JSON.parse(eventJson) as SidebarEvent;
          switch (ev.type) {
            case 'TAB_ADDED':
              dispatch({ type: 'TAB_ADDED', tab: ev.tab }); break;
            case 'TAB_REMOVED':
              dispatch({ type: 'TAB_REMOVED', tabId: ev.tabId }); break;
            case 'TAB_UPDATED':
              dispatch({ type: 'TAB_UPDATED', tab: ev.tab }); break;
            case 'TAB_ACTIVATED':
              dispatch({ type: 'TAB_ACTIVATED', tabId: ev.tabId }); break;
            case 'WORKSPACE_CHANGED':
              dispatch({ type: 'WORKSPACE_CHANGED', workspaceId: ev.workspaceId }); break;
            case 'WORKSPACE_ADDED':
              dispatch({ type: 'WORKSPACE_ADDED', workspace: ev.workspace }); break;
            case 'WORKSPACE_REMOVED':
              dispatch({ type: 'WORKSPACE_REMOVED', workspaceId: ev.workspaceId }); break;
          }
        } catch { /* ignore */ }
      });
    } else {
      // Development mock
      dispatch({ type: 'INIT', tabs: MOCK_TABS, workspaces: MOCK_WORKSPACES });
    }

    return () => {
      if (subIdRef.current !== null) {
        window.__fennec?.sidebar?.unsubscribe(subIdRef.current);
      }
    };
  }, []);

  const handleActivate = useCallback((tabId: number) => {
    window.__fennec?.sidebar?.activateTab(tabId);
    dispatch({ type: 'TAB_ACTIVATED', tabId });
  }, []);

  const handleClose = useCallback((tabId: number) => {
    window.__fennec?.sidebar?.closeTab(tabId);
    dispatch({ type: 'TAB_REMOVED', tabId });
  }, []);

  const handlePin = useCallback((tab: SidebarTab) => {
    window.__fennec?.sidebar?.setPinned(tab.id, !tab.pinned);
    dispatch({ type: 'TAB_UPDATED', tab: { ...tab, pinned: !tab.pinned } });
  }, []);

  const handleNewTab = useCallback(() => {
    window.__fennec?.sidebar?.newTab(state.activeWorkspaceId);
  }, [state.activeWorkspaceId]);

  const handleWorkspaceSwitch = useCallback((workspaceId: number) => {
    window.__fennec?.sidebar?.moveTab(0, workspaceId); // 0 = noop; bridge handles workspace switch
    dispatch({ type: 'WORKSPACE_CHANGED', workspaceId });
  }, []);

  // Partition tabs for the active workspace.
  const workspaceTabs = state.tabs.filter(
    t => t.workspaceId === state.activeWorkspaceId,
  );
  const pinnedTabs = workspaceTabs.filter(t => t.pinned);
  const regularTabs = workspaceTabs.filter(t => !t.pinned);

  const sidebarStyle: React.CSSProperties = {
    display:       'flex',
    flexDirection: 'column',
    height:        '100vh',
    width:         '100%',
    background:    'var(--fnc-surface-sidebar)',
    color:         'var(--fnc-text-primary)',
    fontFamily:    'var(--fnc-font-sans)',
    fontSize:      'var(--fnc-text-base)',
    overflow:      'hidden',
    borderRight:   '1px solid var(--fnc-border-subtle)',
  };

  const headerStyle: React.CSSProperties = {
    height:      'var(--fnc-sidebar-header-height)',
    display:     'flex',
    alignItems:  'center',
    padding:     `0 var(--fnc-space-2)`,
    gap:         'var(--fnc-space-1)',
    borderBottom: '1px solid var(--fnc-border-subtle)',
    flexShrink:  0,
    flexWrap:    'wrap',
  };

  const tabListStyle: React.CSSProperties = {
    flex:       1,
    overflowY:  'auto',
    overflowX:  'hidden',
    padding:    `var(--fnc-space-1) var(--fnc-space-1)`,
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize:      'var(--fnc-text-2xs)',
    fontWeight:    'var(--fnc-weight-semibold)' as React.CSSProperties['fontWeight'],
    color:         'var(--fnc-text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--fnc-tracking-widest)',
    padding:       `var(--fnc-space-2) var(--fnc-space-3) var(--fnc-space-1)`,
  };

  const newTabBtnStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    justifyContent: collapsed ? 'center' : undefined,
    gap:            'var(--fnc-space-2)',
    margin:         `var(--fnc-space-1) var(--fnc-space-1)`,
    padding:        collapsed
      ? 'var(--fnc-space-2) var(--fnc-space-3)'
      : `var(--fnc-space-2) var(--fnc-space-3)`,
    border:         'none',
    borderRadius:   'var(--fnc-radius-md)',
    background:     'transparent',
    color:          'var(--fnc-text-tertiary)',
    fontSize:       'var(--fnc-text-sm)',
    fontFamily:     'var(--fnc-font-sans)',
    cursor:         'pointer',
    width:          `calc(100% - var(--fnc-space-2))`,
  };

  return (
    <div style={sidebarStyle}>
      {/* Workspace chips header */}
      <div style={headerStyle} aria-label="Workspaces">
        {state.workspaces.map(ws => (
          <WorkspaceChip
            key={ws.id}
            workspace={ws}
            active={ws.id === state.activeWorkspaceId}
            onActivate={() => handleWorkspaceSwitch(ws.id)}
          />
        ))}
      </div>

      {/* Tab list */}
      <div style={tabListStyle} role="list" aria-label="Open tabs">
        {/* Pinned tabs */}
        {pinnedTabs.length > 0 && (
          <>
            {!collapsed && <div style={sectionLabelStyle}>Pinned</div>}
            {pinnedTabs.map(tab => (
              <div key={tab.id} role="listitem">
                <TabItem
                  tab={tab}
                  collapsed={collapsed}
                  onActivate={() => handleActivate(tab.id)}
                  onClose={() => handleClose(tab.id)}
                  onPin={() => handlePin(tab)}
                />
              </div>
            ))}
          </>
        )}

        {/* Regular tabs */}
        {pinnedTabs.length > 0 && regularTabs.length > 0 && !collapsed && (
          <div style={sectionLabelStyle}>Tabs</div>
        )}
        {regularTabs.map(tab => (
          <div key={tab.id} role="listitem">
            <TabItem
              tab={tab}
              collapsed={collapsed}
              onActivate={() => handleActivate(tab.id)}
              onClose={() => handleClose(tab.id)}
              onPin={() => handlePin(tab)}
            />
          </div>
        ))}

        {/* Empty state */}
        {workspaceTabs.length === 0 && (
          <div style={{
            padding:   'var(--fnc-space-6) var(--fnc-space-4)',
            textAlign: 'center',
            color:     'var(--fnc-text-tertiary)',
            fontSize:  'var(--fnc-text-sm)',
          }}>
            {collapsed ? '' : 'No tabs'}
          </div>
        )}
      </div>

      {/* New tab button */}
      <div style={{ borderTop: '1px solid var(--fnc-border-subtle)', flexShrink: 0 }}>
        <button
          style={newTabBtnStyle}
          onClick={handleNewTab}
          title="New tab"
          aria-label="New tab"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {!collapsed && <span>New tab</span>}
        </button>
      </div>

      {/* Spinner keyframe — injected once */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
