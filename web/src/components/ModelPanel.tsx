/** Explica el modelo hidrológico v1: datos, pasos, umbrales, reportes, ruta y límites. */
const STEPS = [
  {
    n: '01',
    name: 'Terreno satelital',
    detail:
      'Elevación SRTM (misión de radar de la NASA) desde AWS Open Data, 1.6 M celdas de 18 m. Priority-Flood detecta 3,438 hondonadas reales donde se junta el agua.',
  },
  {
    n: '02',
    name: 'Hacia dónde escurre',
    detail: 'Cada celda sigue la máxima pendiente (D8) hasta una hondonada: así sabemos qué superficie le aporta agua a cada calle.',
  },
  {
    n: '03',
    name: 'Lluvia real',
    detail: 'Open-Meteo cada 15 min: archivo histórico para cualquier fecha y pronóstico para hoy y las próximas horas.',
  },
  {
    n: '04',
    name: 'Escurrimiento SCS-CN',
    detail: 'Método del número de curva (NRCS, CN 85 urbano): qué parte de la lluvia corre por la calle y cuánto absorben pozos y suelo kárstico.',
  },
  {
    n: '05',
    name: 'Llenado de hondonadas',
    detail: 'El volumen llena cada hondonada según la forma real de su fondo → profundidad en cm por tramo de calle.',
  },
];

export function ModelPanel() {
  return (
    <section className="panel model" aria-label="Cómo decide">
      <h2>Modelo hidrológico v1 · cómo predice</h2>
      <p className="model-lede">
        No depende de reportes: <b>simula la física del agua</b> sobre el terreno real con la lluvia real.
      </p>

      <ol className="factors steps">
        {STEPS.map((s) => (
          <li key={s.n}>
            <span className="w">{s.n}</span>
            <div>
              <strong>{s.name}</strong>
              <span>{s.detail}</span>
            </div>
          </li>
        ))}
      </ol>

      <div className="thresholds">
        <span className="t lvl-low">B &lt; 10 cm</span>
        <span className="t lvl-medium">M 10–20 cm</span>
        <span className="t lvl-high">A ≥ 20 cm</span>
      </div>

      <h2>Reportes ciudadanos: solo corroboran</h2>
      <p className="model-lede">
        Un reporte <b>aislado</b> en una calle donde el modelo no ve agua <b>no cambia el mapa</b> (evita falsos
        positivos). Cuenta si el modelo predice agua ahí o si hay 2 o más reportes del mismo tramo.
      </p>

      <h2>Ruta según tu vehículo</h2>
      <p className="model-lede">
        Ruta más corta sobre 14,950 tramos reales (OpenStreetMap) y otra que excluye lo que tu vehículo no tolera: compacto,
        moto o a pie evitan ≥ 10 cm; SUV evita ≥ 20 cm.
      </p>

      <h2>Límites honestos</h2>
      <ul className="roadmap">
        <li>SRTM mide superficie (incluye edificios y árboles) a 18 m: calibrado a ojo, no validado aún.</li>
        <li>La lluvia es de modelo (~10–25 km): suaviza tormentas locales intensas.</li>
        <li>
          Siguiente: LiDAR INEGI, lluvia satelital GPM IMERG y calibración con inundaciones históricas de Protección
          Civil.
        </li>
      </ul>
    </section>
  );
}
