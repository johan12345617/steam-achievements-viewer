# Steam Achievements mobile

<!-- impeccable:product-schema 1 -->

## Platform

Android first, using React Native and Expo. The user requested native mobile views,
a simple layout, Tailwind styling, tested Steam login, and an installable APK.
The code also targets iOS, but this delivery is validated for Android only.

## Purpose and capabilities

Adapt the existing Steam Achievements Viewer: inspect Steam library and achievement
progress, browse RetroAchievements by public username, and attach screenshots or
clips to unlocked achievements when signed in. Preserve the existing backend and
Angular web app. Public Steam profile previews are read-only; sample mode uses
explicitly labeled illustrative data.

## Configuration

The user confirmed https://johanstuff.tikraq.pe as the backend.
Its API prefix is /api. Public build configuration belongs in mobile/.env. Steam
API keys, the cookie signing secret, RetroAchievements keys, and R2 credentials
remain exclusively in backend environment variables.

## Constraints

Steam authentication happens in the system browser and returns to the app through
a verified code exchange. The deployed backend must include the mobile auth
endpoints. Sample mode must never grant an authenticated identity or upload access.
No store publication or production signing is included in a local test APK.

## Open decisions

iOS distribution and tablet-specific layouts are outside the requested Android
test build. A future production deployment with multiple backend instances needs
shared storage for native sessions and pending login transactions.
