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

# A release build signed with a stable key when one is configured: not
# debuggable, and every future build installs cleanly over the last one. Without
# a keystore we fall back to a debug build, which still installs but is only fit
# for your own device.
GRADLE_ARGS=(--no-daemon -PversionName="$VERSION" -PversionCode="$BUILD_NUMBER")
if [ -n "${GARAGEBOOK_KEYSTORE:-}" ] && [ -f "$GARAGEBOOK_KEYSTORE" ]; then
  echo "==> Compiling a signed release APK"
  GRADLE_ARGS+=(
    -PgbStoreFile="$GARAGEBOOK_KEYSTORE"
    -PgbStorePassword="$GARAGEBOOK_KEYSTORE_PASS"
    -PgbKeyAlias="${GARAGEBOOK_KEY_ALIAS:-garagebook}"
    assembleRelease
  )
  APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
else
  echo "==> No keystore configured — compiling a DEBUG APK (fine for your own phone,"
  echo "    not for sharing). Set GARAGEBOOK_KEYSTORE in .env.local for a release build."
  GRADLE_ARGS+=(assembleDebug)
  APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
fi

cd "$ROOT/android"
./gradlew "${GRADLE_ARGS[@]}"

[ -f "$APK" ] || { echo "Build produced no APK at $APK"; exit 1; }

# Version in the filename so a downloads folder stays legible.
NAME="GarageBook-$VERSION.apk"
rm -rf "$OUT" && mkdir -p "$OUT"
cp "$APK" "$OUT/$NAME"

echo
echo "Built: $OUT/$NAME"

# Optionally drop a copy where your phone can reach it (cloud-synced folder,
# shared drive, anywhere). Set GARAGEBOOK_DELIVERY_DIR to enable; unset it and
# the build simply stays in dist-apk/.
if [ -n "${GARAGEBOOK_DELIVERY_DIR:-}" ]; then
  mkdir -p "$GARAGEBOOK_DELIVERY_DIR"
  cp "$OUT/$NAME" "$GARAGEBOOK_DELIVERY_DIR/"
  echo "Copied to: $GARAGEBOOK_DELIVERY_DIR/$NAME"
fi

echo "Install: copy it to the phone and tap it (allow 'install unknown apps' once)."
