const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, createHmac, randomBytes } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { ConfigModule, ConfigService } = require('@nestjs/config');
const { ThrottlerModule } = require('@nestjs/throttler');
const { AuthModule } = require('../dist/auth/auth.module');
const { MediaModule } = require('../dist/media/media.module');
const { AuthController } = require('../dist/auth/auth.controller');
const { SteamSessionGuard } = require('../dist/auth/steam-session.guard');
const { SteamIdentityService } = require('../dist/auth/steam-identity.service');
const { MobileSteamVerifier } = require('../dist/auth/mobile-steam-verifier');
const {
  MobileAuthService, MOBILE_REDIRECT_URI, MOBILE_TRANSACTION_COOKIE,
  MOBILE_TRANSACTION_TTL_MS, MOBILE_CODE_TTL_MS,
} = require('../dist/auth/mobile-auth.service');
const { createSteamSessionCookie, readSteamSession, STEAM_SESSION_MAX_AGE_MS } = require('../dist/auth/steam-session');

const user = { steamId: '76561198000000001', displayName: 'Test account', avatar: 'https://example.test/avatar.jpg' };
const secret = 'test-only-cookie-secret-not-a-deployed-secret';
const backendOrigin = 'http://127.0.0.1:3000';
const hash = value => createHash('sha256').update(value).digest('base64url');
const random = () => randomBytes(32).toString('base64url');
const config = () => new ConfigService({ BACKEND_URL: backendOrigin, AUTH_COOKIE_SECRET: secret, NODE_ENV: 'test' });
let app;
let base;
let verifierCalls = 0;

before(async () => {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, ignoreEnvVars: true, load: [() => ({
        BACKEND_URL: backendOrigin, FRONTEND_URL: 'http://localhost:4200', AUTH_COOKIE_SECRET: secret, NODE_ENV: 'test',
      })] }),
      ThrottlerModule.forRoot([{ ttl: 60000, limit: 500 }]),
      AuthModule,
      MediaModule,
    ],
  }).overrideProvider(MobileSteamVerifier).useValue({
    // This adapter exists only in the test container. It represents the result of
    // upstream OpenID verification; no production route or flag bypasses Steam.
    async verify(req, _res, returnUrl) {
      verifierCalls++;
      assert.equal(req.query['openid.return_to'], returnUrl);
      if (req.query['openid.sig'] !== 'test-verified-signature') throw new Error('Invalid OpenID signature');
      return user;
    },
  }).compile();
  app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});

after(async () => { if (app) await app.close(); });

async function request(path, options = {}) {
  return fetch(`${base}${path}`, { redirect: 'manual', ...options });
}

async function post(path, body, headers = {}) {
  return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

async function begin() {
  const verifier = random();
  const state = random();
  const start = await post('/api/auth/mobile/start', { codeChallenge: hash(verifier), state, redirectUri: MOBILE_REDIRECT_URI });
  assert.equal(start.status, 200);
  assert.equal(start.headers.get('cache-control'), 'no-store');
  const { authorizationUrl } = await start.json();
  const launchUrl = new URL(authorizationUrl);
  assert.equal(launchUrl.origin, backendOrigin);
  const launched = await request(launchUrl.pathname + launchUrl.search);
  assert.equal(launched.status, 302);
  const steamUrl = new URL(launched.headers.get('location'));
  assert.equal(steamUrl.origin, 'https://steamcommunity.com');
  assert.equal(steamUrl.pathname, '/openid/login');
  assert.equal(steamUrl.searchParams.get('openid.mode'), 'checkid_setup');
  const cookieHeader = launched.headers.get('set-cookie');
  assert.match(cookieHeader, /HttpOnly/);
  assert.match(cookieHeader, /SameSite=Lax/);
  const cookie = cookieHeader.split(';')[0];
  const returnUrl = steamUrl.searchParams.get('openid.return_to');
  const callback = new URL(returnUrl);
  callback.searchParams.set('openid.mode', 'id_res');
  callback.searchParams.set('openid.return_to', returnUrl);
  callback.searchParams.set('openid.sig', 'test-verified-signature');
  return { verifier, state, cookie, callback, returnUrl, launchUrl };
}

async function finish(flow) {
  const response = await request(flow.callback.pathname + flow.callback.search, { headers: { Cookie: flow.cookie } });
  assert.equal(response.status, 302);
  const redirect = new URL(response.headers.get('location'));
  assert.equal(`${redirect.protocol}//${redirect.host}${redirect.pathname}`, MOBILE_REDIRECT_URI);
  assert.equal(redirect.searchParams.get('state'), flow.state);
  assert.equal(redirect.searchParams.has('token'), false);
  assert.equal(redirect.searchParams.has('steamId'), false);
  return redirect.searchParams.get('code');
}

test('HTTP mobile handoff, PKCE exchange, me, media guard, one-time code, and logout', async () => {
  const flow = await begin();
  const code = await finish(flow);
  assert.match(code, /^[\w-]{43}$/);
  const exchangeBody = { code, codeVerifier: flow.verifier, redirectUri: MOBILE_REDIRECT_URI };
  const exchanged = await post('/api/auth/mobile/exchange', exchangeBody);
  assert.equal(exchanged.status, 200);
  assert.equal(exchanged.headers.get('cache-control'), 'no-store');
  const session = await exchanged.json();
  assert.deepEqual(session.user, user);
  assert.ok(Date.parse(session.expiresAt) > Date.now());
  const headers = { Authorization: `Bearer ${session.token}` };
  const me = await request('/api/auth/me', { headers });
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), user);
  // With a valid native token the real media route reaches its body validation;
  // without it the guard rejects before touching the storage provider.
  assert.equal((await post('/api/media/upload-url/test-achievement', {}, headers)).status, 400);
  const guardedRequest = { headers: { authorization: headers.Authorization } };
  const context = { switchToHttp: () => ({ getRequest: () => guardedRequest }) };
  assert.equal(app.get(SteamSessionGuard).canActivate(context), true);
  assert.deepEqual(guardedRequest.user, user);
  assert.equal((await post('/api/auth/mobile/exchange', exchangeBody)).status, 401);
  assert.equal((await post('/api/auth/logout', {}, headers)).status, 200);
  assert.equal((await request('/api/auth/me', { headers })).status, 401);
  assert.equal((await post('/api/media/upload-url/test-achievement', {}, headers)).status, 401);
  assert.throws(() => app.get(SteamSessionGuard).canActivate(context), /Sign in with Steam/);
});

test('config exposes only public capabilities and login cancellation returns matching state', async () => {
  const response = await request('/api/auth/mobile/config');
  assert.deepEqual(await response.json(), { enabled: true, version: 1, redirectUri: MOBILE_REDIRECT_URI, codeChallengeMethod: 'S256' });
  const flow = await begin();
  flow.callback.searchParams.set('openid.mode', 'cancel');
  flow.callback.searchParams.delete('openid.return_to');
  const cancelled = await request(flow.callback.pathname + flow.callback.search, { headers: { Cookie: flow.cookie } });
  assert.equal(cancelled.status, 302);
  const redirect = new URL(cancelled.headers.get('location'));
  assert.equal(redirect.searchParams.get('error'), 'access_denied');
  assert.equal(redirect.searchParams.get('state'), flow.state);
  assert.equal(redirect.searchParams.has('code'), false);
});

test('missing, wrong, duplicate and malformed browser cookies cannot complete a login', async () => {
  const flow = await begin();
  const callsBefore = verifierCalls;
  for (const cookie of ['', `${MOBILE_TRANSACTION_COOKIE}=${random()}`, `${flow.cookie}; ${flow.cookie}`, `${MOBILE_TRANSACTION_COOKIE}=%E0%A4%A`]) {
    const response = await request(flow.callback.pathname + flow.callback.search, { headers: { Cookie: cookie } });
    assert.equal(response.status, 401);
  }
  assert.equal(verifierCalls, callsBefore);
  assert.ok(await finish(flow));
});

test('launch and successful callback are both one-use', async () => {
  const flow = await begin();
  assert.equal((await request(flow.launchUrl.pathname + flow.launchUrl.search)).status, 401);
  await finish(flow);
  assert.equal((await request(flow.callback.pathname + flow.callback.search, { headers: { Cookie: flow.cookie } })).status, 401);
});

test('signed return_to must exactly identify this transaction; state cannot be overwritten in callback', async () => {
  const flow = await begin();
  const callsBefore = verifierCalls;
  flow.callback.searchParams.set('openid.return_to', `${backendOrigin}/api/auth/steam/callback?mobile=${random()}`);
  assert.equal((await request(flow.callback.pathname + flow.callback.search, { headers: { Cookie: flow.cookie } })).status, 401);
  assert.equal(verifierCalls, callsBefore);
  flow.callback.searchParams.set('openid.return_to', flow.returnUrl);
  flow.callback.searchParams.set('state', 'attacker-controlled-state');
  assert.ok(await finish(flow));
});

test('failed upstream verification produces only a state-bound error and no authorization code', async () => {
  const flow = await begin();
  flow.callback.searchParams.set('openid.sig', 'invalid');
  const failed = await request(flow.callback.pathname + flow.callback.search, { headers: { Cookie: flow.cookie } });
  assert.equal(failed.status, 302);
  const redirect = new URL(failed.headers.get('location'));
  assert.equal(redirect.searchParams.get('error'), 'auth_failed');
  assert.equal(redirect.searchParams.get('state'), flow.state);
  assert.equal(redirect.searchParams.has('code'), false);
});

test('wrong verifier and redirect cannot redeem a code; legitimate app can still finish', async () => {
  const flow = await begin();
  const code = await finish(flow);
  assert.equal((await post('/api/auth/mobile/exchange', { code, codeVerifier: random(), redirectUri: MOBILE_REDIRECT_URI })).status, 401);
  assert.equal((await post('/api/auth/mobile/exchange', { code, codeVerifier: flow.verifier, redirectUri: `${MOBILE_REDIRECT_URI}/evil` })).status, 400);
  assert.equal((await post('/api/auth/mobile/exchange', { code, codeVerifier: flow.verifier, redirectUri: MOBILE_REDIRECT_URI })).status, 200);
});

test('strict redirect allowlist and PKCE/state validation reject malformed start requests', async () => {
  const valid = { codeChallenge: hash(random()), state: random(), redirectUri: MOBILE_REDIRECT_URI };
  for (const redirectUri of ['https://attacker.test', `${MOBILE_REDIRECT_URI}/`, `${MOBILE_REDIRECT_URI}?next=evil`, 'steamachievements://auth@evil/callback']) {
    assert.equal((await post('/api/auth/mobile/start', { ...valid, redirectUri })).status, 400);
  }
  for (const input of [{}, [], { ...valid, state: 'short' }, { ...valid, codeChallenge: 'not-a-sha256-challenge' }]) {
    assert.equal((await post('/api/auth/mobile/start', input)).status, 400);
  }
});

test('web cookies still authenticate, malformed bearer does not fall back, and web logout clears cookie', async () => {
  const token = createSteamSessionCookie(user, secret);
  const cookie = `sav_steam_session=${token}`;
  const me = await request('/api/auth/me', { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.deepEqual(await me.json(), user);
  assert.equal((await request('/api/auth/me', { headers: { Cookie: cookie, Authorization: 'Bearer invalid' } })).status, 401);
  assert.equal((await request('/api/auth/me', { headers: { Cookie: 'sav_steam_session=%E0%A4%A' } })).status, 401);
  const logout = await post('/api/auth/logout', {}, { Cookie: cookie });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /sav_steam_session=;/);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
});

function fakeResponse() {
  return { cookie() {}, clearCookie() {}, redirect(value) { return value; } };
}

function unitFlow(service) {
  const verifier = random();
  const { authorizationUrl } = service.start({ codeChallenge: hash(verifier), state: random(), redirectUri: MOBILE_REDIRECT_URI });
  const transactionId = new URL(authorizationUrl).searchParams.get('transaction');
  service.launch(transactionId, fakeResponse());
  const redirect = new URL(service.complete(transactionId, user, fakeResponse()));
  return { code: redirect.searchParams.get('code'), codeVerifier: verifier, redirectUri: MOBILE_REDIRECT_URI };
}

test('transaction, authorization code and native session expiration are enforced at their boundaries', () => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    const service = new MobileAuthService(config());
    const started = service.start({ codeChallenge: hash(random()), state: random(), redirectUri: MOBILE_REDIRECT_URI });
    const id = new URL(started.authorizationUrl).searchParams.get('transaction');
    now += MOBILE_TRANSACTION_TTL_MS;
    assert.throws(() => service.launch(id, fakeResponse()), /expired/);
    const expiredCode = unitFlow(service);
    now += MOBILE_CODE_TTL_MS;
    assert.throws(() => service.exchange(expiredCode), /invalid, expired/);
    const session = service.exchange(unitFlow(service));
    const req = { headers: { authorization: `Bearer ${session.token}` } };
    assert.deepEqual(service.readSession(req, secret), user);
    now += STEAM_SESSION_MAX_AGE_MS;
    assert.equal(service.readSession(req, secret), null);
  } finally { Date.now = originalNow; }
});

test('pending storage is bounded and expired entries free capacity', () => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    const service = new MobileAuthService(config());
    const input = { codeChallenge: hash(random()), state: random(), redirectUri: MOBILE_REDIRECT_URI };
    for (let i = 0; i < 1000; i++) service.start(input);
    assert.throws(() => service.start(input), /busy/);
    now += MOBILE_TRANSACTION_TTL_MS;
    assert.ok(service.start(input).authorizationUrl);
  } finally { Date.now = originalNow; }
});

test('production requires HTTPS and sets secure browser transaction cookies', () => {
  const insecure = new MobileAuthService(new ConfigService({ NODE_ENV: 'production', BACKEND_URL: backendOrigin }));
  assert.throws(() => insecure.start({ codeChallenge: hash(random()), state: random(), redirectUri: MOBILE_REDIRECT_URI }), /HTTPS/);
  const secure = new MobileAuthService(new ConfigService({ NODE_ENV: 'production', BACKEND_URL: 'https://api.example.test' }));
  const start = secure.start({ codeChallenge: hash(random()), state: random(), redirectUri: MOBILE_REDIRECT_URI });
  let cookieOptions;
  secure.launch(new URL(start.authorizationUrl).searchParams.get('transaction'), { cookie(_name, _value, options) { cookieOptions = options; } });
  assert.equal(cookieOptions.secure, true);
  assert.equal(cookieOptions.httpOnly, true);
});

test('signed but malformed/expired web session payloads fail closed without crashing', () => {
  const signPayload = payload => {
    const value = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${value}.${createHmac('sha256', secret).update(value).digest('base64url')}`;
  };
  for (const payload of [null, {}, { ...user, iat: Date.now(), exp: 'tomorrow' }, { ...user, iat: 0, exp: 1 }, { steamId: { bad: true }, iat: 0, exp: Date.now() + 10000 }]) {
    assert.equal(readSteamSession({ headers: { cookie: `sav_steam_session=${signPayload(payload)}` } }, secret), null);
  }
  const token = createSteamSessionCookie(user, secret);
  assert.equal(readSteamSession({ headers: { cookie: `sav_steam_session=${token}.extra` } }, secret), null);
  assert.equal(readSteamSession({ headers: { cookie: `sav_steam_session=${token};sav_steam_session=${token}` } }, secret), null);
});

test('web callback retains its cookie and dashboard redirect', () => {
  const controller = new AuthController(config(), new MobileAuthService(config()));
  let cookieName;
  let cookieToken;
  const result = controller.steamCallback({ query: {}, user }, {
    cookie(name, token) { cookieName = name; cookieToken = token; },
    redirect(url) { return url; },
  });
  assert.equal(result, 'http://localhost:4200/dashboard');
  assert.equal(cookieName, 'sav_steam_session');
  assert.deepEqual(readSteamSession({ headers: { cookie: `${cookieName}=${cookieToken}` } }, secret), user);
});

test('verified Steam identifier lookup uses numeric ID and rejects mismatched profiles and foreign identifiers', async () => {
  let requested;
  const identity = new SteamIdentityService({ async getPlayerSummary(id) {
    requested = id;
    return { steamid: id, personaname: user.displayName, avatarfull: user.avatar };
  } });
  assert.deepEqual(await identity.resolveVerifiedIdentifier(`https://steamcommunity.com/openid/id/${user.steamId}`), user);
  assert.equal(requested, user.steamId);
  for (const identifier of [`https://evil.test/openid/id/${user.steamId}`, `http://steamcommunity.com/openid/id/${user.steamId}`, `https://steamcommunity.com/openid/id/${user.steamId}/extra`]) {
    await assert.rejects(identity.resolveVerifiedIdentifier(identifier), /invalid identifier/);
  }
  const mismatched = new SteamIdentityService({ async getPlayerSummary() { return { steamid: '76561198000000002' }; } });
  await assert.rejects(mismatched.resolveVerifiedIdentifier(`https://steamcommunity.com/openid/id/${user.steamId}`), /different profile/);
});

test('real verifier rejects incomplete assertions before Passport and configures per-request return URLs', async () => {
  const passport = require('passport');
  const originalAuthenticate = passport.authenticate;
  const verifier = new MobileSteamVerifier({ resolveVerifiedIdentifier: async () => user });
  await assert.rejects(verifier.verify({ query: {} }, {}, 'https://api.example.test/callback', 'https://api.example.test'), /not completed/);
  const seen = [];
  passport.authenticate = (strategy, options, callback) => {
    seen.push(strategy._relyingParty.returnUrl);
    assert.equal(strategy._profile, false);
    assert.equal(options.session, false);
    return () => callback(null, user);
  };
  try {
    await verifier.verify({ query: { 'openid.mode': 'id_res' } }, {}, 'https://api.example.test/callback?mobile=one', 'https://api.example.test');
    await verifier.verify({ query: { 'openid.mode': 'id_res' } }, {}, 'https://api.example.test/callback?mobile=two', 'https://api.example.test');
    assert.deepEqual(seen, ['https://api.example.test/callback?mobile=one', 'https://api.example.test/callback?mobile=two']);
  } finally { passport.authenticate = originalAuthenticate; }
});
