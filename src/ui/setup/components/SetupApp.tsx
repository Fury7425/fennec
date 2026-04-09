import React, { useState } from 'react';
import type { SetupState, SetupStep } from '../types';
import { WelcomeStep } from './WelcomeStep';
import { PrivacyStep } from './PrivacyStep';
import { ServicesStep } from './ServicesStep';
import { AppearanceStep } from './AppearanceStep';
import { DoneStep } from './DoneStep';

const STEPS: SetupStep[] = ['welcome', 'privacy', 'services', 'appearance', 'done'];

const STEP_LABELS: Record<SetupStep, string> = {
  welcome:    'Welcome',
  privacy:    'Privacy',
  services:   'Services',
  appearance: 'Appearance',
  done:       'Done',
};

const DEFAULT_STATE: SetupState = {
  step: 'welcome',
  privacy: {
    blockThirdPartyCookies: true,
    httpsOnly:              true,
    webrtcProtection:       true,
    noPasswordManager:      true,
  },
  services: {
    enableSync:    false,
    syncServerUrl: '',
    enableUpdates: false,
  },
  appearance: {
    theme:       'system',
    accentColor: '#e8780f',
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
      // No-op: not in browser context (development / preview)
      console.info('[fennec:setup] commit called (no-op — no Mojo bridge)', state);
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
    maxWidth:     '520px',
    overflow:     'hidden',
  };

  const progressBarStyle: React.CSSProperties = {
    display:         'flex',
    gap:             'var(--fnc-space-1)',
    padding:         'var(--fnc-space-4) var(--fnc-space-6) 0',
    alignItems:      'center',
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Progress indicator */}
        <div style={progressBarStyle}>
          {STEPS.map((step, idx) => {
            const isPast    = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const dotStyle: React.CSSProperties = {
              flex:          isCurrent ? '1' : undefined,
              height:        '4px',
              minWidth:      isCurrent ? undefined : '4px',
              width:         isCurrent ? undefined : '4px',
              borderRadius:  'var(--fnc-radius-full)',
              background:    isCurrent
                ? 'var(--fnc-accent)'
                : isPast
                  ? 'var(--fnc-color-fox-200)'
                  : 'var(--fnc-border-subtle)',
              transition:    `all var(--fnc-duration-gentle) var(--fnc-ease-calm)`,
            };
            return (
              <span key={step} style={dotStyle} title={STEP_LABELS[step]} />
            );
          })}
        </div>

        {/* Step content */}
        {state.step === 'welcome' && (
          <WelcomeStep onNext={next} />
        )}
        {state.step === 'privacy' && (
          <PrivacyStep
            state={state.privacy}
            onChange={privacy => setState(prev => ({ ...prev, privacy }))}
            onNext={next}
          />
        )}
        {state.step === 'services' && (
          <ServicesStep
            state={state.services}
            onChange={services => setState(prev => ({ ...prev, services }))}
            onNext={next}
          />
        )}
        {state.step === 'appearance' && (
          <AppearanceStep
            state={state.appearance}
            onChange={appearance => setState(prev => ({ ...prev, appearance }))}
            onNext={next}
          />
        )}
        {state.step === 'done' && (
          <DoneStep
            setupState={state}
            onNext={next}
          />
        )}
      </div>
    </div>
  );
}
