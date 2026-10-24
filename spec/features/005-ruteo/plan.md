# Plan — Ruteo que evita riesgo

## Enfoque técnico

Interfaz `RoutingProvider`; `LocalGraphRoutingProvider` con Dijkstra; `AmazonLocationRoutingProvider` con `CalculateRoutes` + `Avoid.Areas` y verificación de la geometría resultante.

## Archivos a crear/modificar

- `api/src/routing/`
- `api/test/` — tests C005-n

## Endpoints y modelo de datos

Los de `contract/openapi.yaml` y `spec-lite.md` §2. Esta feature no agrega campos ni endpoints.

## Verificación por criterio

| Criterio | Test | Tipo |
|---|---|---|
| C005-1..4 | `api/test/*.test.ts` | integración |

## Consideraciones de seguridad específicas de esta feature

Revisar contra `spec/features/000-seguridad-transversal/spec.md`. Validación estricta según el contrato; errores sin detalles internos; nunca credenciales AWS en el cliente.
