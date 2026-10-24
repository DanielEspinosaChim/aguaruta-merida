import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Disclaimer, FALLBACK_DISCLAIMER } from './Disclaimer';
import { RoutePanel } from './RoutePanel';
import { ReportPanel } from './ReportPanel';
import { ApiError, type RouteResult } from '../api/types';
import { LEVEL_COLORS, levelColorExpression, stepToAsOf, REPLAY_STEPS } from '../lib/replay';

const ROUTE: RouteResult = {
  computedAt: '2026-05-29T20:00:00Z',
  baseline: {
    distanceM: 11800,
    durationS: 1140,
    riskySegmentCount: 4,
    geometry: { type: 'LineString', coordinates: [[-89.59, 20.96], [-89.69, 21.01]] },
  },
  safer: {
    distanceM: 13250,
    durationS: 1380,
    avoidedSegmentIds: ['seg_a', 'seg_b'],
    residualRiskLevel: 'medium',
    geometry: { type: 'LineString', coordinates: [[-89.59, 20.96], [-89.61, 20.98], [-89.69, 21.01]] },
  },
  disclaimer: 'Riesgo estimado, no garantía.',
};

describe('C002-1: color por nivel', () => {
  it('la expresión de la capa asigna verde/ámbar/rojo por level', () => {
    expect(levelColorExpression).toEqual([
      'match', ['get', 'level'],
      'low', LEVEL_COLORS.low, 'medium', LEVEL_COLORS.medium, 'high', LEVEL_COLORS.high,
      '#888888',
    ]);
  });
});

describe('replay', () => {
  it('pasos de 15 min de 15:00Z a 00:00Z', () => {
    expect(stepToAsOf(0)).toBe('2026-05-29T15:00:00Z');
    expect(stepToAsOf(1)).toBe('2026-05-29T15:15:00Z');
    expect(stepToAsOf(REPLAY_STEPS)).toBe('2026-05-30T00:00:00Z');
    expect(stepToAsOf(REPLAY_STEPS + 5)).toBe('2026-05-30T00:00:00Z');
  });
});

describe('C002-6: disclaimer', () => {
  it('muestra el texto recibido', () => {
    render(<Disclaimer text="Riesgo estimado, no garantía. Evita las calles marcadas." />);
    expect(screen.getByRole('note')).toHaveTextContent('Evita las calles marcadas');
  });
  it('sin texto usa el de respaldo', () => {
    render(<Disclaimer text={null} />);
    expect(screen.getByRole('note')).toHaveTextContent(FALLBACK_DISCLAIMER);
  });
});

describe('RoutePanel', () => {
  const base = {
    origin: [-89.59, 20.96] as [number, number],
    destination: [-89.69, 21.01] as [number, number],
    asOf: '2026-05-29T20:00:00Z',
    picking: null,
    onPick: () => {},
  };

  it('C002-3: manda la solicitud y muestra métricas de ambas rutas', async () => {
    const calculateRoute = vi.fn().mockResolvedValue(ROUTE);
    const onResult = vi.fn();
    const { rerender } = render(<RoutePanel {...base} api={{ calculateRoute }} onResult={onResult} result={null} />);
    fireEvent.click(screen.getByText('Calcular ruta'));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(ROUTE));
    expect(calculateRoute).toHaveBeenCalledWith({
      origin: base.origin,
      destination: base.destination,
      mode: 'car',
      avoidLevel: 'high',
      asOf: base.asOf,
    });
    rerender(<RoutePanel {...base} api={{ calculateRoute }} onResult={onResult} result={ROUTE} />);
    const table = screen.getByRole('table', { name: 'Comparación de rutas' });
    expect(table).toHaveTextContent('11.8 km');
    expect(table).toHaveTextContent('13.3 km');
    expect(table).toHaveTextContent('2 evitados');
    expect(table).toHaveTextContent('Medio');
  });

  it('C002-4: 404 ROUTE_NOT_FOUND muestra error.message', async () => {
    const err = new ApiError(404, {
      error: { code: 'ROUTE_NOT_FOUND', message: 'No se encontró una ruta que evite los tramos de riesgo alto.', requestId: 'r' },
    });
    const onResult = vi.fn();
    render(<RoutePanel {...base} api={{ calculateRoute: vi.fn().mockRejectedValue(err) }} onResult={onResult} result={null} />);
    fireEvent.click(screen.getByText('Calcular ruta'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se encontró una ruta que evite');
    expect(onResult).toHaveBeenCalledWith(null);
  });
});

describe('ReportPanel', () => {
  const api = () => ({
    createPhotoUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: 'https://s3.test/put',
      photoKey: 'reports-photos/x/y.jpg',
      method: 'PUT',
      expiresInSeconds: 300,
    }),
    createReport: vi.fn().mockResolvedValue({
      reportId: 'r1',
      location: { type: 'Point', coordinates: [-89.62, 20.97] },
      waterLevel: 'ankle',
      createdAt: '2026-05-29T20:00:00Z',
    }),
  });
  const setFile = (file: File) => fireEvent.change(screen.getByLabelText('Foto'), { target: { files: [file] } });

  it('C002-5: foto con tipo no permitido se rechaza sin llamar a la API', async () => {
    const a = api();
    render(<ReportPanel api={a} location={[-89.62, 20.97]} picking={false} onPick={() => {}} onCreated={() => {}} />);
    setFile(new File(['x'], 'a.gif', { type: 'image/gif' }));
    fireEvent.click(screen.getByText('Enviar reporte'));
    expect(await screen.findByRole('alert')).toHaveTextContent('JPEG o PNG');
    expect(a.createPhotoUploadUrl).not.toHaveBeenCalled();
    expect(a.createReport).not.toHaveBeenCalled();
  });

  it('C002-5: foto > 5 MB se rechaza', async () => {
    const a = api();
    render(<ReportPanel api={a} location={[-89.62, 20.97]} picking={false} onPick={() => {}} onCreated={() => {}} />);
    const big = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    Object.defineProperty(big, 'size', { value: 5_242_881 });
    setFile(big);
    fireEvent.click(screen.getByText('Enviar reporte'));
    expect(await screen.findByRole('alert')).toHaveTextContent('5 MB');
    expect(a.createReport).not.toHaveBeenCalled();
  });

  it('C002-5: notas > 280 se rechazan', async () => {
    const a = api();
    render(<ReportPanel api={a} location={[-89.62, 20.97]} picking={false} onPick={() => {}} onCreated={() => {}} />);
    fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'a'.repeat(281) } });
    fireEvent.click(screen.getByText('Enviar reporte'));
    expect(await screen.findByRole('alert')).toHaveTextContent('280');
    expect(a.createReport).not.toHaveBeenCalled();
  });

  it('sin ubicación pide tocar el mapa', async () => {
    const a = api();
    render(<ReportPanel api={a} picking={false} onPick={() => {}} onCreated={() => {}} />);
    fireEvent.click(screen.getByText('Enviar reporte'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Toca el mapa');
  });

  it('si falla el PUT de la foto, envía el reporte sin photoKey y avisa', async () => {
    const a = api();
    const onCreated = vi.fn();
    render(
      <ReportPanel
        api={a}
        location={[-89.62, 20.97]}
        picking={false}
        onPick={() => {}}
        onCreated={onCreated}
        putFile={vi.fn().mockResolvedValue(false)}
      />,
    );
    setFile(new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    fireEvent.click(screen.getByText('Enviar reporte'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(a.createPhotoUploadUrl).toHaveBeenCalledWith({ contentType: 'image/jpeg', sizeBytes: 1 });
    expect(a.createReport.mock.calls[0][0].photoKey).toBeNull();
    expect(screen.getByText(/sin foto/)).toBeTruthy();
  });

  it('con PUT exitoso manda el photoKey', async () => {
    const a = api();
    render(
      <ReportPanel
        api={a}
        location={[-89.62, 20.97]}
        picking={false}
        onPick={() => {}}
        onCreated={() => {}}
        putFile={vi.fn().mockResolvedValue(true)}
      />,
    );
    setFile(new File(['x'], 'a.png', { type: 'image/png' }));
    fireEvent.click(screen.getByText('Enviar reporte'));
    await waitFor(() => expect(a.createReport).toHaveBeenCalled());
    expect(a.createReport.mock.calls[0][0].photoKey).toBe('reports-photos/x/y.jpg');
    expect(a.createReport.mock.calls[0][0].location).toEqual({ type: 'Point', coordinates: [-89.62, 20.97] });
  });
});
