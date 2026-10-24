# Spec — Datos y replay

Estado: LISTO PARA IMPLEMENTAR

## Qué hace

Genera `segments.json` de la zona piloto, la serie de lluvia del 29-may-2026 y snapshots cada 15 minutos con `computeRisk` (fórmula §2.2, pesos en `data/model.json`). **Para la demo los datos son SINTÉTICOS** (retícula del Centro); los reales de OSM + INEGI + lluvia observada quedan pendientes.

## Nivel de riesgo

Mediano — lógica nueva de riesgo; datos públicos sin PII.

## Módulos que toca

- [x] Backend
- [ ] Frontend
- [x] Datos / ML / LLM

## Depende de

- 001

## Fuera de alcance

- Ingesta de lluvia en vivo
- Calibración estadística del modelo
- Todo lo de la lista Post-MVP de `spec-lite.md`

## Criterios de aceptación

1. **Dado** lluvia y un tramo de ejemplo, **cuando** corro `computeRisk`, **entonces** el score coincide con la fórmula §2.2.
2. **Dado** scores 0.329/0.33/0.659/0.66, **cuando** calculo el nivel, **entonces** low/medium/medium/high.
3. **Dado** `data/model.json` modificado, **cuando** corro `computeRisk`, **entonces** usa esos pesos (nada hardcodeado).
4. **Dado** entradas extremas, **cuando** corro `computeRisk`, **entonces** el score queda en [0,1].
