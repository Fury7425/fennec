# Mods Registry API

`mods.fennec.computer` is the public, open-source-only registry that powers `fennec://mods`.

All registry submissions must point to GPL-3.0-compatible source code. Closed-source Mods are never listed.

## Endpoints

### `GET /api/index.json`

Returns the full registry index as JSON.

Each entry contains:

```json
{
  "id": "calm-research-tools",
  "name": "Calm Research Tools",
  "author": "fennec-community",
  "version": "1.2.0",
  "description": "Floating citations panel and softer workspace tinting.",
  "surfaces": ["sidebar", "layout"],
  "install_count": 812,
  "last_updated": "2026-04-04",
  "license": "GPL-3.0",
  "repo_url": "https://github.com/fennec-browser/mod-calm-research-tools"
}
```

### `GET /api/mod/{id}.fennecmod`

Returns the `.fennecmod` archive for the requested Mod.

The archive is a zip file containing:

- `manifest.json`
- Any CSS, JS, panel HTML, or other assets referenced by the manifest

### `GET /api/mod/{id}/meta.json`

Returns the full metadata document for a single Mod, including:

- Registry index fields
- Manifest contents
- Release notes or changelog excerpt
- Optional screenshot or preview URLs

### `POST /api/submit`

Submits a new Mod for review.

Expected payload:

```json
{
  "repo_url": "https://github.com/example/fennec-mod-example",
  "manifest_url": "https://raw.githubusercontent.com/example/fennec-mod-example/main/manifest.json"
}
```

Submission pipeline requirements:

- `repo_url` must point to a public source repository
- `manifest.json` must validate against [`src/mods/mod.schema.json`](../src/mods/mod.schema.json)
- `license` must be one of the accepted GPL-3.0-compatible SPDX identifiers
- Registry entries are published only after license verification succeeds

## Journal classification

Requests from `fennec://mods` to `mods.fennec.computer` are classified as `fennec-internal` in the Request Journal and remain opt-in via onboarding/settings.
