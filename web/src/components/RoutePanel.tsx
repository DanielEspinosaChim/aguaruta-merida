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
  /** Tormenta de diseño activa (mm en 1 h). */
  stormMmPerH?: number;
}

/** Tolerancia de agua por vehículo → qué nivel evitar (bajo < 10 cm, medio 10–20 cm, alto ≥ 20 cm). */
export const VEHICLES = {
  suv: { label: 'SUV / camioneta', mode: 'car', avoidLevel: 'high', tolerance: 'hasta 20 cm' },
  compacto: { label: 'Auto compacto', mode: 'car', avoidLevel: 'medium', tolerance: 'hasta 10 cm' },
  moto: { label: 'Moto', mode: 'car', avoidLevel: 'medium', tolerance: 'hasta 10 cm' },
  pie: { label: 'A pie', mode: 'walk', avoidLevel: 'medium', tolerance: 'hasta 10 cm' },
} as const satisfies Record<string, { label: string; mode: TravelMode; avoidLevel: 'medium' | 'high'; tolerance: string }>;
type Vehicle = keyof typeof VEHICLES;

const fmt = (p?: Position) => (p ? `${p[0].toFixed(4)}, ${p[1].toFixed(4)}` : '—');

export function RoutePanel({ api, origin, destination, asOf, picking, onPick, onResult, result, stormMmPerH = 0 }: RoutePanelProps) {
  const [vehicle, setVehicle] = useState<Vehicle>('suv');
  const { mode, avoidLevel } = VEHICLES[vehicle];
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function calculate() {
    if (!origin || !destination) return;
    setLoading(true);
    setError(null);
    try {
      onResult(
        await api.calculateRoute({ origin, destination, mode, avoidLevel, asOf, ...(stormMmPerH > 0 ? { stormMmPerH } : {}) }),
      );
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
          Vehículo{' '}
          <select value={vehicle} onChange={(e) => setVehicle(e.target.value as Vehicle)}>
            {(Object.keys(VEHICLES) as Vehicle[]).map((v) => (
              <option key={v} value={v}>
                {VEHICLES[v].label}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">
          Tolera {VEHICLES[vehicle].tolerance} · evita riesgo {avoidLevel === 'high' ? 'alto' : 'medio o alto'}
        </span>
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
