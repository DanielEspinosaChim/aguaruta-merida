import { useEffect, useState } from 'react';

/**
 * Pronóstico EN VIVO para Mérida (Open-Meteo, sin clave): lluvia por hora de hoy y las próximas 12 h,
 * con el riesgo proyectado para un tramo en punto bajo usando los mismos pesos/refs de data/model.json.
 */
const W = { rain1h: 0.35, rain3h: 0.2, lowPoint: 0.2, depression: 0.15 };
const REF = { rain1h: 80, rain3h: 150 };
const URL =
  'https://api.open-meteo.com/v1/forecast?latitude=20.97&longitude=-89.62&hourly=precipitation,precipitation_probability&timezone=America%2FMerida&forecast_hours=12&past_hours=3';

interface Hour { t: string; mm: number; prob: number; risk: number }

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const level = (s: number) => (s < 0.33 ? 'low' : s < 0.66 ? 'medium' : 'high');

export function LivePanel() {
  const [hours, setHours] = useState<Hour[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(URL)
      .then((r) => r.json())
      .then((d) => {
        const mm: number[] = d.hourly.precipitation;
        const out = d.hourly.time.map((t: string, i: number) => {
          const acc3 = mm.slice(Math.max(0, i - 2), i + 1).reduce((a, b) => a + b, 0);
          // Tramo en depresión con punto bajo de -1 m (peor caso típico del Centro).
          const risk = clamp(
            W.rain1h * clamp(mm[i]! / REF.rain1h) + W.rain3h * clamp(acc3 / REF.rain3h) + W.lowPoint * (1 / 1.5) + W.depression,
          );
          return { t: t.slice(11, 16), mm: mm[i]!, prob: d.hourly.precipitation_probability[i] ?? 0, risk };
        });
        setHours(out.slice(3));
      })
      .catch(() => setFailed(true));
  }, []);

  const max = hours ? Math.max(...hours.map((h) => h.mm), 1) : 1;
  const total = hours?.reduce((a, h) => a + h.mm, 0) ?? 0;

  return (
    <section className="panel live" aria-label="Pronóstico en vivo">
      <h2>
        <i className="dot" /> En vivo · Mérida hoy
      </h2>
      {failed && <p className="muted">Sin conexión al pronóstico. Usa el replay del 29-may.</p>}
      {!hours && !failed && <p className="muted">Consultando pronóstico…</p>}
      {hours && (
        <>
          <p className="model-lede">
            {total < 0.5 ? (
              <>Sin lluvia significativa en las próximas 12 h: <b>riesgo base</b> en toda la ciudad.</>
            ) : (
              <>Se esperan <b>{total.toFixed(1)} mm</b> en 12 h. Riesgo proyectado en puntos bajos abajo.</>
            )}
          </p>
          <div className="bars">
            {hours.map((h) => (
              <div key={h.t} className={`bar lvl-${level(h.risk)}`} title={`${h.t} · ${h.mm} mm · ${h.prob}%`}>
                <i style={{ height: `${Math.max(4, (h.mm / max) * 100)}%` }} />
                <span>{h.t.slice(0, 2)}</span>
              </div>
            ))}
          </div>
          <p className="muted">Fuente: Open-Meteo (modelos GFS/ICON), actualizado cada hora.</p>
        </>
      )}

      <h2>Siguiente fase · modelo predictivo</h2>
      <ul className="roadmap">
        <li><b>Satélite:</b> lluvia observada NASA GPM IMERG cada 30 min.</li>
        <li><b>Terreno:</b> modelo de elevación INEGI (CEM) para puntos bajos reales.</li>
        <li><b>ML:</b> modelo de gradiente (XGBoost) entrenado con inundaciones históricas de Protección Civil; los reportes solo validan, nunca deciden solos.</li>
        <li><b>Vehículo:</b> umbral de agua por tipo (compacto, SUV, moto, a pie) para elegir qué evitar.</li>
      </ul>
    </section>
  );
}
