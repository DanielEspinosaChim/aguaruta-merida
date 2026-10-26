# Plan de trabajo — aguaruta-merida

El orden y el estado viven en `spec/constitution/roadmap.md`; los criterios de aceptación, en `spec/features/NNN-*/spec.md`. Aquí sólo se enlazan, para no duplicarlos.

Orden de recorte (de abajo hacia arriba): reportes con foto → ruteo → mapa con replay (éste nunca se recorta).

| # | Módulo | Nivel | Spec | Fechas |
|---|---|---|---|---|
| 001 | Contrato y mock | Chico | `spec/features/001-contrato-y-mock/` | `docs/calendario-qa.md` |
| 002 | Cliente web contra el mock | Mediano | `spec/features/002-cliente-mock/` | idem |
| 003 | Datos y replay | Mediano | `spec/features/003-datos-y-replay/` | idem |
| 004 | API de lectura | Mediano | `spec/features/004-api-lectura/` | idem |
| 005 | Ruteo | Mediano | `spec/features/005-ruteo/` | idem |
| 006 | Reportes con foto | Crítico | `spec/features/006-reportes-con-foto/` | idem |
| 007 | Guion de demo y plan B | Chico | `spec/features/007-demo/` | idem |

Transversal: `spec/features/000-seguridad-transversal/` (checklist de auditoría de cualquier módulo).

Fuera de alcance (Post-MVP, no construir): ver la lista en `roadmap.md`. Un módulo sin renglón en la matriz de trazabilidad es alcance nuevo y va a Change Request, no a este plan.

Carga en Ágora: pendiente, paso manual.
