# Roadmap

Orden de construcción. Orden de recorte (de abajo hacia arriba): reportes con foto → ruteo → mapa con replay (este nunca se recorta).

| # | Feature | Fase spec-lite | Nivel | Estado |
|---|---|---|---|---|
| 001 | Contrato y mock (repo, `openapi.yaml`, `types.ts`, Prism) | 0 | Chico | En implementación |
| 002 | Cliente web contra el mock (mapa, replay, ruta, reporte, errores, disclaimer) | 1 | Mediano | En implementación |
| 003 | Datos y replay (`segments.json`, lluvia, `computeRisk`, `build-replay`) | 2 | Mediano | En implementación (datos sintéticos) |
| 004 | API de lectura (Lambda + API Gateway + S3, `GET /risk/segments`) | 3 | Mediano | Lógica local hecha; falta despliegue AWS |
| 005 | Ruteo (`RoutingProvider`, `POST /routes`, `ROUTE_NOT_FOUND`) | 4 | Mediano | Proveedor local hecho; falta Amazon Location |
| 006 | Reportes con foto (DynamoDB, URL prefirmada, `applyReports`) | 5 | Crítico | Lógica local hecha; falta S3/DynamoDB |
| 007 | Guion de demo y plan B | 6 | Chico | Pendiente |

## Post-MVP (no construir)

Cognito y límite de tasa · `Idempotency-Key` · índice `geohash5` · lluvia en vivo con EventBridge · `GET /zones`, `GET /reports/{id}`, paginación · IaC · filtro de fotos con Bedrock · avisos SNS · sensores IoT Core.
