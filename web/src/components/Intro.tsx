import { useEffect, useState } from 'react';

/** Intro de entrada: titular que sube letra por letra, contador y cortina que revela el mapa. Clic para saltar. */
export function Intro({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const k = Math.min((t - start) / 2000, 1);
      setCount(Math.round(k * 100));
      if (k < 1) raf = requestAnimationFrame(loop);
      else setLeaving(true);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const id = setTimeout(onDone, 900);
    return () => clearTimeout(id);
  }, [leaving, onDone]);

  const word = (text: string, delay: number) =>
    text.split('').map((ch, i) => (
      <span key={i} style={{ animationDelay: `${delay + i * 55}ms` }}>
        {ch}
      </span>
    ));

  return (
    <div className={`intro${leaving ? ' leaving' : ''}`} onClick={() => setLeaving(true)} aria-hidden="true">
      <div className="intro-top">
        <span>Mérida, Yuc.</span>
        <span>20.97°N 89.62°W</span>
        <span>29.05.2026</span>
      </div>
      <h2 className="intro-title">
        <span className="line">{word('AGUA', 150)}</span>
        <span className="line outline">{word('RUTA', 420)}</span>
      </h2>
      <div className="intro-bottom">
        <p>Replay de la tormenta. Riesgo de inundación calle por calle. Rutas que lo evitan.</p>
        <span className="intro-count">{String(count).padStart(3, '0')}</span>
      </div>
      <div className="intro-rule" style={{ transform: `scaleX(${count / 100})` }} />
    </div>
  );
}
