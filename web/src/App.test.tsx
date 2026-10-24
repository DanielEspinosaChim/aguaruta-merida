import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AguaRutaApi } from './api/types';
import { stepToAsOf } from './lib/replay';

// MapLibre necesita WebGL; en jsdom lo sustituimos por un mapa falso que emite un bbox.
vi.mock('./components/MapView', () => ({
  MapView: ({ onBboxChange }: { onBboxChange: (b: string) => void }) => (
    <button type="button" onClick={() => onBboxChange('-89.6400,20.9500,-89.6000,20.9900')}>
      mapa-falso
    </button>
  ),
}));

import App from './App';

function fakeApi(): AguaRutaApi {
  return {
    listRiskSegments: vi.fn().mockResolvedValue({
      type: 'FeatureCollection',
      computedAt: '2026-05-29T20:00:00Z',
      disclaimer: 'Riesgo estimado, no garantía. Evita las calles marcadas en riesgo alto.',
      features: [],
    }),
    listReports: vi.fn().mockResolvedValue({ items: [] }),
    getRainfall: vi.fn().mockResolvedValue({ source: 'test', stepMinutes: 15, series: [] }),
    createReport: vi.fn(),
    createPhotoUploadUrl: vi.fn(),
    calculateRoute: vi.fn(),
  };
}

describe('App', () => {
  it('C002-6: el disclaimer es visible desde el inicio y se actualiza con la respuesta', async () => {
    const api = fakeApi();
    render(<App api={api} />);
    expect(screen.getByRole('note')).toHaveTextContent('Riesgo estimado, no garantía.');
    fireEvent.click(screen.getByText('mapa-falso'));
    await waitFor(() => expect(screen.getByRole('note')).toHaveTextContent('Evita las calles marcadas'));
  });

  it('C002-2: mover el slider pide /risk/segments con el asOf correspondiente', async () => {
    const api = fakeApi();
    render(<App api={api} />);
    fireEvent.click(screen.getByText('mapa-falso'));
    await waitFor(() => expect(api.listRiskSegments).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Hora del replay'), { target: { value: '4' } });
    await waitFor(() =>
      expect(api.listRiskSegments).toHaveBeenLastCalledWith({
        bbox: '-89.6400,20.9500,-89.6000,20.9900',
        asOf: stepToAsOf(4),
      }),
    );
    expect(stepToAsOf(4)).toBe('2026-05-29T16:00:00Z');
  });

  it('error de la API se muestra con error.message', async () => {
    const api = fakeApi();
    const { ApiError } = await import('./api/types');
    (api.listRiskSegments as ReturnType<typeof vi.fn>).mockRejectedValue(
      new ApiError(500, { error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.', requestId: 'r' } }),
    );
    render(<App api={api} />);
    fireEvent.click(screen.getByText('mapa-falso'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
  });
});
