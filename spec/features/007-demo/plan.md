# Plan — Guion de demo, README y entregables

## Enfoque técnico

README en la raíz, diagrama mermaid en `docs/arquitectura.md`, guion en `docs/demo.md`.

## Archivos a crear/modificar

- `README.md`
- `docs/arquitectura.md`
- `docs/demo.md`

## Endpoints y modelo de datos

Los de `contract/openapi.yaml` y `spec-lite.md` §2. Esta feature no agrega campos ni endpoints.

## Verificación por criterio

| Criterio | Test | Tipo |
|---|---|---|
| C007-1..2 | revisión y ensayo manual registrados en docs/ | manual |

## Consideraciones de seguridad específicas de esta feature

Revisar contra `spec/features/000-seguridad-transversal/spec.md`. Validación estricta según el contrato; errores sin detalles internos; nunca credenciales AWS en el cliente.
