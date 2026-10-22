import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, createApiClient, normalizeApiBase } from '../src/lib/api';

test('normalizes hosted and local backend configuration', () => {
  assert.equal(normalizeApiBase(' https://johanstuff.tikraq.pe/ '), 'https://johanstuff.tikraq.pe/api');
  assert.equal(normalizeApiBase('https://example.com/api/'), 'https://example.com/api');
  assert.equal(normalizeApiBase('http://10.0.2.2:3000/api'), 'http://10.0.2.2:3000/api');
  assert.equal(normalizeApiBase('http://192.168.1.10:3000'), 'http://192.168.1.10:3000/api');
});

test('rejects unsafe or ambiguous server configuration', () => {
  for (const value of ['http://public.example/api', 'http://10.evil.example/api', 'http://192.168.evil.example/api', 'ftp://example.com', 'https://user:password@example.com/api', 'https://example.com/api?token=secret', 'https://example.com/api#fragment', 'not a URL']) {
    assert.throws(() => normalizeApiBase(value));
  }
});

test('sends bearer credentials only in headers and uses no browser cookies', async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const api = createApiClient('https://example.com/api', () => 'test-native-token', fetcher);
  assert.deepEqual(await api.post('/media/complete/123', { appId: 620 }), { ok: true });
  assert.equal(requests[0].url, 'https://example.com/api/media/complete/123');
  assert.equal(new Headers(requests[0].init?.headers).get('Authorization'), 'Bearer test-native-token');
  assert.equal(requests[0].init?.credentials, 'omit');
  assert.equal(requests[0].init?.redirect, 'error');
  assert.equal(requests[0].init?.body, '{"appId":620}');
  assert.ok(!requests[0].url.includes('token'));
});

test('public profile requests have no session credential', async () => {
  const api = createApiClient('https://example.com/api', () => null, async (_url, init) => {
    assert.equal(new Headers(init?.headers).has('Authorization'), false);
    return new Response('{}');
  });
  await api.get('/steam/player/76561198000000001');
});

test('does not send credentials to absolute URLs or escaped API paths', async () => {
  let called = false;
  const api = createApiClient('https://example.com/api', () => 'secret', async () => { called = true; return new Response('{}'); });
  for (const path of ['https://evil.test', '//evil.test', '/../secret', '/%2e%2e/secret']) {
    await assert.rejects(api.get(path));
  }
  assert.equal(called, false);
});

test('explains a deployed server that lacks mobile auth', async () => {
  const api = createApiClient('https://example.com/api', () => null, async () => new Response('{"message":"Not Found"}', { status: 404 }));
  await assert.rejects(api.post('/auth/mobile/start', {}), /mobile login update/);
});

test('preserves unauthorized status so restoration can clear a revoked session', async () => {
  let rejectedToken: string | null = null;
  const api = createApiClient('https://example.com/api', () => 'revoked', async () => new Response('{"message":"Session expired"}', { status: 401 }), value => { rejectedToken = value; });
  await assert.rejects(api.get('/auth/me'), (error: unknown) => error instanceof ApiError && error.status === 401);
  assert.equal(rejectedToken, 'revoked');
});

test('handles cold-start gateway HTML and disconnected server responses', async () => {
  const html = createApiClient('https://example.com/api', () => null, async () => new Response('<html>Bad Gateway</html>', { status: 502 }));
  await assert.rejects(html.get('/auth/mobile/config'), /unexpected response/);
  const offline = createApiClient('https://example.com/api', () => null, async () => { throw new Error('Network request failed'); });
  await assert.rejects(offline.get('/auth/mobile/config'), /Cannot reach the server/);
});
