import { describe, expect, it } from 'vitest';
import { nearestSegment, parseBbox } from '../src/geo';
import { applyReports } from '../src/reports';
import type { ReportForRisk, SnapshotEntry, StreetSegment } from '../src/types';

const NOW = Date.parse('2026-05-29T20:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

const entry = (segmentId: string, score: number, level: SnapshotEntry['level']): SnapshotEntry => ({
  segmentId,
  score,
  level,
  rainfall1hMm: 30,
  rainfall3hMm: 50,
});

const report = (segmentId: string | null, waterLevel: ReportForRisk['waterLevel'], ago = 5): ReportForRisk => ({
  segmentId,
  waterLevel,
  createdAt: minutesAgo(ago),
});

describe('applyReports', () => {
  it('C006-1: cada reporte vigente suma 0.10 al score', () => {
    const [a] = applyReports([entry('s1', 0.2, 'low')], [report('s1', 'ankle')], NOW);
    expect(a!.score).toBeCloseTo(0.3, 6);
    expect(a!.reportCount60m).toBe(1);
    const [b] = applyReports([entry('s1', 0.2, 'low')], [report('s1', 'ankle'), report('s1', 'puddle')], NOW);
    expect(b!.score).toBeCloseTo(0.4, 6);
    expect(b!.level).toBe('medium');
  });

  it('C006-2: el ajuste tiene tope +0.30', () => {
    const reports = Array.from({ length: 6 }, () => report('s1', 'knee'));
    const [a] = applyReports([entry('s1', 0.1, 'low')], reports, NOW);
    expect(a!.score).toBeCloseTo(0.4, 6);
    expect(a!.reportCount60m).toBe(6);
    const [b] = applyReports([entry('s1', 0.9, 'high')], reports, NOW);
    expect(b!.score).toBeLessThanOrEqual(1);
  });

  it('C006-3: un reporte impassable fija level=high', () => {
    const [a] = applyReports([entry('s1', 0.05, 'low')], [report('s1', 'impassable')], NOW);
    expect(a!.level).toBe('high');
  });

  it('C006-4: reportes de hace más de 1 h, futuros, vencidos o de otro tramo se ignoran', () => {
    const reports: ReportForRisk[] = [
      report('s1', 'impassable', 61),
      report('s1', 'impassable', -5),
      { ...report('s1', 'impassable'), expiresAt: Math.floor(NOW / 1000) - 1 },
      report('s2', 'impassable'),
      report(null, 'impassable'),
    ];
    const [a] = applyReports([entry('s1', 0.2, 'low')], reports, NOW);
    expect(a).toEqual({ ...entry('s1', 0.2, 'low'), reportCount60m: 0 });
  });

  it('el nivel nunca baja respecto al snapshot', () => {
    const [a] = applyReports([entry('s1', 0.5, 'high')], [report('s1', 'puddle')], NOW);
    expect(a!.level).toBe('high');
  });
});

describe('nearestSegment', () => {
  const seg = (id: string, coords: [number, number][]): Pick<StreetSegment, 'segmentId' | 'geometry'> => ({
    segmentId: id,
    geometry: { type: 'LineString', coordinates: coords },
  });
  const segments = [
    seg('a', [
      [-89.6237, 20.9671],
      [-89.6221, 20.9674],
    ]),
    seg('b', [
      [-89.63, 20.97],
      [-89.63, 20.972],
    ]),
  ];

  it('C006-5: asocia al tramo a ≤ 30 m o devuelve null', () => {
    // ~11 m al sur del tramo "a"
    const near = nearestSegment([-89.623, 20.96715], segments, 30);
    expect(near?.segment.segmentId).toBe('a');
    expect(near!.distanceM).toBeLessThan(30);
    // ~200 m de cualquier tramo
    expect(nearestSegment([-89.626, 20.9655], segments, 30)).toBeNull();
  });
});

describe('parseBbox', () => {
  it('acepta el formato del contrato y rechaza formatos o rangos inválidos', () => {
    expect(parseBbox('-89.64,20.95,-89.60,20.99')).toEqual({ minLng: -89.64, minLat: 20.95, maxLng: -89.6, maxLat: 20.99 });
    expect(parseBbox('abc')).toBeNull();
    expect(parseBbox('-89.60,20.95,-89.64,20.99')).toBeNull();
    expect(parseBbox('-200,20,-89,21')).toBeNull();
    expect(parseBbox(undefined)).toBeNull();
  });
});
