import { describe, expect, it } from 'vitest';
import { call, contractErrors, floodedEverywhere, makeHydroApp, PILOT_BBOX } from './helpers';

const T = Date.parse('2026-05-29T16:00:00Z');
const rain = new Map([[T, 5], [T - 15 * 60_000, 5]]);

describe('modelo hidrológico en la API', () => {
  it('C012-5: /risk/segments devuelve waterDepthCm y respeta el contrato', async () => {
    const app = makeHydroApp(floodedEverywhere(), rain);
    const res = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX, asOf: '2026-05-29T16:07:00Z', stormMmPerH: '40' } });
    expect(res.status).toBe(200);
    expect(contractErrors('SegmentRiskCollection', res.json)).toEqual([]);
    expect(res.json.computedAt).toBe('2026-05-29T16:00:00Z');
    expect(res.json.features[0].properties.waterDepthCm).toBeGreaterThan(0);
  });

  it('C012-6: sin lluvia no hay agua; stormMmPerH fuera de rango → 400', async () => {
    const app = makeHydroApp(floodedEverywhere(), new Map());
    const dry = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX, asOf: '2026-05-29T16:00:00Z' } });
    expect(dry.json.features.every((f: { properties: { waterDepthCm: number } }) => f.properties.waterDepthCm === 0)).toBe(true);
    const bad = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX, stormMmPerH: '999' } });
    expect(bad.status).toBe(400);
  });

  it('C012-7: un reporte aislado donde el modelo no ve agua no cambia el mapa', async () => {
    const empty = { cellAreaM2: 100, depressions: [], segments: {} };
    const app = makeHydroApp(empty, new Map());
    const rep = await call(app, 'POST', '/v1/reports', {
      body: { location: { type: 'Point', coordinates: [-89.623321, 20.966445] }, waterLevel: 'impassable' },
    });
    expect(rep.status).toBe(201);
    const res = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX } });
    const f = res.json.features.find((x: { properties: { segmentId: string } }) => x.properties.segmentId === rep.json.segmentId);
    expect(f.properties.level).toBe('low');
  });

  it('C012-8: /rainfall devuelve la serie de 15 min y valida el rango', async () => {
    const app = makeHydroApp(floodedEverywhere(), rain);
    const ok = await call(app, 'GET', '/v1/rainfall', { query: { from: '2026-05-29T15:00:00Z', to: '2026-05-29T17:00:00Z' } });
    expect(ok.status).toBe(200);
    expect(contractErrors('RainfallSeries', ok.json)).toEqual([]);
    expect(ok.json.series).toHaveLength(2);
    const bad = await call(app, 'GET', '/v1/rainfall', { query: { from: '2026-05-29T15:00:00Z', to: '2026-06-29T15:00:00Z' } });
    expect(bad.status).toBe(400);
  });
});
