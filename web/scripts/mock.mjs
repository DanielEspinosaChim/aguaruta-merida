// Mock local: Prism sirve el contrato en :4011 y este proxy expone la base /v1 en :4010.
// Prism ignora el path de `servers`, así que el proxy quita el prefijo /v1.
import { spawn } from 'node:child_process';
import http from 'node:http';

const PUBLIC_PORT = 4010;
const PRISM_PORT = 4011;
const PREFIX = '/v1';

const prism = spawn('npx', ['prism', 'mock', '../contract/openapi.yaml', '-p', String(PRISM_PORT)], {
  stdio: 'inherit',
  shell: true,
});

const server = http.createServer((req, res) => {
  const url = req.url ?? '/';
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }
  if (!url.startsWith(`${PREFIX}/`)) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ error: { code: 'INVALID_REQUEST', message: `Usa la base ${PREFIX}.`, requestId: 'mock' } }));
  }
  const upstream = http.request(
    { host: '127.0.0.1', port: PRISM_PORT, path: url.slice(PREFIX.length), method: req.method, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, { ...up.headers, 'access-control-allow-origin': '*' });
      up.pipe(res);
    },
  );
  upstream.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'El mock aún no arranca.', requestId: 'mock' } }));
  });
  req.pipe(upstream);
});

server.listen(PUBLIC_PORT, '127.0.0.1', () => console.log(`Mock /v1 en http://127.0.0.1:${PUBLIC_PORT}${PREFIX}`));

const stop = () => {
  server.close();
  prism.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
