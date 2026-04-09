import React, { useState } from 'react';
import type { SetupState, SetupStep } from '../types';
import { WelcomeStep } from './WelcomeStep';
import { ServicesStep } from './ServicesStep';
import { DoneStep } from './DoneStep';

// Three screens per spec:
//   1. Welcome  — branding, tagline, two pillars
//   2. Services — 4 opt-in network-service toggles
//   3. Done     — summary + "Start browsing"
const STEPS: SetupStep[] = ['welcome', 'services', 'done'];

const DEFAULT_STATE: SetupState = {
  step: 'welcome',
  services: {
    enableUpdates:      false,
    enableFilterRefresh: false,
    enableModsRegistry:  false,
    enableCwsProxy:      false,
  },
};

export function SetupApp(): React.ReactElement {
  const [state, setState] = useState<SetupState>(DEFAULT_STATE);

  const currentIndex = STEPS.indexOf(state.step);

  function next(): void {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= STEPS.length) {
      commit();
      return;
    }
    setState(prev => ({ ...prev, step: STEPS[nextIndex] }));
  }

  function commit(): void {
    try {
      window.__fennec?.setup?.commit(state);
    } catch {
      // Development / preview — no Mojo bridge present.
      console.info('[fennec:setup] commit (no-op — no bridge)', state);
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight:       '100vh',
    background:      'var(--fnc-surface-base)',
    color:           'var(--fnc-text-primary)',
    fontFamily:      'var(--fnc-font-sans)',
    fontSize:        'var(--fnc-text-base)',
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         'var(--fnc-space-6)',
  };

  const cardStyle: React.CSSProperties = {
    background:   'var(--fnc-surface-raised)',
    borderRadius: 'var(--fnc-radius-2xl)',
    boxShadow:    'var(--fnc-shadow-xl)',
    width:        '100%',
    maxWidth:     '540px',
    overflow:     'hidden',
  };

  // Step progress dots.
  const progressStyle: React.CSSProperties = {
    display:    'flex',
    gap:        'var(--fnc-space-1)',
    padding:    'var(--fnc-space-4) var(--fnc-space-6) 0',
    alignItems: 'center',
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Progress indicator */}
        <div style={progressStyle} aria-hidden="true">
          {STEPS.map((step, idx) => {
            const isPast    = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            return (
              <span
                key={step}
                style={{
                  flex:         isCurrent ? '1' : undefined,
                  height:       '4px',
                  minWidth:     isCurrent ? undefined : '4px',
                  width:        isCurrent ? undefined : '4px',
                  borderRadius: 'var(--fnc-radius-full)',
                  background:   isCurrent
                    ? 'var(--fnc-accent)'
                    : isPast
                      ? 'var(--fnc-color-fox-200)'
                      : 'var(--fnc-border-subtle)',
                  transition:   `all var(--fnc-duration-gentle) var(--fnc-ease-calm)`,
                }}
              />
            );
          })}
        </div>

        {/* Screen content */}
        {state.step === 'welcome' && (
          <WelcomeStep onNext={next} />
        )}

        {state.step === 'services' && (
          <ServicesStep
            services={state.services}
            onChange={patch =>
              setState(prev => ({
                ...prev,
                services: { ...prev.services, ...patch },
              }))
            }
            onNext={next}
          />
        )}

        {state.step === 'done' && (
          <DoneStep
            services={state.services}
            onFinish={next}
          />
        )}
      </div>
    </div>
  );
}
