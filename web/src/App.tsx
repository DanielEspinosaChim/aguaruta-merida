import { useCallback, useEffect, useRef, useState } from 'react';
import { api as defaultApi } from './api/client';
import {
  ApiError,
  type AguaRutaApi,
  type FloodReport,
  type Position,
  type RiskLevel,
  type RouteResult,
  type SegmentRiskCollection,
} from './api/types';
import { Disclaimer } from './components/Disclaimer';
import { Intro } from './components/Intro';
import { MapView } from './components/MapView';
import { RainOverlay } from './components/RainOverlay';
import { ReplayControl } from './components/ReplayControl';
import { ReportPanel } from './components/ReportPanel';
import { RoutePanel } from './components/RoutePanel';
import { LEVEL_LABELS, REPLAY_STEPS, stepToAsOf } from './lib/replay';
import { useTheme } from './lib/theme';
import { isValidBbox } from './lib/validation';

type PickMode = 'origin' | 'destination' | 'report' | null;

const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.body.error.message : 'Ocurrió un error inesperado. Intenta de nuevo.';

const BULLET: Record<RiskLevel, string> = { high: 'A', medium: 'M', low: 'B' };

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
  const [tab, setTab] = useState<'route' | 'report'>('route');
  const [theme, toggleTheme] = useTheme();
  const [introDone, setIntroDone] = useState(
    import.meta.env.MODE === 'test' || (typeof location !== 'undefined' && location.search.includes('nointro')),
  );

  const asOf = stepToAsOf(step);

  useEffect(() => {
    if (!bbox || !isValidBbox(bbox)) return;
    let cancelled = false;
    api
      .listRiskSegments({ bbox, asOf })
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
  }, [api, bbox, asOf, refresh]);

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
  for (const f of segments?.features ?? []) counts[f.properties.level]++;
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
              <span className="line-label">Riesgo estimado {LEVEL_LABELS[l].toLowerCase()}</span>
            </div>
          ))}
        </section>

        <div className={`tabs tab-${tab}`} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'route'} onClick={() => setTab('route')}>
            <em>02</em> Ruta segura
          </button>
          <button type="button" role="tab" aria-selected={tab === 'report'} onClick={() => setTab('report')}>
            <em>03</em> Reportar
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
            <RoutePanel
              api={api}
              origin={picks.origin}
              destination={picks.destination}
              asOf={asOf}
              picking={pickMode === 'origin' || pickMode === 'destination' ? pickMode : null}
              onPick={setPickMode}
              onResult={setRoute}
              result={route}
            />
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
      />

      {!introDone && <Intro onDone={onIntroDone} />}
    </div>
  );
}
