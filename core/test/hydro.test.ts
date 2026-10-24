import { describe, expect, it } from 'vitest';
import { depthToScore, levelForVolume, scsRunoffMm, segmentDepthsCm, simulateLevels, type HydroModel } from '../src/hydro';

const P = { curveNumber: 85, drainMmPerH: 2, depthCmMaxScore: 30 };

// Hondonada de 4 celdas de 100 m² (fondo en 9.0, 9.2, 9.4, 9.6; derrame 10.0) con cuenca de 1 ha.
const model: HydroModel = {
  cellAreaM2: 100,
  depressions: [{ spill: 10, catchAreaM2: 10000, zs: [9.0, 9.2, 9.4, 9.6] }],
  segments: { seg_fondo: [[0, 9.0]], seg_borde: [[0, 9.6]], seg_fuera: [] },
};

describe('modelo hidrológico', () => {
  it('C012-1: escurrimiento SCS-CN (CN 85, 50 mm → 19.6 mm; bajo Ia → 0)', () => {
    expect(scsRunoffMm(50, 85)).toBeCloseTo(19.61, 1);
    expect(scsRunoffMm(5, 85)).toBe(0);
  });

  it('C012-2: el nivel sale de la forma real del fondo', () => {
    // 20 m³ llenan 0.2 m sobre la celda más baja (1 celda) → 9.2
    expect(levelForVolume(model.depressions[0]!, 100, 20)).toBeCloseTo(9.2, 6);
    expect(Number.isNaN(levelForVolume(model.depressions[0]!, 100, 0))).toBe(true);
  });

  it('C012-3: sin lluvia no hay agua; con tormenta el fondo se inunda más que el borde', () => {
    const dry = segmentDepthsCm(model, simulateLevels(model, Array(24).fill(0), P));
    expect(dry.size).toBe(0);
    const storm = [...Array(4).fill(10), ...Array(4).fill(5)]; // 60 mm en 2 h
    const depths = segmentDepthsCm(model, simulateLevels(model, storm, P));
    expect(depths.get('seg_fondo')!).toBeGreaterThan(depths.get('seg_borde') ?? 0);
    expect(depths.has('seg_fuera')).toBe(false);
  });

  it('C012-4: profundidad → score con tope (30 cm = 1)', () => {
    expect(depthToScore(15, P)).toBeCloseTo(0.5, 6);
    expect(depthToScore(90, P)).toBe(1);
  });
});
