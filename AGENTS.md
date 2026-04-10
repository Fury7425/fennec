# AGENTS.md

## Working Rules

- Prefer updating source files in `src/`, `fennec-surfer/src/`, and `devutils/` directly rather than patching build artifacts.
- Keep all Fennec WebUI styling on the token system in `src/ui/tokens/tokens.css`.
- Treat Mod install/export as `.fennecmod` zip archives with `manifest.json` plus referenced assets.

## What Requires Human Confirmation

- Any change to the Mod sandbox CSP rules.
- Any change to the registry submission pipeline.
- Any expansion of the `window.__fennec.ui` API surface.

## Validation Commands

- `npm run build`
- `cd fennec-surfer && npm run build`
- `node devutils/check_mod_sandbox.mjs`
- `fennec check-mod-sandbox`
- `fennec build macos` after `fennec bootstrap`
