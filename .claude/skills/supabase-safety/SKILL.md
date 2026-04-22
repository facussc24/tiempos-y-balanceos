---
name: supabase-safety
description: Protocolo de seguridad para modificar datos en Supabase sin perderlos. Uso obligatorio antes de correr cualquier script .mjs que toque amfe_documents, cp_documents, ho_documents, pfd_documents, family_documents, products. Incluye backup, dry-run, restore y checklist de errores tipicos.
user-invocable: false
---

# Supabase Safety — Protocolo para NO perder datos

## Cuando cargar esta skill

- Vas a crear o modificar un script `.mjs` en `scripts/` que toca Supabase.
- Vas a correr un script existente con `--apply`.
- Hay que recuperar datos borrados o rotos.
- Fak reporta "perdiste data" o "se rompio algo en la base".

## Reglas absolutas (NO ROMPER)

### 1. Dry-run por default, --apply explicito
Todo script nuevo debe arrancar en modo simulacion. Ejecuta cambios SOLO con `--apply`. Usar `scripts/_lib/dryRunGuard.mjs`:

```js
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
const { apply } = parseSafeArgs();
// ... iterar docs ...
logChange(apply, `update ${doc.id}`, { before: x, after: newX });
if (apply) { await sb.from('amfe_documents').update(...).eq('id', doc.id); }
finish(apply);
```

### 2. Backup automatico antes de escribir
El hook `.claude/hooks/supabase-guard.sh` corre `_backup.mjs` antes de CUALQUIER comando que matchee:
- `node scripts/_fix*`, `_sync*`, `_delete*`, `_clean*`, `_reset*`, `_reseed*`, `_propagate*`, `_apply*`, `_seed*`, `_migrate*`
- cualquier `.mjs` con flag `--apply`

Si el backup falla, el comando se bloquea. No hay que recordar correrlo.

### 3. NUNCA double-serializar JSONB
Las columnas `data` son JSONB. Pasar el OBJETO directo:
```js
// CORRECTO
await sb.from('amfe_documents').update({ data: obj }).eq('id', id);
// INCORRECTO — convierte a string dentro de JSONB
await sb.from('amfe_documents').update({ data: JSON.stringify(obj) }).eq('id', id);
```
Verificar despues: `typeof row.data === 'object'`. Si es `string`, esta roto.

### 4. NUNCA DELETE directo si hay alternativa
Preferir UPDATE con un flag (ej `deleted_at`, `archived: true`) sobre DELETE. Los DELETE son irreversibles salvo por backup.

### 5. NUNCA borrar filas que existen pero no estan en el backup
`_restore.mjs` usa upsert, no truncate + insert. Si la fila existe en Supabase pero no en el backup, NO se toca. Esto previene que restaurar un backup viejo borre trabajo reciente.

## Herramientas disponibles

### Backup manual
```bash
node scripts/_backup.mjs
```
Guarda snapshot de 12 tablas en `backups/<timestamp>/`. Lo corre solo el hook en casos destructivos, pero se puede forzar manualmente antes de cualquier cambio riesgoso.

### Listar backups
```bash
node scripts/_restore.mjs --list
```

### Restore completo (todas las tablas)
```bash
# Dry-run primero
node scripts/_restore.mjs 2026-04-20T19-42-58
# Ejecutar
node scripts/_restore.mjs 2026-04-20T19-42-58 --apply
```
Antes de aplicar, `_restore.mjs` toma un snapshot `pre-restore-*` automatico. Si el restore sale mal, restaurar desde ese pre-restore.

### Restore de UNA tabla
```bash
node scripts/_restore.mjs 2026-04-20T19-42-58 amfe_documents --apply
```

### Helper para scripts nuevos
```js
import { parseSafeArgs, logChange, finish } from './_lib/dryRunGuard.mjs';
```

### Gate pre-commit OBLIGATORIO (scripts que modifican `data` de amfe_documents)

Todo script `.mjs` que escriba a `amfe_documents.data` DEBE pasar por `runWithValidation()`. El gate valida el estado before/after y **bloquea el --apply si introduce issues criticos nuevos** (failures sin causas, causas sin S/O/D, operaciones vacias, etc.).

```js
import { connectSupabase, readAmfe, parseData } from './_lib/amfeIo.mjs';
import { parseSafeArgs, runWithValidation, finish } from './_lib/dryRunGuard.mjs';

const { apply } = parseSafeArgs();
const sb = await connectSupabase();

// 1) Leer docs y preparar cambios SIN escribirlos
const plan = [];
for (const targetId of myTargets) {
    const { doc: before, amfe_number } = await readAmfe(sb, targetId);
    const after = applyChanges(before);  // tu logica
    plan.push({
        id: targetId,
        amfeNumber: amfe_number,
        productName,
        before,
        after,
    });
}

// 2) Pasar por el gate. Si --apply y hay criticos nuevos → bloquea con exit 1
await runWithValidation(plan, apply, async () => {
    // commitFn: SOLO se llama si apply=true y el gate aprueba
    for (const change of plan) {
        await saveAmfe(sb, change.id, change.after);
    }
});

finish(apply);
```

**Override:** si el script intencionalmente deja algunos issues (ej: placeholder para que el equipo APQP complete), usar `{ allowNewCritical: true }` como cuarto argumento y documentar por que.

**Demo ejecutable:** `scripts/_demoValidator.mjs` (read-only, no escribe nada) muestra el flujo con cambios inocuo/warning/critico contra un AMFE real.

**Detalle de los checks:** `scripts/_lib/amfeValidator.mjs` — replica la logica de `_auditIntegral.mjs` (single source of truth: si se agrega un check alla, actualizar aca).

## Flujo recomendado para cambios riesgosos

1. **Backup manual primero** (aunque el hook lo hace, doble seguro no duele):
   ```bash
   node scripts/_backup.mjs
   ```
2. **Correr el script en dry-run**:
   ```bash
   node scripts/_miFix.mjs
   ```
3. **Leer el diff propuesto**. Si hay cambios que no deberian ocurrir, CORREGIR el script antes de aplicar.
4. **Aplicar**:
   ```bash
   node scripts/_miFix.mjs --apply
   ```
5. **Verificar post-script**:
   - `typeof doc.data === 'object'` para cada doc modificado
   - `Array.isArray(doc.data.operations)` (AMFE), `.items` (CP), `.sheets` (HO), `.steps` (PFD)
   - Contar operaciones / items / sheets y comparar con lo esperado
6. **Test visual en la app** (abrir el doc en la UI).

## Checklist de errores tipicos (antes de cerrar tarea)

| # | Check | Como detectarlo |
|---|-------|----------------|
| 1 | `data` como string (double-serialization) | `typeof row.data === 'object'` debe ser true |
| 2 | Campos borrados silenciosamente | Comparar counts antes/despues: operations, failures, causes |
| 3 | AP recalculado con formula mala | Usar `calculateAP(s, o, d)` de `modules/amfe/apTable.ts`. Nunca `S*O*D` |
| 4 | Nombres de campo incorrectos | AMFE: `opNumber` Y `operationNumber`; `ap` Y `actionPriority`; `cause` Y `description` (ambos alias) |
| 5 | Propagar maestro equivocado | Leer fallas/causas del producto destino antes de propagar. Inyeccion plastica != PU |
| 6 | Inventar valores numericos | Pesos, temperaturas, tolerancias: TBD si no hay confirmacion de Fak |
| 7 | Inventar acciones de optimizacion | Solo el equipo APQP humano define acciones. Ver `amfe-actions.md` |
| 8 | Clasificar CC/SC sin autorizacion | No asignar sin confirmacion explicita. Ver `amfe.md` |

## Recuperacion de incidentes ya conocidos

| Incidente | Patron de fix |
|-----------|---------------|
| Columna de severidad borrada en N AMFEs | `_restore.mjs <ts> amfe_documents --apply` desde backup previo al incidente |
| Double-serialization | Fix programatico: `if (typeof row.data === 'string') row.data = JSON.parse(row.data)` + update |
| AP mal calculado | Re-correr generador con `calculateAP` oficial |
| Script propago datos a familia incorrecta | Restore de esa familia desde backup + verificar maestro correcto |

## Tablas cubiertas por backup/restore

`amfe_documents`, `cp_documents`, `ho_documents`, `pfd_documents`,
`product_families`, `product_family_members`, `family_documents`,
`family_document_overrides`, `family_change_proposals`,
`products`, `customer_lines`, `settings`.

Si se agrega una tabla nueva a Supabase, **actualizar la lista `tables` en `scripts/_backup.mjs`**.

## Como detectar mas errores a futuro

1. Cada vez que se rompe algo, agregar el patron de deteccion a la tabla del checklist arriba.
2. Si el patron es automatizable, agregarlo a `_auditAmfeIntegrity.mjs` / `_auditFinal*.mjs` y correrlo como paso de CI.
3. Los scripts de auditoria (`_audit*.mjs`) son read-only — se pueden correr siempre sin miedo.
4. Si un incidente es reproducible, convertirlo en test en `__tests__/`.

## Links internos

- `scripts/_backup.mjs` — backup completo
- `scripts/_restore.mjs` — restore desde backup
- `scripts/_lib/dryRunGuard.mjs` — helpers para scripts nuevos
- `.claude/hooks/supabase-guard.sh` — hook auto-backup
- `.claude/rules/database.md` — reglas de persistencia
- `.claude/skills/apqp-schema/SKILL.md` — schema detallado de tablas APQP
