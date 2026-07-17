---
name: fix-amfe-gaps
description: Completar gaps en AMFEs de Barack Mercosul. Corre audit, clasifica gaps, aplica fixes seguros (placeholders + propagacion desde hermanos) y reporta lo que requiere decision humana. Usar cuando Fak pida "completar AMFE", "reparar", "fill gaps", "fix AMFE". Complementa `/audit-amfe` (que solo diagnostica).
---

# /fix-amfe-gaps — Reparar gaps en AMFEs

Invoca el agent `amfe-healer` para ejecutar el flujo completo de correccion de gaps.

## Uso

```
/fix-amfe-gaps                  # todos los AMFEs
/fix-amfe-gaps TELAS_PLANAS     # filtra por nombre de producto
/fix-amfe-gaps AMFE-HF-PAT      # filtra por amfe_number
/fix-amfe-gaps ARMREST          # filtra por match parcial en project_name
```

## Que hace

1. Carga el agent `amfe-healer` con el target especificado en `$ARGUMENTS`.
2. El agent corre el pipeline vivo:
   - `scripts/_auditAll.mjs` → diagnostico integral (read-only, todos los checks del validator)
   - `scripts/_auditWePlaceholdersAndAllocation.mjs` → detalle de placeholders y failures mal alocados
   - `scripts/_fixAmfePlaceholdersAndAllocation.mjs` → dry-run del fix automatico
3. Reporta el plan a Fak (BORRAR / RENOMBRAR / MOVER + lo que queda SIN_FUENTE).
4. Con OK de Fak, aplica con `--apply` (pasa por `runWithValidation`).
5. Verifica con nuevo `_auditAll.mjs` y reporta cuantos issues se resolvieron.

Gaps SIN fix automatico (S/O/D faltantes, causas, efectos): el agent los reporta
agrupados. Si existe hermano fuente 1-a-1, propone un script one-off segun la
receta del skill `amfe-cookbook` (siempre con `runWithValidation`) y espera OK.

## Diferencia con `/audit-amfe`

- `/audit-amfe` = SOLO lectura, reporta problemas (no modifica nada).
- `/fix-amfe-gaps` = audit + propone + (con OK) aplica fixes.

Flujo tipico: primero `/audit-amfe` para entender, despues `/fix-amfe-gaps` para ejecutar.

## Ejecucion

Invocar el subagent `amfe-healer` con el argumento $ARGUMENTS como target:

- Si `$ARGUMENTS` esta vacio: target = "todos"
- Si `$ARGUMENTS` parece un amfe_number (formato AMFE-XXX-YYY): pasarlo tal cual
- Si `$ARGUMENTS` es un nombre de producto: el agent lo resolvera via `listAmfes()`

El agent sigue su protocolo obligatorio (audit → dry-run → reportar plan → esperar OK → apply → verificar).
