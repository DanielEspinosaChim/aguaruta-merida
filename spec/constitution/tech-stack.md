# Tech stack

| Capa | Decisión | Por qué |
|---|---|---|
| Lenguaje | TypeScript en todo el repo | Un solo lenguaje; tipos derivados del contrato |
| Web | React 18 + Vite + MapLibre GL | Mapa vectorial/raster gratuito, compatible con Amazon Location |
| Hosting web | AWS Amplify Hosting | Capa gratuita, deploy desde GitHub |
| API | API Gateway HTTP API + 1 Lambda `api` (Node 20) | Capa gratuita (1M req/mes Lambda) |
| Datos | S3 (segmentos, snapshots, fotos) + DynamoDB `Reports` (on-demand, TTL 24 h) | Capa gratuita; mínimo de piezas |
| Rutas/mapa | Amazon Location Service (`geo-routes` `CalculateRoutes` con `Avoid.Areas`, mapas con API key) tras `RoutingProvider` | Evita áreas; intercambiable por OSRM/Valhalla |
| Ruteo local/demo offline | `LocalGraphRoutingProvider` (Dijkstra sobre `segments.json`) | Demo sin red ni AWS; evitación exacta |
| Mock | Prism (`@stoplight/prism-cli`) | Mock del contrato sin escribir código |
| Tests | Vitest (+ Testing Library en web) | Rápido, nativo de Vite |
| Calidad | `tsc --noEmit` (typecheck) en cada paquete | Lint mínimo para hackathon |

## Servicios AWS usados (capa gratuita)

S3, DynamoDB, Lambda, API Gateway, Amazon Location Service y Amplify (6 servicios, el requisito mínimo era 2). Antes de la Fase 3 hay que confirmar en la consola los límites vigentes de la capa gratuita de Amazon Location y el presupuesto en 0. <!-- REVISAR -->

## Acceso a AWS

AWS CLI v2, perfil `aguaruta`, región `us-east-1`, `aws login` (sesión del navegador). La Lambda usa un rol IAM de mínimo privilegio (ver `spec-lite.md` §1.7).
