# Guion de demo (5 min + 2 de preguntas)

## Antes de presentar
- Terminal 1: `cd api && pnpm run dev` (API local en 4020). Si ya está en AWS, usar la URL de Amplify.
- Terminal 2: `cd web` y `$env:VITE_API_BASE_URL="http://127.0.0.1:4020/v1"; pnpm run dev`
- Navegador en el Centro de Mérida, con el slider en 15:00Z.

## Guion
1. **Problema (40 s):** En Mérida las calles se inundan en minutos y nadie sabe cuáles evitar hasta que ya está dentro del agua.
2. **Replay (1 min):** Dar play desde 15:00Z. Las calles pasan a ámbar y a rojo conforme sube la lluvia. A las 20:30Z, en el pico, hay 18 tramos en alto, todos en zonas bajas.
3. **Reporte en vivo (1 min):** Clic en un tramo ámbar → "Intransitable" + foto → enviar. El tramo cambia a rojo en la siguiente consulta.
4. **Ruta (1 min):** Origen en Calle 70 y destino en Calle 50, por la 61, evitando riesgo alto. Se comparan la ruta base (2 tramos de riesgo) y la alternativa (+581 m, +70 s, riesgo residual medio). Mencionar el disclaimer.
5. **AWS y arquitectura (1 min):** Mostrar el diagrama: S3, Lambda, API Gateway, DynamoDB, Amplify e IAM. Modelo transparente con pesos en `model.json`. Desarrollo guiado por specs y tests (más de 50).
6. **Cierre (20 s):** Siguiente paso: datos reales de OSM, INEGI y CONAGUA, y Amazon Location.

## Plan B
- Si falla AWS o la red: API local (terminal 1).
- Si falla la API local: `cd web && pnpm run mock` (datos de ejemplo del contrato).

## Preguntas probables
- **¿Los datos son reales?** No. Son sintéticos y plausibles; el pipeline acepta los reales sin cambiar código.
- **¿Garantiza que una calle es segura?** No. Es riesgo estimado y siempre se muestra el disclaimer.
