import { randomUUID } from 'node:crypto';
import {
  applyReports,
  isAtLeast,
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

export interface AppDeps {
  snapshots: SnapshotStore;
  reports: ReportStore;
  photos: PhotoSigner;
  routing: (segments: StreetSegment[]) => RoutingProvider;
  /** Reloj inyectable para tests. */
  now?: () => number;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
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

  /** Snapshot elegido + ajuste por reportes de la última hora (reloj real: los reportes son en vivo). */
  async function adjustedSnapshot(asOfMs?: number) {
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
    const segments = await deps.snapshots.getSegments();
    const { snapshot, entries } = await adjustedSnapshot(asOfMs);
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
        },
      });
    }
    return json(200, { type: 'FeatureCollection', computedAt: snapshot.computedAt, disclaimer: RISK_DISCLAIMER, features });
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

    const pilot = await getPilotBbox();
    if (!pointInBbox(origin, pilot) || !pointInBbox(destination, pilot)) {
      throw badRequest('Origen o destino fuera de la zona piloto.');
    }

    const segments = await deps.snapshots.getSegments();
    router ??= deps.routing(segments);
    const { snapshot, entries } = await adjustedSnapshot(asOfMs);
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
