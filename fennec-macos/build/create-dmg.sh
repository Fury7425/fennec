#!/usr/bin/env bash
# create-dmg.sh — Package Fennec as a .dmg for macOS
# Requires: create-dmg (brew install create-dmg), codesign, notarytool

set -euo pipefail

CHANNEL="${CHANNEL:-release}"
VERSION="${VERSION:-1.0.0}"
APP_NAME="Fennec"
BUILD_DIR="chromium-src/out/Release"
APP_PATH="${BUILD_DIR}/Fennec.app"
OUTPUT="${APP_NAME}-${VERSION}.dmg"

echo "Building DMG: ${OUTPUT}"

# Codesign
if [ -n "${FENNEC_MACOS_CERT:-}" ]; then
  echo "  Signing with: ${FENNEC_MACOS_CERT}"
  codesign --deep --force --verify --verbose \
    --sign "${FENNEC_MACOS_CERT}" \
    --options runtime \
    --entitlements "fennec-macos/build/fennec.entitlements" \
    "${APP_PATH}"
else
  echo "  WARN: FENNEC_MACOS_CERT not set — skipping codesign"
fi

# Create DMG
create-dmg \
  --volname "${APP_NAME} ${VERSION}" \
  --window-pos 200 120 \
  --window-size 600 400 \
  --icon-size 100 \
  --icon "${APP_NAME}.app" 175 190 \
  --hide-extension "${APP_NAME}.app" \
  --app-drop-link 425 190 \
  --no-internet-enable \
  "${OUTPUT}" \
  "${APP_PATH}"

# Notarize
if [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ] && [ -n "${APPLE_APP_PASSWORD:-}" ]; then
  echo "  Notarizing..."
  xcrun notarytool submit "${OUTPUT}" \
    --apple-id "${APPLE_ID}" \
    --team-id "${APPLE_TEAM_ID}" \
    --password "${APPLE_APP_PASSWORD}" \
    --wait
  xcrun stapler staple "${OUTPUT}"
else
  echo "  WARN: Apple credentials not set — skipping notarization"
fi

echo "Done: ${OUTPUT}"
