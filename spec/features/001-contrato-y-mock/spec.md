# Spec — Contrato y mock

Estado: LISTO PARA IMPLEMENTAR

## Qué hace

Deja el repo con la estructura de spec-lite §1.6, el contrato `contract/openapi.yaml` y `web/src/api/types.ts`. Prism sirve un mock del contrato para construir el cliente sin AWS.

## Nivel de riesgo

Chico — solo archivos de contrato y herramienta de mock; sin lógica ni datos de usuario.

## Módulos que toca

- [ ] Backend
- [x] Frontend
- [ ] Datos / ML / LLM

## Depende de

- Ninguna

## Fuera de alcance

- Lógica real de API
- Cualquier recurso de AWS
- Todo lo de la lista Post-MVP de `spec-lite.md`

## Criterios de aceptación

1. **Dado** el repo, **cuando** corro `cd web && npm run mock`, **entonces** `GET http://127.0.0.1:4010/v1/risk/segments?bbox=-89.64,20.95,-89.60,20.99` responde 200 con un `SegmentRiskCollection`.
2. **Dado** el contrato, **cuando** comparo los enums de `types.ts` (`RiskLevel`, `WaterLevel`, `TravelMode`, `ApiErrorCode`), **entonces** son idénticos a los de `openapi.yaml`.
3. **Dado** el mock, **cuando** pido `/risk/segments` con `bbox=foo`, **entonces** responde 4xx (el contrato valida el patrón).
