# data/

> **DATOS SINTÉTICOS DE DEMO. NO SON REALES.**
> `segments.json` y `rain-2026-05-29.json` los genera `scripts/generate-data.ts` con semilla fija.
> La retícula imita la numeración del Centro de Mérida (pares N-S, impares E-O), pero las elevaciones,
> depresiones, historial de inundaciones y la lluvia son inventados para la demo.
> Sustituir por OSM + elevación INEGI y la lluvia observada del 29-may-2026 cuando estén disponibles.

| Archivo | Qué es |
|---|---|
| `model.json` | Pesos y referencias del modelo de riesgo v0 (spec-lite 2.2). Se calibra aquí, no en el código. |
| `segments.json` | ~682 tramos entre intersecciones, Calles 42–80 (pares) y 45–79 (impares). 3 depresiones sintéticas; una en Calle 60 x 61 (mercado). |
| `rain-2026-05-29.json` | Serie cada 15 min, 15:00Z–00:00Z, pico ~20:00–20:30Z (≈ 46 mm en 1 h, ≈ 82 mm en 3 h). |
| `snapshots/` | Salida de `scripts/build-replay.ts`: `{yyyyMMddTHHmmZ}.json` + `index.json`. |
| `photos/` | Fotos que sube el servidor local (no se versiona). |

Regenerar: `cd api && npm run data`.
