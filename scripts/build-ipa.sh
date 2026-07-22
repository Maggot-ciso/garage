#!/usr/bin/env bash
# Builds an unsigned .ipa for sideloading — no Apple Developer Program, no
# signing identity, no money. AltStore (or Sideloadly) re-signs it on the device
# with your own free Apple ID at install time.
#
# Requires Xcode (not just Command Line Tools).
#   xcode-select -p   should print /Applications/Xcode.app/Contents/Developer
#   if it prints /Library/Developer/CommandLineTools, run:
#   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Machine-local settings (never committed) — e.g. GARAGEBOOK_DELIVERY_DIR, so
# where you keep your builds stays your business and off GitHub.
[ -f "$ROOT/.env.local" ] && . "$ROOT/.env.local"
BUILD_DIR="$ROOT/ios/build"
OUT="$ROOT/dist-ipa"

command -v xcodebuild >/dev/null || { echo "xcodebuild not found — install Xcode"; exit 1; }
if ! xcodebuild -version >/dev/null 2>&1; then
  echo "xcodebuild found but not usable. Xcode is probably not selected:"
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

echo "==> Building web assets for the native shell"
cd "$ROOT"
CAP_BUILD=1 npm run build
npx cap sync ios

echo "==> Compiling the iOS app (unsigned)"
# Version comes from package.json (single source); build number = commit count,
# so AltStore shows exactly which build is installed.
VERSION="$(node -p "require('$ROOT/package.json').version")"
BUILD_NUMBER="$(git -C "$ROOT" rev-list --count HEAD 2>/dev/null || echo 1)"
echo "    version $VERSION ($BUILD_NUMBER)"
rm -rf "$BUILD_DIR"
xcodebuild \
  -project "$ROOT/ios/App/App.xcodeproj" \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$BUILD_DIR" \
  MARKETING_VERSION="$VERSION" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  build

APP="$BUILD_DIR/Build/Products/Release-iphoneos/App.app"
[ -d "$APP" ] || { echo "Build produced no App.app at $APP"; exit 1; }

echo "==> Packaging .ipa"
# An .ipa is just a zip with the .app inside a Payload/ directory
rm -rf "$OUT" && mkdir -p "$OUT/Payload"
cp -R "$APP" "$OUT/Payload/"
cd "$OUT"
zip -qry GarageBook.ipa Payload
rm -rf Payload

echo
echo "Built: $OUT/GarageBook.ipa"

# Optionally drop a copy where your phone can reach it (cloud-synced folder,
# shared drive, anywhere). Set GARAGEBOOK_DELIVERY_DIR to enable; unset it and
# the build simply stays in dist-ipa/.
if [ -n "${GARAGEBOOK_DELIVERY_DIR:-}" ]; then
  mkdir -p "$GARAGEBOOK_DELIVERY_DIR"
  cp "$OUT/GarageBook.ipa" "$GARAGEBOOK_DELIVERY_DIR/"
  echo "Copied to: $GARAGEBOOK_DELIVERY_DIR/GarageBook.ipa"
fi

echo "Install it with AltStore — it signs with your own free Apple ID on device."
