#!/bin/bash
# build.sh — builds Lockin.app (Apple Silicon + Intel) from the web app in this repo. No Xcode needed.
#   ./build.sh            → build/Lockin.app and build/Lockin-mac.zip
set -euo pipefail
cd "$(dirname "$0")"
OUT=build; APP=$OUT/Lockin.app
rm -rf "$APP"; mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web/js" "$OUT/tmp"

# 1. the native shell, for both kinds of Mac
for arch in arm64 x86_64; do
  swiftc -O -target $arch-apple-macos13.0 Lockin.swift -o "$OUT/tmp/Lockin-$arch"
done
lipo -create "$OUT/tmp/Lockin-arm64" "$OUT/tmp/Lockin-x86_64" -output "$APP/Contents/MacOS/Lockin"

# 2. the web app (only what the app itself needs)
cp ../index.html ../styles.css ../app.webmanifest ../icon-180.png ../icon-512.png "$APP/Contents/Resources/web/"
for f in store ambience services progress together voice-control app hover; do cp "../js/$f.js" "$APP/Contents/Resources/web/js/"; done
cp bridge.js "$APP/Contents/Resources/"

# 3. icon + Info.plist
python3 make_icon.py "$OUT/tmp" >/dev/null
cp "$OUT/tmp/Lockin.icns" "$APP/Contents/Resources/"
cp Info.plist "$APP/Contents/"

# 4. sign (ad-hoc: fine for your own Mac and friends; see README for the Gatekeeper note)
codesign --force --deep --sign - "$APP"
rm -rf "$OUT/tmp"
( cd "$OUT" && rm -f Lockin-mac.zip && ditto -c -k --keepParent Lockin.app Lockin-mac.zip )
echo "built $APP ($(du -sh "$APP" | cut -f1)) and $OUT/Lockin-mac.zip"
