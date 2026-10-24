import { clamp01, levelFromScore, levelRank } from './risk';
import type { AdjustedEntry, ReportForRisk, SnapshotEntry } from './types';

export const REPORT_WINDOW_MS = 60 * 60 * 1000;
export const REPORT_BONUS = 0.1;
export const REPORT_BONUS_CAP = 0.3;

/** Reporte vigente: creado en la última hora respecto a `nowMs` y no vencido. */
export function isRecentReport(report: ReportForRisk, nowMs: number): boolean {
  const created = Date.parse(report.createdAt);
  if (!Number.isFinite(created)) return false;
  if (created > nowMs || nowMs - created > REPORT_WINDOW_MS) return false;
  if (report.expiresAt !== undefined && report.expiresAt * 1000 <= nowMs) return false;
  return true;
}

/**
 * Ajuste por reportes (spec-lite 2.2), aplicado al leer. Función pura.
 * +0.10 por reporte vigente sobre el tramo (tope +0.30); `impassable` fija `high`.
 * El nivel nunca baja respecto al del snapshot: ante duda, no subestimar.
 */
export function applyReports(entries: SnapshotEntry[], reports: ReportForRisk[], nowMs: number): AdjustedEntry[] {
  const bySegment = new Map<string, ReportForRisk[]>();
  for (const r of reports) {
    if (!r.segmentId || !isRecentReport(r, nowMs)) continue;
    const list = bySegment.get(r.segmentId) ?? [];
    list.push(r);
    bySegment.set(r.segmentId, list);
  }

  return entries.map((e) => {
    const recent = bySegment.get(e.segmentId) ?? [];
    if (recent.length === 0) return { ...e, reportCount60m: 0 };
    const score = clamp01(e.score + Math.min(REPORT_BONUS_CAP, REPORT_BONUS * recent.length));
    const fromScore = levelFromScore(score);
    let level = levelRank(fromScore) >= levelRank(e.level) ? fromScore : e.level;
    if (recent.some((r) => r.waterLevel === 'impassable')) level = 'high';
    return { ...e, score: Math.round(score * 1000) / 1000, level, reportCount60m: recent.length };
  });
}
