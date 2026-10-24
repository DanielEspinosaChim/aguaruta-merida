# Spec — Cliente web contra el mock

Estado: LISTO PARA IMPLEMENTAR

## Qué hace

SPA en español con mapa MapLibre de Mérida, capa de tramos coloreada por nivel de riesgo, control de tiempo del replay del 29-may-2026, panel de ruta (base vs. alternativa) y formulario de reporte con foto. Funciona contra el mock o la API real cambiando solo `VITE_API_BASE_URL`.

## Nivel de riesgo

Mediano — varios componentes y estado de UI; las fotos se validan en cliente y servidor.

## Módulos que toca

- [ ] Backend
- [x] Frontend
- [ ] Datos / ML / LLM

## Depende de

- 001

## Fuera de alcance

- Autenticación
- Modo offline/PWA
- Notificaciones
- Todo lo de la lista Post-MVP de `spec-lite.md`

## Criterios de aceptación

1. **Dado** un `SegmentRiskCollection`, **cuando** se pinta la capa, **entonces** `low`→verde, `medium`→ámbar, `high`→rojo.
2. **Dado** el slider en 2026-05-29T20:00:00Z, **cuando** lo muevo, **entonces** la request a `/risk/segments` lleva `asOf` con ese instante.
3. **Dado** origen y destino, **cuando** calculo la ruta, **entonces** se dibujan `baseline` y `safer` y se muestran distancia, tiempo, `riskySegmentCount` y `residualRiskLevel`.
4. **Dado** un 404 `ROUTE_NOT_FOUND`, **cuando** calculo la ruta, **entonces** se muestra `error.message` y no se dibuja ruta.
5. **Dado** un reporte con notas >280 caracteres, foto >5 MB o tipo distinto de jpeg/png, **cuando** lo envío, **entonces** el cliente lo rechaza sin llamar a la API.
6. **Dado** cualquier pantalla, **cuando** se renderiza, **entonces** el disclaimer de riesgo estimado está visible.
7. **Dado** `VITE_API_BASE_URL`, **cuando** el cliente hace requests, **entonces** usa solo esa base (sin URLs de API hardcodeadas).
