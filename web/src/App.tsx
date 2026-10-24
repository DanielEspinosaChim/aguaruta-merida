import { useCallback, useEffect, useRef, useState } from 'react';
import { api as defaultApi } from './api/client';
import {
  ApiError,
  type AguaRutaApi,
  type FloodReport,
  type Position,
  type RainfallSeries,
  type RiskLevel,
  type RouteResult,
  type SegmentRiskCollection,
} from './api/types';
import { DashboardPanel, type TimelineMode } from './components/DashboardPanel';
import { Disclaimer } from './components/Disclaimer';
import { Intro } from './components/Intro';
import { MapView } from './components/MapView';
import { ModelPanel } from './components/ModelPanel';
import { RainOverlay } from './components/RainOverlay';
import { ReplayControl } from './components/ReplayControl';
import { ReportPanel } from './components/ReportPanel';
import { RouteInputs } from './components/RouteInputs';
import { RoutePanel } from './components/RoutePanel';
import { LEVEL_LABELS, REPLAY_START, REPLAY_STEP_MS, REPLAY_STEPS } from './lib/replay';
import { useTheme } from './lib/theme';
import { isValidBbox } from './lib/validation';

type PickMode = 'origin' | 'destination' | 'report' | null;

const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.body.error.message : 'Ocurrió un error inesperado. Intenta de nuevo.';

const BULLET: Record<RiskLevel, string> = { high: 'A', medium: 'M', low: 'B' };

/** Longitud de una línea en km (haversine). */
function lineKm(coords: Position[]): number {
  let m = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1]!;
    const [lon2, lat2] = coords[i]!;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    m += 2 * 6371000 * Math.asin(Math.sqrt(a));
  }
  return m / 1000;
}

/** Número que cuenta hasta su valor nuevo (tabular, sin saltos). */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const loop = (t: number) => {
      const k = Math.min((t - start) / 700, 1);
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3)));
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(loop);
      else from.current = value;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

export default function App({ api = defaultApi }: { api?: AguaRutaApi }) {
  const [step, setStep] = useState(Math.round(REPLAY_STEPS * (5 / 9))); // 20:00Z, pico del evento
  const [playing, setPlaying] = useState(false);
  const [bbox, setBbox] = useState<string | null>(null);
  const [segments, setSegments] = useState<SegmentRiskCollection | null>(null);
  const [reports, setReports] = useState<FloodReport[]>([]);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [picks, setPicks] = useState<{ origin?: Position; destination?: Position; report?: Position }>({});
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState<'dash' | 'route' | 'report' | 'model'>('dash');
  const [tlMode, setTlMode] = useState<TimelineMode>('event');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [storm, setStorm] = useState(0);
  const [rain, setRain] = useState<RainfallSeries | null>(null);
  const [theme, toggleTheme] = useTheme();
  const [introDone, setIntroDone] = useState(
    import.meta.env.MODE === 'test' || (typeof location !== 'undefined' && location.search.includes('nointro')),
  );

  // Rango de la línea de tiempo: evento del 29-may, en vivo (−3 h … +12 h) u otra fecha (día completo, hora Mérida).
  const liveStart = Math.floor(Date.now() / REPLAY_STEP_MS) * REPLAY_STEP_MS - 3 * 3600_000;
  const timeline =
    tlMode === 'event'
      ? { startMs: REPLAY_START, steps: REPLAY_STEPS, title: 'Línea 29·05 — tormenta real' }
      : tlMode === 'live'
        ? { startMs: liveStart, steps: 60, title: 'En vivo — pronóstico 12 h' }
        : { startMs: Date.parse(`${date}T06:00:00Z`), steps: 96, title: `Fecha ${date}` };
  const asOf = new Date(timeline.startMs + Math.min(step, timeline.steps) * REPLAY_STEP_MS).toISOString().replace('.000Z', 'Z');
  const rangeFrom = new Date(timeline.startMs).toISOString().replace('.000Z', 'Z');
  const rangeTo = new Date(timeline.startMs + timeline.steps * REPLAY_STEP_MS).toISOString().replace('.000Z', 'Z');

  const changeMode = useCallback((m: TimelineMode) => {
    setTlMode(m);
    setPlaying(false);
    setStep(m === 'event' ? Math.round(REPLAY_STEPS * (5 / 9)) : m === 'live' ? 12 : 48);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getRainfall({ from: rangeFrom, to: rangeTo })
      .then((r) => !cancelled && setRain(r))
      .catch(() => !cancelled && setRain(null));
    return () => {
      cancelled = true;
    };
  }, [api, rangeFrom, rangeTo]);

  useEffect(() => {
    if (!bbox || !isValidBbox(bbox)) return;
    let cancelled = false;
    api
      .listRiskSegments({ bbox, asOf, ...(storm > 0 ? { stormMmPerH: storm } : {}) })
      .then((fc) => {
        if (cancelled) return;
        setSegments(fc);
        setDisclaimer(fc.disclaimer);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, bbox, asOf, storm, refresh]);

  useEffect(() => {
    if (!bbox || !isValidBbox(bbox)) return;
    let cancelled = false;
    api
      .listReports({ bbox })
      .then((r) => !cancelled && setReports(r.items))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [api, bbox, refresh]);

  const onMapClick = useCallback(
    (p: Position) => {
      if (!pickMode) return;
      setPicks((prev) => ({ ...prev, [pickMode]: p }));
      setPickMode(null);
    },
    [pickMode],
  );

  const onStep = useCallback((s: number) => setStep(s), []);
  const onIntroDone = useCallback(() => setIntroDone(true), []);

  const counts: Record<RiskLevel, number> = { high: 0, medium: 0, low: 0 };
  const km: Record<RiskLevel, number> = { high: 0, medium: 0, low: 0 };
  for (const f of segments?.features ?? []) {
    counts[f.properties.level]++;
    km[f.properties.level] += lineKm(f.geometry.coordinates);
  }
  const totalKm = km.high + km.medium + km.low;
  const kmByDepth = { any: 0, medium: km.medium + km.high, high: km.high };
  const pctRisk = totalKm ? Math.round(((km.high + km.medium) / totalKm) * 100) : 0;
  const rainMm = segments?.features[0]?.properties.rainfall1hMm ?? 0;

  return (
    <div className={`app${introDone ? ' ready' : ''}${pickMode ? ' picking' : ''}`}>
      <MapView
        segments={segments}
        reports={reports}
        route={route}
        picks={picks}
        onBboxChange={setBbox}
        onMapClick={onMapClick}
        theme={theme}
        revealed={introDone}
      />
      <RainOverlay mmPerHour={rainMm} dark={theme === 'dark'} />
      <div className="vignette" aria-hidden="true" />

      <aside className="rail">
        <header className="masthead">
          <div className="mast-row">
            <span className="kicker">N.º 01 — Mérida, Yucatán</span>
            <button
              type="button"
              className="theme-toggle"
              onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              <span className="knob" />
            </button>
          </div>
          <h1>
            <span>Agua</span>
            <span className="outline">Ruta</span>
          </h1>
          <p className="lede">El riesgo de inundación, calle por calle, y la ruta que lo esquiva.</p>
        </header>

        <section className="lines" aria-label="Leyenda">
          {(['high', 'medium', 'low'] as const).map((l) => (
            <div key={l} className={`line-item lvl-${l}`}>
              <span className="bullet">{BULLET[l]}</span>
              <strong>
                <CountUp value={counts[l]} />
              </strong>
              <span className="line-label">
                Riesgo estimado {LEVEL_LABELS[l].toLowerCase()}
                <b>{km[l].toFixed(1)} km</b>
              </span>
            </div>
          ))}
        </section>

        <section className="impact" aria-label="Impacto">
          <strong>
            <CountUp value={pctRisk} />%
          </strong>
          <span>
            de las calles visibles con riesgo medio o alto · {(km.high + km.medium).toFixed(0)} de {totalKm.toFixed(0)} km
          </span>
        </section>

        <div className={`tabs tab-${tab}`} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'dash'} onClick={() => setTab('dash')}>
            <em>01</em> Panel
          </button>
          <button type="button" role="tab" aria-selected={tab === 'route'} onClick={() => setTab('route')}>
            <em>02</em> Ruta
          </button>
          <button type="button" role="tab" aria-selected={tab === 'report'} onClick={() => setTab('report')}>
            <em>03</em> Reporte
          </button>
          <button type="button" role="tab" aria-selected={tab === 'model'} onClick={() => setTab('model')}>
            <em>04</em> Modelo
          </button>
          <span className="tab-ink" aria-hidden="true" />
        </div>

        <div className="stage">
          {pickMode && <p className="notice">Toca el mapa para elegir la ubicación</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="pane" hidden={tab !== 'route'}>
            <RouteInputs
              onOrigin={(p) => setPicks((prev) => ({ ...prev, origin: p }))}
              onDestination={(p) => setPicks((prev) => ({ ...prev, destination: p }))}
            />
            <RoutePanel
              api={api}
              origin={picks.origin}
              destination={picks.destination}
              asOf={asOf}
              picking={pickMode === 'origin' || pickMode === 'destination' ? pickMode : null}
              onPick={setPickMode}
              onResult={setRoute}
              result={route}
              stormMmPerH={storm}
            />
          </div>
          <div className="pane" hidden={tab !== 'dash'}>
            <DashboardPanel
              segments={segments}
              rain={rain}
              asOf={asOf}
              mode={tlMode}
              date={date}
              onMode={changeMode}
              onDate={setDate}
              storm={storm}
              onStorm={setStorm}
              kmByDepth={kmByDepth}
              reports={reports}
            />
          </div>
          <div className="pane" hidden={tab !== 'model'}>
            <ModelPanel />
          </div>
          <div className="pane" hidden={tab !== 'report'}>
            <ReportPanel
              api={api}
              location={picks.report}
              picking={pickMode === 'report'}
              onPick={() => setPickMode('report')}
              onCreated={(r) => {
                setReports((prev) => [r, ...prev]);
                setRefresh((n) => n + 1);
              }}
            />
          </div>
        </div>

        <Disclaimer text={route?.disclaimer ?? disclaimer} />
      </aside>

      <ReplayControl
        step={step}
        playing={playing}
        onStep={onStep}
        onTogglePlay={() => setPlaying((p) => !p)}
        rainMm={rainMm}
        startMs={timeline.startMs}
        steps={timeline.steps}
        title={timeline.title + (storm > 0 ? ` · +${storm} mm/h` : '')}
      />

      {!introDone && <Intro onDone={onIntroDone} />}
    </div>
  );
}
