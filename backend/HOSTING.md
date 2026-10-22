# Hosting handoff

Deploy the `backend/` directory of this repository. It is a single NestJS/Node.js
service. The Angular website and the Expo/Android build tools are not needed to
run the API for the mobile app.

## What the owner provides

- Repository access and the branch/commit containing the mobile authentication
  update. Uncommitted local files are not included when someone clones GitHub.
- The existing `STEAM_API_KEY` and, for retro features, `RETROACHIEVEMENTS_API_KEY`.
- The four existing R2 settings below if media uploads/viewing are enabled.
- The current web frontend origin for `FRONTEND_URL` and `CORS_ORIGIN` if the web
  app is also used. Native Android requests do not require browser CORS permission.

Pass actual secrets privately or enter them in the host's environment settings.
Do not commit a populated `.env` or put server secrets in the mobile app.

## What the host provides

- Node.js 22 with npm; the backend was tested on Node 22.22.3. Use an up-to-date
  Node 22 patch. [Node release status](https://nodejs.org/en/about/previous-releases).
- One shared vCPU, 512 MiB available to the app (1 GiB gives more headroom), and
  1–2 GiB application disk space, excluding the OS and container images.
- A public HTTPS origin, for example `https://api.example.com`, with a valid
  certificate. Proxy requests to the backend's internal port 3000, preserving
  `/api`, query strings, authorization headers, cookies, and redirects.
- One running backend process, supervised by the host's existing systemd,
  container, or process manager setup, with automatic restart and log rotation.
- Outbound HTTPS access to Steam, RetroAchievements, and Cloudflare R2.

Do not cache `/api/auth/*` responses. Current native sessions and in-progress
logins live in memory: restarting or redeploying the process signs users out.
Run one process/replica until the session store is made shared and durable.

## Backend environment

Set these as service environment variables, or create `backend/.env`. Replace
every example value. Keep `AUTH_COOKIE_SECRET` stable across deployments.

```dotenv
NODE_ENV=production
PORT=3000

# Required: the new API origin, without /api or a trailing slash.
BACKEND_URL=https://api.example.com
STEAM_API_KEY=replace_with_existing_steam_api_key
AUTH_COOKIE_SECRET=replace_with_a_long_random_secret

# Existing web frontend origin, not the native app's callback scheme.
# These are used for web login redirects and browser CORS.
FRONTEND_URL=https://app.example.com
CORS_ORIGIN=https://app.example.com

# Optional: required when using RetroAchievements features.
RETROACHIEVEMENTS_API_KEY=replace_with_existing_retroachievements_key

# Optional: all four are required when using achievement media.
R2_ACCOUNT_ID=replace_with_existing_account_id
R2_ACCESS_KEY_ID=replace_with_existing_access_key_id
R2_SECRET_ACCESS_KEY=replace_with_existing_secret_access_key
R2_BUCKET=replace_with_existing_bucket_name
```

If the deployment is mobile-only, the web frontend settings can be omitted; they
are not used by native login. Set real values before enabling the web login flow.

The host can generate a new cookie secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## Build and start

From a checkout containing the updated backend:

```bash
cd backend
npm ci --include=dev
npm run build
npm run start:prod
```

The build needs the development dependencies (Nest CLI and TypeScript), even
when the runtime environment is production. The start command runs the compiled
`dist/main.js`; use it as the supervised service command with `backend/` as its
working directory. It needs `NODE_ENV=production` and the configuration above.
See the [Nest production deployment guide](https://docs.nestjs.com/deployment).

No local database, Redis, GPU, media transcoder, Android SDK, or Metro server is
required by the current backend. Native media uploads and playback go directly
between the phone and R2 using signed URLs.

## Verify and reconnect the app

```bash
curl --fail https://api.example.com/api/auth/mobile/config
```

Expected HTTP 200:

```json
{"enabled":true,"version":1,"redirectUri":"steamachievements://auth/callback","codeChallengeMethod":"S256"}
```

The Steam browser callback must be reachable at
`https://api.example.com/api/auth/steam/callback`. The readiness endpoint verifies
the deployed route, not the validity of the Steam/R2 credentials; finish by signing
in from the installed app and checking a small media upload if R2 is enabled.

Send the final API origin back to the owner. In the existing APK's Server settings,
enter `https://api.example.com/api` and test the connection. This permits testing
the new host without rebuilding. To make it the default in future APKs, set
`EXPO_PUBLIC_API_URL=https://api.example.com/api` in `mobile/.env` and rebuild.

If the Angular website is also used, update its production API URL in
`src/environments/environment.ts`, then rebuild/redeploy that website. Hosting
that frontend is a separate step from this backend handoff.
