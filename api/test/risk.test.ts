import { describe, expect, it } from 'vitest';
import { call, contractErrors, makeApp, PEAK, PILOT_BBOX } from './helpers';

describe('GET /v1/risk/segments', () => {
  const app = makeApp();

  it('C004-1: bbox válido → 200 con FeatureCollection según el contrato', async () => {
    const res = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX, asOf: PEAK } });
    expect(res.status).toBe(200);
    expect(contractErrors('SegmentRiskCollection', res.json)).toEqual([]);
    expect(res.json.features.length).toBeGreaterThan(100);
    expect(res.json.disclaimer).toMatch(/no garantía/);
    expect(res.headers['Access-Control-Allow-Origin']).toBeDefined();
    const levels = new Set(res.json.features.map((f: { properties: { level: string } }) => f.properties.level));
    expect(levels.has('high')).toBe(true);
  });

  it('C004-2: bbox inválido → 400 INVALID_REQUEST con requestId y sin detalles internos', async () => {
    for (const bbox of ['abc', '-89.60,20.95,-89.64,20.99', '']) {
      const res = await call(app, 'GET', '/v1/risk/segments', { query: { bbox } });
      expect(res.status).toBe(400);
      expect(contractErrors('ErrorResponse', res.json)).toEqual([]);
      expect(res.json.error.code).toBe('INVALID_REQUEST');
      expect(JSON.stringify(res.json)).not.toMatch(/at .*\.ts|stack/i);
    }
    const noBbox = await call(app, 'GET', '/v1/risk/segments');
    expect(noBbox.status).toBe(400);
    const badDate = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX, asOf: 'ayer' } });
    expect(badDate.status).toBe(400);
    const badLevel = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX, minLevel: 'extreme' } });
    expect(badLevel.status).toBe(400);
  });

  it('C004-3: asOf usa el snapshot más cercano anterior', async () => {
    const res = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX, asOf: '2026-05-29T20:07:00Z' } });
    expect(res.json.computedAt).toBe('2026-05-29T20:00:00Z');
    const exact = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX, asOf: '2026-05-29T17:15:00Z' } });
    expect(exact.json.computedAt).toBe('2026-05-29T17:15:00Z');
  });

  it('C004-4: sin asOf usa el último snapshot', async () => {
    const res = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX } });
    expect(res.json.computedAt).toBe('2026-05-30T00:00:00Z');
  });

  it('filtra por bbox y por minLevel', async () => {
    const all = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX, asOf: PEAK } });
    const high = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX, asOf: PEAK, minLevel: 'high' } });
    expect(high.json.features.length).toBeGreaterThan(0);
    expect(high.json.features.length).toBeLessThan(all.json.features.length);
    expect(high.json.features.every((f: { properties: { level: string } }) => f.properties.level === 'high')).toBe(true);
    const far = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: '-90,10,-89.9,10.1' } });
    expect(far.json.features).toEqual([]);
  });

  it('ruta desconocida → 404 con ErrorResponse', async () => {
    const res = await call(app, 'GET', '/v1/nada');
    expect(res.status).toBe(404);
    expect(contractErrors('ErrorResponse', res.json)).toEqual([]);
  });
});
