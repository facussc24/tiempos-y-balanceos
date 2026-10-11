# presupuesto-agentes (P33)

Mod de Claude Code (probado contra la app de escritorio 2.1.293, Windows 11) que hace en `agent.spawn` lo mismo que `~/.claude/hooks/agentes-guard.sh` (regla `.claude/rules/techo-agentes.md`) y una cosa mas: pesa cada subagente por costo (haiku 1, sonnet 4, opus 8, fable 20), suma la ventana de 10 min (40 puntos) y ADEMAS niega cuando el cupo real esta por encima del 85 % de la ventana de 5 h o del 60 % de la semanal (ese freno no tiene escape por archivo: es lo que evita otro 06/08). La auditoria final (`auditor`, `auditor-cliente`) pasa siempre y no descuenta. Falla cerrado (`FALLA_CERRADA` en `hooks/register.js`). En `turn.step`, un subagente que pida `effort: max` se rebaja a `xhigh`.

- Politica pura: `hooks/presupuesto.mjs` (sin `$`). Test: `__tests__/mods/presupuesto-agentes.test.mjs`.
- Cascara: `hooks/register.js` (`session.start`, `agent.spawn`, `session.measure`, `turn.step`).
- Libro: `$.store`, clave `lanzamientos` (reemplaza `~/.claude/.agent-spawns.log`). Registro: `~/.claude/mods-log/presupuesto-agentes.log`.
- Escapes: los mismos archivos que el bash (`~/.claude/.agent-limit`, `.agent-opus-ok`, `.agent-builtin-ok`), 12 h; vencidos se ignoran, no se borran. `.workflow-ok` no aplica: Workflow no pasa por `agent.spawn`, lo sigue tapando `disableWorkflows: true`.

## Instalar (recien cuando recordatorio-ccsc lleve dos dias de registro coherente)

```bash
mkdir -p ~/.claude/mods ~/.claude/mods-log
rm -rf ~/.claude/mods/presupuesto-agentes && cp -r /c/Dev/BarackMercosul/mods/presupuesto-agentes ~/.claude/mods/
