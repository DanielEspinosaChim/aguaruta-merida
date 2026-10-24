# Plan — Contrato y mock

## Enfoque técnico

Copia literal del contrato y de los tipos; Prism como devDependency de `web/` con script `mock`. Un test compara los enums del YAML con los de `types.ts`.

## Archivos a crear/modificar

- `contract/openapi.yaml` — contrato
- `web/src/api/types.ts` — tipos
- `web/package.json` — script `mock`
- `api/test/contract-enums.test.ts` — test C001-2

## Endpoints y modelo de datos

Los de `contract/openapi.yaml` y `spec-lite.md` §2. Esta feature no agrega campos ni endpoints.

## Verificación por criterio

| Criterio | Test | Tipo |
|---|---|---|
| C001-1 | curl manual registrado en docs/ | manual |
| C001-2 | `api/test/contract-enums.test.ts` | unitario |
| C001-3 | curl manual | manual |

## Consideraciones de seguridad específicas de esta feature

Revisar contra `spec/features/000-seguridad-transversal/spec.md`. Validación estricta según el contrato; errores sin detalles internos; nunca credenciales AWS en el cliente.
