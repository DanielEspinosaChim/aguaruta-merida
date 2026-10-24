# Plan — API de lectura (riesgo)

## Enfoque técnico

Handler HTTP API v2 con interfaces `SnapshotStore` (fs local / S3) y `ReportStore`; despliegue en AWS con rol IAM mínimo.

## Archivos a crear/modificar

- `api/src/handler.ts`
- `api/src/` — stores y servidor local
- `api/test/` — tests C004-n

## Endpoints y modelo de datos

Los de `contract/openapi.yaml` y `spec-lite.md` §2. Esta feature no agrega campos ni endpoints.

## Verificación por criterio

| Criterio | Test | Tipo |
|---|---|---|
| C004-1..4 | `api/test/*.test.ts` | integración (handler) |

## Consideraciones de seguridad específicas de esta feature

Revisar contra `spec/features/000-seguridad-transversal/spec.md`. Validación estricta según el contrato; errores sin detalles internos; nunca credenciales AWS en el cliente.
