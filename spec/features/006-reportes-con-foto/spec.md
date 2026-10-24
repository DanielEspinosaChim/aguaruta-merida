# Spec — Reportes ciudadanos con foto

Estado: LISTO PARA IMPLEMENTAR

## Qué hace

`POST /v1/reports/photo-upload-url`, `POST /v1/reports` y `GET /v1/reports`. El reporte se asocia al tramo más cercano (≤30 m) y ajusta el riesgo al leer (`applyReports`).

## Nivel de riesgo

Crítico — subida de archivos por usuarios anónimos y URL prefirmada de S3.

## Módulos que toca

- [x] Backend
- [x] Frontend
- [ ] Datos / ML / LLM

## Depende de

- 004

## Fuera de alcance

- Moderación de fotos (Bedrock)
- Rate limiting/Cognito
- Todo lo de la lista Post-MVP de `spec-lite.md`

## Criterios de aceptación

1. **Dado** 1 reporte reciente en un tramo, **cuando** aplico reportes, **entonces** su score sube 0.10.
2. **Dado** 5 reportes recientes, **cuando** aplico reportes, **entonces** el ajuste se topa en +0.30.
3. **Dado** un reporte `impassable`, **cuando** aplico reportes, **entonces** el nivel es `high`.
4. **Dado** un reporte de hace 61 min, **cuando** aplico reportes, **entonces** se ignora.
5. **Dado** un punto a 25 m de un tramo, **cuando** busco el tramo más cercano, **entonces** lo devuelve; a 40 m devuelve null.
6. **Dado** un POST `impassable`, **cuando** pido `/risk/segments`, **entonces** ese tramo sale `high`.
7. **Dado** notas >280, `contentType=image/gif` o `sizeBytes>5242880`, **cuando** envío, **entonces** 400 `INVALID_REQUEST`.
