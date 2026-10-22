# Steam Achievements — Expo mobile app

Native React Native screens, NativeWind/Tailwind styling, and the existing NestJS
API. This app lives beside the Angular web app; it does not replace it.

## Install the test APK

The local build writes `artifacts/steam-achievements-test.apk` and a SHA-256
checksum alongside it. Transfer the APK to an Android device and open it to
install, or use `adb install -r artifacts/steam-achievements-test.apk`.

The release JS bundle is included. Expo Go and a running Metro server are **not**
needed. This is signed with a test key for sideloading, not a production store key.
The default build includes ARM64 phones and x86_64 emulators.

The app offers Steam sign-in, read-only public Steam profile lookup, and a clearly
labeled offline demo. It includes progress, Steam/RetroAchievements libraries,
achievement details, and signed-in photo/video uploads and playback.

## Environment configuration

Run commands from `mobile/`:

```powershell
npm ci
Copy-Item .env.example .env  # only when .env does not exist
```

The configured `.env` for this delivery uses:

```dotenv
EXPO_PUBLIC_API_URL=https://johanstuff.tikraq.pe/api
APP_NAME=Steam Achievements
ANDROID_PACKAGE=com.steamachievements.viewer
IOS_BUNDLE_IDENTIFIER=com.steamachievements.viewer
APP_VERSION=1.0.0
ANDROID_VERSION_CODE=1
ALLOW_LOCAL_HTTP=false
```

Expo loads `.env` for development, export, and native builds. `app.config.ts` reads
app metadata at build time; `EXPO_PUBLIC_API_URL` is bundled into the app. Rebuild
the APK after changing it. The file is gitignored; `.env.example` is provided as
the template. Existing process environment variables take precedence over `.env`.

Only public values belong here. **Do not put Steam/RetroAchievements API keys,
AUTH_COOKIE_SECRET, R2 credentials, or other secrets in mobile environment files.**
Those stay in the backend's environment. An APK's bundled configuration is public.

Server settings can override the bundled URL on a test device, and changing the
server signs the user out. To restore the default, enter the URL from `.env` again.
HTTP is disabled in the hosted build. For LAN testing, use a private LAN IP in
`EXPO_PUBLIC_API_URL`, set `ALLOW_LOCAL_HTTP=true`, and rebuild. The backend's
`BACKEND_URL` must be reachable from the phone browser too. Android emulator host
access normally uses `10.0.2.2`; a physical phone needs the computer's LAN IP.

## Deploy the mobile login update first

The existing web login relies on a browser cookie. The app adds a separate native
session: system-browser Steam OpenID → verified app callback → PKCE code exchange
→ Android secure storage → bearer-authenticated API requests.

Deploy the updated `backend/` code to the confirmed Render service. Keep its
existing secrets, and set:

```dotenv
BACKEND_URL=https://johanstuff.tikraq.pe
NODE_ENV=production
```

`BACKEND_URL` is the origin, **without** `/api`; the mobile API URL includes `/api`.
Keep a valid `STEAM_API_KEY`, a strong `AUTH_COOKIE_SECRET`, and the existing web
`FRONTEND_URL`/`CORS_ORIGIN`. See [backend protocol and deployment notes](../backend/MOBILE_AUTH.md).

After deployment, `GET /api/auth/mobile/config` must return HTTP 200 with
`enabled: true`, `codeChallengeMethod: "S256"`, and
`redirectUri: "steamachievements://auth/callback"`. The app's **Test connection**
button checks this. At implementation time, the hosted server returned 404 for
this route, while the existing `/api/auth/steam` redirected to Steam successfully.

The current backend keeps native sessions in bounded process memory: deploys or
restarts sign users out. The app rechecks on foreground and recovers from 401s.
Use one backend instance for this version; shared persistent storage is needed
before multi-instance deployment or persistent sessions across restarts.

## Build locally on Windows

Install JDK 17 and the Android SDK (Expo prebuild/Gradle select the required SDK,
NDK and build tools). Set `JAVA_HOME` and `ANDROID_HOME`, then:

```powershell
npm run apk
```

The build script runs Expo prebuild and `:app:assembleRelease`, verifies APK
signing, copies the artifact, and writes its checksum. It prefers a repo-local
`.mobile-tools/android-sdk` if provisioned; generated native projects, caches and
artifacts are ignored. Explicit paths can also be supplied:

```powershell
./scripts/build-android.ps1 -JavaHome 'C:/path/to/jdk-17' -AndroidSdk 'C:/path/to/Android/Sdk'
```

An optional Expo EAS preview profile is provided in `eas.json`:
`eas build --platform android --profile preview`. It requires your Expo account
and project setup; the local build does not. For a cloud build, provide the same
public environment variables through the preview EAS environment/profile.

## Development and checks

```powershell
npm start
npm run android
npm run typecheck
npm test
npm run export:android
```

`npm run web` is a convenient screen preview; Steam native sign-in intentionally
requires the installed APK. Expo Go is not the acceptance environment for the
custom auth callback scheme. Backend validation: `npm test` from `backend/`.

Automated tests cover callback URI/state/expiry, PKCE encoding, invalid and revoked
sessions, API origin restrictions, bearer headers, missing-server-update errors,
and the backend's full HTTP code-exchange transaction. Backend tests replace only
the upstream Steam verification provider; there is no production mock-login route.
These tests are not a claim that a real Steam account completed sign-in.

Validation passed: 17 mobile tests, 16 backend tests, and TypeScript checks. The
delivered APK installed on an isolated Android 14 emulator. Native checks covered
library/detail navigation, achievement filters, Retro screens, account settings,
an unsolicited auth callback, the hosted backend-update error, and an airplane-mode
cold restart into the demo. No JS errors or Android runtime crashes were captured.
Build metadata and the native results are in `artifacts/verification.json`, with
screenshots in `artifacts/screenshots/`. Live Steam login and authenticated uploads
still require the backend deployment and a real account check.

After backend deployment, check on your phone: sign in → Steam confirmation →
return to app; cancel sign-in; relaunch and restore session; open your library;
upload/view/delete one test moment; sign out and confirm it cannot access media.
The app never requests or stores your Steam password.

## Dependency baseline

Expo SDK 57 / React Native 0.86 with NativeWind 4.2.7 and Tailwind 3.4 are pinned
through `package-lock.json`. Use `npx expo install` for compatible native modules.
The dependency audit currently reports transitive advisories in build tooling
(glob/selector parsers and certificate utilities); do not apply the audit's major
version downgrade suggestions blindly. Development servers should remain local.
