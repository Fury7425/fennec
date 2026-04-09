import React from 'react';
import type { FilterTab } from '../types';

interface FilterBarProps {
  activeTab: FilterTab;
  counts: Record<FilterTab, number>;
  onTabChange: (tab: FilterTab) => void;
  onExport: () => void;
  onClear: () => void;
}

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',              label: 'All' },
  { id: 'blocked',          label: 'Blocked' },
  { id: 'trackers',         label: 'Trackers' },
  { id: 'fennec-internal',  label: 'Fennec' },
];

export function FilterBar({
  activeTab,
  counts,
  onTabChange,
  onExport,
  onClear,
}: FilterBarProps): React.ReactElement {
  const barStyle: React.CSSProperties = {
    display:         'flex',
    alignItems:      'center',
    gap:             'var(--fnc-space-1)',
    padding:         'var(--fnc-space-2) var(--fnc-space-4)',
    borderBottom:    '1px solid var(--fnc-border-subtle)',
    background:      'var(--fnc-surface-toolbar)',
    flexShrink:      0,
    overflowX:       'auto',
  };

  const tabGroupStyle: React.CSSProperties = {
    display:     'flex',
    gap:         'var(--fnc-space-1)',
    flex:        '1',
    minWidth:    0,
  };

  const actionGroupStyle: React.CSSProperties = {
    display:      'flex',
    gap:          'var(--fnc-space-1)',
    flexShrink:   0,
    marginLeft:   'var(--fnc-space-2)',
  };

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      display:       'flex',
      alignItems:    'center',
      gap:           'var(--fnc-space-1)',
      padding:       `var(--fnc-space-1) var(--fnc-space-3)`,
      borderRadius:  'var(--fnc-radius-full)',
      border:        'none',
      background:    active ? 'var(--fnc-accent)' : 'transparent',
      color:         active ? 'var(--fnc-accent-on)' : 'var(--fnc-text-secondary)',
      fontSize:      'var(--fnc-text-sm)',
      fontWeight:    active ? 600 : 400,
      fontFamily:    'var(--fnc-font-sans)',
      cursor:        'pointer',
      whiteSpace:    'nowrap',
      transition:    'background 120ms ease',
    };
  }

  function badgeStyle(active: boolean): React.CSSProperties {
    return {
      display:       'inline-block',
      minWidth:      '18px',
      padding:       '0 5px',
      height:        '18px',
      lineHeight:    '18px',
      textAlign:     'center',
      borderRadius:  '9px',
      fontSize:      '11px',
      fontWeight:    700,
      background:    active ? 'rgba(255,255,255,0.25)' : 'var(--fnc-surface-overlay)',
      color:         active ? '#fff' : 'var(--fnc-text-tertiary)',
    };
  }

  function actionBtnStyle(): React.CSSProperties {
    return {
      padding:       `var(--fnc-space-1) var(--fnc-space-3)`,
      border:        '1px solid var(--fnc-border)',
      borderRadius:  'var(--fnc-radius-md)',
      background:    'transparent',
      color:         'var(--fnc-text-secondary)',
      fontSize:      'var(--fnc-text-sm)',
      fontFamily:    'var(--fnc-font-sans)',
      cursor:        'pointer',
    };
  }

  return (
    <div style={barStyle}>
      <div style={tabGroupStyle}>
        {TABS.map(tab => {
          const active = tab.id === activeTab;
          const count  = counts[tab.id] ?? 0;
          return (
            <button
              key={tab.id}
              style={tabStyle(active)}
              onClick={() => onTabChange(tab.id)}
              aria-selected={active}
              role="tab"
            >
              {tab.label}
              {count > 0 && (
                <span style={badgeStyle(active)}>
                  {count > 9999 ? '9999+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={actionGroupStyle}>
        <button style={actionBtnStyle()} onClick={onExport} title="Export last 7 days as JSON">
          Export JSON
        </button>
        <button
          style={{ ...actionBtnStyle(), color: 'var(--fnc-text-danger, #c0392b)' }}
          onClick={onClear}
          title="Clear journal"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
