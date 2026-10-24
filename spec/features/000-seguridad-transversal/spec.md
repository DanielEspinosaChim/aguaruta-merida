# Checklist de seguridad transversal

Referencia fija que se usa para auditar **cualquier** módulo del proyecto
antes de mergear. No es específico de una feature — aplica a todas.

## Los 11 puntos

1. **Validación de inputs**: todo input de usuario se valida en tipo,
   formato y longitud antes de usarse.
2. **Control de acceso**: cada endpoint verifica autenticación Y
   autorización (no basta con saber que el usuario está logueado).
   **AguaRuta MVP:** sin autenticación por decisión de spec (reportes anónimos,
   spam aceptado para la demo). Aun así: el bucket de fotos es privado, solo se
   escribe con URL prefirmada de 5 min, y el cliente nunca recibe credenciales AWS.
3. **Aislamiento multi-tenant**: **No aplica**: sin cuentas ni tenants en el MVP (reportes anónimos). Si se agrega auth post-MVP, revisar.
4. **Manejo de secrets**: ninguna credencial, token o llave está
   hardcodeada ni se sube al repositorio (`.env*` en `.gitignore`).
5. **Protección contra inyecciones**: SQL, NoSQL, comandos de sistema —
   nunca se concatenan inputs directamente en queries o comandos.
6. **Protección XSS/CSRF**: en cualquier superficie web que renderice
   contenido generado por usuarios.
7. **Rate limiting**: en endpoints públicos o sensibles (login, registro,
   recuperación de contraseña, APIs de escritura).
8. **Logging seguro**: nunca se registran contraseñas, tokens, ni datos
   personales sensibles en texto plano en los logs.
9. **Manejo de errores**: los mensajes de error al cliente no filtran
   stack traces, rutas internas, ni versiones de librerías.
10. **Dependencias**: sin vulnerabilidades conocidas (CVEs) sin mitigar o
    justificar.
11. **Subida de archivos** (si aplica): validación por tipo real (no solo
    extensión), tamaño máximo, y almacenamiento fuera de rutas ejecutables.

## Puntos adicionales si el proyecto usa LLMs o modelos de ML

**No aplica**: AguaRuta MVP no usa LLMs ni modelos de ML (el riesgo es una
heurística pura `computeRisk`). Filtro de fotos con Bedrock es Post-MVP.

12. **Salidas del modelo como datos no confiables**: toda salida de un LLM
    se valida con un esquema antes de usarse, y nunca llega sin validar a
    SQL, shell, `eval` ni a otra herramienta con permisos.
13. **Prompt injection**: el texto que viene de usuarios, documentos,
    páginas o herramientas se trata como dato, separado de las
    instrucciones; las acciones irreversibles del agente requieren
    confirmación humana.
14. **Datos y artefactos**: no se envía PII a proveedores externos sin
    permiso, no se registran prompts con PII en logs, y no se cargan
    artefactos de modelo con `pickle`/`joblib` desde fuentes no confiables.

## Formato de auditoría

Al auditar un módulo contra este checklist, reportar en el siguiente
formato:

```
Módulo: [nombre]
Fecha: [fecha]

1. Validación de inputs — [OK / P0 / P1 / P2 / No aplica] — [detalle si hay hallazgo]
2. Control de acceso — [...]
...
11. Subida de archivos — [...]
12-14. (si aplica) — [...]

Resultado final: APROBADO / APROBADO CON OBSERVACIONES / RECHAZADO
```

- **P0**: crítico, bloquea el merge.
- **P1**: importante, debe resolverse pronto pero no bloquea si hay plan.
- **P2**: menor, mejora recomendada.
