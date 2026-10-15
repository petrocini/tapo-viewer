import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import type { CameraBridge, BridgeStatus } from '../src/bridge.js';
import { createServer } from '../src/server.js';

function makeFixture() {
  let current: BridgeStatus = { state: 'disconnected' };
  let connects = 0;
  const bridge = {
    status: () => current,
    refreshStatus: async () => current,
    connect: async () => { connects++; current = { state: 'connecting' }; },
    disconnect: async () => { current = { state: 'disconnected' }; }
  } satisfies CameraBridge;
  const server = createServer(bridge);
  return { server, get connects() { return connects; } };
}

async function withServer(run: (url: string, app: ReturnType<typeof makeFixture>) => Promise<void>) {
  const app = makeFixture();
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const port = (app.server.address() as AddressInfo).port;
  try {
    await run(`http://127.0.0.1:${port}`, app);
  } finally {
    await new Promise<void>((resolve) => app.server.close(() => resolve()));
  }
}

test('rejects an invalid camera address without starting a bridge', async () => {
  await withServer(async (url, app) => {
    const response = await fetch(`${url}/api/connect`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: url },
      body: JSON.stringify({ ip: '8.8.8.8', username: 'camerauser', password: 'secret-pass' })
    });
    assert.equal(response.status, 400);
    assert.equal(app.connects, 0);
    assert.match((await response.json()).error, /rede local/);
  });
});

test('connects without returning credentials and exposes safe status', async () => {
  await withServer(async (url, app) => {
    const response = await fetch(`${url}/api/connect`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: url },
      body: JSON.stringify({ ip: '192.168.1.42', username: 'camerauser', password: 'secret-pass' })
    });
    assert.equal(response.status, 200);
    assert.equal(app.connects, 1);
    assert.doesNotMatch(await response.text(), /secret-pass|camerauser/);
    const status = await fetch(`${url}/api/status`);
    assert.deepEqual(await status.json(), { state: 'connecting' });
  });
});

test('rejects a cross-origin connection request', async () => {
  await withServer(async (url, app) => {
    const response = await fetch(`${url}/api/connect`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.com' },
      body: JSON.stringify({ ip: '192.168.1.42', username: 'camerauser', password: 'secret-pass' })
    });
    assert.equal(response.status, 403);
    assert.equal(app.connects, 0);
  });
});

test('serves the interface and rejects unsupported API methods', async () => {
  await withServer(async (url) => {
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Tapo C500/);
    const wrongMethod = await fetch(`${url}/api/connect`);
    assert.equal(wrongMethod.status, 405);
  });
});

test('malformed JSON never echoes credential fragments', async () => {
  await withServer(async (url, app) => {
    const response = await fetch(`${url}/api/connect`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: url },
      body: '{"password":"private-secret",'
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'JSON inválido.' });
    assert.equal(app.connects, 0);
  });
});

test('only player assets are exposed through the local proxy', async () => {
  const upstream = createHttpServer((request, response) => response.end(request.url));
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamPort = (upstream.address() as AddressInfo).port;
  const server = createServer({
    status: () => ({ state: 'disconnected' }), refreshStatus: async () => ({ state: 'disconnected' }),
    connect: async () => undefined, disconnect: async () => undefined
  }, `http://127.0.0.1:${upstreamPort}`);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const player = await fetch(`${url}/player/stream.html?src=tapo-c500`);
    assert.equal(player.status, 200);
    assert.equal(await player.text(), '/stream.html?src=tapo-c500');
    assert.equal((await fetch(`${url}/player/api/streams`)).status, 404);
    assert.equal((await fetch(`${url}/player/index.html`)).status, 404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});
