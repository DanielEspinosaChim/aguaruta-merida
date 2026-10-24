# Plan — Datos y replay

## Enfoque técnico

Funciones puras en `core/`; scripts deterministas (seed fija) en `scripts/`; snapshots a disco y `--upload` a S3 en la Fase 3.

## Archivos a crear/modificar

- `core/src/` — computeRisk y geometría
- `scripts/generate-data.ts`
- `scripts/build-replay.ts`
- `data/` — json y README

## Endpoints y modelo de datos

Los de `contract/openapi.yaml` y `spec-lite.md` §2. Esta feature no agrega campos ni endpoints.

## Verificación por criterio

| Criterio | Test | Tipo |
|---|---|---|
| C003-1..4 | `core/src/*.test.ts` | unitario |

## Consideraciones de seguridad específicas de esta feature

Revisar contra `spec/features/000-seguridad-transversal/spec.md`. Validación estricta según el contrato; errores sin detalles internos; nunca credenciales AWS en el cliente.
