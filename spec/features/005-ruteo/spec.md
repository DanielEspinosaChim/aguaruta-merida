# Spec — Ruteo que evita riesgo

Estado: LISTO PARA IMPLEMENTAR

## Qué hace

`POST /v1/routes` devuelve una ruta base y una alternativa que evita tramos con nivel ≥ `avoidLevel`, con métricas comparativas, `residualRiskLevel` y `disclaimer`; 404 `ROUTE_NOT_FOUND` si no hay alternativa. `RoutingProvider` local (grafo) para la demo; Amazon Location después.

## Nivel de riesgo

Mediano — lógica nueva; sin datos sensibles.

## Módulos que toca

- [x] Backend
- [ ] Frontend
- [ ] Datos / ML / LLM

## Depende de

- 004

## Fuera de alcance

- Navegación paso a paso
- Tráfico en vivo
- Todo lo de la lista Post-MVP de `spec-lite.md`

## Criterios de aceptación

1. **Dado** el pico del replay, **cuando** pido una ruta que cruza tramos high, **entonces** `safer` no contiene tramos high.
2. **Dado** un destino rodeado de tramos high, **cuando** pido ruta, **entonces** 404 `ROUTE_NOT_FOUND`.
3. **Dado** cualquier ruta exitosa, **cuando** respondo, **entonces** incluye `disclaimer`.
4. **Dado** origen `[200, 95]`, **cuando** pido ruta, **entonces** 400 `INVALID_REQUEST`.
