import type { RainfallSeries, SegmentRiskCollection } from '../api/types';

export type TimelineMode = 'event' | 'live' | 'date';

export interface DashboardPanelProps {
  segments: SegmentRiskCollection | null;
  rain: RainfallSeries | null;
  asOf: string;
  mode: TimelineMode;
  date: string;
  onMode: (m: TimelineMode) => void;
  onDate: (d: string) => void;
  storm: number;
  onStorm: (mm: number) => void;
  kmByDepth: { any: number; medium: number; high: number };
}

const STORMS = [0, 20, 40, 60, 90];

/** Tablero: escenario, KPIs del modelo hidrológico, hidrograma y calles más afectadas. */
export function DashboardPanel(p: DashboardPanelProps) {
  const feats = p.segments?.features ?? [];
  const wet = feats.filter((f) => (f.properties.waterDepthCm ?? 0) > 0);
  const maxDepth = wet.reduce((m, f) => Math.max(m, f.properties.waterDepthCm ?? 0), 0);
  const byStreet = new Map<string, number>();
  for (const f of wet) {
    const name = f.properties.name ?? 'Sin nombre';
    byStreet.set(name, Math.max(byStreet.get(name) ?? 0, f.properties.waterDepthCm ?? 0));
  }
  const top = [...byStreet].filter(([n]) => n !== 'Sin nombre').sort((a, b) => b[1] - a[1]).slice(0, 6);
  const series = p.rain?.series ?? [];
  const maxMm = Math.max(1, ...series.map((s) => s.mm));
  const total = series.reduce((a, s) => a + s.mm, 0);
  const cursor = series.findIndex((s) => s.t >= p.asOf);

  return (
    <section className="panel dash" aria-label="Panel del modelo">
      <h2>Escenario</h2>
      <div className="seg-control" role="radiogroup" aria-label="Fecha">
        <button type="button" className={p.mode === 'event' ? 'active' : ''} onClick={() => p.onMode('event')}>
          29 may 2026
        </button>
        <button type="button" className={p.mode === 'live' ? 'active' : ''} onClick={() => p.onMode('live')}>
          <i className="live-dot" /> Ahora
        </button>
        <input
          type="date"
          aria-label="Otra fecha"
          value={p.mode === 'date' ? p.date : ''}
          max={new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)}
          min="2022-01-01"
          onChange={(e) => e.target.value && (p.onDate(e.target.value), p.onMode('date'))}
        />
      </div>

      <label className="storm-label">
        ¿Y si lloviera? Tormenta de diseño: <b>{p.storm} mm/h</b>
      </label>
      <div className="storm-chips">
        {STORMS.map((s) => (
          <button key={s} type="button" className={p.storm === s ? 'active' : ''} onClick={() => p.onStorm(s)}>
            {s === 0 ? 'Real' : `+${s}`}
          </button>
        ))}
      </div>

      <div className="kpis">
        <div>
          <strong>{maxDepth}</strong>
          <span>cm máx. en calle</span>
        </div>
        <div>
          <strong>{wet.length}</strong>
          <span>tramos con agua</span>
        </div>
        <div>
          <strong>{p.kmByDepth.medium.toFixed(1)}</strong>
          <span>km ≥ 10 cm</span>
        </div>
        <div>
          <strong>{p.kmByDepth.high.toFixed(1)}</strong>
          <span>km ≥ 20 cm</span>
        </div>
      </div>

      <h2>
        Lluvia real · {total.toFixed(1)} mm <span className="muted">({p.rain?.source ?? '…'})</span>
      </h2>
      <div className="hydro" aria-label="Hidrograma">
        {series.map((s, i) => (
          <i
            key={s.t}
            className={i === cursor ? 'now' : i > cursor && cursor >= 0 ? 'future' : ''}
            style={{ height: `${Math.max(2, (s.mm / maxMm) * 100)}%` }}
            title={`${s.t} · ${s.mm} mm`}
          />
        ))}
        {series.length === 0 && <span className="muted">Sin datos de lluvia para este rango.</span>}
      </div>

      <h2>Calles más afectadas</h2>
      {top.length === 0 ? (
        <p className="model-lede">
          El modelo no predice acumulación de agua con esta lluvia. Prueba una tormenta de diseño para ver qué calles se
          inundarían.
        </p>
      ) : (
        <ol className="top-streets">
          {top.map(([name, cm]) => (
            <li key={name}>
              <span>{name}</span>
              <b className={cm >= 20 ? 'lvl-high' : cm >= 10 ? 'lvl-medium' : 'lvl-low'}>{cm >= 100 ? '≥ 100' : cm} cm</b>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
