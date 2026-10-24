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
  const local = new Date(asOf).toLocaleString('es-MX', {
    timeZone: 'America/Merida',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <section className="panel replay">
      <h2>Replay tormenta 29-may-2026</h2>
      <div className="row">
        <button type="button" onClick={onTogglePlay} aria-label={playing ? 'Pausar' : 'Reproducir'}>
          {playing ? '⏸' : '▶'}
        </button>
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
      <div className="muted">
        {local} (Mérida) · <code>{asOf}</code>
      </div>
    </section>
  );
}
