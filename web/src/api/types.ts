/* Derivado de contract/openapi.yaml v0.1.0-lite. Si el contrato cambia, se actualiza este archivo. */

/* ---------- Primitivos ---------- */

export type RiskLevel = 'low' | 'medium' | 'high';
export type WaterLevel = 'puddle' | 'ankle' | 'knee' | 'impassable';
export type TravelMode = 'car' | 'walk';

/** [longitud, latitud] */
export type Position = [number, number];

export interface Point {
  type: 'Point';
  coordinates: Position;
}

export interface LineString {
  type: 'LineString';
  coordinates: Position[];
}

/* ---------- Errores ---------- */

export type ApiErrorCode = 'INVALID_REQUEST' | 'ROUTE_NOT_FOUND' | 'INTERNAL_ERROR';

export interface ErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
  };
}

/* ---------- Riesgo ---------- */

export interface SegmentRiskProperties {
  segmentId: string;
  name?: string | null;
  level: RiskLevel;
  score: number; // 0..1
  rainfall1hMm: number;
  rainfall3hMm: number;
  reportCount60m: number;
}

export interface SegmentRiskFeature {
  type: 'Feature';
  geometry: LineString;
  properties: SegmentRiskProperties;
}

export interface SegmentRiskCollection {
  type: 'FeatureCollection';
  computedAt: string;
  disclaimer: string;
  features: SegmentRiskFeature[];
}

export interface ListRiskSegmentsParams {
  bbox: string; // "minLng,minLat,maxLng,maxLat"
  asOf?: string;
  minLevel?: RiskLevel;
}

/* ---------- Reportes ---------- */

export interface CreateReportRequest {
  location: Point;
  waterLevel: WaterLevel;
  notes?: string; // máx. 280 caracteres
  photoKey?: string | null;
}

export interface FloodReport {
  reportId: string;
  location: Point;
  segmentId?: string | null;
  waterLevel: WaterLevel;
  notes?: string | null;
  photoUrl?: string | null;
  createdAt: string;
}

export interface FloodReportList {
  items: FloodReport[];
}

export interface ListReportsParams {
  bbox: string;
  since?: string;
}

export interface PhotoUploadRequest {
  contentType: 'image/jpeg' | 'image/png';
  sizeBytes: number; // máx. 5 242 880
}

export interface PhotoUploadResponse {
  uploadUrl: string;
  photoKey: string;
  method: 'PUT';
  expiresInSeconds: number;
}

/* ---------- Rutas ---------- */

export interface RouteRequest {
  origin: Position;
  destination: Position;
  mode?: TravelMode; // por defecto 'car'
  avoidLevel?: 'medium' | 'high'; // por defecto 'high'
  asOf?: string;
}

export interface RouteLeg {
  distanceM: number;
  durationS: number;
  geometry: LineString;
}

export interface BaselineRoute extends RouteLeg {
  riskySegmentCount: number;
}

export interface SaferRoute extends RouteLeg {
  avoidedSegmentIds: string[];
  residualRiskLevel: RiskLevel;
}

export interface RouteResult {
  computedAt: string;
  baseline: BaselineRoute;
  safer: SaferRoute;
  disclaimer: string;
}

/* ---------- Cliente HTTP ---------- */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ErrorResponse,
  ) {
    super(body.error.message);
    this.name = 'ApiError';
  }
}

export interface AguaRutaApi {
  listRiskSegments(params: ListRiskSegmentsParams): Promise<SegmentRiskCollection>;
  createReport(body: CreateReportRequest): Promise<FloodReport>;
  listReports(params: ListReportsParams): Promise<FloodReportList>;
  createPhotoUploadUrl(body: PhotoUploadRequest): Promise<PhotoUploadResponse>;
  calculateRoute(body: RouteRequest): Promise<RouteResult>;
}
