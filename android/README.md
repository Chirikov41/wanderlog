# Wanderlog for Android (APK)

This folder packages the same web build as a native Android app, so it can be installed from a
single `.apk` file with no browser, no hosting and no certificate.

## Why a local HTTP server inside the app

The app is a WebView, but it does not load `file:///android_asset/...`. Chromium treats `file://`
as an opaque origin, which breaks IndexedDB in WebView, and IndexedDB is where every memory is
stored.

Instead, `AssetServer.java` serves the bundled `assets/www` folder over
`http://127.0.0.1:8765`. Loopback is a *secure context* and a normal first-party origin, so the
exact same JavaScript that runs on the deployed PWA also runs here: IndexedDB, the service worker,
`navigator.geolocation` and `getUserMedia` all behave normally, with zero network access.

```
WebView ──▶ http://127.0.0.1:8765 ──▶ AssetServer ──▶ APK assets/www
   │
   ├─ onGeolocationPermissionsShowPrompt  → grant
   ├─ onPermissionRequest (video capture) → grant
   └─ onShowFileChooser                   → system photo picker
```

## Requirements

- JDK 17
- Android SDK: `platforms;android-34`, `build-tools;34.0.0`
- The web build in `../dist` (`pnpm build`)

## Build

```powershell
cd android
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

Optional arguments when the SDK is not in the default location:

```powershell
.\build.ps1 -Sdk "D:\android-sdk" -OutDir "C:\out"
```

The script copies `dist/` into `assets/www`, compiles resources with `aapt2`, compiles the two Java
classes, dexes them with `d8`, adds `classes.dex` to the archive, normalises entry paths, aligns
with `zipalign` and signs with `apksigner`. The result is written to `<OutDir>\Wanderlog.apk`
(`submission/Wanderlog.apk` by default).

## Notes

- The signing key is generated on first build into `build/` (git-ignored). To update an installed
  APK you must sign with the same key, so keep that folder.
- `minSdkVersion` is 23 and `targetSdkVersion` is 34. Camera over WebView needs a reasonably modern
  WebView (Chromium 53+); on very old devices the camera falls back to the system picker.
- The compass relies on `DeviceOrientationEvent`, which WebView does not always expose. The rest of
  the app is unaffected and the entry simply records no heading.
- Cleartext HTTP is enabled in the manifest only for the loopback origin (`usesCleartextTraffic`);
  every network request the app makes (map tiles, geocoding) is HTTPS.
