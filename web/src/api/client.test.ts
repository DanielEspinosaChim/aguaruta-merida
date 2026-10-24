import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_API_BASE_URL, createApiClient } from './client';
import { ApiError } from './types';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('cliente API', () => {
  it('C002-7: usa solo la base URL configurada y serializa params', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(200, { type: 'FeatureCollection', computedAt: 'x', disclaimer: 'd', features: [] }),
    );
    const api = createApiClient('https://api.test/v1/', fetchMock);
    await api.listRiskSegments({ bbox: '-89.64,20.95,-89.60,20.99', asOf: '2026-05-29T20:00:00Z' });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://api.test/v1/risk/segments');
    expect(url.searchParams.get('bbox')).toBe('-89.64,20.95,-89.60,20.99');
    expect(url.searchParams.get('asOf')).toBe('2026-05-29T20:00:00Z');
    expect(url.searchParams.has('minLevel')).toBe(false);
  });

  it('C002-7: base por defecto es el mock local', () => {
    expect(DEFAULT_API_BASE_URL).toBe('http://127.0.0.1:4010/v1');
  });

  it('POST manda JSON y regresa el cuerpo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(201, { reportId: 'r1' }));
    const api = createApiClient('https://api.test/v1', fetchMock);
    const r = await api.createReport({ location: { type: 'Point', coordinates: [-89.62, 20.97] }, waterLevel: 'knee' });
    expect(r.reportId).toBe('r1');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('400 lanza ApiError con el ErrorResponse', async () => {
    const body = { error: { code: 'INVALID_REQUEST', message: 'bbox inválido', requestId: 'req_1' } };
    const api = createApiClient('https://api.test/v1', vi.fn().mockResolvedValue(json(400, body)));
    await expect(api.listReports({ bbox: 'x' })).rejects.toMatchObject({ status: 400, body });
  });

  it('C002-4: 404 ROUTE_NOT_FOUND conserva error.message', async () => {
    const body = { error: { code: 'ROUTE_NOT_FOUND', message: 'No se encontró una ruta.', requestId: 'req_2' } };
    const api = createApiClient('https://api.test/v1', vi.fn().mockResolvedValue(json(404, body)));
    const err = await api.calculateRoute({ origin: [0, 0], destination: [1, 1] }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('No se encontró una ruta.');
    expect(err.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('500 sin JSON se convierte en INTERNAL_ERROR', async () => {
    const api = createApiClient('https://api.test/v1', vi.fn().mockResolvedValue(new Response('<html>', { status: 502 })));
    const err = await api.listReports({ bbox: '1,1,2,2' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('fallo de red se convierte en ApiError', async () => {
    const api = createApiClient('https://api.test/v1', vi.fn().mockRejectedValue(new TypeError('fail')));
    await expect(api.listReports({ bbox: '1,1,2,2' })).rejects.toBeInstanceOf(ApiError);
  });
});
