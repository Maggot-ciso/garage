#!/usr/bin/env bash
# Builds an installable .apk for sideloading onto an Android phone. Unlike iOS,
# Android needs no developer account, no re-signing service and no 7-day expiry:
# a debug-signed APK installs directly once "install unknown apps" is allowed.
#
# The toolchain lives in user-space (no Homebrew, no sudo), matching how Node is
# installed on this machine:
#   JDK          ~/.local/opt/jdk-21*/Contents/Home
#   Android SDK  ~/Library/Android/sdk
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Machine-local settings (never committed) — e.g. GARAGEBOOK_DELIVERY_DIR, so
# where you keep your builds stays your business and off GitHub.
[ -f "$ROOT/.env.local" ] && . "$ROOT/.env.local"
OUT="$ROOT/dist-apk"

# Pick up the user-space JDK/SDK unless the environment already set them.
if [ -z "${JAVA_HOME:-}" ]; then
  JDK_DIR="$(ls -d "$HOME"/.local/opt/jdk-21* 2>/dev/null | head -1 || true)"
  [ -n "$JDK_DIR" ] && export JAVA_HOME="$JDK_DIR/Contents/Home"
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

[ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ] || {
  echo "No JDK found. Expected ~/.local/opt/jdk-21*/Contents/Home"; exit 1; }
[ -d "$ANDROID_HOME/platforms" ] || {
  echo "No Android SDK at $ANDROID_HOME"; exit 1; }

VERSION="$(node -p "require('$ROOT/package.json').version")"
BUILD_NUMBER="$(git -C "$ROOT" rev-list --count HEAD 2>/dev/null || echo 1)"
echo "==> GarageBook $VERSION ($BUILD_NUMBER) for Android"

echo "==> Building web assets for the native shell"
cd "$ROOT"
CAP_BUILD=1 npm run build
npx cap sync android

echo "==> Compiling the APK"
cd "$ROOT/android"
./gradlew --no-daemon assembleDebug \
  -PversionName="$VERSION" \
  -PversionCode="$BUILD_NUMBER"

APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
[ -f "$APK" ] || { echo "Build produced no APK at $APK"; exit 1; }

rm -rf "$OUT" && mkdir -p "$OUT"
cp "$APK" "$OUT/GarageBook.apk"

echo
echo "Built: $OUT/GarageBook.apk"

# Optionally drop a copy where your phone can reach it (cloud-synced folder,
# shared drive, anywhere). Set GARAGEBOOK_DELIVERY_DIR to enable; unset it and
# the build simply stays in dist-apk/.
if [ -n "${GARAGEBOOK_DELIVERY_DIR:-}" ]; then
  mkdir -p "$GARAGEBOOK_DELIVERY_DIR"
  cp "$OUT/GarageBook.apk" "$GARAGEBOOK_DELIVERY_DIR/"
  echo "Copied to: $GARAGEBOOK_DELIVERY_DIR/GarageBook.apk"
fi

echo "Install: copy it to the phone and tap it (allow 'install unknown apps' once)."
