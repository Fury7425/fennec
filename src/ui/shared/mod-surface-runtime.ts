import type { FennecLayoutConfig, InstalledMod, ModSurface } from './models';
import { logModViolation } from './journal-store';
import {
  getActiveLayoutOverride,
  getInstalledModsForSurface,
  type RegisteredPanel,
  subscribeInstalledMods,
  subscribeToModTabChange,
  subscribeToModWorkspaceChange,
} from './mods';
import { loadThemeTokens, saveThemeTokens, subscribeToThemeTokens } from './theme';

interface SurfaceRuntimeOptions {
  surface: ModSurface;
  onPanelsChange?: (panels: RegisteredPanel[]) => void;
  onLayoutOverrideChange?: (layout: FennecLayoutConfig | null) => void;
}

interface SandboxHandle {
  iframe: HTMLIFrameElement;
  dispose: () => void;
}

const MOD_RUNTIME_MESSAGE = '__fennec_mod_runtime__';

function buildSandboxHtml(mod: InstalledMod): string {
  const script = `
    const currentTokens = ${JSON.stringify(loadThemeTokens())};
    const tabListeners = [];
    const workspaceListeners = [];
    const send = (kind, payload) => parent.postMessage({ marker: '${MOD_RUNTIME_MESSAGE}', modId: ${JSON.stringify(mod.id)}, kind, payload }, '*');
    const violation = (api) => {
      send('violation', { api });
      throw new Error('Fennec Mod sandbox blocked ' + api);
    };
    Object.defineProperty(window, 'fetch', { configurable: false, value: (...args) => violation('fetch') });
    class BlockedXMLHttpRequest { constructor() { violation('XMLHttpRequest'); } }
    class BlockedWebSocket { constructor() { violation('WebSocket'); } }
    Object.defineProperty(window, 'XMLHttpRequest', { configurable: false, value: BlockedXMLHttpRequest });
    Object.defineProperty(window, 'WebSocket', { configurable: false, value: BlockedWebSocket });
    Object.defineProperty(window, 'chrome', { configurable: false, get() { return violation('chrome.*'); } });
    window.__fennec = {
      ui: {
        registerPanel(config) {
          send('registerPanel', config);
        },
        getTokens() {
          return { ...currentTokens };
        },
        setToken(key, value) {
          currentTokens[key] = value;
          send('setToken', { key, value });
        },
        onTabChange(callback) {
          tabListeners.push(callback);
        },
        onWorkspaceChange(callback) {
          workspaceListeners.push(callback);
        },
      },
    };
    window.addEventListener('message', event => {
      if (!event.data || event.data.marker !== '${MOD_RUNTIME_MESSAGE}') {
        return;
      }
      if (event.data.kind === 'tokens') {
        Object.assign(currentTokens, event.data.payload);
        return;
      }
      if (event.data.kind === 'tab-change') {
        tabListeners.forEach(listener => listener(event.data.payload));
        return;
      }
      if (event.data.kind === 'workspace-change') {
        workspaceListeners.forEach(listener => listener(event.data.payload));
      }
    });
    ${mod.js ? mod.assets[mod.js] ?? '' : ''}
  `;

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'none'; connect-src 'none'; img-src data:; font-src 'none';" />
    </head>
    <body>
      <script>${script.replaceAll('</script>', '<\\/script>')}</script>
    </body>
  </html>`;
}

function createSandboxHandle(
  mod: InstalledMod,
  pushDynamicPanel: (panel: RegisteredPanel) => void,
): SandboxHandle {
  const iframe = document.createElement('iframe');
  iframe.sandbox.add('allow-scripts');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'absolute';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = '0';
  iframe.srcdoc = buildSandboxHtml(mod);
  document.body.appendChild(iframe);

  const handleMessage = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow || event.data?.marker !== MOD_RUNTIME_MESSAGE) {
      return;
    }

    if (event.data.kind === 'violation') {
      logModViolation(mod.id, event.data.payload?.api ?? 'unknown');
      return;
    }

    if (event.data.kind === 'setToken') {
      const tokens = loadThemeTokens();
      const key = event.data.payload?.key;
      const value = event.data.payload?.value;
      if (typeof key === 'string' && typeof value === 'string') {
        tokens[key as keyof typeof tokens] = value;
        saveThemeTokens(tokens);
      }
      return;
    }

    if (event.data.kind === 'registerPanel' && event.data.payload && typeof event.data.payload.title === 'string') {
      const entryPath = typeof event.data.payload.entry === 'string'
        ? event.data.payload.entry
        : mod.panel?.entry ?? '';
      pushDynamicPanel({
        modId: mod.id,
        title: event.data.payload.title,
        icon: typeof event.data.payload.icon === 'string' ? event.data.payload.icon : mod.panel?.icon ?? '',
        entry: entryPath,
        html: mod.assets[entryPath] ?? '',
      });
    }
  };

  window.addEventListener('message', handleMessage);

  return {
    iframe,
    dispose: () => {
      window.removeEventListener('message', handleMessage);
      iframe.remove();
    },
  };
}

export function activateModsForSurface(options: SurfaceRuntimeOptions): () => void {
  const styleNodes: HTMLStyleElement[] = [];
  const sandboxes: SandboxHandle[] = [];
  const themeSubscribers: Array<() => void> = [];
  let panels: RegisteredPanel[] = [];

  const updatePanels = () => {
    options.onPanelsChange?.(panels);
  };

  const clearRuntime = () => {
    for (const styleNode of styleNodes.splice(0, styleNodes.length)) {
      styleNode.remove();
    }
    for (const sandbox of sandboxes.splice(0, sandboxes.length)) {
      sandbox.dispose();
    }
    panels = [];
    updatePanels();
  };

  const applyRuntime = () => {
    clearRuntime();
    const mods = getInstalledModsForSurface(options.surface);
    const tokenOverrides = mods.reduce<Record<string, string>>((merged, mod) => {
      return { ...merged, ...(mod.tokens ?? {}) };
    }, {});

    if (Object.keys(tokenOverrides).length > 0) {
      const tokenStyle = document.createElement('style');
      tokenStyle.dataset.fennecMod = `tokens-${options.surface}`;
      tokenStyle.textContent = `:root { ${Object.entries(tokenOverrides)
        .map(([key, value]) => `${key}: ${value};`)
        .join(' ')} }`;
      document.head.appendChild(tokenStyle);
      styleNodes.push(tokenStyle);
    }

    const dynamicPanels: RegisteredPanel[] = [];
    const pushDynamicPanel = (panel: RegisteredPanel) => {
      dynamicPanels.push(panel);
      panels = [...panels.filter(existing => existing.modId !== panel.modId), ...dynamicPanels];
      updatePanels();
    };

    panels = mods
      .filter(mod => options.surface === 'sidebar' && Boolean(mod.panel))
      .map(mod => ({
        modId: mod.id,
        title: mod.panel!.title,
        icon: mod.panel!.icon,
        entry: mod.panel!.entry,
        html: mod.assets[mod.panel!.entry] ?? '',
      }));

    for (const mod of mods) {
      if (mod.css && mod.assets[mod.css]) {
        const style = document.createElement('style');
        style.dataset.fennecMod = mod.id;
        style.textContent = mod.assets[mod.css];
        document.head.appendChild(style);
        styleNodes.push(style);
      }

      if (mod.js && mod.assets[mod.js]) {
        sandboxes.push(createSandboxHandle(mod, pushDynamicPanel));
      }
    }

    updatePanels();
    options.onLayoutOverrideChange?.(getActiveLayoutOverride());
  };

  applyRuntime();

  const postToSandboxes = (kind: string, payload: unknown) => {
    for (const sandbox of sandboxes) {
      sandbox.iframe.contentWindow?.postMessage({ marker: MOD_RUNTIME_MESSAGE, kind, payload }, '*');
    }
  };

  themeSubscribers.push(subscribeToThemeTokens(tokens => {
    postToSandboxes('tokens', tokens);
  }));
  themeSubscribers.push(subscribeInstalledMods(() => {
    applyRuntime();
  }));
  themeSubscribers.push(subscribeToModTabChange(tab => {
    postToSandboxes('tab-change', tab);
  }));
  themeSubscribers.push(subscribeToModWorkspaceChange(workspace => {
    postToSandboxes('workspace-change', workspace);
  }));

  return () => {
    for (const dispose of themeSubscribers.splice(0, themeSubscribers.length)) {
      dispose();
    }
    clearRuntime();
  };
}
