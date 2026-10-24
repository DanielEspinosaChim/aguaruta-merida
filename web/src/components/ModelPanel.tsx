import { LivePanel } from './LivePanel';
/** Explica cómo decide AguaRuta: factores del riesgo (pesos de data/model.json), umbrales, reportes y ruta. */
const FACTORS = [
  { w: 35, name: 'Lluvia última hora', detail: 'mm acumulados en 1 h, normalizados contra la referencia del modelo' },
  { w: 20, name: 'Lluvia últimas 3 h', detail: 'suelo saturado: el agua ya no se infiltra al subsuelo kárstico' },
  { w: 20, name: 'Punto bajo', detail: 'elevación relativa negativa: ahí corre y se junta el agua' },
  { w: 15, name: 'Depresión del terreno', detail: 'la calle está dentro de una hondonada' },
  { w: 10, name: 'Historial', detail: 'veces que ese tramo se ha inundado antes' },
];

export function ModelPanel() {
  return (
    <>
    <LivePanel />
    <section className="panel model" aria-label="Cómo decide">
      <h2>Cómo decide AguaRuta</h2>

      <p className="model-lede">
        Cada tramo de calle recibe un <b>puntaje de 0 a 1</b> cada 15 minutos. Es una suma ponderada y transparente:
        no es una caja negra.
      </p>

      <ol className="factors">
        {FACTORS.map((f) => (
          <li key={f.name}>
            <span className="w" style={{ ['--w' as string]: `${f.w * 2.6}%` }}>
              {f.w}%
            </span>
            <div>
              <strong>{f.name}</strong>
              <span>{f.detail}</span>
            </div>
          </li>
        ))}
      </ol>

      <div className="thresholds">
        <span className="t lvl-low">B &lt; 0.33</span>
        <span className="t lvl-medium">M 0.33–0.66</span>
        <span className="t lvl-high">A ≥ 0.66</span>
      </div>

      <h2>Reportes ciudadanos</h2>
      <p className="model-lede">
        Cada reporte de la última hora suma <b>+0.10</b> al tramo más cercano (≤ 30 m), hasta +0.30. Un reporte{' '}
        <b>intransitable</b> lo pone en alto de inmediato. Ante la duda, no subestimamos el riesgo.
      </p>

      <h2>La ruta segura</h2>
      <p className="model-lede">
        Calculamos la ruta más corta sobre las calles reales (OpenStreetMap) y luego otra que <b>excluye</b> los tramos con
        el nivel que elegiste evitar. Mostramos ambas con el costo en metros y minutos. Si no existe alternativa, lo
        decimos.
      </p>
    </section>
    </>
  );
}
