# Mobile Steam authentication

The native app uses the external browser for Steam OpenID, then exchanges a short-lived authorization code with PKCE. Steam credentials are never entered into the app. The Angular login at `/api/auth/steam` continues to issue the existing signed browser cookie.

## Deployment

Deploy this backend version before testing login in the APK. A pre-existing deployment without these routes will report that mobile login is unavailable. `GET /api/auth/mobile/config` is a public readiness endpoint and exposes only supported protocol configuration.

Set `BACKEND_URL` to the public HTTPS origin, for example `https://johanstuff.tikraq.pe`, with no `/api` suffix or other path. Set a valid `STEAM_API_KEY`, a strong `AUTH_COOKIE_SECRET`, `FRONTEND_URL`, and the existing web `CORS_ORIGIN`. Production rejects an HTTP backend origin. Local phone testing requires a reachable backend URL; a phone's `localhost` is the phone itself. No Steam key or cookie secret belongs in the APK.

The current transaction/code/native-session stores live in process memory, have expiry, and are bounded (1,000 pending transactions, 1,000 codes, 10,000 sessions). Restarting the backend invalidates native sessions and incomplete logins. Run one backend instance for this version. Before scaling to multiple instances or requiring sessions to survive deploys, replace these maps with shared storage that atomically consumes codes and supports token revocation (for example Redis); sticky routing alone does not provide persistence. A full store fails closed with HTTP 503 instead of evicting another user's active session.

## Protocol

1. The app creates cryptographically random `state` (32–128 base64url characters) and a PKCE verifier (43–128 RFC 7636 unreserved characters). Compute `codeChallenge = base64url(SHA256(codeVerifier))`, without padding.
2. `POST /api/auth/mobile/start` with `{codeChallenge,state,redirectUri:"steamachievements://auth/callback"}` returns `{authorizationUrl}`. Only this exact callback URI is allowed. The transaction expires in 10 minutes.
3. Open `authorizationUrl` in a browser authentication session. The one-use launch endpoint sets a short-lived HttpOnly, SameSite=Lax transaction cookie (Secure over HTTPS), then redirects to Steam. The random transaction ID is part of Steam's signed `openid.return_to`.
4. Steam returns to `/api/auth/steam/callback?mobile=...`. The backend requires the matching browser cookie, exact signed return URL, and Passport's OpenID verification. Profile lookup uses only the verified numeric Steam ID, avoiding passport-steam 1.0.18's optional built-in profile URL extraction.
5. The backend redirects to `steamachievements://auth/callback?code=...&state=...`. It never puts a session token in the redirect. Denial returns `error=access_denied`; verification failure returns `error=auth_failed`, each with the stored state. The app must check the exact callback destination and state before proceeding.
6. `POST /api/auth/mobile/exchange` with `{code,codeVerifier,redirectUri}` returns `{token,user:{steamId,displayName,avatar},expiresAt}`. `expiresAt` is an ISO timestamp. Codes expire after 60 seconds and are consumed atomically once; incorrect verifiers cannot redeem them.
7. Store the native token in OS secure storage. Send `Authorization: Bearer <token>` to `/api/auth/me` and authenticated media endpoints. Native sessions last 30 days unless revoked or the server restarts. An invalid explicit Authorization header fails closed instead of falling back to a browser cookie.
8. `POST /api/auth/logout` with the bearer token revokes it and clears any browser session cookie. Remove local secure storage even if offline; without a successful logout request, the server token remains valid until expiry/restart.

Use HTTPS for real accounts. Custom schemes can be claimed by another app; state and PKCE prevent an intercepted code from becoming a usable session. Verified Android App Links can replace the custom scheme in a future production hardening change, alongside the exact server allowlist and app configuration.

## Validation

Run `npm ci` and `npm test` from `backend/`. Tests use a real local Nest HTTP server with an in-test replacement for the upstream Steam verification provider. They cover browser cookie and signed return URL binding, state, malformed requests, redirects, cancellation, code replay/expiry, PKCE, session expiry/revocation, storage bounds, profile validation, media guards, and existing web-cookie behavior. A separate test exercises the real verifier's rejection boundary and isolated Passport configuration.

These automated tests **do not authenticate a real Steam account** or prove the device/browser deep-link behavior. A complete live check still requires deploying these routes and signing in through the APK on a device, then checking `/auth/me`, authenticated media access, cancellation, relaunch, and sign-out. There is no production fake-user endpoint or login-bypass flag.
