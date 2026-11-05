# Lockin for Mac

A native Mac app around the Lockin web app. The web files are bundled inside, so it works offline.

**Mac-only upgrades** (wired in `bridge.js` ↔ `Lockin.swift`):
- **Looking away counts app switches**: switching to any other app, minimising or closing the window counts, not just leaving a browser tab.
- **Hands-free on macOS speech recognition**, on-device when the Mac supports it, with spoken answers in the macOS voice.
- **Real macOS notifications** for reminders.
- **A timer in the menu bar** with Start 25/45/60, Pause/Resume, +5 min and Finish. Closing the window keeps the timer running; click the Dock icon to bring it back.
- **Invite links** point at the public web app, so friends can open them in any browser.

## Build

    ./build.sh

This writes `build/Lockin.app` (Apple Silicon + Intel, macOS 13+) and `build/Lockin-mac.zip`. It needs only the command-line Swift tools and Python with Pillow (for the icon). Re-run it after changing the web app, because the app carries its own copy of the files.

Self-test (prints which features work inside the app, saves a snapshot, quits):

    LOCKIN_SELFTEST=write build/Lockin.app/Contents/MacOS/Lockin
    LOCKIN_SELFTEST=read  build/Lockin.app/Contents/MacOS/Lockin   # checks saved data survived

## Sharing it

The app is signed ad-hoc (no paid Apple Developer account), so the first time someone opens it macOS says it "can't be opened". Fix: right-click Lockin.app → **Open** → **Open**. On macOS 15 and later, go to System Settings → Privacy & Security → **Open Anyway** instead. To remove the warning entirely it would need a Developer ID ($99/year) and notarisation.

The app keeps its own data, separate from Safari or Chrome.
