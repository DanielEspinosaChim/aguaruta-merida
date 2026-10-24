import { useEffect } from 'react';
import { REPLAY_START, REPLAY_STEPS, REPLAY_STEP_MS } from '../lib/replay';

export interface ReplayControlProps {
  step: number;
  playing: boolean;
  onStep: (step: number) => void;
  onTogglePlay: () => void;
  /** Lluvia 1 h del snapshot actual, para el indicador. */
  rainMm?: number;
  /** Inicio del rango (ms) y número de pasos de 15 min. Por defecto, el evento del 29-may. */
  startMs?: number;
  steps?: number;
  title?: string;
}

const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z');
const merida = (ms: number) =>
  new Date(ms).toLocaleTimeString('es-MX', { timeZone: 'America/Merida', hour: '2-digit', minute: '2-digit', hour12: false });

/** Línea de tiempo como línea de metro: estaciones por hora y un "tren" que avanza cada 15 min. */
export function ReplayControl({
  step,
  playing,
  onStep,
  onTogglePlay,
  rainMm = 0,
  startMs = REPLAY_START,
  steps = REPLAY_STEPS,
  title = 'Línea 29·05 — tormenta',
}: ReplayControlProps) {
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => onStep(step >= steps ? 0 : step + 1), 900);
    return () => clearInterval(id);
  }, [playing, step, steps, onStep]);

  const atMs = startMs + Math.min(Math.max(step, 0), steps) * REPLAY_STEP_MS;
  const asOf = iso(atMs);
  const time = merida(atMs);
  const pct = (step / steps) * 100;
  const every = steps <= 40 ? 4 : steps <= 64 ? 8 : 16;
  const stations = Array.from({ length: Math.floor(steps / every) + 1 }, (_, i) => i * every);

  return (
    <section className="replay" aria-label="Replay de la tormenta">
      <button type="button" className="play" onClick={onTogglePlay} aria-label={playing ? 'Pausar' : 'Reproducir'}>
        <span className={playing ? 'icon-pause' : 'icon-play'} />
      </button>

      <div className="clock">
        <span className="kicker">{title}</span>
        <strong key={time} className="digits">
          {time}
        </strong>
        <span className="rain-read">
          <b>{rainMm.toFixed(1)}</b> mm/h · <code>{asOf}</code>
        </span>
      </div>

      <div className="subway" style={{ ['--pct' as string]: `${pct}%` }}>
        <div className="subway-rail" />
        <div className="subway-done" />
        {stations.map((s) => (
          <div key={s} className={`station${step >= s ? ' passed' : ''}`} style={{ left: `${(s / steps) * 100}%` }}>
            <i />
            <span>{merida(startMs + s * REPLAY_STEP_MS).slice(0, 2)}</span>
          </div>
        ))}
        <div className="train" style={{ left: `${pct}%` }}>
          <span>{time}</span>
        </div>
        <input
          type="range"
          min={0}
          max={steps}
          step={1}
          value={step}
          aria-label="Hora del replay"
          onChange={(e) => onStep(Number(e.target.value))}
        />
      </div>
    </section>
  );
}
