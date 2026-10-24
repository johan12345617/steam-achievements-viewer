const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { brotliCompressSync, gzipSync } = require('node:zlib');
const { Body, Controller, Module, Post } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { rejectEncodedBodies } = require('../dist/reject-encoded-bodies');

class EchoController {
  echo(body) {
    return body;
  }
}
Controller('echo')(EchoController);
Post()(EchoController.prototype, 'echo', Object.getOwnPropertyDescriptor(EchoController.prototype, 'echo'));
Body()(EchoController.prototype, 'echo', 0);

class EchoModule {}
Module({ controllers: [EchoController] })(EchoModule);

const payload = JSON.stringify({ hello: 'world' });
let guarded;
let unguarded;

async function start(withGuard) {
  const app = await NestFactory.create(EchoModule, { logger: false });
  if (withGuard) app.use(rejectEncodedBodies);
  await app.listen(0, '127.0.0.1');
  return { app, base: `http://127.0.0.1:${app.getHttpServer().address().port}` };
}

const post = (base, body, encoding) => fetch(`${base}/echo`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(encoding ? { 'Content-Encoding': encoding } : {}) },
  body,
});

before(async () => {
  guarded = await start(true);
  unguarded = await start(false);
});

after(async () => {
  await guarded.app.close();
  await unguarded.app.close();
});

test('body-parser decompresses brotli bodies when the guard is absent', async () => {
  const res = await post(unguarded.base, brotliCompressSync(payload), 'br');
  assert.equal(res.status, 201);
  assert.deepEqual(await res.json(), { hello: 'world' });
});

test('brotli and gzip bodies are rejected before any parser runs', async () => {
  for (const [encoding, body] of [['br', brotliCompressSync(payload)], ['gzip', gzipSync(payload)], ['gzip, br', payload]]) {
    const res = await post(guarded.base, body, encoding);
    assert.equal(res.status, 415, encoding);
    assert.equal(res.headers.get('accept-encoding'), 'identity');
  }
});

test('uncompressed and identity bodies still reach the handler', async () => {
  for (const encoding of [undefined, 'identity']) {
    const res = await post(guarded.base, payload, encoding);
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { hello: 'world' });
  }
});
