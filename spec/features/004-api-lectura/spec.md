# Spec — API de lectura (riesgo)

Estado: LISTO PARA IMPLEMENTAR

## Qué hace

Lambda `api` con router; `GET /v1/risk/segments` elige el snapshot anterior más cercano a `asOf` (o el último), filtra por `bbox`, aplica reportes y responde el `SegmentRiskCollection`. Corre en local (`api/src/local-server.ts`) y en AWS (Lambda + S3).

## Nivel de riesgo

Mediano — endpoint público de solo lectura; validación de entrada estricta.

## Módulos que toca

- [x] Backend
- [ ] Frontend
- [ ] Datos / ML / LLM

## Depende de

- 003

## Fuera de alcance

- Caché distribuida
- Autenticación
- Todo lo de la lista Post-MVP de `spec-lite.md`

## Criterios de aceptación

1. **Dado** un bbox válido, **cuando** pido `/risk/segments`, **entonces** 200 con la forma del contrato y `disclaimer`.
2. **Dado** `bbox=foo`, **cuando** pido `/risk/segments`, **entonces** 400 `INVALID_REQUEST` con `requestId` y sin stack trace.
3. **Dado** `asOf=2026-05-29T20:07:00Z`, **cuando** pido `/risk/segments`, **entonces** usa el snapshot de 20:00Z.
4. **Dado** sin `asOf`, **cuando** pido `/risk/segments`, **entonces** usa el último snapshot.
