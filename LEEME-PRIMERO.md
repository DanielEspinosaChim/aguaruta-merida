# Leer primero — aguaruta-merida

> Para humanos que llegan hoy. Máximo 120 líneas.
> Si eres un agente: tu archivo es `CLAUDE.md`.
> El `README.md` dice **qué es** esto. Este archivo dice **cómo lo levantas y a quién le preguntas**.

## En 30 segundos

AguaRuta Mérida: mapa de riesgo estimado de inundación por calle, con replay de la tormenta del 29-may-2026, ruta que evita calles de riesgo alto y reportes ciudadanos con foto. Va como proyecto de hackathon, fase MVP. Estado en `ESTADO.md`.

## Levantarlo en local

Los paquetes son independientes (`web/`, `api/`, `core/`, `scripts/`). Se usa pnpm (npm está prohibido en Techmaleon). Cada paquete tiene su `pnpm-lock.yaml`.

```bash
cd api && pnpm run dev        # API local en http://127.0.0.1:4020/v1
cd web && pnpm run dev        # cliente; VITE_API_BASE_URL decide mock o API
cd web && pnpm run mock       # mock Prism en http://127.0.0.1:4010/v1
```

Listo cuando: `GET http://127.0.0.1:4020/v1/risk/segments` responde 200 (ejemplo con parámetros en `README.md`).

Tests antes de cada commit: `pnpm test` y `pnpm run typecheck` en `core/`, `api/` y `web/`.

## Requisitos

- Node 24 en local (Node 20+ en Lambda)
- Para desplegar: AWS CLI v2 con el perfil `aguaruta`, región `us-east-1`
- **Nunca** pidas ni compartas secretos por chat ni los subas al repo.

## A quién le preguntas

| Tema | Persona |
|---|---|
| Alcance, cliente | POR CONFIRMAR (dueño de cuenta: Alan o Michael) |
| Día a día, prioridades | POR CONFIRMAR (líder de proyecto) |
| QA, seguridad | Mei |

## Antes de tu primer PR

1. Lee `CLAUDE.md` completo. No es opcional.
2. Lee los últimos 3 renglones de `DECISIONES.md`.
3. Revisa `DEUDA.md`: lo que está mal ahí, está mal a propósito.
4. Rama `feat/NNN-nombre`, commits convencionales, PR con CI verde. Nunca commits directos a `main`.

## Errores comunes al empezar

- Cambiar un campo de la API sin editar antes `contract/openapi.yaml` y `web/src/api/types.ts`.
- Afirmar que una calle es transitable: sólo existe «riesgo estimado», con `disclaimer`.
- Leer `data/segments.json` o `data/snapshots/` completos: son enormes, busca lo que necesitas.
