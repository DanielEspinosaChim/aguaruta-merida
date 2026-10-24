/**
 * Servidor local para la demo sin AWS: expone /v1 (mismo handler que la Lambda) y simula
 * el bucket de fotos con PUT/GET /local-photos/{photoKey}.
 * Cliente: VITE_API_BASE_URL=http://127.0.0.1:4020/v1
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { corsHeaders, newRequestId } from './http';
import { LocalGraphRoutingProvider } from './routing';
import { LocalPhotoSigner, LocalSnapshotStore, MemoryReportStore } from './stores';
import { MAX_PHOTO_BYTES, PHOTO_KEY_RE } from './validation';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT ?? 4020);
const BASE_URL = `http://${HOST}:${PORT}`;
const DATA_DIR = process.env.DATA_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
const PHOTOS_DIR = join(DATA_DIR, 'photos');
const MAX_JSON_BYTES = 64 * 1024;

const signer = new LocalPhotoSigner(BASE_URL);
const app = createApp({
  snapshots: new LocalSnapshotStore(DATA_DIR),
  reports: new MemoryReportStore(),
  photos: signer,
  routing: (segments) => new LocalGraphRoutingProvider(segments),
});

function readBody(req: IncomingMessage, limit: number): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, headers: Record<string, string>, body: string | Buffer) {
  res.writeHead(status, headers);
  res.end(body);
}

async function handlePhoto(req: IncomingMessage, res: ServerResponse, url: URL) {
  const key = decodeURIComponent(url.pathname.slice('/local-photos/'.length));
  const cors = { ...corsHeaders(), 'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS' };
  if (!PHOTO_KEY_RE.test(key)) return send(res, 404, cors, '');
  const file = join(PHOTOS_DIR, ...key.split('/'));

  if (req.method === 'OPTIONS') return send(res, 204, cors, '');
  if (req.method === 'GET') {
    if (!existsSync(file)) return send(res, 404, cors, '');
    const type = key.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return send(res, 200, { ...cors, 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' }, readFileSync(file));
  }
  if (req.method !== 'PUT') return send(res, 405, cors, '');

  const ct = url.searchParams.get('ct') ?? '';
  const ok = signer.verify(key, Number(url.searchParams.get('exp')), ct, url.searchParams.get('sig') ?? '');
  if (!ok || req.headers['content-type'] !== ct) return send(res, 403, cors, '');
  const body = await readBody(req, MAX_PHOTO_BYTES);
  if (!body || body.length === 0) return send(res, 413, cors, '');
  const isJpeg = body[0] === 0xff && body[1] === 0xd8;
  const isPng = body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47;
  if ((ct === 'image/jpeg' && !isJpeg) || (ct === 'image/png' && !isPng)) return send(res, 400, cors, '');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  return send(res, 200, cors, '');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', BASE_URL);
    if (url.pathname.startsWith('/local-photos/')) return await handlePhoto(req, res, url);

    const raw = req.method === 'POST' ? await readBody(req, MAX_JSON_BYTES) : Buffer.alloc(0);
    const requestId = newRequestId();
    if (raw === null) {
      return send(
        res,
        413,
        { 'Content-Type': 'application/json', ...corsHeaders() },
        JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'El cuerpo es demasiado grande.', requestId } }),
      );
    }
    const result = await app({
      method: req.method ?? 'GET',
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      body: raw.length ? raw.toString('utf8') : undefined,
      requestId,
    });
    send(res, result.statusCode, result.headers, result.body);
  } catch {
    send(res, 500, { 'Content-Type': 'application/json', ...corsHeaders() }, JSON.stringify({
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado. Intenta de nuevo.', requestId: newRequestId() },
    }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`AguaRuta API local en ${BASE_URL}/v1 (datos: ${DATA_DIR})`);
});
