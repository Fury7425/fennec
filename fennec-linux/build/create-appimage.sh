#!/usr/bin/env bash
# create-appimage.sh — Package Fennec as an AppImage for Linux
# Requires: appimagetool in PATH, FENNEC_SRC set to chromium-src/out/Release

set -euo pipefail

FENNEC_SRC="${FENNEC_SRC:-chromium-src/out/Release}"
CHANNEL="${CHANNEL:-release}"
VERSION="${VERSION:-1.0.0}"
ARCH="${ARCH:-x86_64}"
OUTPUT="Fennec-${VERSION}-${ARCH}.AppImage"

echo "Building AppImage: ${OUTPUT}"
echo "  Source: ${FENNEC_SRC}"
echo "  Channel: ${CHANNEL}"

# Set up AppDir
APPDIR="$(mktemp -d)/Fennec.AppDir"
mkdir -p "${APPDIR}/usr/bin"
mkdir -p "${APPDIR}/usr/lib/fennec"
mkdir -p "${APPDIR}/usr/share/applications"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/256x256/apps"

# Copy binary and resources
cp "${FENNEC_SRC}/chrome" "${APPDIR}/usr/bin/fennec"
cp -r "${FENNEC_SRC}/"{locales,resources,*.so,*.pak} "${APPDIR}/usr/lib/fennec/" 2>/dev/null || true

# Desktop file and icon
cp "fennec-linux/build/fennec.desktop" "${APPDIR}/usr/share/applications/fennec.desktop"
cp "branding/icons/fennec-256.png" "${APPDIR}/usr/share/icons/hicolor/256x256/apps/fennec.png"

# AppDir root links (required by AppImage spec)
ln -sf "usr/share/applications/fennec.desktop" "${APPDIR}/fennec.desktop"
ln -sf "usr/share/icons/hicolor/256x256/apps/fennec.png" "${APPDIR}/fennec.png"

# AppRun entrypoint
cat > "${APPDIR}/AppRun" << 'EOF'
#!/usr/bin/env bash
HERE="$(dirname "$(readlink -f "$0")")"
export LD_LIBRARY_PATH="${HERE}/usr/lib/fennec:${LD_LIBRARY_PATH:-}"
exec "${HERE}/usr/bin/fennec" "$@"
EOF
chmod +x "${APPDIR}/AppRun"

# Build AppImage
ARCH="${ARCH}" appimagetool "${APPDIR}" "${OUTPUT}"
echo "Done: ${OUTPUT}"
