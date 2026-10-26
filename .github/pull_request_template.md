## Qué cambia

{{Una frase.}}

## Criterios de aceptación que cubre

- [ ] `M-_-CA-__` — el test lleva el ID al inicio del nombre

## Checklist

- [ ] CI verde (typecheck, lint, tests, gitleaks)
- [ ] Ninguna credencial, `.env` ni llave en el diff
- [ ] Toda ruta nueva con `@Roles()` o `@Public()` explícito
- [ ] Si me desvié del estándar de casa: bloque completo en `DECISIONES.md`, con **Qué se pierde**
- [ ] Si dejé algo peor a propósito: renglón en `DEUDA.md` con prioridad y fecha
- [ ] `ESTADO.md` actualizado si cerré un módulo (y sigue bajo 200 líneas)
- [ ] Si esto corrige un bug que se escapó a QA: regla nueva en `.github/REGLAS-APRENDIDAS.md`

## Cómo lo verifiqué

{{Contra el sistema real, no sólo contra un mock que yo escribí.}}
