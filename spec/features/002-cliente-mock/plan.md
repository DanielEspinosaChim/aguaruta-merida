# Plan — Cliente web contra el mock

## Enfoque técnico

Cliente HTTP tipado (`AguaRutaApi`) sobre fetch; validación pura en `lib/validation.ts`; componentes React por panel; MapLibre con fuente GeoJSON y estilo por `level`.

## Archivos a crear/modificar

- `web/src/api/client.ts` — cliente HTTP
- `web/src/lib/validation.ts` — validación pura
- `web/src/components/` — mapa, replay, ruta, reporte, disclaimer
- `web/src/**/*.test.ts(x)` — tests C002-n

## Endpoints y modelo de datos

Los de `contract/openapi.yaml` y `spec-lite.md` §2. Esta feature no agrega campos ni endpoints.

## Verificación por criterio

| Criterio | Test | Tipo |
|---|---|---|
| C002-1..7 | `web/src/**/*.test.ts(x)` con el ID en el nombre | unitario / componente |

## Consideraciones de seguridad específicas de esta feature

Revisar contra `spec/features/000-seguridad-transversal/spec.md`. Validación estricta según el contrato; errores sin detalles internos; nunca credenciales AWS en el cliente.
