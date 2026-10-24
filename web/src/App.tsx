import { useCallback, useEffect, useState } from 'react';
import { api as defaultApi } from './api/client';
import {
  ApiError,
  type AguaRutaApi,
  type FloodReport,
  type Position,
  type RouteResult,
  type SegmentRiskCollection,
} from './api/types';
import { Disclaimer } from './components/Disclaimer';
import { MapView } from './components/MapView';
import { ReplayControl } from './components/ReplayControl';
import { ReportPanel } from './components/ReportPanel';
import { RoutePanel } from './components/RoutePanel';
import { LEVEL_COLORS, LEVEL_LABELS, REPLAY_STEPS, stepToAsOf } from './lib/replay';
import { isValidBbox } from './lib/validation';

type PickMode = 'origin' | 'destination' | 'report' | null;

const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.body.error.message : 'Ocurrió un error inesperado. Intenta de nuevo.';

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

  return (
    <div className="app">
      <header className="header">
        <h1>AguaRuta Mérida</h1>
        <Disclaimer text={route?.disclaimer ?? disclaimer} />
      </header>
      <main className="layout">
        <MapView
          segments={segments}
          reports={reports}
          route={route}
          picks={picks}
          onBboxChange={setBbox}
          onMapClick={onMapClick}
        />
        <aside className="sidebar">
          {pickMode && <p className="notice">Toca el mapa para elegir la ubicación.</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <ReplayControl step={step} playing={playing} onStep={onStep} onTogglePlay={() => setPlaying((p) => !p)} />
          <section className="panel legend" aria-label="Leyenda">
            {(['low', 'medium', 'high'] as const).map((l) => (
              <span key={l}>
                <i style={{ background: LEVEL_COLORS[l] }} /> Riesgo estimado {LEVEL_LABELS[l].toLowerCase()}
              </span>
            ))}
          </section>
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
        </aside>
      </main>
    </div>
  );
}
