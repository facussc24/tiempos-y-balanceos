# Auditoria Propagacion Cross-Family — 2026-04-10

Auditor: `propagation-auditor`
Feature: Fase 2 cross-family propagation (process-master AMFE -> product AMFEs)
Alcance: edge cases, robustez, regresiones.

## Resumen ejecutivo

| Categoria | Cantidad |
|-----------|----------|
| TRUE BUG | 2 |
| ROBUSTNESS | 9 |
| FALSE POSITIVE del matcher | 1 (confirmada con datos reales) |

Estado para produccion: **APTO con salvedades** — no encontre bugs bloqueantes ni regresiones. Los dos TRUE BUGs son defectos de comportamiento observable en escenarios comunes (supresion de ruido al guardar sin cambios reales) y no corrompen datos ni rompen guardado. El matcher tiene un false positive real (INYECCION PU) que ya se ve en produccion con el master de inyeccion actual.

## Tests y TS

- `npx vitest run __tests__/core/inheritance/` → **17/17 PASS**.
- `npx vitest run __tests__/utils/crossDocumentAlerts.test.ts __tests__/crossDocumentAlerts.test.ts __tests__/hooks/useRevisionControl.test.ts` → **38/38 PASS** (APQP cascade y revision control intactos).
- `npx tsc --noEmit` → 0 errores nuevos. Los unicos errores son pre-existentes en `modules/CavityCalculator/index.tsx` (9 errores, no relacionados con propagation).
- E2E `scripts/testInjectionPropagation.mjs` corrido **2 veces consecutivas** con scanned=9, affected=7, revert=OK, cleanup=OK en ambas.

## Edge cases

### E1. Master sin cambios (JSON identico)

**Finding: ROBUSTNESS.**

El flujo de `doSaveHierarchical` en `modules/amfe/useAmfeProjects.ts:377-436` dispara `triggerCrossFamilyPropagation` **cada vez que se guarda el maestro**, sin mirar si `JSON.stringify(oldDoc) === JSON.stringify(newDoc)`. Si el usuario abre el master y guarda sin cambiar nada, la funcion corre y:

1. `propagateMasterAcrossFamilies` siempre escanea todos los otros AMFEs.
2. Por cada AMFE con operaciones que matchean (hoy 7 de 9), llama `createCrossFamilyAlert`.
3. `createCrossFamilyAlert` llama a `upsertCrossDocCheck` con `sourceUpdated = new Date().toISOString()` (timestamp distinto cada vez).
4. La UNIQUE key es `(source_module, source_doc_id, target_module, target_doc_id)`, asi que no se duplican filas, pero cada run **resetea `acknowledged_at = NULL`** (ver `utils/repositories/crossDocRepository.ts:58-63`).

Consecuencia: si un usuario afectado ya habia descartado la alerta, al ser tocado el maestro incluso sin cambios reales, la alerta **re-aparece** en el banner. El sistema es idempotente en filas pero NO en estado de reconocimiento. Combinado con E2 (cambio cosmetico) y con el uso legitimo de "abrir y guardar para refrescar", esto produce fatiga de alertas.

**Mitigacion recomendada:** antes de `await createCrossFamilyAlert`, comparar los normalized masterOpNames de `oldDoc` vs `newDoc` y hacer no-op si no cambio el conjunto de operaciones. (El scanner ya tiene ambos docs disponibles en params).

Evidencia: `core/inheritance/changePropagation.ts:459-529`, `utils/repositories/crossDocRepository.ts:58-63`.

### E2. Master con cambio cosmetico (solo header)

**Finding: TRUE BUG #1.**

Ver E1. El scanner `propagateMasterAcrossFamilies` lee **solo** las operation names de `newDoc` (via `extractMasterOperationNames`) y nunca compara contra `oldDoc`. `oldDoc` entra por parametro pero jamas se lee — comentario en la linea 448-449 lo reconoce: *"Kept for symmetry with intra-family propagation even though cross-family scan is content-agnostic"*.

Resultado: al guardar el maestro con un solo cambio en `header.scope` o `header.revisionLevel`, todos los AMFEs target reciben alertas nuevas (con `acknowledged_at = NULL`) aunque el contenido que les importa — las operaciones — no cambio.

El E2E real confirma el bug: el script cambia solo `header.subject` (cosmetico puro), y el resultado es 7 alertas creadas. Ningun usuario quiere 7 alertas por renombrar un AMFE.

**Impacto:** ruido constante en el banner de alertas. Los usuarios de las 7 familias target veran un triangulo amarillo cada vez que alguien toque el header del maestro. Como el master de inyeccion esta siendo creado/corregido activamente (ver `project_pwa_audit_2026_04_06.md`), esto **va a ocurrir en la primera semana de uso**.

**Fix sugerido:** en `propagateMasterAcrossFamilies`, despues de extraer `masterOpNames` del `newDoc`, extraer tambien de `oldDoc` con la misma helper. Si los dos sets son iguales (en contenido normalizado) y oldDoc tenia >= 1 op, early return con `empty`. Costo: un Set.equals ligero, sin queries adicionales.

Evidencia: `core/inheritance/changePropagation.ts:443-478` (oldDoc nunca se toca).

### E3. Master con eliminacion de operacion

**Finding: ROBUSTNESS.**

Si el usuario borra la operacion "INYECCION" del maestro, el scanner busca las ops del `newDoc` (ya sin "INYECCION") contra los targets. Los targets que tenian operaciones tipo "INYECCION DE SUSTRATO" dejan de matchear → no se genera alerta → el usuario de Headrest nunca sabe que la operacion que estaba modelada en el maestro fue eliminada.

Esto es un **silencio incorrecto**: eliminar del maestro es un cambio mas importante que modificarlo, y merece alerta. Hoy es invisible.

**Fix sugerido:** calcular `removedMasterOps = oldOps - newOps` (set diff). Para cada AMFE target que tenia matches contra `removedMasterOps`, crear alerta indicando eliminacion. Requiere extraer `masterOldOpNames` del `oldDoc` (mismo helper) + pasar los removed al loop de scan.

Evidencia: `core/inheritance/changePropagation.ts:472-478`.

### E4. Master con agregado de operacion

**Finding: ROBUSTNESS (menor).**

Al agregar OP 40 al maestro, el scanner escanea todos los targets. Un target que no tiene la nueva op simplemente no matchea y no recibe alerta. Esto es silencioso pero menos grave que E3: el target puede no necesitar esa operacion nueva (no todas las variantes la tienen). Sin embargo, si el maestro es un "Proceso de X" que dicta que **toda variante debe tener** esa op, el silencio vuelve a ser incorrecto.

**Fix sugerido:** fuera de alcance para Fase 2. Documentar como limitacion conocida. Para un usuario que quiera "oportunidad de agregar" habria que cambiar la semantica de alerta de *cambio* a *gap*, distinto nivel de producto.

### E5. Producto con override intra-family AND operacion cross-family matcheando

**Finding: ROBUSTNESS. No hay conflicto real pero hay acoplamiento debil.**

El flujo en `doSaveHierarchical` (lineas 407-423) dispara TRES triggers en serie y fire-and-forget cuando se guarda un AMFE:

1. `triggerOverrideTracking` → escribe a `family_document_overrides` (solo si es variante).
2. `triggerChangePropagation` → escribe a `family_change_proposals` (solo si es master de su familia).
3. `triggerCrossFamilyPropagation` → escribe a `cross_doc_checks` (solo si es master de una familia tipo "Proceso de").

Las tres tablas son disjuntas. Un mismo save nunca corre los tres utilmente porque las gates (variant vs master, proceso vs no-proceso) son excluyentes. El caso de E5 — "un producto con override intra-family y cross-family matcheando" — no existe porque el producto que tiene override intra-family es una **variante**, y las variantes **no disparan** `triggerCrossFamilyPropagation` (gate `!familyInfo.isMaster` en la linea 558 de `changePropagation.ts`).

No hay bug, pero el lector del codigo facilmente puede confundir los 3 triggers. **Recomendacion:** un comentario en `useAmfeProjects.ts` aclarando "estas 3 corren en serie intencional, son mutuamente excluyentes por gates internas".

Evidencia: `core/inheritance/changePropagation.ts:556-570`.

### E6. Duplicados en cross_doc_checks (upsert)

**Finding: OK.**

Corri el E2E dos veces consecutivas. Resultado en ambas: `rows upserted: 7`, `new: 7` (despues del cleanup), `cleanup OK`. La unique key `(source_module, source_doc_id, target_module, target_doc_id)` en `cross_doc_checks` (ver `utils/database.ts:251`) previene duplicados tanto en el insert del script como en el `upsertCrossDocCheck` de TS (usa `ON CONFLICT ... DO UPDATE`).

Sin embargo ver E1: el upsert resetea `acknowledged_at` a NULL, lo cual es correcto cuando hay cambio real, pero problematico cuando no lo hay.

Evidencia: `utils/database.ts:242-252`, `utils/repositories/crossDocRepository.ts:55-68`, E2E run x2.

### E7. Fire-and-forget swallowing errors

**Finding: OK.**

`triggerCrossFamilyPropagation` envuelve todo en `void (async () => { try { ... } catch { ... } })()`. El `catch` llama a `logger.error` y NO re-lanza. La funcion retorna `void` antes del await, asi que ni siquiera propagar la promise. Test unitario `never throws when the database throws` (crossFamilyPropagation.test.ts:341-349) cubre exactamente este caso y pasa.

Ademas `createCrossFamilyAlert` internamente tiene su propio try/catch que retorna `false` en caso de falla (ver `utils/crossDocumentAlerts.ts:121-148`). Double-catch: el save del usuario nunca puede romperse por fallas en alertas.

Evidencia: `core/inheritance/changePropagation.ts:548-585`.

### E8. Performance / escalabilidad

**Finding: ROBUSTNESS.**

`propagateMasterAcrossFamilies` hace `SELECT id, subject, project_name, data FROM amfe_documents WHERE id != ?` — full table scan. Hoy 10 AMFEs, OK. A 100 AMFEs: cada uno carga su `data` JSONB completo (decenas a cientos de KB), se parsea con `JSON.parse`, y se itera sobre `operations[]`. A 1000 AMFEs esto se convierte en un "pause" de varios segundos cada vez que se guarda el master.

Ademas el SELECT descarga **el JSON entero** cuando solo necesita `operations[].name/operationName`. Un Postgres funcional podria proyectar con `data->'operations'` pero el codigo lee `data` completo.

**Mitigaciones:**
1. Reducir el SELECT a solo columnas minimas: si Supabase soporta `select('id, subject, project_name, data->operations')`, usar solo el subarbol. Check manual.
2. Agregar filtro preliminar: solo AMFEs cuya `cliente`/`familia` pueda contener procesos similares (dificil sin schema mas fuerte).
3. Marcar en logs cuando `rows.length > 50` como advertencia.

Por ahora: no bloqueante. El comentario en linea 80 del codigo ya reconoce esto: *"Never touches the family_change_proposals table"*. Documentar como O(n) en el codigo.

Evidencia: `core/inheritance/changePropagation.ts:481-484`.

### E9. Colision con cascada APQP existente

**Finding: ROBUSTNESS (semantica, no tecnica).**

La cascada APQP existente (`APQP_CASCADE` en `utils/crossDocumentAlerts.ts:32-36`) define:

```
pfd  -> amfe
amfe -> cp, ho, pfd
cp   -> ho
```

La nueva feature crea filas con `source_module='amfe'` **y** `target_module='amfe'`. Esta combinacion **no existe** en la cascada APQP tradicional (amfe nunca se apunta a si mismo en el mapa). Por lo tanto:

- Las unique keys no colisionan (pares `(amfe, X, amfe, Y)` donde X != Y son exclusivos de cross-family).
- El hook `useCrossDocAlerts` abre un target y lee todas las filas con `target_module=amfe AND target_doc_id=<doc>`. Hoy, la UI no distingue si una fila viene de cascada o de cross-family.

**Problema semantico:** `detectCrossDocAlerts` (utils/crossDocumentAlerts.ts:66-88) genera el mensaje en base a `sourceModule` solamente:

> `"El documento AMFE fue actualizado a Rev. A. Revise si este documento necesita actualizarse."`

Para alertas cross-family, el source **tambien** es un AMFE (el master), pero de otra familia, y la relacion no es "cascada APQP" (AIAG) sino "process-master". Un operador viendo esto en el banner de un AMFE de producto **no sabe** que el cambio viene de un proceso externo a su producto. Relacionado con E10 y E12.

**Recomendacion:** extender el schema de `cross_doc_checks` con una columna `alert_type TEXT DEFAULT 'cascade'` o `details JSONB`, y en el TODO de la linea 104 de `crossDocumentAlerts.ts` ya esta anotado: *"add a details column to cross_doc_checks to carry matched op names and the originating process-family name"*. Hasta que esa migracion ocurra, la UX es ambigua.

Evidencia: `utils/crossDocumentAlerts.ts:71-83`, `utils/crossDocumentAlerts.ts:96-107` (TODO reconocido).

### E10. UI render de los nuevos registros

**Finding: ROBUSTNESS.**

`CrossDocAlertBanner.tsx` muestra TODAS las alertas como `<div className="bg-amber-50 ..."><AlertTriangle size={16} className="text-amber-500" />...`. No hay icon ni color diferenciado para cross-family. El mensaje es el mismo "El documento AMFE fue actualizado a Rev. X".

El usuario abre un AMFE de Headrest y ve: *"El documento AMFE fue actualizado a Rev. A. Revise si este documento necesita actualizarse."* — y no entiende si se trata de otro AMFE de headrest (nunca, porque headrest no tiene otra variante AMFE en la misma familia con cross-doc) o de un proceso externo (inyeccion plastica).

Hoy, con 9 AMFEs y un solo process-master (inyeccion), el bug no causa confusion (es el unico caso). Al agregar otros process-masters (soldadura, termoformado), el usuario no va a saber cual se toco.

**Mitigacion temporaria:** incluir el `projectName` o el `familyName` del source en el mensaje. Requiere join contra `amfe_documents` o `product_families` al leer, o que el source venga con una etiqueta. Fuera de alcance de Fase 2; documentar como limitacion.

Evidencia: `components/ui/CrossDocAlertBanner.tsx:20-55`, `utils/crossDocumentAlerts.ts:71-83`.

### E11. Falsos positivos del matcher

**Finding: 1 FALSE POSITIVE confirmada con datos reales + varios casos hipoteticos OK.**

**Test mental con datos ficticios:**
- Master "INYECCION" vs target "INYECCION DE PIEZAS PLASTICAS" → match. **CORRECTO** (inyeccion de plastico).
- Master "INYECCION" vs target "INYECCION DE SUSTRATO" → match. **CORRECTO** (es inyeccion plastica).
- Master "CONTROL DIMENSIONAL POST-INYECCION Y CORTE DE COLADA" (7 palabras) vs target "CONTROL FINAL DE CALIDAD" → **NO match** (CORRECTO, tokens distintos).
- Master "RECEPCION Y PREPARACION DE MATERIA PRIMA" vs target "RECEPCION DE MATERIA PRIMA" → **NO match**. Problema: el master es mas largo que el target, entonces la regla "master como whole-word substring de target" falla. El scanner **NO detecta** que es la misma operacion con ligero rewording en la direccion inversa.

  Esto es una ROBUSTNESS secundaria: el E2E actual muestra que ningun AMFE de producto tiene "RECEPCION Y PREPARACION" — todos dicen "RECEPCION DE MATERIA PRIMA". El master tiene la version larga. Como resultado, **el master nunca genera alerta sobre la op de recepcion**. La evidencia del E2E lo confirma: los 7 matches son todos por "INYECCION", ninguno por la operacion de recepcion. Si Fak cambia algo en la recepcion del master, nadie se entera.

**Test con datos REALES (E2E run):**

Output de la corrida:
```
- Proceso de fabricación - Armrest Door Panel  [5268704d-...]
    matched op: "INYECCION DE PIEZAS PLASTICAS"
    matched op: "INYECCION PU"
```

**FALSE POSITIVE confirmado:** "INYECCION PU" es inyeccion de poliuretano (espuma), proceso completamente distinto a inyeccion de plastico. El master es "Proceso de Inyeccion **Plastica**" y el matcher lo empareja con una operacion PU porque la regla 2 (whole-word substring) matchea "INYECCION" como token dentro de "INYECCION PU".

Impacto practico en este run: Armrest ya hubiera sido afectado por "INYECCION DE PIEZAS PLASTICAS" (match legitimo), asi que el conteo `affectedDocs=7` no varia. Pero la lista `matchedOperationNames` de Armrest contiene un nombre spurio ("INYECCION PU") que, si se muestra al usuario en el futuro (cuando se agregue la columna `details`), va a ser confuso.

**Peligro latente:** si alguna familia tuviera SOLO "INYECCION PU" y ninguna otra inyeccion plastica, recibiria una alerta falsa completa. Hoy no ocurre por la composicion de los AMFEs, pero el matcher no previene el caso.

**Fix sugerido:** agregar una blocklist de sufijos semanticamente distintos. Si el target es `"INYECCION X"` y X esta en `{PU, POLIURETANO, ESPUMA}`, rechazar el match. O inferior, exigir que el token siguiente al nombre del master no sea uno de esos modificadores.

Ordenado: **TRUE BUG #2** (la falsa positiva real en datos de produccion, con nombre del AMFE que la dispara).

Evidencia: `core/inheritance/changePropagation.ts:376-401`, E2E run output real del 10/04/2026.

### E12. Tipo de alerta especifico

**Finding: ROBUSTNESS.**

El codigo NO usa un tipo de alerta `process_master_changed` como describe el brief — usa el mismo mecanismo generico `upsertCrossDocCheck` con `source_module='amfe'`, `target_module='amfe'`. No hay distincion en el esquema ni en el codigo. El TODO en `utils/crossDocumentAlerts.ts:96-107` reconoce exactamente este gap:

> *"TODO: add a details column to cross_doc_checks to carry matched op names and the originating process-family name (so the UI can differentiate cascade alerts vs. cross-family alerts)."*

Evidencia directa del TODO. Consistente con E10.

### E13. Master no-proceso (gate)

**Finding: OK.**

`triggerCrossFamilyPropagation` linea 567 checkea `if (!family.name.trim().toLowerCase().startsWith('proceso de'))` y early returns. Ademas `propagateMasterAcrossFamilies` linea 462 repite el gate como defensa en profundidad. Los tests unitarios cubren "Insert Patagonia" y "Proceso de Inyeccion Plastica" separadamente y pasan.

Mental: "Insert Patagonia" (sin "Proceso de") → `startsWith` retorna false → early return → scanner no se ejecuta. Correcto.

Evidencia: `core/inheritance/changePropagation.ts:462, 567`, test `does NOT run for non-process families`.

### E14. Concurrencia

**Finding: ROBUSTNESS.**

Escenario: dos usuarios simultaneamente guardan el master. Ambos save flows ejecutan `doSaveHierarchical` → `triggerCrossFamilyPropagation` async. Las dos instancias del scanner corren en paralelo. No hay lock distribuido.

Consecuencia tecnica:
1. Cada instancia hace su SELECT + N upserts.
2. Por el UNIQUE en `(source_module, source_doc_id, target_module, target_doc_id)`, Postgres ejecuta los `ON CONFLICT DO UPDATE` de cada run — no hay duplicados.
3. `sourceUpdated = new Date().toISOString()` es distinto en cada run → gana el que llega ultimo (write-wins). Esto esta bien semanticamente.
4. `acknowledged_at = NULL` en ambos runs → no se pierde informacion, solo se asegura que cualquier reconocimiento previo se borra.

Hay un `savingRef` mutex en `doSaveHierarchical` (linea 378) que previene saves concurrentes **en el mismo tab**. Entre tabs/usuarios diferentes no hay lock, pero el diseño es seguro (idempotente, upsert-based).

Un riesgo marginal: si dos usuarios A y B guardan con intenciones distintas (A agrega op, B la borra), los scanners corren con sus respectivos `newDoc` snapshots. La fila escrita en Supabase amfe_documents va a ser la del save que termino ultimo (presumiblemente B — `saveAmfeHierarchical` es el que persiste). Pero los `cross_doc_checks` rows que A creo pueden corresponder a un estado intermedio que ya no existe. Con E2/E3 resueltos seria un problema menor; hoy esta enmascarado por E2.

**Recomendacion:** aceptar como limitacion conocida. Un lock distribuido es overkill para la frecuencia de edicion del master.

Evidencia: `modules/amfe/useAmfeProjects.ts:377-378`, `utils/repositories/crossDocRepository.ts:58-63`.

## Regresiones

### R1. Tests de propagation intra-family

**Finding: N/A — no existen tests para intra-family propagation.**

Busque tests con `propagateChangesToVariants|triggerChangePropagation|diffMasterChanges|familyDocument|inheritance` en `__tests__/**`. Resultado: **0 archivos**. El unico test de inheritance es el nuevo cross-family test.

Esto significa que no puedo validar "no hay regresion" sobre tests que no existen. Sin embargo:

- Lei `propagateChangesToVariants` y `triggerChangePropagation` y verifiqué que la Fase 2 **no los modifica**. Las dos funciones pre-existentes viven en `changePropagation.ts:138-297` y el codigo nuevo esta en `changePropagation.ts:300-585` (seccion separada, sin imports ni side-effects compartidos).
- `triggerChangePropagation` se llama antes de `triggerCrossFamilyPropagation` en `useAmfeProjects.ts:414-421`. Los dos son independientes.
- `npx vitest run __tests__/utils/crossDocumentAlerts.test.ts __tests__/crossDocumentAlerts.test.ts __tests__/hooks/useRevisionControl.test.ts` → **38/38 PASS**.

**Recomendacion separada (fuera del alcance de esta auditoria):** agregar tests para `diffMasterChanges` y `propagateChangesToVariants`. Es un gap estructural del proyecto.

Evidencia: `core/inheritance/changePropagation.ts:124-297` (intra-family intacto), busqueda global en tests.

### R2. Save AMFE no bloqueante con 2 triggers fire-and-forget en serie

**Finding: OK.**

`doSaveHierarchical` lineas 408-423:

```
try {
    const loaded = await loadAmfeByProjectName(projectName);
    if (loaded) {
        triggerOverrideTracking(loaded.meta.id, currentData, 'amfe');
        if (oldAmfeDoc) {
            triggerChangePropagation(loaded.meta.id, oldAmfeDoc, currentData, 'amfe');
            triggerCrossFamilyPropagation(loaded.meta.id, oldAmfeDoc, currentData, 'amfe');
        }
    }
} catch { /* override tracking is non-critical */ }
```

Tres observaciones:

1. Los tres `trigger*` funcs NO son awaited — son fire-and-forget (`void (async () => ...)()`). Si cualquiera de los tres lanza sincronicamente antes del `void`, el catch los captura. Mentalmente simule: ¿puede alguno lanzar sincronicamente? `triggerCrossFamilyPropagation` tiene forma `(docId, oldDoc, newDoc, moduleType) => { if (moduleType !== 'amfe') return; void (async ...)(); }`. El `return` early no lanza. El IIFE esta envuelto en async, asi que cualquier throw interno es una rejected promise, no una excepcion sincrona. **No puede romper el save.**

2. El `try/catch` externo cubre el primer await (`loadAmfeByProjectName`) y los 3 triggers. Si `loadAmfeByProjectName` falla, el catch ignora silenciosamente y el save sigue su curso (saveStatus='saved' ya fue seteado arriba). **Correcto.**

3. `setSaveStatus('saved')` y `setHasUnsavedChanges(false)` se ejecutan **antes** del bloque de triggers (lineas 395-399), asi que aun si todos los triggers fallan, el usuario ve "Saved" y puede seguir trabajando. **Correcto.**

Simulacion mental de peor caso: los 3 triggers tiran excepcion → las 3 son async → el `try/catch` externo captura la primera que se awaita (pero ninguna se awaita aca, son `void ...`), asi que los errores aterrizan en el `window.unhandledrejection` handler de Chrome → seran logged por el listener de logger.ts pero **no romperan el save**. 

El test unitario `never throws when the database throws` explicitamente verifica esto para `triggerCrossFamilyPropagation` (test pasa).

Evidencia: `modules/amfe/useAmfeProjects.ts:377-436`, `core/inheritance/changePropagation.ts:548-585`, test unitario.

## Lista priorizada de bugs

1. **TRUE BUG #1 — E2: save de master con cambio cosmetico genera alertas falsas** (utils/crossDocumentAlerts.ts + changePropagation.ts)
   - Severidad: alta (UX).
   - Reproducible 100% con `scripts/testInjectionPropagation.mjs`.
   - Afecta: todos los usuarios de los 7 AMFEs que matchean el master de inyeccion.
   - Fix: comparar `masterOpNames` de oldDoc vs newDoc en `propagateMasterAcrossFamilies`; early return si son iguales.

2. **TRUE BUG #2 — E11: false positive del matcher "INYECCION" vs "INYECCION PU"** (changePropagation.ts matchOperationName)
   - Severidad: media (ruido en log + lista de matched ops).
   - Confirmado en datos reales (Armrest Door Panel).
   - Impacto latente grave si una familia solo tuviera operaciones PU (nunca el caso hoy).
   - Fix: blocklist de sufijos `{PU, POLIURETANO, ESPUMA}` despues del token del master.

## Lista priorizada de robustness

3. **E1 — alertas re-aparecen al guardar sin cambios** — dependiente del fix #1.
4. **E3 — eliminacion de operacion del master no genera alerta** — gap de cobertura.
5. **E11b — "RECEPCION Y PREPARACION" vs "RECEPCION DE MATERIA PRIMA" no matchea** — cambios en recepcion del master no propagan.
6. **E9/E10/E12 — UI no distingue cross-family de cascada APQP** — TODO reconocido en el codigo.
7. **E8 — full scan de amfe_documents sin filtros** — degrada a N>100.
8. **E14 — sin lock distribuido entre tabs/usuarios** — acceptable.
9. **E4 — agregado de operacion del master no genera alerta "gap"** — fuera de alcance.
10. **E5 — 3 triggers acoplados sin comentario explicativo** — cosmetico.
11. **R1 — gap estructural: no hay tests para intra-family propagation** — fuera de alcance de Fase 2.

## Recomendaciones de mejora (en orden de esfuerzo)

### Fix rapido (30 min)

1. Suprimir alertas cuando las ops del master no cambiaron (fix E1+E2):

```typescript
// core/inheritance/changePropagation.ts propagateMasterAcrossFamilies()
const masterNewOpNames = extractMasterOperationNames(newDoc as AmfeDocument);
if (masterNewOpNames.length === 0) return empty;
const masterOldOpNames = extractMasterOperationNames(params.oldDoc as AmfeDocument);
const oldSet = new Set(masterOldOpNames);
const newSet = new Set(masterNewOpNames);
const opsUnchanged = oldSet.size === newSet.size
    && [...oldSet].every(op => newSet.has(op));
if (opsUnchanged) {
    logger.debug(CROSS_FAMILY_LOG_TAG, 'Master op names unchanged, skipping cross-family scan', { masterDocId });
    return empty;
}
```

2. Blocklist de sufijos en el matcher (fix E11):

```typescript
const INCOMPATIBLE_SUFFIXES = new Set(['PU', 'POLIURETANO', 'ESPUMA']);
// inside matchOperationName rule 2:
if (containsWholeWord(targetNormName, master)) {
    // reject if the token immediately after `master` in targetNormName is in INCOMPATIBLE_SUFFIXES
    const tail = targetNormName.slice(targetNormName.indexOf(master) + master.length).trim().split(/[^A-Z0-9]+/).filter(Boolean)[0];
    if (tail && INCOMPATIBLE_SUFFIXES.has(tail)) continue;
    return master;
}
```

### Mejoras de migracion (Fase 3)

3. Agregar columna `details JSONB` a `cross_doc_checks` (ya hay TODO):
   - `matched_operation_names TEXT[]`
   - `source_family_name TEXT`
   - `alert_type TEXT` (`'cascade'` | `'cross_family'` | ...)
4. Extender `detectCrossDocAlerts` y `CrossDocAlertBanner` para renderizar los tipos distintos (iconos/colores).
5. Agregar test coverage unitaria para `diffMasterChanges`, `propagateChangesToVariants`, `triggerChangePropagation` (gap R1).
6. Emitir alertas para operaciones eliminadas del master (E3).

### Performance / escalabilidad

7. Proyectar `data->'operations'` en el SELECT para no bajar el JSON completo (E8).
8. Cachear `extractMasterOperationNames(newDoc)` por sesion si el master no cambio.

## Conclusion

La feature **no tiene bugs bloqueantes** que rompan datos, el save del usuario o la cascada APQP existente. Los 17 tests unitarios pasan, el E2E es limpio (revert + cleanup), no introduce errores de TypeScript, y los triggers fire-and-forget estan bien aislados.

Los dos TRUE BUGs (E2 y E11) son problemas de comportamiento observables desde el dia 1 de uso en produccion con el master de inyeccion actual, pero ninguno causa perdida de datos. Son candidatos naturales para un hotfix rapido post-merge, no para bloquear el release.

Recomendacion final: **merge la feature, aplicar los 2 fixes de "fix rapido" en un hotfix subsiguiente**, y planificar la migracion de `cross_doc_checks.details` para Fase 3 cuando se construya la UI dedicada.
