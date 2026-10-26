# Estado — aguaruta-merida

> Documento vivo. **Máximo 200 líneas.** Se actualiza al cerrar cada módulo.
> Aquí NO va: deuda (→ `DEUDA.md`), decisiones (→ `DECISIONES.md`), cómo levantarlo (→ `LEEME-PRIMERO.md`).

**Última actualización:** 2026-10-25 por Claude (aterrizaje retroactivo, ver `docs/cierre-fase-4.md`)
**Fase actual:** Hackathon / MVP — en curso

## Ahora mismo

Fuente: `spec/constitution/roadmap.md` (ahí manda el detalle).

| Módulo | Estado | Ventana de QA | Nota |
|---|---|---|---|
| 001 Contrato y mock | 🔨 en implementación | POR CONFIRMAR CON MEI | — |
| 002 Cliente web contra el mock | 🔨 en implementación | POR CONFIRMAR CON MEI | — |
| 003 Datos y replay | 🔨 en implementación | POR CONFIRMAR CON MEI | datos sintéticos de demo |
| 004 API de lectura | 🔨 lógica local hecha | POR CONFIRMAR CON MEI | falta despliegue AWS |
| 005 Ruteo | 🔨 proveedor local hecho | POR CONFIRMAR CON MEI | falta Amazon Location |
| 006 Reportes con foto | 🔨 lógica local hecha | POR CONFIRMAR CON MEI | nivel crítico; falta S3/DynamoDB |
| 007 Guion de demo y plan B | ⏸ pendiente | POR CONFIRMAR CON MEI | `docs/demo.md` ya tiene borrador |

## Qué está desplegado

| Entorno | Versión | Fecha |
|---|---|---|
| Producción | sin tag (Amplify `main`, API Gateway `us-east-2`; URLs en `README.md`) | por confirmar |
| Staging | no existe | — |

## Bloqueos abiertos

| Qué | Desde | Quién lo destraba |
|---|---|---|
| Propuesta firmada y dueño de cuenta sin registrar | 2026-10-25 | Alan o Michael |
| Ventanas de QA sin confirmar | 2026-10-25 | Mei |

## Cierre de la fase anterior

No hay fase anterior registrada.
