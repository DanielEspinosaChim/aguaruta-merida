import { describe, expect, it } from 'vitest';
import { call, contractErrors, floodedEverywhere, makeApp, makeHydroApp, PEAK, PILOT_BBOX } from './helpers';

// Calle 70 x 61 → Calle 50 x 61: la ruta directa cruza la depresión del mercado (Calle 60 x 61).
const ORIGIN = [-89.63095, 20.9668];
const DESTINATION = [-89.61645, 20.9668];

describe('POST /v1/routes', () => {
  const app = makeApp();

  it('C005-1: en el pico, la ruta alternativa evita los tramos high', async () => {
    const res = await call(app, 'POST', '/v1/routes', {
      body: { origin: ORIGIN, destination: DESTINATION, mode: 'car', avoidLevel: 'high', asOf: PEAK },
    });
    expect(res.status).toBe(200);
    expect(contractErrors('RouteResult', res.json)).toEqual([]);
    expect(res.json.baseline.riskySegmentCount).toBeGreaterThan(0);
    expect(res.json.safer.avoidedSegmentIds.length).toBe(res.json.baseline.riskySegmentCount);
    expect(res.json.safer.residualRiskLevel).not.toBe('high');
    expect(res.json.safer.distanceM).toBeGreaterThanOrEqual(res.json.baseline.distanceM);

    const risk = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX, asOf: PEAK, minLevel: 'high' } });
    const highIds = new Set(risk.json.features.map((f: { properties: { segmentId: string } }) => f.properties.segmentId));
    for (const id of res.json.safer.avoidedSegmentIds) expect(highIds.has(id)).toBe(true);
  });

  it('C005-2: sin alternativa posible → 404 ROUTE_NOT_FOUND', async () => {
    // Terreno de prueba donde toda la red queda bajo agua: no existe ruta que evite el riesgo.
    const flooded = makeHydroApp(floodedEverywhere(), new Map());
    const res = await call(flooded, 'POST', '/v1/routes', {
      body: { origin: ORIGIN, destination: DESTINATION, avoidLevel: 'medium', asOf: PEAK, stormMmPerH: 60 },
    });
    expect(res.status).toBe(404);
    expect(contractErrors('ErrorResponse', res.json)).toEqual([]);
    expect(res.json.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('C005-3: la respuesta incluye disclaimer y nunca afirma transitabilidad', async () => {
    const res = await call(app, 'POST', '/v1/routes', { body: { origin: ORIGIN, destination: DESTINATION, asOf: '2026-05-29T15:00:00Z' } });
    expect(res.status).toBe(200);
    expect(res.json.disclaimer).toMatch(/no garantía/);
    expect(JSON.stringify(res.json)).not.toMatch(/transitable/i);
  });

  it('C005-4: coordenadas inválidas o fuera de la zona piloto → 400', async () => {
    const bad = [
      { origin: [-200, 20.96], destination: DESTINATION },
      { origin: [-89.62], destination: DESTINATION },
      { origin: ORIGIN, destination: [-99.13, 19.43] },
      { origin: ORIGIN, destination: DESTINATION, mode: 'bike' },
      { origin: ORIGIN, destination: DESTINATION, avoidLevel: 'low' },
      { origin: ORIGIN, destination: DESTINATION, asOf: 'mañana' },
      'no-json',
    ];
    for (const body of bad) {
      const res = await call(app, 'POST', '/v1/routes', { body });
      expect(res.status).toBe(400);
      expect(res.json.error.code).toBe('INVALID_REQUEST');
    }
  });

  it('mode walk tarda más que car para la misma ruta', async () => {
    const car = await call(app, 'POST', '/v1/routes', { body: { origin: ORIGIN, destination: DESTINATION, mode: 'car', asOf: PEAK } });
    const walk = await call(app, 'POST', '/v1/routes', { body: { origin: ORIGIN, destination: DESTINATION, mode: 'walk', asOf: PEAK } });
    expect(walk.json.baseline.durationS).toBeGreaterThan(car.json.baseline.durationS);
  });
});
