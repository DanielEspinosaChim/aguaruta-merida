import type { Bbox, Position, StreetSegment } from './types';

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (d: number): number => (d * Math.PI) / 180;

export function haversineM(a: Position, b: Position): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineLengthM(coords: Position[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineM(coords[i - 1]!, coords[i]!);
  return total;
}

/** Distancia en metros de un punto a un segmento [a, b] (proyección local equirectangular). */
export function pointToSegmentM(p: Position, a: Position, b: Position): number {
  const kx = Math.cos(toRad(p[1])) * (Math.PI / 180) * EARTH_RADIUS_M;
  const ky = (Math.PI / 180) * EARTH_RADIUS_M;
  const ax = (a[0] - p[0]) * kx;
  const ay = (a[1] - p[1]) * ky;
  const bx = (b[0] - p[0]) * kx;
  const by = (b[1] - p[1]) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function pointToLineM(p: Position, coords: Position[]): number {
  if (coords.length === 1) return haversineM(p, coords[0]!);
  let best = Infinity;
  for (let i = 1; i < coords.length; i++) best = Math.min(best, pointToSegmentM(p, coords[i - 1]!, coords[i]!));
  return best;
}

/** Tramo más cercano a `point` dentro de `maxM` metros, o null. */
export function nearestSegment<S extends Pick<StreetSegment, 'segmentId' | 'geometry'>>(
  point: Position,
  segments: S[],
  maxM = 30,
): { segment: S; distanceM: number } | null {
  let best: { segment: S; distanceM: number } | null = null;
  for (const s of segments) {
    const d = pointToLineM(point, s.geometry.coordinates);
    if (d <= maxM && (!best || d < best.distanceM)) best = { segment: s, distanceM: d };
  }
  return best;
}

const BBOX_RE = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

/** Parsea "minLng,minLat,maxLng,maxLat". Devuelve null si el formato o los rangos son inválidos. */
export function parseBbox(raw: string | undefined | null): Bbox | null {
  if (typeof raw !== 'string' || !BBOX_RE.test(raw)) return null;
  const [minLng, minLat, maxLng, maxLat] = raw.split(',').map(Number) as [number, number, number, number];
  const lngOk = (x: number) => x >= -180 && x <= 180;
  const latOk = (y: number) => y >= -90 && y <= 90;
  if (![minLng, maxLng].every(lngOk) || ![minLat, maxLat].every(latOk)) return null;
  if (minLng > maxLng || minLat > maxLat) return null;
  return { minLng, minLat, maxLng, maxLat };
}

export function pointInBbox(p: Position, b: Bbox): boolean {
  return p[0] >= b.minLng && p[0] <= b.maxLng && p[1] >= b.minLat && p[1] <= b.maxLat;
}

/** True si el bbox de la línea intersecta el bbox pedido. */
export function lineIntersectsBbox(coords: Position[], b: Bbox): boolean {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [x, y] of coords) {
    minLng = Math.min(minLng, x);
    maxLng = Math.max(maxLng, x);
    minLat = Math.min(minLat, y);
    maxLat = Math.max(maxLat, y);
  }
  return minLng <= b.maxLng && maxLng >= b.minLng && minLat <= b.maxLat && maxLat >= b.minLat;
}

export function isValidPosition(p: unknown): p is Position {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === 'number' &&
    typeof p[1] === 'number' &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    p[0] >= -180 &&
    p[0] <= 180 &&
    p[1] >= -90 &&
    p[1] <= 90
  );
}
