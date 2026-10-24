import { useEffect, useRef } from 'react';

/** Lluvia en canvas: densidad y velocidad según la lluvia acumulada en 1 h del snapshot (0–50 mm). */
export function RainOverlay({ mmPerHour, dark }: { mmPerHour: number; dark: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const target = useRef(mmPerHour);
  target.current = mmPerHour;
  const darkRef = useRef(dark);
  darkRef.current = dark;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const drops = Array.from({ length: 700 }, () => ({ x: Math.random(), y: Math.random(), z: 0.4 + Math.random() * 0.6 }));
    let level = 0;
    let raf = 0;
    const loop = () => {
      level += (Math.min(target.current / 45, 1.2) - level) * 0.04;
      ctx.clearRect(0, 0, w, h);
      const n = Math.floor(drops.length * Math.min(level, 1));
      ctx.strokeStyle = darkRef.current ? 'rgba(150,200,255,0.35)' : 'rgba(30,70,110,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const d = drops[i]!;
        d.y += (0.006 + level * 0.012) * d.z;
        d.x -= 0.0015 * d.z;
        if (d.y > 1) {
          d.y = -0.05;
          d.x = Math.random() * 1.1;
        }
        if (d.x < -0.05) d.x = 1.05;
        const x = d.x * w;
        const y = d.y * h;
        const len = (10 + level * 22) * d.z;
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * 0.18, y + len);
      }
      ctx.stroke();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="rain" aria-hidden="true" />;
}
