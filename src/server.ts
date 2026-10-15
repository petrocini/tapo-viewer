import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import httpProxy from 'http-proxy';
import { BridgeManager, type CameraBridge } from './bridge.js';
import { parseCameraConfig } from './config.js';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const assets: Record<string, [string, string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8']
};

const playerFiles = new Set(['/stream.html', '/video-stream.js', '/video-rtc.js']);

export function createServer(manager: CameraBridge, playerTarget = 'http://127.0.0.1:1984'): Server {
  const proxy = httpProxy.createProxyServer({ target: playerTarget, ws: true });
  proxy.on('error', (_error, _request, response) => {
    if ('writeHead' in response && !response.headersSent) {
      response.writeHead(502).end('Player indisponível');
    } else if ('destroy' in response) {
      response.destroy();
    }
  });
  const server = createHttpServer(async (request, response) => {
    try {
      await handleRequest(server, manager, request, response, proxy);
    } catch {
      sendJson(response, 500, { error: 'Ocorreu uma falha local. Tente novamente.' });
    }
  });
  server.on('upgrade', (request, socket, head) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    if (path !== '/player/api/ws' || !sameOrigin(server, request)) {
      socket.destroy();
      return;
    }
    request.url = request.url!.replace(/^\/player/, '');
    proxy.ws(request, socket, head);
  });
  return server;
}

async function handleRequest(server: Server, manager: CameraBridge, request: IncomingMessage, response: ServerResponse, proxy: httpProxy): Promise<void> {
  const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (path.startsWith('/player/')) {
    const playerPath = path.slice('/player'.length);
    if (request.method !== 'GET' || !playerFiles.has(playerPath)) {
      response.writeHead(404).end('Não encontrado');
      return;
    }
    request.url = request.url!.replace(/^\/player/, '');
    proxy.web(request, response);
    return;
  }

  if (path.startsWith('/api/')) {
    if (request.method === 'POST' && !sameOrigin(server, request)) {
      sendJson(response, 403, { error: 'Origem não permitida.' });
      return;
    }
    if (path === '/api/status' && request.method === 'GET') {
      sendJson(response, 200, await manager.refreshStatus());
      return;
    }
    if (path === '/api/connect' && request.method === 'POST') {
      if (!request.headers['content-type']?.startsWith('application/json')) {
        sendJson(response, 415, { error: 'Envie os dados em JSON.' });
        return;
      }
      let input;
      try {
        input = JSON.parse(await readBody(request));
      } catch {
        sendJson(response, 400, { error: 'JSON inválido.' });
        return;
      }
      let config;
      try {
        config = parseCameraConfig(input);
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : 'Dados inválidos.' });
        return;
      }
      await manager.connect(config);
      sendJson(response, 200, manager.status());
      return;
    }
    if (path === '/api/disconnect' && request.method === 'POST') {
      await manager.disconnect();
      sendJson(response, 200, manager.status());
      return;
    }
    sendJson(response, ['GET', 'POST'].includes(request.method ?? '') ? 405 : 404, { error: 'Método não permitido.' });
    return;
  }

  if (request.method !== 'GET' || !assets[path]) {
    response.writeHead(404).end('Não encontrado');
    return;
  }
  const [filename, mime] = assets[path];
  const content = await readFile(join(projectRoot, 'public', filename));
  response.writeHead(200, {
    'Content-Type': mime,
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; frame-src 'self'; connect-src 'self'",
  }).end(content);
}

function sameOrigin(server: Server, request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  const address = server.address();
  return !origin || (typeof address === 'object' && address !== null && origin === `http://127.0.0.1:${address.port}`);
}

async function readBody(request: IncomingMessage): Promise<string> {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 4096) throw new Error('Pedido muito grande.');
  }
  return body;
}

function sendJson(response: ServerResponse, status: number, data: object): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(data));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manager = new BridgeManager({
    binaryPath: join(projectRoot, 'vendor', 'go2rtc.exe'),
    configPath: join(projectRoot, 'config', 'go2rtc.yaml')
  });
  const server = createServer(manager);
  server.listen(4173, '127.0.0.1', () => {
    console.log('Tapo Viewer: http://127.0.0.1:4173');
  });
  const shutdown = () => {
    void manager.disconnect().finally(() => server.close());
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
