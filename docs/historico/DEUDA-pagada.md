# Deuda pagada — aguaruta-merida

| ID | Qué | Pagada | Cómo |
|---|---|---|---|
| T-001 | Migrar de npm a pnpm | 2026-10-25 | `pnpm import` por paquete, lockfiles de npm eliminados, `pnpm-workspace.yaml` con `allowBuilds` para esbuild, scripts y docs actualizados |
| T-002 | `ci-node.yml` corría `npm ci` en una raíz sin `package.json` | 2026-10-25 | Matriz por paquete (`core`, `api`, `web`) con pnpm; trazabilidad en su propio job |
| T-005 | `scripts/_live.ts` sin seguimiento en git | 2026-10-25 | Script de prueba local; se ignora con `scripts/_*.ts` en `.gitignore` |
