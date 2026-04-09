# Fennec

**A browser that respects you.**

[![CI](https://github.com/fennec-browser/fennec/actions/workflows/ci.yml/badge.svg)](https://github.com/fennec-browser/fennec/actions/workflows/ci.yml)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

Fennec is a privacy-first, Chromium-based desktop browser built on two pillars:

| Pillar | What it means |
|--------|---------------|
| **Transparency** | Every network request is visible to you. Zero requests are made before you consent. The Request Journal logs all activity in plain language. |
| **Privacy** | Aggressive defaults: no third-party cookies, HTTPS-only, WebRTC IP protection, no built-in password manager, no telemetry. |

---

## Features

### Transparency
- **ConsentFirstNetworkGuard** — blocks all HTTP/HTTPS until `fennec://setup` is completed
- **Request Journal** — SQLite-backed log of every request, accessible at `fennec://journal`
- **Zero boot requests** — verified by CI on every commit

### Privacy
- Third-party cookies blocked by default
- HTTPS-only mode enabled by default
- WebRTC set to DISABLE_NON_PROXIED_UDP
- No built-in password manager
- No sync unless you opt in with your own server
- No telemetry, no crash reporting, no Google API keys

### Calm UI
- Vertical tab sidebar with workspace switcher
- Split view (two pages side by side)
- Glance modal (peek at a link without leaving the current page)
- Mods system — sandboxed UI extensions

---

## Quick start

```sh
# 1. Install the CLI
git clone https://github.com/fennec-browser/fennec
cd fennnec
npm install
cd fennec-surfer && npm install && npm run build && cd ..

# 2. Bootstrap (downloads Chromium 124, applies all patches)
node fennec-surfer/dist/index.js bootstrap

# 3. Build
node fennec-surfer/dist/index.js build --channel release
```

---

## Architecture

```
Chromium 124
  └── ungoogled-chromium patches   (fetched at bootstrap)
        └── Iridium patches         (fetched at bootstrap)
              └── Fennec patches    (patches/vendor/fennec/)
                    └── Fennec WebUI (src/ui/ — React 18 + Vite)
```

**Patch categories:**
- `branding/` — product name, user agent, about page, update URL
- `networking/` — ConsentFirstNetworkGuard, qjz9zk blocker, Request Journal
- `privacy/` — cookie policy, WebRTC, HTTPS, password manager, sync
- `ui/` — vertical sidebar, workspaces, split view, Glance, Mods

---

## Mods

Mods are sandboxed JavaScript extensions that can inject UI into Fennec's WebUI surfaces (`sidebar`, `newtab`, `settings`, `theme`). They cannot access page content or make network requests.

A mod is a directory with a `mod.json` manifest:

```json
{
  "id": "my-mod",
  "name": "My Mod",
  "version": "1.0.0",
  "fennecVersion": ">=1.0.0",
  "entry": "index.js",
  "permissions": ["sidebar"],
  "sandbox": { "noNetwork": true, "noPageAccess": true }
}
```

---

## Contributing

1. Fork the repo and create a feature branch
2. Write a patch: `fennec patch new vendor/fennec/<category>/<name>`
3. Test locally: `fennec patch validate && fennec build`
4. Open a PR against `main`

See [docs/BUILDING.md](docs/BUILDING.md) for the full build guide.

---

## License

GPL-3.0 — see [LICENSE](LICENSE).
