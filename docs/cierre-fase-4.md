# Cierre de la Fase 4 — aguaruta-merida

Checklist M-04 §15, llenado el 2026-10-25. Sólo se marca lo que se verificó en el repo.

| # | Renglón | Estado | Nota |
|---|---|---|---|
| 1 | Propuesta firmada y matriz de trazabilidad | ☐ | No hay evidencia en el repo. Pendiente |
| 2 | Dueño de cuenta (Alan o Michael) y líder de proyecto registrados | ☐ | Pendiente |
| 3 | Módulos con criterios de aceptación verificables | ☑ | `spec/features/001`–`007`, con `scripts/trazabilidad.py` |
| 4 | Volúmenes | ☐ | Pendiente del levantamiento; sin supuesto escrito |
| 5 | Stack y desviaciones con «qué se pierde» | ☑ | `DECISIONES.md` D-001 a D-003 (retroactivas, por confirmar) |
| 5b | Arquitectura y árbol de carpetas | ☑ | `CLAUDE.md` y `docs/arquitectura.md` |
| 6 | Nombres de repos válidos | ☐ | `aguaruta-merida` no sigue `<producto>-<capa>`. Hay que decidir si se renombra |
| 7 | Calendario con ventanas de QA confirmadas por Mei | ☐ | `docs/calendario-qa.md` en POR CONFIRMAR CON MEI. **Así la fase no cierra** |
| 8 | Protocolo de sesiones con el cliente | ☐ | `docs/protocolo-sesiones.md` sin día ni hora |
| 9 | pnpm, sin npm | ☑ | `pnpm-lock.yaml` en `core/`, `api/`, `web/` y `scripts/`; sin `package-lock.json`. Tests y typecheck en verde con pnpm (core 15, api 19, web 27) |
| 10 | CI con escaneo de secretos y seguridad | ☑ | `ci-node.yml` (gitleaks, semgrep) y `seguridad.yml`; ambos corren pnpm por paquete (`core`, `api`, `web`); aún sin correr en GitHub |
| 11 | Documentos vivos | ☑ | `CLAUDE.md`, `README.md`, `ESTADO.md`, `DECISIONES.md`, `DEUDA.md`, `LEEME-PRIMERO.md` |
| 12 | `main` protegido | ☐ | Paso manual en GitHub; no verificado |
| 13 | Repo asignado al team | ☐ | Paso manual en GitHub; no verificado |
| 14 | Plan cargado en Ágora | ☐ | Paso manual; no verificado |

**Para que Alan firme faltan:** los renglones 1, 2, 4, 6, 7, 8, 12, 13 y 14.
