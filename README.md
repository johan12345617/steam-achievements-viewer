# Steam Achievements Viewer

A full-stack achievement tracker for Steam and RetroAchievements. Browse your game library, inspect completion progress and rarity, review recent unlocks, and attach screenshots or clips to completed achievements.

## Features

- Sign in with Steam OpenID, or preview a public profile using a Steam ID or vanity URL
- Dashboard with total progress, recent unlocks, and rare achievements
- Search, sort, filter, and paginate owned Steam games
- View unlocked, locked, and hidden achievements with global completion percentages
- Connect a RetroAchievements username and browse progress by game
- Upload and view achievement images or videos using Cloudflare R2
- Responsive Steam-inspired interface built with Tailwind CSS


## Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- npm
- A [Steam Web API key](https://steamcommunity.com/dev/apikey)
- A RetroAchievements Web API key if you want to use the retro game features
- A Cloudflare R2 bucket if you want to upload achievement media

Steam profiles must expose their game details publicly for the app to retrieve owned games and achievement progress.

## Android mobile app

The native React Native + Expo app is in [`mobile/`](mobile/README.md). It uses
NativeWind/Tailwind, supports Steam and RetroAchievements, and builds a standalone
test APK with `npm run apk` from that directory. Public build settings are loaded
from `mobile/.env` (copy `mobile/.env.example` for a fresh checkout).

Deploy the updated backend before testing Steam sign-in in the APK; mobile login
uses a browser-to-app code exchange instead of sharing the web browser's cookie.
See [`backend/MOBILE_AUTH.md`](backend/MOBILE_AUTH.md) for configuration and tests.

## Getting started

### 1. Install dependencies

The frontend and backend have separate dependency trees:

```bash
npm install
cd backend
npm install
cd ..
```

### 2. Configure the backend

Copy the example environment file:

```powershell
Copy-Item backend/.env.example backend/.env
```

On macOS or Linux:

```bash
cp backend/.env.example backend/.env
```

Then update `backend/.env`:

```env
PORT=3000
NODE_ENV=development

STEAM_API_KEY=your_steam_api_key
RETROACHIEVEMENTS_API_KEY=your_retroachievements_api_key

CORS_ORIGIN=http://localhost:4200
FRONTEND_URL=http://localhost:4200
BACKEND_URL=http://localhost:3000
AUTH_COOKIE_SECRET=replace_with_a_long_random_secret

R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET=your_r2_bucket_name
```

`STEAM_API_KEY` is required for Steam data and OpenID login. `RETROACHIEVEMENTS_API_KEY` is only required for RetroAchievements features. The four `R2_*` values are only required for media uploads and retrieval. Always set a strong `AUTH_COOKIE_SECRET` in production.

### 3. Start the backend

Run this from the `backend` directory:

```bash
cd backend
npm run start:dev
```

The API will be available at `http://localhost:3000/api`.

### 4. Start the frontend

In a second terminal, run this from the project root:

```bash
npm start
```

Open [http://localhost:4200](http://localhost:4200). During development, Angular proxies `/api` requests to the NestJS server using `proxy.conf.json`.

## Available scripts

### Frontend

| Command | Description |
| --- | --- |
| `npm start` | Start the Angular development server |
| `npm run build` | Create a production frontend build |
| `npm run watch` | Rebuild the frontend when files change |
| `npm test` | Run the Angular test suite |

### Backend

Run these commands inside `backend`:

| Command | Description |
| --- | --- |
| `npm run start:dev` | Start NestJS in watch mode |
| `npm run build` | Compile the backend |
| `npm start` | Run the compiled backend from `dist` |
| `npm run lint` | Lint and automatically fix backend TypeScript files |
| `npm run format` | Format backend TypeScript files |

## Project structure

```text
steam-achievements-viewer/
|-- src/
|   |-- app/
|   |   |-- components/     # Navigation, upload modal, and media viewer
|   |   |-- models/         # Steam and RetroAchievements types
|   |   |-- pages/          # Login, dashboard, games, and detail pages
|   |   `-- services/       # API and media clients
|   `-- environments/       # Development and production API settings
|-- backend/
|   `-- src/
|       |-- auth/           # Steam OpenID and signed cookie sessions
|       |-- media/          # Cloudflare R2 media storage
|       |-- retroachievements/
|       `-- steam/          # Steam Web API integration
|-- proxy.conf.json
|-- tailwind.config.js
`-- angular.json
```

## Offline demo mode

The frontend includes mock Steam data and in-memory media for UI development. To use it, set `offlineMode` to `true` in the relevant file under `src/environments/`, then restart the Angular development server. Mock media is temporary and disappears when the page is reloaded.

## Production notes

For deployment on a friend's server or a VPS, see the [backend hosting handoff](backend/HOSTING.md)
for the exact environment variables, build/start commands, and mobile connection check.

- Set `NODE_ENV=production` and use a strong `AUTH_COOKIE_SECRET`.
- Update `FRONTEND_URL`, `BACKEND_URL`, and `CORS_ORIGIN` to the deployed HTTPS origins.
- Update `src/environments/environment.ts` if the production API is hosted somewhere else.
- Build both applications with `npm run build` in the project root and in `backend`.
