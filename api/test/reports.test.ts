import { describe, expect, it } from 'vitest';
import { call, contractErrors, makeApp, PILOT_BBOX } from './helpers';

// Junto al mercado, sobre un tramo real de Calle 63 (data/segments.json viene de OSM).
const ON_STREET = [-89.623321, 20.966445];
// Fuera de la red importada: a más de 30 m de cualquier calle.
const OFF_STREET = [-89.648, 20.945];

async function segmentAt(app: ReturnType<typeof makeApp>, segmentId: string, asOf: string) {
  const res = await call(app, 'GET', '/v1/risk/segments', { query: { bbox: PILOT_BBOX, asOf } });
  return res.json.features.find((f: { properties: { segmentId: string } }) => f.properties.segmentId === segmentId);
}

describe('reportes', () => {
  it('C006-6: un reporte impassable deja el tramo en high en la siguiente consulta', async () => {
    const app = makeApp();
    const created = await call(app, 'POST', '/v1/reports', {
      body: { location: { type: 'Point', coordinates: ON_STREET }, waterLevel: 'impassable', notes: 'No pasa nada' },
    });
    expect(created.status).toBe(201);
    expect(contractErrors('FloodReport', created.json)).toEqual([]);
    expect(created.json.reportId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    const segmentId = created.json.segmentId as string;
    expect(segmentId).toMatch(/^seg_/);

    // Antes de la lluvia el tramo no está en high; con el reporte, sí.
    const before = await segmentAt(makeApp(), segmentId, '2026-05-29T15:00:00Z');
    expect(before.properties.level).not.toBe('high');
    const after = await segmentAt(app, segmentId, '2026-05-29T15:00:00Z');
    expect(after.properties.level).toBe('high');
    expect(after.properties.reportCount60m).toBe(1);
    expect(after.properties.score).toBeCloseTo(before.properties.score + 0.1, 3);

    const list = await call(app, 'GET', '/v1/reports', { query: { bbox: PILOT_BBOX } });
    expect(contractErrors('FloodReportList', list.json)).toEqual([]);
    expect(list.json.items).toHaveLength(1);
  });

  it('reporte lejos de cualquier calle queda con segmentId null', async () => {
    const app = makeApp();
    const res = await call(app, 'POST', '/v1/reports', {
      body: { location: { type: 'Point', coordinates: OFF_STREET }, waterLevel: 'puddle' },
    });
    expect(res.status).toBe(201);
    expect(res.json.segmentId).toBeNull();
  });

  it('C006-7: notes > 280, enums o tipos inválidos → 400', async () => {
    const app = makeApp();
    const loc = { type: 'Point', coordinates: ON_STREET };
    const bad = [
      { location: loc, waterLevel: 'knee', notes: 'x'.repeat(281) },
      { location: loc, waterLevel: 'deep' },
      { location: { type: 'Polygon', coordinates: ON_STREET }, waterLevel: 'knee' },
      { location: { type: 'Point', coordinates: [500, 20] }, waterLevel: 'knee' },
      { location: loc, waterLevel: 'knee', photoKey: '../../etc/passwd' },
    ];
    for (const body of bad) {
      const res = await call(app, 'POST', '/v1/reports', { body });
      expect(res.status).toBe(400);
      expect(res.json.error.code).toBe('INVALID_REQUEST');
    }
    const ok = await call(app, 'POST', '/v1/reports', { body: { location: loc, waterLevel: 'knee', notes: 'x'.repeat(280) } });
    expect(ok.status).toBe(201);
  });

  it('C006-7: photo-upload-url valida contentType y tamaño', async () => {
    const app = makeApp();
    const ok = await call(app, 'POST', '/v1/reports/photo-upload-url', { body: { contentType: 'image/jpeg', sizeBytes: 1843200 } });
    expect(ok.status).toBe(201);
    expect(contractErrors('PhotoUploadResponse', ok.json)).toEqual([]);
    expect(ok.json.expiresInSeconds).toBe(300);

    const bad = [
      { contentType: 'image/gif', sizeBytes: 100 },
      { contentType: 'image/png', sizeBytes: 0 },
      { contentType: 'image/png', sizeBytes: 5242881 },
      { contentType: 'image/png', sizeBytes: 1.5 },
      { contentType: 'image/png' },
    ];
    for (const body of bad) {
      const res = await call(app, 'POST', '/v1/reports/photo-upload-url', { body });
      expect(res.status).toBe(400);
    }

    const withPhoto = await call(app, 'POST', '/v1/reports', {
      body: { location: { type: 'Point', coordinates: ON_STREET }, waterLevel: 'ankle', photoKey: ok.json.photoKey },
    });
    expect(withPhoto.status).toBe(201);
    expect(withPhoto.json.photoUrl).toContain(ok.json.photoKey);
  });
});
