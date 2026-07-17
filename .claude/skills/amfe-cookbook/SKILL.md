---
name: amfe-cookbook
description: Recetas prescriptivas para completar gaps en AMFEs Barack Mercosul. Tabla issue-type -> accion con ejemplos. Usar cuando Fak pida "completar AMFE", "reparar AMFE", "fill gaps", "fix AMFE gaps", "llenar faltantes". Complementa /audit-amfe y los auditores (que detectan) — este skill dice como fijar cada tipo de issue.
---

# AMFE Cookbook — Recetas para fijar gaps

Complementa `/audit-amfe` y los auditores read-only (diagnostico). Este skill responde "COMO completar cada tipo de gap detectado".

## Cuando usar

- Fak dice: "completa AMFE", "fill gaps", "reparar", "reparar AMFEs", "completa los faltantes"
- Hay un `tmp/we_placeholders_audit.json` con issues identificados
- Se va a ejecutar `scripts/_fixAmfePlaceholdersAndAllocation.mjs` (este skill es su referencia)
- Comando `/fix-amfe-gaps` fue invocado

## Flujo operativo

```
1. Diagnostico global:  node scripts/_auditAll.mjs --summary
2. Detalle placeholders: node scripts/_auditWePlaceholdersAndAllocation.mjs [--filter=X]
3. Revisar issues:      cat tmp/we_placeholders_audit.json
4. Dry-run del fix:     node scripts/_fixAmfePlaceholdersAndAllocation.mjs [--filter=X]
5. Aplicar fixes:       node scripts/_fixAmfePlaceholdersAndAllocation.mjs --filter=X --apply
6. Verificar:           node scripts/_auditAll.mjs --summary   (issues deben bajar)
7. Si contadores desync: resync con countAmfeStats() + saveAmfe extraFields (ver abajo)
```

## Tabla Issue-Type -> Accion

| IssueType | Accion | Automatizable | Fuente |
|---|---|---|---|
| `SUSPICIOUS_OP` ("Clasificacion y Segregacion") | BORRAR op + step PFD | Resuelto (one-off archivado) | reportar a Fak si reaparece |
| `INVALID_OP_CLIPS` (Telas Planas) | BORRAR op + step PFD | Resuelto (one-off archivado) | reportar a Fak si reaparece |
| `FN_TBD_OR_EMPTY` (placeholder name) | BORRAR WE | SI | Lista placeholders (ver abajo) |
| `FN_TBD_OR_EMPTY` (WE real) | PROPAGAR desde hermano | Parcial | Mapeo operacion -> AMFE (ver abajo) |
| `FN_NO_FAILURES` (placeholder) | BORRAR WE | SI | Lista placeholders |
| `FN_NO_FAILURES` (WE real) | PROPAGAR desde hermano | Parcial | Mapeo |
| `WE_NO_FN` (placeholder) | BORRAR WE | SI | Lista |
| `FM_NO_CAUSES` | PROPAGAR causa desde hermano con misma failure | Parcial | Mapeo |
| `CAUSE_MISSING_SOD` | MERGE no-destructivo desde hermano + `calculateAP()` | Parcial | Mapeo |
| `CAUSE_NO_AP` | Recalcular con `calculateAP(s,o,d)` | SI | Inline |
| `CAUSE_NO_PREV_CTRL` | Copiar control de hermano con misma causa | Parcial | Mapeo |
| `CAUSE_NO_DET_CTRL` | idem | Parcial | Mapeo |
| `FM_NO_EFFECT_LOCAL/NEXT/END` | Copiar efectos de hermano con misma failure | Parcial | Mapeo |
| `EMPTY_OP` | BORRAR si es placeholder; pedir dictado a Fak si es real | Mixto | Consulta Fak |

**Automatizable = SI**: `_fixAmfePlaceholdersAndAllocation.mjs` cubre placeholders/allocation; `CAUSE_NO_AP` se recalcula inline con `calculateAP()`.
**Parcial**: solo si hay fuente confiable (hermano con mismo nombre de WE + failures cargadas) — script one-off segun la receta de abajo, con `runWithValidation`, y OK de Fak antes de aplicar.
**Consulta Fak**: se reporta como SIN_FUENTE, requiere decision humana.

## Lista hardcoded de WE names placeholder (para BORRAR)

Estos aparecen repetidos en Insert/Armrest/Top Roll/IP_PADS — son copy-paste sin contenido tecnico real. Confirmados por Fak 2026-04-21.

```
Method / Methods (borrar siempre si 0 failures):
  - "Hoja de operaciones"
  - "Hojas de operaciones"
  - "Ayudas visuales"
  - "Ayuda visual"

Environment (borrar siempre si 0 failures):
  - "Iluminacion/Ruido, Ley 19587"
  - "Iluminación/Ruido, Ley 19587"
  - "Iluminacion/Ruido Ley 19587"
  - "Iluminación/Ruido Ley 19587"
```

Matching: usar `normalizeText()` de `amfeIo.mjs` (lowercase + NFD + trim). NO matchear exacto porque hay acentos inconsistentes.

## Mapeo operacion-tipo -> AMFE hermano fuente

Para gaps que son WE real (no placeholder), buscar fuente en estos AMFEs segun el tipo de operacion del gap.

| Tipo operacion (matching parcial en nombre) | AMFEs fuente prioridad 1 | AMFEs fuente prioridad 2 |
|---|---|---|
| RECEPCION / MATERIA PRIMA | `AMFE-MAESTRO-LOG-REC-001` (logistica) | cualquier AMFE con OP 10 cargada |
| COSTURA / COSER | `AMFE-HF-PAT`, `AMFE-HRC-PAT`, `AMFE-HRO-PAT` (Headrest) | `AMFE-2` OP "Costura de refuerzos" |
| TROQUELADO | `AMFE-2` OP 60 y OP 70 (Termoformadas) | `AMFE-INS-PAT` si aplica |
| INYECCION PLASTICA (termoplastico) | `AMFE-MAESTRO-INY-001` (family 15) | `AMFE-INS-PAT` OP 70, `AMFE-ARM-PAT` OP 60 |
| INYECCION PU / ESPUMADO | **Sin maestro** — pedir a Fak | Headrest OP ESPUMADO |
| TERMOFORMADO | `AMFE-2` OP 40 (Termoformadas) | `AMFE-TR-PAT` OP 40 |
| ADHESIVADO / HOT MELT | `AMFE-TR-PAT` OP 30 | `AMFE-INS-PAT` OP 90, `AMFE-ARM-PAT` OP 80 |
| SOLDADURA ULTRASONIDO | `VWA-PAT-IPPADS-001` OP 110 | Top Roll OP 80 |
| CONTROL FINAL DE CALIDAD | `AMFE-2` OP 100 | `AMFE-INS-PAT` OP 110 |
| EMBALAJE | `AMFE-2` OP 110 | `AMFE-INS-PAT` OP 110 |

**NOTA**: propagar SOLO si hermano tiene WE con el mismo nombre normalizado. No propagar "por similitud semantica" — eso requiere juicio humano.

## Reglas duras (NUNCA violar)

1. **NO inventar valores S/O/D** — si no hay hermano con SOD completo para la misma causa, reportar SIN_FUENTE.
2. **NO asignar CC/SC** — siempre `specialChar: ""` en causas nuevas. Autorizacion CC/SC solo por Fak explicitamente.
3. **NO completar acciones** — `preventionAction`, `detectionAction`, `responsible`, `targetDate`, `status`, `actionTaken`, `completionDate` quedan vacios. Regla `.claude/rules/amfe.md` §5.
4. **NO usar S*O*D** — siempre `calculateAP(s,o,d)` del helper `_lib/amfeIo.mjs`.
5. **NO propagar entre familias con proceso distinto**: inyeccion plastica != inyeccion PU. Verificar fallas/causas del hermano antes de propagar (regla `feedback_verify_content_not_name`).
6. **data es TEXT** — siempre `JSON.stringify(doc)` al escribir (helper `saveAmfe` lo hace automatico). Regla `feedback_amfe_data_is_text`.
7. **NO borrar OPs completas con contenido** — solo BORRAR a nivel de WE (work element), no de operacion. (Los casos historicos `SUSPICIOUS_OP` / `INVALID_OP_CLIPS` se resolvieron con one-offs hoy en `scripts/_archive/`; si reaparecen, reportar a Fak.)
8. **Merge NO-destructivo**: al llenar gaps, preservar valores ya existentes en el target. Solo rellenar campos vacios/null.

## Ejemplo de uso — fijar un gap `CAUSE_MISSING_SOD`

```js
import {
  connectSupabase, readAmfe, saveAmfe, findOperation, findWorkElement,
  findFailure, findCauseByText, calculateAP, normalizeText
} from './_lib/amfeIo.mjs';

const sb = await connectSupabase();
const target = await readAmfe(sb, '<target-id>');
const source = await readAmfe(sb, '<sibling-id>');

// Para cada causa con SOD incompleto:
for (const op of target.doc.operations) {
  for (const we of op.workElements || []) {
    for (const fn of we.functions || []) {
      for (const fm of fn.failures || []) {
        for (const cause of fm.causes || []) {
          if (cause.severity != null && cause.occurrence != null && cause.detection != null) continue;

          // Buscar misma causa en sibling
          const srcOp = findOperation(source.doc, op.opNumber || op.operationNumber);
          if (!srcOp) continue;
          const srcWe = findWorkElement(srcOp, we.name);
          if (!srcWe) continue;
          const srcFm = srcWe.functions
            ?.flatMap(f => f.failures || [])
            .find(x => normalizeText(x.description) === normalizeText(fm.description));
          if (!srcFm) continue;
          const srcCause = findCauseByText(srcFm.causes, cause.cause || cause.description);
          if (!srcCause) continue;

          // Merge no-destructivo (solo rellena vacios)
          if (cause.severity == null) cause.severity = srcCause.severity;
          if (cause.occurrence == null) cause.occurrence = srcCause.occurrence;
          if (cause.detection == null) cause.detection = srcCause.detection;
          if (!cause.preventionControl) cause.preventionControl = srcCause.preventionControl;
          if (!cause.detectionControl) cause.detectionControl = srcCause.detectionControl;

          // Recalcular AP oficial
          const ap = calculateAP(cause.severity, cause.occurrence, cause.detection);
          cause.actionPriority = ap;
          cause.ap = ap;
        }
      }
    }
  }
}

await saveAmfe(sb, '<target-id>', target.doc, { expectedAmfeNumber: '<expected>' });
```

## Campos double-aliased (OBLIGATORIO escribir ambos)

Al crear nuevas estructuras, llenar AMBOS alias — el TS y el export Excel usan distintos.

- `opNumber` + `operationNumber` (misma op)
- `name` + `operationName` (misma op)
- `description` + `functionDescription` (misma function)
- `cause` + `description` (misma cause — texto)
- `ap` + `actionPriority` (misma cause — AP calculado)

Ver regla `.claude/rules/amfe.md` seccion "Schema de campos AMFE".

## Checklist post-apply

Despues de `_fixAmfePlaceholdersAndAllocation.mjs --apply` (o de un one-off de propagacion):

- [ ] Correr `node scripts/_auditAll.mjs --summary` (confirmar que issues bajaron)
- [ ] Si `_auditAll` reporta operation_count/cause_count desync: resync con
      `countAmfeStats(doc)` de `_lib/amfeIo.mjs` + `saveAmfe(sb, id, doc, { extraFields: { operation_count, cause_count } })`
      (no existe script dedicado de resync)
- [ ] Verificar que los items `SIN_FUENTE` estan reportados a Fak (no se tocaron silenciosamente)
- [ ] Backup post-fix: `node scripts/_backup.mjs` (opcional — `supabase-guard.sh` ya corre backup pre-apply)
- [ ] Si el fix fue grande: `git add scripts/ && git commit -m "..."` (trazabilidad de scripts generados)

## Relacionado

- `.claude/commands/audit-amfe.md` — diagnostico (detecta)
- `.claude/skills/supabase-safety/SKILL.md` — protocolo backup/dry-run
- `.claude/skills/apqp-schema/SKILL.md` — estructura JSON documentos APQP
- `.claude/agents/amfe-healer.md` — agent que orquesta este flujo
- `.claude/commands/fix-amfe-gaps.md` — comando user-facing
- `scripts/_lib/amfeIo.mjs` — helpers I/O + `calculateAP` + `countAmfeStats`
- `scripts/_fixAmfePlaceholdersAndAllocation.mjs` — ejecutor automatico
- `scripts/_archive/_autoHeal.mjs` — ejecutor viejo (HISTORICO; conserva el mapeo operacion→AMFE fuente)
- `.claude/rules/amfe.md` — regla AMFE consolidada (§4 placeholder AP=H, §5 acciones)
- skill `amfe-domain` — detalle profundo (funciones, placeholders, SQL de auditoria)
