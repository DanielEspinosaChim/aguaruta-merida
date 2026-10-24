import { randomUUID } from 'node:crypto';
import {
  applyReports,
  depthToScore,
  isAtLeast,
  levelFromScore,
  segmentDepthsCm,
  simulateLevels,
  type HydroModel,
  type HydroParams,
  lineIntersectsBbox,
  maxLevel,
  nearestSegment,
  pointInBbox,
  REPORT_WINDOW_MS,
  type AdjustedEntry,
  type Bbox,
  type Position,
  type RiskLevel,
  type StreetSegment,
} from '../../core/src/index';
import {
  badRequest,
  errorResponse,
  HttpError,
  json,
  corsHeaders,
  newRequestId,
  type ApiRequest,
  type ApiResponse,
} from './http';
import modelJson from '../../data/model.json';
import { STEP_MS, type RainProvider } from './rain';
import type { RoutingProvider, TravelMode } from './routing';
import { pickSnapshot, type PhotoSigner, type ReportStore, type SnapshotStore, type StoredReport } from './stores';
import { ulid } from './ulid';
import {
  optionalDateTime,
  optionalRiskLevel,
  parseJsonObject,
  requireBbox,
  requirePosition,
  validateCreateReport,
  validatePhotoUpload,
} from './validation';

export const RISK_DISCLAIMER = 'Riesgo estimado, no garantía. Evita las calles marcadas en riesgo alto.';
export const ROUTE_DISCLAIMER = 'Riesgo estimado, no garantía. La ruta puede cruzar zonas no reportadas.';
const REPORT_TTL_S = 24 * 60 * 60;
const PHOTO_URL_TTL_S = 300;
const REPORT_SNAP_M = 30;
const HYDRO = modelJson.hydro as HydroParams & { antecedentHours: number };
const MAX_RAIN_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
const sum1 = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;

export interface AppDeps {
  snapshots: SnapshotStore;
  reports: ReportStore;
  photos: PhotoSigner;
  routing: (segments: StreetSegment[]) => RoutingProvider;
  /** Modelo hidrológico v1 (terreno). Si falta, se usan los snapshots precalculados. */
  hydro?: () => Promise<HydroModel>;
  rain?: RainProvider;
  /** Reloj inyectable para tests. */
  now?: () => number;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}

function optionalStorm(v: unknown): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 150) throw badRequest('stormMmPerH debe ser un número entre 0 y 150.');
  return n;
}

export function createApp(deps: AppDeps) {
  const now = deps.now ?? (() => Date.now());
  const log = deps.log ?? ((msg, meta) => console.error(JSON.stringify({ msg, ...meta })));
  let router: RoutingProvider | undefined;
  let pilotBbox: Bbox | undefined;

  const toPublicReport = async (r: StoredReport) => ({
    reportId: r.reportId,
    location: r.location,
    segmentId: r.segmentId,
    waterLevel: r.waterLevel,
    notes: r.notes,
    photoUrl: r.photoKey ? await deps.photos.publicUrl(r.photoKey) : null,
    createdAt: r.createdAt,
  });

  type HydroEntry = AdjustedEntry & { waterDepthCm: number };
  const hydroCache = new Map<number, Promise<{ base: HydroEntry[]; depths: Map<string, number> }>>();

  /** Corre el modelo hidrológico para el paso de 15 min `t` (lluvia de las `antecedentHours` previas). */
  function hydroBase(t: number, stormMmPerH: number) {
    const key = t * 1000 + Math.round(stormMmPerH);
    let hit = hydroCache.get(key);
    if (!hit) {
      hit = (async () => {
        const from = t - HYDRO.antecedentHours * 3600_000 + STEP_MS;
        const [model, rain, segments] = await Promise.all([deps.hydro!(), deps.rain!.get(from, t), deps.snapshots.getSegments()]);
        const series: number[] = [];
        for (let s = from; s <= t; s += STEP_MS) series.push(rain.byStep.get(s) ?? 0);
        // Tormenta de diseño: X mm repartidos en los 4 pasos (1 h) que terminan en t.
        for (let k = Math.max(0, series.length - 4); k < series.length; k++) series[k]! += stormMmPerH / 4;
        const depths = segmentDepthsCm(model, simulateLevels(model, series, HYDRO));
        const rainfall1hMm = sum1(series.slice(-4));
        const rainfall3hMm = sum1(series.slice(-12));
        const base = segments.map((s) => {
          const waterDepthCm = depths.get(s.segmentId) ?? 0;
          const score = Math.round(depthToScore(waterDepthCm, HYDRO) * 1000) / 1000;
          return { segmentId: s.segmentId, score, level: levelFromScore(score), rainfall1hMm, rainfall3hMm, reportCount60m: 0, waterDepthCm };
        });
        return { base, depths };
      })();
      hit.catch(() => hydroCache.delete(key));
      if (hydroCache.size > 200) hydroCache.clear();
      hydroCache.set(key, hit);
    }
    return hit;
  }

  /** Riesgo para asOf (o ahora) + reportes de la última hora que el modelo u otro reporte corroboran. */
  async function adjustedSnapshot(asOfMs?: number, stormMmPerH = 0) {
    if (deps.hydro && deps.rain) {
      const t = Math.floor((asOfMs ?? now()) / STEP_MS) * STEP_MS;
      const { base, depths } = await hydroBase(t, stormMmPerH);
      const nowMs = now();
      const reports = await deps.reports.listSince(nowMs - REPORT_WINDOW_MS);
      const perSeg = new Map<string, number>();
      for (const r of reports) if (r.segmentId) perSeg.set(r.segmentId, (perSeg.get(r.segmentId) ?? 0) + 1);
      // Un reporte aislado donde el modelo no ve agua no cambia el mapa (evita falsos positivos).
      const corroborated = reports.filter(
        (r) => r.segmentId && ((depths.get(r.segmentId) ?? 0) > 0 || (perSeg.get(r.segmentId) ?? 0) >= 2),
      );
      const entries = applyReports(base, corroborated, nowMs) as HydroEntry[];
      return { snapshot: { computedAt: new Date(t).toISOString().replace('.000Z', 'Z') }, entries };
    }
    const index = await deps.snapshots.getIndex();
    const chosen = pickSnapshot(index, asOfMs);
    const snapshot = await deps.snapshots.getSnapshot(chosen.key);
    const nowMs = now();
    const reports = await deps.reports.listSince(nowMs - REPORT_WINDOW_MS);
    const entries = applyReports(snapshot.entries, reports, nowMs);
    return { snapshot, entries };
  }

  async function getPilotBbox(): Promise<Bbox> {
    if (!pilotBbox) {
      const segs = await deps.snapshots.getSegments();
      const pad = 0.01; // ~1 km
      const xs = segs.flatMap((s) => s.geometry.coordinates.map((c) => c[0]));
      const ys = segs.flatMap((s) => s.geometry.coordinates.map((c) => c[1]));
      pilotBbox = {
        minLng: Math.min(...xs) - pad,
        maxLng: Math.max(...xs) + pad,
        minLat: Math.min(...ys) - pad,
        maxLat: Math.max(...ys) + pad,
      };
    }
    return pilotBbox;
  }

  async function listRiskSegments(req: ApiRequest): Promise<ApiResponse> {
    const bbox = requireBbox(req.query.bbox);
    const asOfMs = optionalDateTime(req.query.asOf, 'asOf');
    const minLevel = optionalRiskLevel(req.query.minLevel, 'minLevel');
    const storm = optionalStorm(req.query.stormMmPerH);
    const segments = await deps.snapshots.getSegments();
    const { snapshot, entries } = await adjustedSnapshot(asOfMs, storm);
    const byId = new Map<string, AdjustedEntry>(entries.map((e) => [e.segmentId, e]));

    const features = [];
    for (const s of segments) {
      const e = byId.get(s.segmentId);
      if (!e || !lineIntersectsBbox(s.geometry.coordinates, bbox)) continue;
      if (minLevel && !isAtLeast(e.level, minLevel)) continue;
      features.push({
        type: 'Feature',
        geometry: s.geometry,
        properties: {
          segmentId: s.segmentId,
          name: s.name,
          level: e.level,
          score: e.score,
          rainfall1hMm: e.rainfall1hMm,
          rainfall3hMm: e.rainfall3hMm,
          reportCount60m: e.reportCount60m,
          ...('waterDepthCm' in e ? { waterDepthCm: (e as HydroEntry).waterDepthCm } : {}),
        },
      });
    }
    return json(200, { type: 'FeatureCollection', computedAt: snapshot.computedAt, disclaimer: RISK_DISCLAIMER, features });
  }

  async function getRainfall(req: ApiRequest): Promise<ApiResponse> {
    const fromMs = optionalDateTime(req.query.from, 'from');
    const toMs = optionalDateTime(req.query.to, 'to');
    if (fromMs === undefined || toMs === undefined) throw badRequest('from y to son obligatorios.');
    if (toMs < fromMs || toMs - fromMs > MAX_RAIN_RANGE_MS) throw badRequest('El rango debe ser de 0 a 7 días.');
    if (!deps.rain) return json(200, { source: 'sin fuente', stepMinutes: 15, series: [] });
    const rain = await deps.rain.get(fromMs, toMs);
    const series = [...rain.byStep]
      .sort((a, b) => a[0] - b[0])
      .map(([t, mm]) => ({ t: new Date(t).toISOString().replace('.000Z', 'Z'), mm }));
    return json(200, { source: rain.source, stepMinutes: 15, series });
  }

  async function createReport(req: ApiRequest): Promise<ApiResponse> {
    const input = validateCreateReport(parseJsonObject(req.body));
    const segments = await deps.snapshots.getSegments();
    const near = nearestSegment(input.location, segments, REPORT_SNAP_M);
    const nowMs = now();
    const report: StoredReport = {
      reportId: ulid(nowMs),
      location: { type: 'Point', coordinates: input.location },
      segmentId: near?.segment.segmentId ?? null,
      waterLevel: input.waterLevel,
      notes: input.notes,
      photoKey: input.photoKey,
      createdAt: new Date(nowMs).toISOString(),
      expiresAt: Math.floor(nowMs / 1000) + REPORT_TTL_S,
    };
    await deps.reports.put(report);
    return json(201, await toPublicReport(report));
  }

  async function listReports(req: ApiRequest): Promise<ApiResponse> {
    const bbox = requireBbox(req.query.bbox);
    const sinceMs = optionalDateTime(req.query.since, 'since') ?? now() - REPORT_WINDOW_MS;
    const items = await Promise.all(
      (await deps.reports.listSince(sinceMs))
        .filter((r) => pointInBbox(r.location.coordinates, bbox))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(toPublicReport),
    );
    return json(200, { items });
  }

  async function createPhotoUploadUrl(req: ApiRequest): Promise<ApiResponse> {
    const { contentType } = validatePhotoUpload(parseJsonObject(req.body));
    const ext = contentType === 'image/png' ? 'png' : 'jpg';
    const photoKey = `reports-photos/${ulid(now())}/${randomUUID()}.${ext}`;
    const uploadUrl = await deps.photos.createUploadUrl(photoKey, contentType, PHOTO_URL_TTL_S);
    return json(201, { uploadUrl, photoKey, method: 'PUT', expiresInSeconds: PHOTO_URL_TTL_S });
  }

  async function calculateRoute(req: ApiRequest): Promise<ApiResponse> {
    const body = parseJsonObject(req.body);
    const origin = requirePosition(body.origin, 'origin');
    const destination = requirePosition(body.destination, 'destination');
    const mode = (body.mode ?? 'car') as TravelMode;
    if (mode !== 'car' && mode !== 'walk') throw badRequest('mode debe ser car o walk.');
    const avoidLevel = (body.avoidLevel ?? 'high') as RiskLevel;
    if (avoidLevel !== 'medium' && avoidLevel !== 'high') throw badRequest('avoidLevel debe ser medium o high.');
    const asOfMs = optionalDateTime(body.asOf, 'asOf');
    const storm = optionalStorm(body.stormMmPerH);

    const pilot = await getPilotBbox();
    if (!pointInBbox(origin, pilot) || !pointInBbox(destination, pilot)) {
      throw badRequest('Origen o destino fuera de la zona piloto.');
    }

    const segments = await deps.snapshots.getSegments();
    router ??= deps.routing(segments);
    const { snapshot, entries } = await adjustedSnapshot(asOfMs, storm);
    const levelOf = new Map<string, RiskLevel>(entries.map((e) => [e.segmentId, e.level]));
    const risky = new Set(entries.filter((e) => isAtLeast(e.level, avoidLevel)).map((e) => e.segmentId));

    const notFound = () =>
      new HttpError(404, 'ROUTE_NOT_FOUND', `No se encontró una ruta que evite los tramos de riesgo ${avoidLevel === 'high' ? 'alto' : 'medio o alto'}.`);

    const baseline = await router.calculate({ origin, destination, mode, avoidSegmentIds: new Set() });
    if (!baseline) throw notFound();
    const baselineRisky = [...new Set(baseline.segmentIds.filter((id) => risky.has(id)))];

    const safer = await router.calculate({ origin, destination, mode, avoidSegmentIds: risky });
    if (!safer) throw notFound();
    // La evitación puede ser solo preferencia (Amazon Location): se verifica contra la geometría.
    if (safer.segmentIds.some((id) => risky.has(id))) throw notFound();
    const residualRiskLevel = maxLevel(safer.segmentIds.map((id) => levelOf.get(id) ?? 'low'));

    const line = (coordinates: Position[]) => ({ type: 'LineString', coordinates });
    return json(200, {
      computedAt: snapshot.computedAt,
      baseline: {
        distanceM: baseline.distanceM,
        durationS: baseline.durationS,
        riskySegmentCount: baselineRisky.length,
        geometry: line(baseline.coordinates),
      },
      safer: {
        distanceM: safer.distanceM,
        durationS: safer.durationS,
        avoidedSegmentIds: baselineRisky,
        residualRiskLevel,
        geometry: line(safer.coordinates),
      },
      disclaimer: ROUTE_DISCLAIMER,
    });
  }

  const routes: Record<string, (req: ApiRequest) => Promise<ApiResponse>> = {
    'GET /v1/risk/segments': listRiskSegments,
    'GET /v1/rainfall': getRainfall,
    'POST /v1/reports': createReport,
    'GET /v1/reports': listReports,
    'POST /v1/reports/photo-upload-url': createPhotoUploadUrl,
    'POST /v1/routes': calculateRoute,
  };

  return async function handle(req: ApiRequest): Promise<ApiResponse> {
    const requestId = req.requestId ?? newRequestId();
    const path = req.path.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return { statusCode: 204, headers: corsHeaders(), body: '' };
    const fn = routes[`${req.method.toUpperCase()} ${path}`];
    if (!fn) return errorResponse(404, 'INVALID_REQUEST', 'Recurso no encontrado.', requestId);
    try {
      return await fn(req);
    } catch (err) {
      if (err instanceof HttpError) return errorResponse(err.status, err.code, err.message, requestId);
      log('unhandled_error', { requestId, route: `${req.method} ${path}`, error: err instanceof Error ? err.message : String(err) });
      return errorResponse(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado. Intenta de nuevo.', requestId);
    }
  };
}
