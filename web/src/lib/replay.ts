import type { RiskLevel } from '../api/types';

export const REPLAY_START = Date.parse('2026-05-29T15:00:00Z');
export const REPLAY_END = Date.parse('2026-05-30T00:00:00Z');
export const REPLAY_STEP_MS = 15 * 60 * 1000;
export const REPLAY_STEPS = Math.round((REPLAY_END - REPLAY_START) / REPLAY_STEP_MS);

/** Paso del slider (0..REPLAY_STEPS) a ISO 8601 sin milisegundos. */
export function stepToAsOf(step: number): string {
  const clamped = Math.min(Math.max(Math.round(step), 0), REPLAY_STEPS);
  return new Date(REPLAY_START + clamped * REPLAY_STEP_MS).toISOString().replace('.000Z', 'Z');
}

export const LEVEL_COLORS: Record<RiskLevel, string> = {
  low: '#2e9d4f',
  medium: '#f2a516',
  high: '#d7263d',
};

export const LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
};

/** Expresión MapLibre de color por `level` (C002-1). */
export const levelColorExpression = [
  'match',
  ['get', 'level'],
  'low',
  LEVEL_COLORS.low,
  'medium',
  LEVEL_COLORS.medium,
  'high',
  LEVEL_COLORS.high,
  '#888888',
] as const;

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function formatDuration(s: number): string {
  return `${Math.round(s / 60)} min`;
}
