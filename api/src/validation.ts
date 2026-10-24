import { isValidPosition, parseBbox, type Bbox, type Position, type RiskLevel, type WaterLevel } from '../../core/src/index';
import { badRequest } from './http';

const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const RISK_LEVELS: RiskLevel[] = ['low', 'medium', 'high'];
const WATER_LEVELS: WaterLevel[] = ['puddle', 'ankle', 'knee', 'impassable'];
export const PHOTO_KEY_RE = /^reports-photos\/[0-9A-HJKMNP-TV-Z]{26}\/[0-9a-f-]{36}\.(jpg|png)$/;
export const MAX_PHOTO_BYTES = 5_242_880;
export const PHOTO_TYPES = ['image/jpeg', 'image/png'] as const;
export type PhotoContentType = (typeof PHOTO_TYPES)[number];

export function requireBbox(raw: string | undefined): Bbox {
  const bbox = parseBbox(raw);
  if (!bbox) throw badRequest('El parámetro bbox no tiene un formato válido.');
  return bbox;
}

export function optionalDateTime(raw: unknown, name: string): number | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !DATE_TIME_RE.test(raw) || !Number.isFinite(Date.parse(raw))) {
    throw badRequest(`El parámetro ${name} debe ser una fecha ISO 8601 (date-time).`);
  }
  return Date.parse(raw);
}

export function optionalRiskLevel(raw: unknown, name: string): RiskLevel | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !RISK_LEVELS.includes(raw as RiskLevel)) {
    throw badRequest(`El parámetro ${name} debe ser uno de: ${RISK_LEVELS.join(', ')}.`);
  }
  return raw as RiskLevel;
}

export function parseJsonObject(body: string | undefined): Record<string, unknown> {
  if (!body) throw badRequest('El cuerpo de la solicitud es obligatorio.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw badRequest('El cuerpo no es JSON válido.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw badRequest('El cuerpo debe ser un objeto JSON.');
  }
  return parsed as Record<string, unknown>;
}

export function requirePosition(raw: unknown, name: string): Position {
  if (!isValidPosition(raw)) throw badRequest(`${name} debe ser [longitud, latitud] con valores válidos.`);
  return raw;
}

export interface ValidReport {
  location: Position;
  waterLevel: WaterLevel;
  notes: string | null;
  photoKey: string | null;
}

export function validateCreateReport(body: Record<string, unknown>): ValidReport {
  const loc = body.location as { type?: unknown; coordinates?: unknown } | undefined;
  if (typeof loc !== 'object' || loc === null || loc.type !== 'Point') {
    throw badRequest('location debe ser un GeoJSON Point.');
  }
  const location = requirePosition(loc.coordinates, 'location.coordinates');
  if (typeof body.waterLevel !== 'string' || !WATER_LEVELS.includes(body.waterLevel as WaterLevel)) {
    throw badRequest(`waterLevel debe ser uno de: ${WATER_LEVELS.join(', ')}.`);
  }
  let notes: string | null = null;
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string') throw badRequest('notes debe ser texto.');
    if (body.notes.length > 280) throw badRequest('notes no puede pasar de 280 caracteres.');
    notes = body.notes.trim() || null;
  }
  let photoKey: string | null = null;
  if (body.photoKey !== undefined && body.photoKey !== null) {
    if (typeof body.photoKey !== 'string' || !PHOTO_KEY_RE.test(body.photoKey)) {
      throw badRequest('photoKey no es válido.');
    }
    photoKey = body.photoKey;
  }
  return { location, waterLevel: body.waterLevel as WaterLevel, notes, photoKey };
}

export function validatePhotoUpload(body: Record<string, unknown>): { contentType: PhotoContentType; sizeBytes: number } {
  if (typeof body.contentType !== 'string' || !PHOTO_TYPES.includes(body.contentType as PhotoContentType)) {
    throw badRequest('contentType debe ser image/jpeg o image/png.');
  }
  const size = body.sizeBytes;
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > MAX_PHOTO_BYTES) {
    throw badRequest('sizeBytes debe ser un entero entre 1 y 5242880.');
  }
  return { contentType: body.contentType as PhotoContentType, sizeBytes: size };
}
