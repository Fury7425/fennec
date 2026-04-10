# CLAUDE.md

## 1. Project Summary

Fennec is a privacy-first Chromium browser with three standing pillars from earlier phases:

- Transparency: Request Journal, zero boot requests before consent, opt-in internal services.
- Privacy: ungoogled Chromium base plus hardened defaults and bundled uBlock Origin.
- Calm UI: vertical sidebar, workspaces, split view, and Glance.

Phase 4 adds the customization layer: editable shell tokens, live layout presets, sandboxed Mods, and an in-browser Mods registry.

## 2. Phase Map

1. Phase 1 — Branding + de-googling
2. Phase 2 — Request Journal + onboarding gate + bundled blocking
3. Phase 3 — Calm UI shell: sidebar, workspaces, split view, Glance
4. Phase 4 — Mods + customization system

## 3. Directory Tree

```text
src/
  journal/
    request_journal.cc              SQLite-backed request log and observer fan-out.
    request_journal.h               Journal entry schema and browser-process API.
    filter_engine.cc                Request classification and blocking helpers.
    filter_engine.h                 Filter engine interface for Journal tagging.
  mods/
    mod.schema.json                 Phase 4 Mod manifest schema, including tokens/panel/layout blocks.
    mod_runtime.cc                  Browser-process Mod loader, validator, injector, and violation logger.
    mod_runtime.h                   ModRuntime types for manifests, panels, layout overlays, and install control.
  ui/
    fennec-ui-api.d.ts              TypeScript contract for `window.__fennec.ui` inside sandboxed Mod JS.
    tokens/
      tokens.css                    Canonical `--fennec-*` theme tokens plus legacy alias bridge for setup UI.
    shared/
      models.ts                     Shared token, layout, mod, registry, and journal data models.
      theme.ts                      Theme token defaults, sanitization, persistence, and cross-page sync.
      layout.ts                     Layout config defaults, presets, persistence, and sync helpers.
      settings-store.ts             Shared settings snapshot persistence for privacy/services/theme mode.
      journal-store.ts              Local Journal fallback store plus mod-violation/internal request logging.
      zip.ts                        `.fennecmod` zip read/write helpers for install/export flows.
      mods.ts                       Mod archive install, registry fetch, preset export, and event wiring.
      mod-surface-runtime.ts        Per-surface Mod injector with CSS insertion and sandboxed JS iframes.
      page-runtime.ts               Shared page bootstrap for tokens, layout, theme mode, and Mod overlays.
      shell.css                     Shared shell/layout CSS classes used across the new WebUI pages.
      fennec-global.d.ts            Page bridge typing for settings, sidebar, journal, new tab, and Mods.
    settings/
      components/SettingsApp.tsx    Phase 4 control tower: privacy, services, appearance, layout, mods, about.
      index.html                    Settings page entry.
      main.tsx                      Settings bundle bootstrap with token + shell CSS imports.
      types.ts                      Settings section/type exports.
    sidebar/
      components/SidebarApp.tsx     Sidebar shell using live layout state, workspace colors, and registered panels.
      index.html                    Sidebar page entry.
      main.tsx                      Sidebar bundle bootstrap.
      types.ts                      Sidebar tab/workspace event types.
    journal/
      components/JournalApp.tsx     Request Journal feed with filters and detail panel.
      index.html                    Journal page entry.
      main.tsx                      Journal bundle bootstrap.
      types.ts                      Journal type exports and filter tab union.
    newtab/
      components/NewTabApp.tsx      Token-driven new tab page with quick links into settings/journal/mods.
      index.html                    New tab page entry.
      main.tsx                      New tab bundle bootstrap.
    mods/
      components/ModsPageApp.tsx    Registry browsing/install UI for `fennec://mods`.
      index.html                    Mods registry page entry.
      main.tsx                      Mods page bundle bootstrap.
fennec-surfer/
  src/
    commands/
      check_mod_sandbox.ts          CLI command that runs the Mod sandbox escape harness.
devutils/
  check_mod_sandbox.mjs            Node test harness that verifies forbidden Mod APIs stay blocked.
docs/
  MODS_REGISTRY_API.md             Registry endpoint contract for `mods.fennec.computer` / fennec-services.
```

## 4. Tech Stack

### Browser foundation

- Chromium 124 base
- ungoogled-chromium + Iridium hardening via patch series
- Browser-process C++ services for Journal, workspaces, and Mod runtime

### WebUI

- React 18
- TypeScript 5
- Vite multi-entry build for `fennec://setup`, `fennec://newtab`, `fennec://settings`, `fennec://sidebar`, `fennec://journal`, and `fennec://mods`
- CSS variable shell driven by `src/ui/tokens/tokens.css`

### Mods system

`window.__fennec.ui` API surface exposed to sandboxed Mod JS:

- `registerPanel(config: PanelConfig): void`
- `getTokens(): Record<string, string>`
- `setToken(key: string, value: string): void`
- `onTabChange(callback: (tab: FennecTab) => void): void`
- `onWorkspaceChange(callback: (workspace: FennecWorkspace) => void): void`

`mod.schema.json` fields:

- `id`
- `name`
- `version`
- `author`
- `description`
- `license`
- `fennec_min_version`
- `surfaces`
- `css`
- `js`
- `panel`
  - `title`
  - `icon`
  - `entry`
- `tokens`
- `layout`
  - `presetName`
  - `config.sidebar.position`
  - `config.sidebar.displayMode`
  - `config.toolbar`
  - `config.addressBar`
  - `config.journalPanel`
  - `config.splitViewDefault`

Sandbox rules:

- Mod CSS is injected only into declared `fennec://` surfaces.
- Mod JS runs in sandboxed `srcdoc` iframes with only `window.__fennec.ui`.
- Forbidden API attempts (`fetch`, `XMLHttpRequest`, `WebSocket`, `chrome.*`) are blocked and logged to the Request Journal as `mod-violation`.
- Registry discovery stays opt-in and logs as `fennec-internal`.

## 5. Runtime Notes

- User-editable shell tokens persist under `fennec.theme.*`.
- Layout state persists under `fennec.layout.*`.
- Page sync uses `BroadcastChannel`, `postMessage`, and storage events so changes apply to open WebUI pages without reload.
- Layout preset export produces `.fennecmod` zip archives so shareable layouts use the same installation path as other Mods.

## 6. Workflow

- Root WebUI build: `npm run build`
- CLI build: `cd fennec-surfer && npm run build`
- Sandbox validation: `node devutils/check_mod_sandbox.mjs` or `fennec check-mod-sandbox`
- Full browser builds still require `fennec bootstrap` to populate `chromium-src/`

## 7. Validation

- `npm run build`
- `cd fennec-surfer && npm run build`
- `node devutils/check_mod_sandbox.mjs`
- `fennec check-mod-sandbox`

## 8. Build Status

- 2026-04-10 — Phase 1 complete — branding + de-googling present in `patches/vendor/fennec/branding` and privacy/networking layers.
- 2026-04-10 — Phase 2 complete — Request Journal, onboarding gate, uBlock integration, and internal service tagging present in source/patch structure.
- 2026-04-10 — Phase 3 complete — sidebar, workspaces, split view, and Glance shell pieces present in source/patch structure.
- 2026-04-10 — Phase 4 complete — token editor, live layout editor, Mod runtime, `.fennecmod` install/export, and `fennec://mods` registry UI landed in repo source.
- 2026-04-10 — Repo-side validation complete — WebUI build, CLI build, and `fennec check-mod-sandbox` pass locally in this workspace.
- 2026-04-10 — Full `fennec build macos` not yet runnable in this workspace because `chromium-src/` is not bootstrapped; the command currently stops before GN/Ninja with “Run \`fennec bootstrap\` first.”

## 9. Decisions Log

- [2026-04-10] [TOKENS] — Moved the shell onto a single `--fennec-*` token set with live cross-page sync — this lets appearance changes apply everywhere immediately while keeping setup compatibility through legacy aliases — files affected: `src/ui/tokens/tokens.css`, `src/ui/shared/theme.ts`, `src/ui/shared/page-runtime.ts`
- [2026-04-10] [LAYOUT OVERLAY] — Kept layout state separate from theme tokens and layered Mod layout overrides on top at runtime — users keep a stable personal layout while Mods can be enabled/disabled cleanly — files affected: `src/ui/shared/layout.ts`, `src/ui/shared/mod-surface-runtime.ts`, `src/ui/settings/components/SettingsApp.tsx`
- [2026-04-10] [MANIFEST] — Added an optional `layout` block and `layout` surface to the Mod schema — exported layout presets and registry filtering needed a first-class way to describe shareable layouts inside `.fennecmod` archives — files affected: `src/mods/mod.schema.json`, `src/ui/shared/models.ts`, `src/ui/shared/mods.ts`, `docs/MODS_REGISTRY_API.md`
- [2026-04-10] [SANDBOX] — Executed Mod JS in sandboxed `srcdoc` iframes with only `window.__fennec.ui` and explicit traps for forbidden APIs — this gives a practical browser-like sandbox in WebUI preview mode and a clear browser-process contract for C++ integration — files affected: `src/ui/fennec-ui-api.d.ts`, `src/ui/shared/mod-surface-runtime.ts`, `src/mods/mod_runtime.cc`, `src/mods/mod_runtime.h`
- [2026-04-10] [REGISTRY] — Kept registry discovery opt-in and Journal-visible, with an offline fallback dataset in the page layer — the request must stay transparent, but the UI should still be previewable without live network access — files affected: `src/ui/mods/components/ModsPageApp.tsx`, `src/ui/shared/mods.ts`, `src/ui/shared/journal-store.ts`
- [2026-04-10] [VALIDATION] — Added `fennec check-mod-sandbox` as a first-class CLI command backed by a devutils harness — Mod sandbox behavior needs a fast regression test that contributors can run without bootstrapping Chromium — files affected: `devutils/check_mod_sandbox.mjs`, `fennec-surfer/src/commands/check_mod_sandbox.ts`, `fennec-surfer/src/index.ts`, `surfer.json`
