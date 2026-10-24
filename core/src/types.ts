/** [longitud, latitud] */
export type Position = [number, number];

export type RiskLevel = 'low' | 'medium' | 'high';
export type WaterLevel = 'puddle' | 'ankle' | 'knee' | 'impassable';

export interface LineString {
  type: 'LineString';
  coordinates: Position[];
}

/** Tramo de calle estático (data/segments.json). */
export interface StreetSegment {
  segmentId: string;
  name: string | null;
  geometry: LineString;
  relativeElevationM: number;
  inDepression: boolean;
  historicalFloodCount: number;
}

export interface Rainfall {
  accum1hMm: number;
  accum3hMm: number;
}

/** Pesos y referencias del modelo v0 (data/model.json). */
export interface RiskModel {
  modelVersion: string;
  weights: {
    rain1h: number;
    rain3h: number;
    lowPoint: number;
    depression: number;
    history: number;
  };
  refs: {
    rain1hRef: number;
    rain3hRef: number;
    lowPointRefM: number;
    historyRef: number;
  };
}

export interface SnapshotEntry {
  segmentId: string;
  score: number;
  level: RiskLevel;
  rainfall1hMm: number;
  rainfall3hMm: number;
}

export interface Snapshot {
  computedAt: string;
  modelVersion: string;
  rainfall: Rainfall;
  entries: SnapshotEntry[];
}

/** Entrada ya ajustada por reportes (lo que se sirve al cliente). */
export interface AdjustedEntry extends SnapshotEntry {
  reportCount60m: number;
}

/** Lo mínimo de un reporte que necesita applyReports. */
export interface ReportForRisk {
  segmentId: string | null;
  waterLevel: WaterLevel;
  createdAt: string;
  /** Epoch en segundos (TTL de DynamoDB). */
  expiresAt?: number;
}

export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}
