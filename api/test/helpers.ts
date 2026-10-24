import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import { createApp } from '../src/app';
import { LocalGraphRoutingProvider } from '../src/routing';
import { StaticRain } from '../src/rain';
import { LocalPhotoSigner, LocalSnapshotStore, MemoryReportStore } from '../src/stores';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = join(ROOT, 'data');

const contract = parse(readFileSync(join(ROOT, 'contract', 'openapi.yaml'), 'utf8')) as {
  components: Record<string, unknown>;
};
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

/** Valida `data` contra components.schemas.<name> del contrato. Devuelve los errores o []. */
export function contractErrors(name: string, data: unknown): string[] {
  const validate = ajv.compile({ components: contract.components, $ref: `#/components/schemas/${name}` });
  return validate(data) ? [] : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
}

export function makeApp(now = () => Date.now()) {
  return createApp({
    snapshots: new LocalSnapshotStore(DATA_DIR),
    reports: new MemoryReportStore(),
    photos: new LocalPhotoSigner('http://127.0.0.1:4020'),
    routing: (segments) => new LocalGraphRoutingProvider(segments),
    now,
    log: () => {},
  });
}

export type App = ReturnType<typeof makeApp>;

export async function call(app: App, method: string, path: string, opts: { query?: Record<string, string>; body?: unknown } = {}) {
  const res = await app({
    method,
    path,
    query: opts.query ?? {},
    body: opts.body === undefined ? undefined : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body),
  });
  return { status: res.statusCode, headers: res.headers, json: res.body ? JSON.parse(res.body) : undefined };
}

export const PILOT_BBOX = '-89.64,20.95,-89.60,20.99';
export const PEAK = '2026-05-29T20:30:00Z';

/** App con el modelo hidrológico y lluvia fija (sin red). */
export function makeHydroApp(model: import('../../core/src/index').HydroModel, rain: Map<number, number>, now = () => Date.now()) {
  const snapshots = new LocalSnapshotStore(DATA_DIR);
  return createApp({
    snapshots,
    hydro: async () => model,
    rain: new StaticRain(rain),
    reports: new MemoryReportStore(),
    photos: new LocalPhotoSigner('http://127.0.0.1:4020'),
    routing: (segments) => new LocalGraphRoutingProvider(segments),
    now,
    log: () => {},
  });
}

/** Terreno de prueba: toda la red en una sola hondonada enorme (todo se inunda con lluvia). */
export function floodedEverywhere() {
  const segs = JSON.parse(readFileSync(join(DATA_DIR, 'segments.json'), 'utf8')) as { segmentId: string }[];
  return {
    cellAreaM2: 100,
    depressions: [{ spill: 100, catchAreaM2: 1e9, zs: [0] }],
    segments: Object.fromEntries(segs.map((s) => [s.segmentId, [[0, 0]] as [number, number][]])),
  };
}
