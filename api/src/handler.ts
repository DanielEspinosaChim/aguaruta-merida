import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { LocalGraphRoutingProvider } from './routing';
import { DynamoReportStore, S3PhotoSigner, S3SnapshotStore } from './aws-stores';
import { OpenMeteoRain } from './rain';
import { LocalPhotoSigner, LocalSnapshotStore, MemoryReportStore } from './stores';

/** Subconjunto del evento de API Gateway HTTP API (payload v2) que usamos. */
export interface HttpApiEventV2 {
  rawPath: string;
  headers?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext: { http: { method: string }; requestId?: string };
}

// Con SNAPSHOT_BUCKET / REPORTS_TABLE / PHOTOS_BUCKET (Lambda) usa S3 y DynamoDB; sin ellas, todo local.
const { SNAPSHOT_BUCKET, REPORTS_TABLE, PHOTOS_BUCKET } = process.env;
const DATA_DIR = process.env.DATA_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');

const snapshots = SNAPSHOT_BUCKET ? new S3SnapshotStore(SNAPSHOT_BUCKET) : new LocalSnapshotStore(DATA_DIR);

const app = createApp({
  snapshots,
  hydro: () => snapshots.getHydro(),
  rain: new OpenMeteoRain(),
  reports: REPORTS_TABLE ? new DynamoReportStore(REPORTS_TABLE) : new MemoryReportStore(),
  photos: PHOTOS_BUCKET
    ? new S3PhotoSigner(PHOTOS_BUCKET)
    : new LocalPhotoSigner(process.env.PUBLIC_BASE_URL ?? 'http://127.0.0.1:4020'),
  routing: (segments) => new LocalGraphRoutingProvider(segments),
});

export async function handler(event: HttpApiEventV2) {
  const body = event.body && event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  const res = await app({
    method: event.requestContext.http.method,
    path: event.rawPath,
    query: event.queryStringParameters ?? {},
    body,
    requestId: event.requestContext.requestId ? `req_${event.requestContext.requestId}` : undefined,
  });
  // Respuestas grandes (toda la ciudad) en gzip: ~7x menos y lejos del límite de 6 MB de Lambda.
  const acceptsGzip = /gzip/i.test(event.headers?.['accept-encoding'] ?? '');
  if (acceptsGzip && typeof res.body === 'string' && res.body.length > 50_000) {
    return {
      ...res,
      headers: { ...res.headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' },
      body: gzipSync(res.body).toString('base64'),
      isBase64Encoded: true,
    };
  }
  return res;
}
