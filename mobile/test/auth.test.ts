import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  MOBILE_REDIRECT_URI, PENDING_LOGIN_MAX_AGE_MS, assertAuthorizationUrl,
  isMobileCallback, parseAuthCallback, parseSteamInput, toBase64Url, validateSession,
  type PendingLogin,
} from '../src/auth/protocol';

const now = Date.now();
const pending: PendingLogin = {
  state: 'a'.repeat(64), codeVerifier: 'b'.repeat(64),
  redirectUri: MOBILE_REDIRECT_URI, apiBase: 'https://example.com/api', createdAt: now,
};
const code = 'C'.repeat(43);
const callback = `${MOBILE_REDIRECT_URI}?code=${code}&state=${pending.state}`;

test('accepts a matching, fresh native login callback', () => {
  assert.equal(parseAuthCallback(callback, pending, now), code);
  assert.equal(isMobileCallback(callback), true);
});

test('rejects login substitution, duplicate state/code, and incomplete callbacks', () => {
  for (const url of [
    callback.replace(pending.state, 'wrong-state'), `${callback}&state=${pending.state}`,
    `${callback}&code=${code}`, `${MOBILE_REDIRECT_URI}?state=${pending.state}`,
    `${callback}&error=cancelled`, callback.replace(code, 'short'),
  ]) assert.throws(() => parseAuthCallback(url, pending, now));
});

test('rejects untrusted callback origins, paths, credentials, ports and fragments', () => {
  for (const url of [
    callback.replace('steamachievements:', 'https:'), callback.replace('auth/', 'evil/'),
    callback.replace('/callback', '/callback/extra'), callback.replace('//auth', '//user@auth'),
    callback.replace('//auth', '//auth:123'), `${callback}#token=secret`,
  ]) assert.throws(() => parseAuthCallback(url, pending, now));
});

test('expires pending login and rejects future timestamps or another redirect', () => {
  assert.throws(() => parseAuthCallback(callback, pending, now + PENDING_LOGIN_MAX_AGE_MS + 1));
  assert.throws(() => parseAuthCallback(callback, { ...pending, createdAt: now + 1 }, now));
  assert.throws(() => parseAuthCallback(callback, { ...pending, redirectUri: 'other://auth' }, now));
});

test('only opens auth URLs on the configured backend', () => {
  assert.doesNotThrow(() => assertAuthorizationUrl('https://example.com/api/auth/mobile/browser?id=abc', pending.apiBase));
  for (const url of [
    'https://evil.example/api/auth/mobile/browser', 'http://example.com/api/auth/mobile/browser',
    'https://user:pass@example.com/api/auth/steam', 'https://example.com/other/steam',
    'https://example.com/api/auth/steam#fragment',
  ]) assert.throws(() => assertAuthorizationUrl(url, pending.apiBase));
});

test('S256 challenge encoding matches RFC 7636 test vector', () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  assert.equal(toBase64Url(createHash('sha256').update(verifier).digest('base64')), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('accepts Steam IDs, vanity names, and official profile URLs', () => {
  assert.deepEqual(parseSteamInput('76561198000000001'), { steamId: '76561198000000001' });
  assert.deepEqual(parseSteamInput('my-player'), { vanity: 'my-player' });
  assert.deepEqual(parseSteamInput('https://steamcommunity.com/id/my-player/'), { vanity: 'my-player' });
  assert.deepEqual(parseSteamInput('steamcommunity.com/profiles/76561198000000001'), { steamId: '76561198000000001' });
});

test('rejects lookalike domains, credentials, and invalid Steam inputs', () => {
  for (const input of ['', 'https://steamcommunity.com.evil.test/id/player', 'https://user@steamcommunity.com/id/player', 'https://example.com/id/player', 'https://steamcommunity.com/profiles/123']) {
    assert.throws(() => parseSteamInput(input));
  }
});

test('refuses malformed and expired sessions before persistence', () => {
  const session = { token: 'T'.repeat(43), user: { steamId: '76561198000000001', displayName: 'Player', avatar: '' }, expiresAt: new Date(Date.now() + 60000).toISOString() };
  assert.equal(validateSession(session), session);
  assert.throws(() => validateSession({ ...session, token: '' }));
  assert.throws(() => validateSession({ ...session, expiresAt: new Date(0).toISOString() }));
  assert.throws(() => validateSession({ ...session, expiresAt: 'invalid' }));
});
