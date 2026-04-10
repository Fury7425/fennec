/**
 * Vite config for Fennec WebUI pages.
 *
 * Each fennec:// page is a separate entry point. Vite compiles them into
 * self-contained bundles that are embedded into the Chromium binary via
 * WebUIDataSource (patched in vendor/fennec/ui/fennec-webui-pages.patch).
 *
 * All pages share the token system (tokens.css) and the shared component
 * library (src/ui/shared/).
 */

import { defineConfig } from 'vite';
import react            from '@vitejs/plugin-react';
import { resolve }      from 'path';

export default defineConfig({
  plugins: [react()],

  // Each fennec:// page is a separate HTML entry point.
  build: {
    rollupOptions: {
      input: {
        setup:    resolve(__dirname, 'src/ui/setup/index.html'),
        newtab:   resolve(__dirname, 'src/ui/newtab/index.html'),
        settings: resolve(__dirname, 'src/ui/settings/index.html'),
        sidebar:  resolve(__dirname, 'src/ui/sidebar/index.html'),
        journal:  resolve(__dirname, 'src/ui/journal/index.html'),
        mods:     resolve(__dirname, 'src/ui/mods/index.html'),
      },
    },
    // Output to chromium-src/chrome/browser/resources/fennec/ via the patch.
    outDir:    'dist/webui',
    emptyOutDir: true,
    // No code splitting — each page is self-contained for WebUI embedding.
    modulePreload: { polyfill: false },
  },

  resolve: {
    alias: {
      '@tokens':  resolve(__dirname, 'src/ui/tokens'),
      '@shared':  resolve(__dirname, 'src/ui/shared'),
    },
  },

  // In development, serve pages at localhost so you can work on them
  // outside the browser shell. WebUI-specific APIs (window.__fennec.*) are
  // stubbed in src/ui/shared/fennec-stub.ts.
  server: {
    port: 5173,
    strictPort: true,
  },

  css: {
    // PostCSS / Tailwind is applied globally.
    // tokens.css is imported in each page's entry main.tsx.
  },
});
