# 👑 DREAM RUN — Android APK Guide

Your game is **APK-ready**. The project uses [Capacitor 6](https://capacitorjs.com/) to wrap the
web game (`dist/`) in a real native Android app (`com.dreamrun.game`):

- ✅ Installable `.apk` (sideload / share) + Play-ready `.aab`
- ✅ Offline-first (all assets bundled, no server needed)
- ✅ Portrait lock, fullscreen immersive, no URL bar
- ✅ Native splash screen, adaptive icon, status-bar styling
- ✅ Hardware back-button, pause/resume lifecycle, native haptics
- ✅ 60fps WebGL (hardware-accelerated WebView)

---

## Option A — 1-click cloud build (recommended, no setup)

1. Push this project to a GitHub repo.
2. Open the repo → **Actions** tab → **Android APK** workflow.
3. Wait ~4–6 min → download artifacts:
   - **`dream-run.apk`** — tap on any Android phone to install ▶️
   - **`dream-run.aab`** — upload to Play Console later.

> Every push to `main` rebuilds the APK automatically. That's it.

### Install the APK on your phone
1. Send `dream-run.apk` to your phone (Drive, Telegram, USB…).
2. Tap the file → **Install** (allow “Install unknown apps” if asked).
3. Launch **DREAM RUN** from the launcher — fullscreen + offline. 🚀

---

## Option B — Build locally (Android Studio)

Requirements: Node 20+, Java 17, Android Studio (SDK 34+).

```bash
# 1. install + build the web game
npm install
npm run build

# 2. create / sync the native project
npx cap add android        # first time only
npx cap sync android

# 3. generate icons + splash from resources/
npx @capacitor/assets generate --android \
  --iconBackgroundColor '#05060f' \
  --splashBackgroundColor '#05060f'

# 4a. open in Android Studio and press ▶ Run
npx cap open android

# 4b. or build debug APK from CLI:
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

After any web change, just re-run: `npm run build && npx cap sync android`.

---

## Option C — Release build for Google Play

1. Create a keystore (once):
   ```bash
   keytool -genkeypair -v -keystore dreamrun.keystore \
     -alias dreamrun -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Add `android/keystore.properties` (never commit!):
   ```properties
   storeFile=../dreamrun.keystore
   storePassword=YOUR_STORE_PASSWORD
   keyAlias=dreamrun
   keyPassword=YOUR_KEY_PASSWORD
   ```
3. Wire signing in `android/app/build.gradle` (`signingConfigs` → `release`).
   Or sign in CI with GitHub Secrets (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, …).
4. Build: `cd android && ./gradlew bundleRelease`
   → `android/app/build/outputs/bundle/release/app-release.aab`
5. Upload the `.aab` to Play Console (new app: Games → `com.dreamrun.game`).
6. Replace the SHA-256 in `public/.well-known/assetlinks.json` with your
   Play signing fingerprint and deploy the site (for deep links / TWA later).

### Versioning
Bump in **both** places before a store release:
- `android/app/build.gradle` → `versionCode` (+1) / `versionName` ("1.1" …)
- `capacitor.config.ts` → `appendUserAgent: 'DreamRun/1.1'` (optional)

---

## Project map (Android-specific)

| File | Purpose |
|---|---|
| `capacitor.config.ts` | App id `com.dreamrun.game`, splash + status-bar config |
| `resources/icon.png` | 1024px adaptive icon source |
| `resources/splash.png` | 2732px splash source |
| `src/game/android.ts` | Web+PWA helpers **and** Capacitor native bridge |
| `src/main.tsx` | Skips service-worker in native, hides native splash |
| `src/App.tsx` | Native back-button + pause/resume lifecycle |
| `.github/workflows/android-apk.yml` | Cloud APK+AAB builder |
| `scripts/` | Local helper scripts |

## Troubleshooting

| Symptom | Fix |
|---|---|
| White screen in APK | Re-run `npm run build && npx cap sync android` (dist/ must be fresh) |
| Icon not updating | Re-run `@capacitor/assets generate`, then uninstall old app (launcher caches icons) |
| Back button exits instantly | Normal on menu screen; in-game it pauses/closes modals first |
| `SDK location not found` | Open `android/` in Android Studio once, or set `ANDROID_HOME` |
| Gradle too slow | Use CI (Option A) — zero local setup |

Made with 👑 for $DREAM.
