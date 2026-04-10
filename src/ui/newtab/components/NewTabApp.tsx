import React, { useEffect, useState } from 'react';
import { initializeSurfaceRuntime } from '../../shared/page-runtime';

interface PrivacyStats {
  blockersToday: number;
  requestsToday: number;
}

function nowLabel(): string {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function greetingLabel(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 18) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

export function NewTabApp(): React.ReactElement {
  const [time, setTime] = useState(nowLabel());
  const [stats, setStats] = useState<PrivacyStats>({ blockersToday: 0, requestsToday: 0 });

  useEffect(() => {
    const disposeRuntime = initializeSurfaceRuntime('newtab');
    const tick = window.setInterval(() => setTime(nowLabel()), 1000);

    const bridge = window.__fennec?.newtab;
    if (bridge) {
      try {
        setStats(JSON.parse(bridge.getPrivacyStats()) as PrivacyStats);
      } catch {
        setStats({ blockersToday: 37, requestsToday: 204 });
      }
    } else {
      setStats({ blockersToday: 37, requestsToday: 204 });
    }

    return () => {
      window.clearInterval(tick);
      disposeRuntime();
    };
  }, []);

  return (
    <div className="fennec-page">
      <div className="fennec-shell" data-sidebar-position="left">
        <main className="fennec-content" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="fennec-stack" style={{ width: 'min(100%, var(--fennec-preview-browser-width))', alignItems: 'center' }}>
            <div className="fennec-stack-tight" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h1 style={{ margin: 0, fontSize: 'var(--fennec-font-size-hero)' }}>{time}</h1>
              <p className="fennec-subtle" style={{ margin: 0, fontSize: 'var(--fennec-font-size-lg)' }}>{greetingLabel()}</p>
            </div>

            <button
              className="fennec-input"
              type="button"
              onClick={() => window.__fennec?.newtab?.focusOmnibox()}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'text',
                textAlign: 'left',
              }}
            >
              <span className="fennec-subtle">Search or enter address</span>
              <span className="fennec-badge">Ctrl+L</span>
            </button>

            <div className="fennec-grid two" style={{ width: '100%' }}>
              <div className="fennec-card-strong">
                <div className="fennec-stack-tight">
                  <strong>{stats.blockersToday}</strong>
                  <span className="fennec-subtle">Blocked today</span>
                </div>
              </div>
              <div className="fennec-card">
                <div className="fennec-stack-tight">
                  <strong>{stats.requestsToday}</strong>
                  <span className="fennec-subtle">Requests today</span>
                </div>
              </div>
            </div>

            <div className="fennec-inline">
              <a className="fennec-button" data-variant="ghost" href="fennec://journal" style={{ textDecoration: 'none' }}>Journal</a>
              <a className="fennec-button" data-variant="ghost" href="fennec://settings" style={{ textDecoration: 'none' }}>Settings</a>
              <a className="fennec-button" data-variant="ghost" href="fennec://mods" style={{ textDecoration: 'none' }}>Mods</a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
