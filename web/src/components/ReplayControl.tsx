import { useEffect } from 'react';
import { REPLAY_STEPS, stepToAsOf } from '../lib/replay';

export interface ReplayControlProps {
  step: number;
  playing: boolean;
  onStep: (step: number) => void;
  onTogglePlay: () => void;
}

export function ReplayControl({ step, playing, onStep, onTogglePlay }: ReplayControlProps) {
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => onStep(step >= REPLAY_STEPS ? 0 : step + 1), 1500);
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
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="clock">
        <span className="eyebrow">Tormenta · 29 may 2026</span>
        <strong>{time}</strong>
        <span className="muted">
          hora Mérida · <code>{asOf}</code>
        </span>
      </div>
      <div className="track" style={{ ['--pct' as string]: `${pct}%` }}>
        <input
          type="range"
          min={0}
          max={REPLAY_STEPS}
          step={1}
          value={step}
          aria-label="Hora del replay"
          onChange={(e) => onStep(Number(e.target.value))}
        />
        <div className="ticks" aria-hidden="true">
          <span>09:00</span>
          <span>12:00</span>
          <span>15:00</span>
          <span>18:00</span>
        </div>
      </div>
    </section>
  );
}
