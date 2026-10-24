import type { Position } from '../api/types';

export const MAX_NOTES_LENGTH = 280;
export const MAX_PHOTO_BYTES = 5_242_880;
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png'] as const;
export type AllowedPhotoType = (typeof ALLOWED_PHOTO_TYPES)[number];

const BBOX_RE = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

export function isValidBbox(bbox: string): boolean {
  if (!BBOX_RE.test(bbox)) return false;
  const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
  return (
    isValidPosition([minLng, minLat]) &&
    isValidPosition([maxLng, maxLat]) &&
    minLng <= maxLng &&
    minLat <= maxLat
  );
}

/** Serializa un bbox con 4 decimales: "minLng,minLat,maxLng,maxLat". */
export function formatBbox(minLng: number, minLat: number, maxLng: number, maxLat: number): string {
  return [minLng, minLat, maxLng, maxLat].map((n) => n.toFixed(4)).join(',');
}

export function isValidPosition(p: readonly number[]): p is Position {
  if (p.length !== 2) return false;
  const [lon, lat] = p;
  return (
    Number.isFinite(lon) && Number.isFinite(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90
  );
}

export function validateNotes(notes: string): string | null {
  return notes.length > MAX_NOTES_LENGTH ? `Las notas no pueden pasar de ${MAX_NOTES_LENGTH} caracteres.` : null;
}

export function validatePhoto(file: { type: string; size: number }): string | null {
  if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return 'La foto debe ser JPEG o PNG.';
  }
  if (file.size < 1 || file.size > MAX_PHOTO_BYTES) {
    return 'La foto debe pesar como máximo 5 MB.';
  }
  return null;
}
