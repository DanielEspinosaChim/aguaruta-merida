import type { Rainfall, RiskLevel, RiskModel, StreetSegment } from './types';

export const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

export const norm = (x: number, ref: number): number => (ref > 0 ? clamp01(x / ref) : 0);

/** Elevación relativa negativa = punto bajo. Positiva no aporta riesgo. */
export const lowPoint = (relativeElevationM: number, lowPointRefM: number): number =>
  norm(-relativeElevationM, lowPointRefM);

export function levelFromScore(score: number): RiskLevel {
  return score < 0.33 ? 'low' : score < 0.66 ? 'medium' : 'high';
}

const LEVEL_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

export const levelRank = (level: RiskLevel): number => LEVEL_RANK[level];

export const maxLevel = (levels: RiskLevel[]): RiskLevel =>
  levels.reduce<RiskLevel>((acc, l) => (LEVEL_RANK[l] > LEVEL_RANK[acc] ? l : acc), 'low');

export const isAtLeast = (level: RiskLevel, min: RiskLevel): boolean => LEVEL_RANK[level] >= LEVEL_RANK[min];

/** Modelo de riesgo v0 (spec-lite 2.2). Función pura. */
export function computeRisk(
  segment: Pick<StreetSegment, 'relativeElevationM' | 'inDepression' | 'historicalFloodCount'>,
  rainfall: Rainfall,
  model: RiskModel,
): { score: number; level: RiskLevel } {
  const { weights: w, refs: r } = model;
  const score = clamp01(
    w.rain1h * norm(rainfall.accum1hMm, r.rain1hRef) +
      w.rain3h * norm(rainfall.accum3hMm, r.rain3hRef) +
      w.lowPoint * lowPoint(segment.relativeElevationM, r.lowPointRefM) +
      w.depression * (segment.inDepression ? 1 : 0) +
      w.history * norm(segment.historicalFloodCount, r.historyRef),
  );
  return { score, level: levelFromScore(score) };
}
