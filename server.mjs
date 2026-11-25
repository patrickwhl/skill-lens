import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultSources, inventory } from './inventory.mjs';

const types = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);
const sample = new URL('./public/sample.json', import.meta.url);

export function createSkillServer({ sources = defaultSources(), demo = false } = {}) {
  return createServer(async (request, response) => {
    const port = request.socket.localPort;
    const hosts = new Set(['127.0.0.1:' + port, 'localhost:' + port]);
    const origin = request.headers.origin;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    if (!hosts.has(request.headers.host) || (origin && ![...hosts].some(host => origin === 'http://' + host))) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' }).end('Method not allowed');
      return;
    }
    const path = request.url.split('?')[0];
    try {
      if (path === '/api/inventory') {
        const data = demo ? await readFile(sample) : JSON.stringify(await inventory(sources));
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(data);
        return;
      }
      const asset = types.get(path);
      if (!asset) {
        response.writeHead(404).end('Not found');
        return;
      }
      const data = await readFile(new URL('./public/' + asset[0], import.meta.url));
      response.writeHead(200, { 'Content-Type': asset[1] }).end(data);
    } catch {
      response.writeHead(500).end('Unable to load inventory');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: {
    project: { type: 'string' }, root: { type: 'string', multiple: true },
    port: { type: 'string', default: '4317' }, demo: { type: 'boolean' },
  } });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be between 1 and 65535');
  const sources = defaultSources({ project: values.project });
  for (const root of values.root ?? []) {
    const path = resolve(root);
    sources.push({ name: 'Custom · ' + basename(path) + ' #' + (sources.length - 4), path });
  }
  const server = createSkillServer({ sources, demo: values.demo });
  server.listen(port, '127.0.0.1', () => console.log('Skill Lens · http://127.0.0.1:' + port));
}
