import { describe, expect, it } from 'vitest';
import modelJson from '../../data/model.json';
import { computeRisk, levelFromScore } from '../src/risk';
import type { RiskModel } from '../src/types';

const model = modelJson as RiskModel;

describe('computeRisk', () => {
  it('C003-1: aplica la fórmula v0 con un ejemplo numérico', () => {
    // 0.35*0.5 + 0.20*0.4 + 0.20*0.5 + 0.15*1 + 0.10*0.4 = 0.545
    const r = computeRisk(
      { relativeElevationM: -1, inDepression: true, historicalFloodCount: 2 },
      { accum1hMm: 20, accum3hMm: 30 },
      model,
    );
    expect(r.score).toBeCloseTo(0.545, 6);
    expect(r.level).toBe('medium');
  });

  it('C003-2: umbrales 0.33 y 0.66', () => {
    expect(levelFromScore(0)).toBe('low');
    expect(levelFromScore(0.3299)).toBe('low');
    expect(levelFromScore(0.33)).toBe('medium');
    expect(levelFromScore(0.6599)).toBe('medium');
    expect(levelFromScore(0.66)).toBe('high');
    expect(levelFromScore(1)).toBe('high');
  });

  it('C003-3: los pesos y referencias vienen de data/model.json, no del código', () => {
    const seg = { relativeElevationM: 0, inDepression: false, historicalFloodCount: 0 };
    const rain = { accum1hMm: model.refs.rain1hRef, accum3hMm: 0 };
    expect(computeRisk(seg, rain, model).score).toBeCloseTo(model.weights.rain1h, 6);
    const altered: RiskModel = { ...model, weights: { ...model.weights, rain1h: 0.9 } };
    expect(computeRisk(seg, rain, altered).score).toBeCloseTo(0.9, 6);
    const altRefs: RiskModel = { ...model, refs: { ...model.refs, rain1hRef: model.refs.rain1hRef * 2 } };
    expect(computeRisk(seg, rain, altRefs).score).toBeCloseTo(model.weights.rain1h / 2, 6);
  });

  it('C003-4: score acotado a [0, 1] con entradas extremas', () => {
    const max = computeRisk(
      { relativeElevationM: -50, inDepression: true, historicalFloodCount: 100 },
      { accum1hMm: 500, accum3hMm: 900 },
      model,
    );
    expect(max.score).toBeLessThanOrEqual(1);
    expect(max.level).toBe('high');
    const min = computeRisk(
      { relativeElevationM: 10, inDepression: false, historicalFloodCount: 0 },
      { accum1hMm: -5, accum3hMm: Number.NaN },
      model,
    );
    expect(min.score).toBe(0);
    expect(min.level).toBe('low');
  });
});
