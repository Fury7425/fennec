#!/usr/bin/env node

import vm from 'node:vm';

const violations = [];
const panels = [];
const tokens = { '--fennec-color-accent': '#e8824a' };
const tabListeners = [];
const workspaceListeners = [];

function violation(api) {
  violations.push(api);
  throw new Error(`sandbox blocked ${api}`);
}

const ui = {
  registerPanel(config) {
    panels.push(config);
  },
  getTokens() {
    return { ...tokens };
  },
  setToken(key, value) {
    tokens[key] = value;
  },
  onTabChange(callback) {
    tabListeners.push(callback);
  },
  onWorkspaceChange(callback) {
    workspaceListeners.push(callback);
  },
};

const context = vm.createContext({
  console,
  window: { __fennec: { ui } },
  __fennec: { ui },
  fetch: () => violation('fetch'),
  XMLHttpRequest: class BlockedXMLHttpRequest {
    constructor() {
      violation('XMLHttpRequest');
    }
  },
  WebSocket: class BlockedWebSocket {
    constructor() {
      violation('WebSocket');
    }
  },
  chrome: new Proxy({}, {
    get() {
      violation('chrome.*');
      return undefined;
    },
  }),
});

function runScript(label, source, shouldFail = false) {
  let failed = false;
  try {
    vm.runInContext(source, context, { timeout: 1000, filename: `${label}.js` });
  } catch (error) {
    failed = true;
    if (!shouldFail) {
      console.error(`Unexpected sandbox failure in ${label}:`, error.message);
      process.exit(1);
    }
  }

  if (shouldFail && !failed) {
    console.error(`Expected ${label} to be blocked, but it executed successfully.`);
    process.exit(1);
  }
}

runScript(
  'allowed-api',
  `
    window.__fennec.ui.registerPanel({ title: 'Inspector', icon: 'data:image/svg+xml;base64,PHN2Zy8+', entry: 'panel.html' });
    window.__fennec.ui.setToken('--fennec-color-accent', '#112233');
    window.__fennec.ui.onTabChange(() => {});
    window.__fennec.ui.onWorkspaceChange(() => {});
  `,
);

runScript('fetch', 'fetch("https://example.com");', true);
runScript('xhr', 'new XMLHttpRequest();', true);
runScript('websocket', 'new WebSocket("wss://example.com");', true);
runScript('chrome', 'chrome.runtime.sendMessage("x");', true);

if (panels.length !== 1) {
  console.error(`Expected 1 registered panel, saw ${panels.length}.`);
  process.exit(1);
}

if (tokens['--fennec-color-accent'] !== '#112233') {
  console.error('setToken did not update the token map.');
  process.exit(1);
}

if (tabListeners.length !== 1 || workspaceListeners.length !== 1) {
  console.error('Event listeners were not registered correctly.');
  process.exit(1);
}

const expectedViolations = ['fetch', 'XMLHttpRequest', 'WebSocket', 'chrome.*'];
for (const expected of expectedViolations) {
  if (!violations.includes(expected)) {
    console.error(`Missing expected sandbox violation: ${expected}`);
    process.exit(1);
  }
}

console.log('fennec check-mod-sandbox: PASS');
