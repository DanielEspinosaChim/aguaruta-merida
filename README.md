# AguaRuta Mérida 🌧️🗺️

Mapa de **riesgo estimado de inundación por calle** en Mérida, Yucatán, con replay de la tormenta del 29-may-2026, **ruta que evita calles de riesgo alto** y **reportes ciudadanos con foto** que actualizan el mapa al instante.

> Riesgo estimado, no garantía. AguaRuta nunca afirma que una calle sea transitable.

## Demo en vivo

- **Web (AWS Amplify):** https://main.ddvd3qz48bevd.amplifyapp.com
- **API (API Gateway + Lambda):** https://v6oco0es27.execute-api.us-east-2.amazonaws.com/v1 — ej. [`/risk/segments`](https://v6oco0es27.execute-api.us-east-2.amazonaws.com/v1/risk/segments?bbox=-89.64,20.95,-89.60,20.99&asOf=2026-05-29T20:30:00Z)
- Región: `us-east-2` (Ohio).

## El problema

En Mérida, el suelo kárstico, la falta de drenaje pluvial y los puntos bajos hacen que algunas calles se inunden en minutos durante tormentas fuertes. Los automovilistas y peatones no saben qué calles evitar hasta que ya están dentro del agua, con riesgo para su vida y su vehículo. La información existe dispersa (lluvia, elevación, historial, testimonios en redes) pero no está unida calle por calle ni sirve para decidir una ruta.

## La solución

**Modelo hidrológico predictivo (v1)** que simula la física del agua; no depende de reportes:

1. **Terreno satelital:** elevación SRTM (radar de la NASA) desde **AWS Open Data** (Terrain Tiles), 1.6 M celdas de 18 m sobre toda Mérida. *Priority-Flood* detecta 3,438 hondonadas reales y D8 calcula qué superficie drena hacia cada una (`scripts/build-terrain.ts`).
2. **Lluvia real cada 15 min** (Open-Meteo): archivo histórico para **cualquier fecha** y pronóstico **en vivo** para hoy y las próximas horas (`GET /v1/rainfall`).
3. **Escurrimiento SCS-CN** (NRCS, CN 85 urbano) menos la absorción de pozos y suelo kárstico; el agua **llena cada hondonada según la forma real de su fondo** → **profundidad en cm por tramo de calle** (`core/src/hydro.ts`). Bajo < 10 cm · medio 10–20 cm · alto ≥ 20 cm.
4. **Tormenta de diseño** ("¿y si lloviera 40 / 60 / 90 mm/h?") sumada a la lluvia real, para planeación y escenarios.
5. **Reportes ciudadanos solo corroboran:** un reporte aislado donde el modelo no ve agua no cambia el mapa (evita falsos positivos).
6. **Ruta según tu vehículo** sobre 19,300 tramos reales de OpenStreetMap: compacto, moto o a pie evitan ≥ 10 cm; SUV evita ≥ 20 cm.
7. **Dashboard:** escenario (29-may-2026, en vivo u otra fecha), profundidad máxima, km inundados, hidrograma y calles más afectadas.

Resultado honesto del 29-may-2026: la lluvia registrada por los modelos (≈ 20 mm en 24 h, picos de 6.8 mm/h) **no genera acumulación** según el modelo. Con una tormenta de diseño de 60 mm/h, 3,436 tramos tienen agua y 246 km superan los 20 cm.

**Límites:** SRTM mide superficie (con edificios) a 18 m y la lluvia de modelo suaviza tormentas locales; CN y drenaje están calibrados a ojo, sin validar todavía. Siguiente: LiDAR de INEGI, lluvia satelital GPM IMERG y calibración con inundaciones históricas de Protección Civil.

## Servicios de AWS usados

| Servicio | Para qué |
|---|---|
| **Amazon S3** | Tramos de calle, snapshots del replay y fotos de reportes (bucket privado, subida con URL prefirmada) |
| **AWS Lambda** | Función `api` que enruta `/v1`: riesgo, reportes, rutas |
| **Amazon API Gateway** (HTTP API) | Entrada HTTPS pública `/v1` con CORS |
| **Amazon DynamoDB** | Tabla `Reports` con TTL de 24 h |
| **AWS Amplify Hosting** | Hosting de la SPA |
| **AWS Open Data** (Terrain Tiles, S3) | Elevación satelital SRTM para el modelo hidrológico |
| **AWS IAM** | Rol de mínimo privilegio para la Lambda |

En la demo, la ruta que evita riesgo la calcula `LocalGraphRoutingProvider` (Dijkstra sobre los tramos, dentro de la Lambda). **Amazon Location Service** (`CalculateRoutes` con `Avoid.Areas`) ya está detrás de la interfaz `RoutingProvider` como siguiente paso, pero todavía no está conectado.

Diagrama: [docs/arquitectura.md](docs/arquitectura.md).

## Código y librerías preexistentes (declarados)

Todo el código de la aplicación (`web/`, `api/`, `core/`, `scripts/`) se escribió durante el hackathon, con ayuda de Claude Code (Anthropic) como asistente de programación. Usamos estas librerías y herramientas de terceros:

- **Frontend:** React, React DOM, Vite, MapLibre GL JS, TypeScript.
- **Backend / scripts:** Node.js, TypeScript, tsx, AWS SDK for JavaScript v3.
- **Pruebas y mock:** Vitest, Testing Library, jsdom, Prism (`@stoplight/prism-cli`), Ajv, js-yaml.
- **Mapa base en local:** teselas de © OpenStreetMap contributors.
- **Arnés de desarrollo** (`.claude/`, pre-commit, CI): plantillas de la skill `sdd-bootstrap`, con hooks de cc-safe-setup (MIT), agentes y skills de everything-claude-code (MIT), wshobson/agents (MIT), obra/superpowers (MIT) y anthropics/skills (Apache-2.0). Las licencias están en `.claude/`.
- **Datos externos:** elevación SRTM vía AWS Open Data (Terrain Tiles), lluvia de © Open-Meteo (CC BY 4.0).
- **Datos:** las **calles son reales**: 3,834 tramos del Centro de Mérida importados de © OpenStreetMap (ODbL) con `scripts/import-osm.ts`. La **elevación relativa, las depresiones, el historial de inundaciones y la serie de lluvia** del 29-may-2026 son **sintéticos** de demo (`scripts/generate-data.ts`); se reemplazan por INEGI, Protección Civil y CONAGUA sin cambiar código.

## Cómo se ejecuta

Requisitos: Node.js 20+ y npm.

```bash
# 1. Dependencias (los datos y snapshots ya vienen en data/; para regenerarlos: cd api && npm run data)
cd core && npm install && cd ..
cd api && npm install && cd ..

# 2. API local (misma lógica que la Lambda), en http://127.0.0.1:4020/v1
cd api && npm run dev

# 3. Cliente web (otra terminal)
cd web && npm install
VITE_API_BASE_URL=http://127.0.0.1:4020/v1 npm run dev     # PowerShell: $env:VITE_API_BASE_URL="http://127.0.0.1:4020/v1"; npm run dev
```

Solo contra el mock del contrato (sin datos reales): `cd web && npm run mock` y `npm run dev` (por defecto usa `http://127.0.0.1:4010/v1`).

Pruebas: `npm test` y `npm run typecheck` dentro de `core/`, `api/` y `web/`.

Despliegue en AWS (idempotente, crea S3, DynamoDB, IAM, Lambda, API Gateway y Amplify): `bash scripts/deploy-aws.sh` con el perfil `aguaruta` de AWS CLI v2.

## Estructura

```
contract/openapi.yaml   contrato de la API (fuente de verdad)
web/                    SPA React + MapLibre
api/                    Lambda api (router), stores, RoutingProvider, servidor local
core/                   computeRisk, applyReports, geometría (puras, con tests)
scripts/                generación de datos y replay
data/                   tramos, lluvia, modelo y snapshots (sintéticos)
spec/                   Spec-Driven Development: constitución y specs por feature
```

## Equipo

<!-- REVISAR: nombre del equipo y número -->
