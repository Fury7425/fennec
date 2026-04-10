import type { FennecLayoutConfig, ModSurface } from './models';
import { activateModsForSurface } from './mod-surface-runtime';
import type { RegisteredPanel } from './mods';
import { applyLayoutConfig, initializeLayoutConfig, loadLayoutConfig, subscribeToLayoutConfig } from './layout';
import { loadSettingsSnapshot, subscribeToSettingsSnapshot } from './settings-store';
import { initializeThemeTokens } from './theme';

interface SurfaceRuntimeCallbacks {
  onPanelsChange?: (panels: RegisteredPanel[]) => void;
  onLayoutChange?: (layout: FennecLayoutConfig) => void;
}

export function initializeChromeRuntime(callbacks: SurfaceRuntimeCallbacks = {}): () => void {
  initializeThemeTokens();
  document.documentElement.dataset.theme = loadSettingsSnapshot().theme;
  const baseLayout = initializeLayoutConfig();
  callbacks.onLayoutChange?.(baseLayout);

  const applyEffectiveLayout = (layout: FennecLayoutConfig): void => {
    applyLayoutConfig(layout);
    callbacks.onLayoutChange?.(layout);
  };

  const disposeLayout = subscribeToLayoutConfig(layout => {
    applyEffectiveLayout(layout);
  });
  const disposeSettings = subscribeToSettingsSnapshot(settings => {
    document.documentElement.dataset.theme = settings.theme;
  });

  return () => {
    disposeLayout();
    disposeSettings();
  };
}

export function initializeSurfaceRuntime(
  surface: ModSurface,
  callbacks: SurfaceRuntimeCallbacks = {},
): () => void {
  const disposeChrome = initializeChromeRuntime(callbacks);

  const applyEffectiveLayout = (layout: FennecLayoutConfig): void => {
    applyLayoutConfig(layout);
    callbacks.onLayoutChange?.(layout);
  };

  const disposeMods = activateModsForSurface({
    surface,
    onPanelsChange: callbacks.onPanelsChange,
    onLayoutOverrideChange: layout => {
      applyEffectiveLayout(layout ?? loadLayoutConfig());
    },
  });

  return () => {
    disposeChrome();
    disposeMods();
  };
}
