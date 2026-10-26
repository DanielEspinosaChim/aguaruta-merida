# Deuda técnica — aguaruta-merida

> Máximo 100 renglones abiertos. La pagada se mueve a `docs/historico/DEUDA-pagada.md` con fecha y PR.
> Deuda que nadie paga es una lista de quejas. Por eso todo renglón lleva **prioridad, dueño y fecha compromiso**.

## Cómo se prioriza

| Prioridad | Criterio | Se paga |
|---|---|---|
| **P0** | Riesgo de seguridad, de datos o legal | Antes del siguiente módulo. No negociable |
| **P1** | Bloquea o encarece el siguiente módulo | Dentro de la fase en curso |
| **P2** | Molesta pero no bloquea | Se agenda en la retrospectiva de fase |
| **P3** | Nos gustaría | Sólo si sobra tiempo; a los 12 meses se cierra como "no se paga" |

## Cómo se paga

1. Toda deuda P0 y P1 entra al plan de la fase como si fuera módulo, con sus días.
2. **Regla del 1 por módulo:** cada módulo cierra pagando al menos un renglón de deuda, o explicando en el PR por qué no.
3. Una deuda que se pospone dos veces sube de prioridad o se cierra como "se acepta para siempre" — con firma del líder.

## Abierta

Dueño y compromiso están **por asignar** por el líder del proyecto: no se inventan aquí.

| ID | Qué | Por qué se contrajo | Prio | Dueño | Compromiso |
|---|---|---|---|---|---|
| T-003 | Datos de demo sintéticos (`data/`) | Sin datos reales de OSM, INEGI y CONAGUA al arranque (según `docs/demo.md`) | P2 | POR ASIGNAR | POR ASIGNAR |
| T-004 | Recursos AWS pendientes: S3/DynamoDB (006) y Amazon Location (005) | Lógica local hecha, despliegue pendiente según `roadmap.md` | P1 | POR ASIGNAR | POR ASIGNAR |
| T-005 | `scripts/_live.ts` sin seguimiento en git | Archivo de trabajo | P3 | POR ASIGNAR | POR ASIGNAR |
