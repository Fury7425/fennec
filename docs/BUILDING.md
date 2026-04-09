# Building Fennec

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 | For fennec-surfer CLI and WebUI |
| Python | ≥ 3.11 | For devutils scripts |
| Git | ≥ 2.40 | |
| **macOS** | Xcode 15+ | Command Line Tools required |
| **Linux** | GCC 12+ / Clang 16+ | `build-essential`, `libgtk-3-dev` |
| **Windows** | VS 2022, Windows SDK 10.0.22621 | |

Disk space: ~50 GB (Chromium source + build artifacts).

---

## 1. Clone and set up the CLI

```sh
git clone https://github.com/fennec-browser/fennnec
cd fennnec

# Install WebUI deps
npm install

# Build the CLI
cd fennec-surfer
npm install
npm run build
cd ..
```

After this, you can run the CLI as:
```sh
node fennec-surfer/dist/index.js <command>
# or install globally:
npm install -g .
fennec <command>
```

---

## 2. Bootstrap

Bootstrap downloads Chromium, verifies its SHA-256, extracts it, fetches upstream patch sets, and applies the full patch series.

```sh
fennec bootstrap [--channel release|nightly]
```

This will:
1. Download `chromium-124.0.6367.201.tar.xz` (~5 GB)
2. Verify SHA-256
3. Extract to `chromium-src/`
4. Clone ungoogled-chromium patches at pinned revision
5. Clone Iridium patches at pinned revision
6. Copy core patches to `patches/core/`
7. Run `devutils/domain_substitution.py`
8. Run binary pruning
9. Apply ungoogled-chromium patches
10. Apply Iridium patches
11. Apply Fennec patch series (`patches/series`)
12. Run `npm install` for WebUI

---

## 3. Build

```sh
fennec build [--channel release|nightly] [--gn-only]
```

GN args are generated from `surfer.json` and written to `chromium-src/out/<Channel>/args.gn`. Then `gn gen` and `ninja` are run.

---

## 4. Package

```sh
fennec package [--channel release|nightly]
```

| Platform | Output |
|----------|--------|
| macOS | `Fennec-1.0.0.dmg` (codesigned + notarized) |
| Linux | `Fennec-1.0.0-x86_64.AppImage` |
| Windows | `FennecSetup-1.0.0.exe` (NSIS) |

---

## 5. Platform notes

### macOS
Set `FENNEC_MACOS_CERT` to your Developer ID Application certificate name.
Notarization requires `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_PASSWORD` env vars.

### Linux
The AppImage build requires `appimagetool` in PATH.

### Windows
Code signing requires `FENNEC_WIN_CERT` pointing to a `.pfx` file and `FENNEC_WIN_CERT_PASSWORD`.

---

## Troubleshooting

**`fennec bootstrap` fails at patch apply**
```sh
fennec patch validate --skip-core
```
Check which patch failed and inspect the diff against the Chromium version.

**GN errors about missing args**
Delete `chromium-src/out/<Channel>/` and re-run `fennec build`.

**Out of disk space**
Run `fennec build --channel release` only — nightly keeps a separate out dir.
