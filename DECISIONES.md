# Decisiones — aguaruta-merida

> Sellado. Sólo se agrega, **nunca se edita ni se borra** un bloque anterior.
> Manda sobre `CLAUDE.md`. Sin límite de tamaño: es la memoria del proyecto.
> Aquí va lo que costaría caro re-discutir. Aquí NO va lo reversible en una tarde.

## Qué califica como decisión sellada

| Sí | No |
|---|---|
| Cambia el stack o la arquitectura | Nombre de una variable |
| Desvía del estándar de casa (M-04 §5.1) | Refactor interno de un archivo |
| Fija un contrato con un tercero | Elección de librería de utilería |
| Acepta un riesgo de seguridad o legal | Orden de las carpetas |
| Descarta una alternativa que alguien va a volver a proponer | Lo que se puede deshacer en una tarde |

**Prueba práctica:** si dentro de seis meses alguien va a preguntar "¿y por qué no hicimos X?", es decisión sellada.

> Los bloques D-001 a D-003 se registraron **de forma retroactiva** el 2026-10-25 a partir del código y `spec/constitution/`. Los campos «Decide» y «Qué se pierde» son una propuesta pendiente de confirmación por el líder del proyecto.

---

### D-001 · El proyecto no sigue el estándar de backend ni de infraestructura de casa
- **Fecha:** 2026-10-25 (retroactiva; la decisión se tomó antes)
- **Decide:** POR CONFIRMAR (líder de proyecto) — **Propone:** equipo del hackathon
- **Default del que se desvía:** M-04 §5.1 — NestJS 11 + Fastify, Supabase Postgres, Drizzle, GCP Cloud Run
- **Razón:** hackathon sobre AWS. Una sola Lambda `api` (router) tras API Gateway HTTP API, S3 para segmentos/snapshots/fotos y DynamoDB sólo para `Reports`. Cabe en la capa gratuita y se despliega rápido.
- **Qué se pierde:** el molde compartido de capas con los otros repos de casa, las migraciones con drizzle-kit, el despliegue ya montado en GCP y el conocimiento del equipo sobre Supabase. El mantenimiento queda en una pila que sólo conoce este repo.
- **Cuándo se revisa:** si el proyecto pasa de demo a producto con cliente.
- **Alternativas descartadas:** NestJS + Supabase + Cloud Run (estándar de casa).

### D-002 · Capas de código: `core` puro, `api` con router, sin NestJS
- **Fecha:** 2026-10-25 (retroactiva)
- **Decide:** POR CONFIRMAR — **Propone:** equipo del hackathon
- **Default del que se desvía:** Controller → Service → Repository agrupado por módulo (M-04 §5b)
- **Razón:** `core/` guarda `computeRisk`, `applyReports` y la geometría como funciones puras, sin AWS y con tests. `api/` tiene el router, los stores y el `RoutingProvider`. La regla real se conserva: la lógica de negocio no depende de AWS ni de HTTP.
- **Qué se pierde:** la separación Controller/Service/Repository por módulo; el router de la Lambda concentra el enrutamiento y los stores concentran los accesos.
- **Cuándo se revisa:** al agregar el cuarto endpoint con lógica propia.
- **Alternativas descartadas:** capas NestJS completas (demasiado para una sola Lambda).

### D-003 · El contrato OpenAPI manda sobre el código
- **Fecha:** 2026-10-25 (retroactiva)
- **Decide:** POR CONFIRMAR — **Propone:** equipo del hackathon
- **Default del que se desvía:** ninguno, es decisión nueva
- **Razón:** `contract/openapi.yaml` es la fuente de verdad. El mock (Prism), los tipos del web y las pruebas de `api/` se validan contra él.
- **Qué se pierde:** cambiar un campo cuesta más pasos (contrato → tipos → código), a cambio de que el cliente y la API no se desalineen.
- **Cuándo se revisa:** si aparece un segundo consumidor de la API.
- **Alternativas descartadas:** tipos escritos a mano en cada lado.
