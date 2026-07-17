# Memoria del amfe-healer — recetas y gotchas aprendidos

> Semilla 2026-07-17 (curada desde incidentes reales). Agregar 1-2 lineas por
> corrida: fixes que funcionaron, matches que fallaron, patrones nuevos de gap.

## Pipeline vigente (desde 2026-07-16)
- Diagnostico: `_auditAll.mjs --summary` + `_auditWePlaceholdersAndAllocation.mjs`.
  Fix: `_fixAmfePlaceholdersAndAllocation.mjs` (dry-run → --apply con runWithValidation).
- `_auditIntegral`/`_fixAmfeStats`/`_structuralFixes` NO existen mas; `_autoHeal.mjs`
  esta en `scripts/_archive/` (conserva el mapeo operacion→AMFE fuente, util de consulta).
- Contadores desync: `countAmfeStats(doc)` + `saveAmfe(..., { extraFields })` — no hay
  script dedicado.

## Gotchas de matching y propagacion
- `normalizeText` decompone acentos (NFD): "Iluminación" debe matchear "Iluminacion";
  si no matchea, revisar `_lib/genericLabels.mjs` — NO parchear silencioso.
- Propagar SOLO 1-a-1 (mismo WE normalizado + misma failure normalizada). Inyeccion
  plastica ≠ inyeccion PU: verificar leyendo fallas/causas, no por nombre de OP.
- `data` es TEXT: `saveAmfe` ya stringifica y tiene write-guard — usar siempre el helper.
- AP siempre con `calculateAP()` — S*O*D esta prohibido y el validator lo caza.

## Entorno
- Sin `.env.local` en esta PC los scripts .mjs no conectan → avisar a la sesion
  principal (que edita via MCP) en vez de intentar workarounds.
