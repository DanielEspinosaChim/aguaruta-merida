# Plan — Reportes ciudadanos con foto

## Enfoque técnico

`applyReports` puro en `core/`; `ReportStore` (memoria / DynamoDB con TTL 24 h); `PhotoSigner` (local / `getSignedUrl` S3 5 min, Content-Type fijado).

## Archivos a crear/modificar

- `core/src/` — applyReports y nearestSegment
- `api/src/` — stores y firmado de fotos
- `api/test/` — tests C006-6..7

## Endpoints y modelo de datos

Los de `contract/openapi.yaml` y `spec-lite.md` §2. Esta feature no agrega campos ni endpoints.

## Verificación por criterio

| Criterio | Test | Tipo |
|---|---|---|
| C006-1..5 | `core/src/*.test.ts` | unitario |
| C006-6..7 | `api/test/*.test.ts` | integración |

## Consideraciones de seguridad específicas de esta feature

Revisar contra `spec/features/000-seguridad-transversal/spec.md`. Validación estricta según el contrato; errores sin detalles internos; nunca credenciales AWS en el cliente.
