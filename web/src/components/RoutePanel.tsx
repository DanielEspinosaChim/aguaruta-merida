import { useState } from 'react';
import { ApiError, type AguaRutaApi, type Position, type RouteResult, type TravelMode } from '../api/types';
import { LEVEL_LABELS, formatDistance, formatDuration } from '../lib/replay';

export type PickMode = 'origin' | 'destination' | null;

export interface RoutePanelProps {
  api: Pick<AguaRutaApi, 'calculateRoute'>;
  origin?: Position;
  destination?: Position;
  asOf: string;
  picking: PickMode;
  onPick: (mode: PickMode) => void;
  onResult: (r: RouteResult | null) => void;
  result: RouteResult | null;
}

const fmt = (p?: Position) => (p ? `${p[0].toFixed(4)}, ${p[1].toFixed(4)}` : '—');

export function RoutePanel({ api, origin, destination, asOf, picking, onPick, onResult, result }: RoutePanelProps) {
  const [mode, setMode] = useState<TravelMode>('car');
  const [avoidLevel, setAvoidLevel] = useState<'medium' | 'high'>('high');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function calculate() {
    if (!origin || !destination) return;
    setLoading(true);
    setError(null);
    try {
      onResult(await api.calculateRoute({ origin, destination, mode, avoidLevel, asOf }));
    } catch (e) {
      onResult(null);
      setError(e instanceof ApiError ? e.body.error.message : 'Ocurrió un error inesperado. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <h2>Ruta que evita riesgo</h2>
      <div className="row">
        <button type="button" className={picking === 'origin' ? 'active' : ''} onClick={() => onPick('origin')}>
          Elegir origen
        </button>
        <span className="muted">{fmt(origin)}</span>
      </div>
      <div className="row">
        <button
          type="button"
          className={picking === 'destination' ? 'active' : ''}
          onClick={() => onPick('destination')}
        >
          Elegir destino
        </button>
        <span className="muted">{fmt(destination)}</span>
      </div>
      <div className="row">
        <label>
          Modo{' '}
          <select value={mode} onChange={(e) => setMode(e.target.value as TravelMode)}>
            <option value="car">Auto</option>
            <option value="walk">A pie</option>
          </select>
        </label>
        <label>
          Evitar desde{' '}
          <select value={avoidLevel} onChange={(e) => setAvoidLevel(e.target.value as 'medium' | 'high')}>
            <option value="high">Riesgo alto</option>
            <option value="medium">Riesgo medio</option>
          </select>
        </label>
      </div>
      <button type="button" disabled={!origin || !destination || loading} onClick={calculate}>
        {loading ? 'Calculando…' : 'Calcular ruta'}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <table className="metrics" aria-label="Comparación de rutas">
          <thead>
            <tr>
              <th />
              <th>Base</th>
              <th>Alternativa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Distancia</td>
              <td>{formatDistance(result.baseline.distanceM)}</td>
              <td>{formatDistance(result.safer.distanceM)}</td>
            </tr>
            <tr>
              <td>Tiempo</td>
              <td>{formatDuration(result.baseline.durationS)}</td>
              <td>{formatDuration(result.safer.durationS)}</td>
            </tr>
            <tr>
              <td>Tramos de riesgo</td>
              <td>{result.baseline.riskySegmentCount}</td>
              <td>{result.safer.avoidedSegmentIds.length} evitados</td>
            </tr>
            <tr>
              <td>Riesgo residual estimado</td>
              <td />
              <td>{LEVEL_LABELS[result.safer.residualRiskLevel]}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
