import { useEffect } from 'react';
import { REPLAY_STEPS, stepToAsOf } from '../lib/replay';

export interface ReplayControlProps {
  step: number;
  playing: boolean;
  onStep: (step: number) => void;
  onTogglePlay: () => void;
  /** Lluvia 1 h del snapshot actual, para el indicador. */
  rainMm?: number;
}

const HOURS = Array.from({ length: 10 }, (_, i) => i); // 09:00 … 18:00 hora Mérida

/** Línea de tiempo como línea de metro: estaciones por hora y un "tren" que avanza cada 15 min. */
export function ReplayControl({ step, playing, onStep, onTogglePlay, rainMm = 0 }: ReplayControlProps) {
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => onStep(step >= REPLAY_STEPS ? 0 : step + 1), 900);
    return () => clearInterval(id);
  }, [playing, step, onStep]);

  const asOf = stepToAsOf(step);
  const time = new Date(asOf).toLocaleTimeString('es-MX', {
    timeZone: 'America/Merida',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const pct = (step / REPLAY_STEPS) * 100;

  return (
    <section className="replay" aria-label="Replay de la tormenta">
      <button type="button" className="play" onClick={onTogglePlay} aria-label={playing ? 'Pausar' : 'Reproducir'}>
        <span className={playing ? 'icon-pause' : 'icon-play'} />
      </button>

      <div className="clock">
        <span className="kicker">Línea 29·05 — tormenta</span>
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
        {HOURS.map((hIdx) => {
          const at = (hIdx * 4) / REPLAY_STEPS;
          return (
            <div key={hIdx} className={`station${step >= hIdx * 4 ? ' passed' : ''}`} style={{ left: `${at * 100}%` }}>
              <i />
              <span>{String(9 + hIdx).padStart(2, '0')}</span>
            </div>
          );
        })}
        <div className="train" style={{ left: `${pct}%` }}>
          <span>{time}</span>
        </div>
        <input
          type="range"
          min={0}
          max={REPLAY_STEPS}
          step={1}
          value={step}
          aria-label="Hora del replay"
          onChange={(e) => onStep(Number(e.target.value))}
        />
      </div>
    </section>
  );
}
