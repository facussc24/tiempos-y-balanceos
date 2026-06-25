# Auditoria Fases 1-3 Plan de Inyeccion — 2026-04-10

Auditor: amfe-auditor (Claude)
Scope: AMFE Maestro `4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c` + feature de propagacion cross-family + 7 AMFEs de productos con operaciones de inyeccion.
Metodo: lectura de Supabase, comparacion contra backup `backups/2026-04-10T23-37-17/amfe_documents.json`, `vitest run` sobre `crossFamilyPropagation.test.ts`, `tsc --noEmit` y ejecucion read-only de `testInjectionPropagation.mjs`.

---

## Resumen ejecutivo

| Categoria | Cantidad |
|---|---|
| **TRUE BUGs** | **5** |
| **ROBUSTNESS issues** | **6** |
| **FALSE POSITIVES (hallazgos iniciales descartados)** | **4** familias |

**Veredicto: NO proceder directamente a Fase 5 (CP Maestro) sin antes atender los 2 bugs bloqueantes.** Los bugs bloqueantes son pequenos (focusElementFunction + 6M incompleto en master), corregibles en minutos. La feature de propagacion cross-family esta solida: 17/17 tests pasan, el E2E corre limpio con 7/9 docs matcheados y cleanup OK, tsc sin regresiones nuevas.

Resumen por item critico:
- OP 10 y OP 30 del maestro NO tienen 6M completo (faltan Environment y/o Material).
- Headrest Front/Rear Center/Rear Outer quedaron con `focusElementFunction` vacio en la OP 40 de inyeccion (el script `syncArmrestHeadrestFromInjectionMaster.mjs` no lo sincroniza).
- Armrest OP 60 no recibio los WEs del maestro por un gate incorrecto (`beforeWes < 3`) — la op tiene exactamente 3 WEs preexistentes y el script asume que eso significa "ya esta completo". Resultado: 3 WEs en vez de ~12.
- Propagacion cross-family del Armrest matchea tambien OP 70 "INYECCION PU" por la regla de substring — alert tecnicamente correcta a nivel de doc pero confusa (ROBUSTNESS).
- Muchos hallazgos iniciales sobre severidades bajadas, aliases de funciones y FEF en ops no-inyeccion son **PRE-EXISTENTES** en los docs de producto (ver FALSE POSITIVES).

---

## Seccion A: AMFE Maestro de Inyeccion (`4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c`)

Estado general del documento: `typeof data === 'string'`, `JSON.parse` OK, `operations` es array de 3 elementos (`A12 PASS`). Header preservado con `revision = "B"` y `revDate = "2026-04-10"`.

| Check | Resultado | Evidencia |
|---|---|---|
| **A1** 6M completo en OP 20 | **PASS** | OP 20 tiene 10 WEs cubriendo Machine,Material,Method,Man,Measurement,Environment. Lista: Inyectora, Molde, Sistema refrigeracion tornillo, Colorante masterbatch, Dossier, Procedimiento arranque, Operador setup, Operador autocontrol, Instrumentos medicion, Aire comprimido. |
| **A2** 1M por linea (regla AIAG-VDA) | **PASS** | Cada WE del OP 20 es un unico item. Un solo WE con slash ("Tolva secadora / Deshumidificador") describe un solo equipo con sinonimo — aceptable. |
| **A3** Efectos VDA 3 niveles en OP 20 | **PASS** | Los 24 failures del OP 20 tienen los 3 niveles llenos y diferenciados por tipo de defecto (ejemplos: "Pieza deformada" → local=scrap, next=ajuste enfriamiento, end=no montable). Cero hallazgos de niveles iguales en OP 20. |
| **A4** AP con tabla oficial | **PASS** | 0 mismatches. Las 41 causas del OP 20 usan S/O/D consistentes con `calculateAP`. Conteos: H=0, M=0, L=41 — todas las causas estan en rango bajo-moderado (S=5-6, O=2-3, D=6-7). |
| **A5** Aliases duales en master | **PASS** | `opNumber === operationNumber`, `name === operationName`, cada cause tiene `ap` y `actionPriority` identicos, cada function tiene `description` y `functionDescription` identicos. |
| **A6** FEF 3 perspectivas | **PASS** | Las 3 ops tienen: `"Interno: ... / Cliente: ... / Usuario final: ..."` (264 chars, 3 splits). |
| **A7** "Capacitacion" NO es causa | **PASS** | 0 causas con patrones de falta de capacitacion. El comentario en `rebuildInjectionMaster.mjs` linea 757 es explicito — una causa original se reemplazo por "Instruccion de trabajo de desmoldeo incompleta". |
| **A8** Acciones no inventadas | **PASS** | Ninguna accion no-placeholder. 0 causas AP=H (por diseño: el master mantiene S/O/D moderados), y todas las causas tienen `preventionAction=""` o placeholder. |
| **A9** OP 10 completa | **FAIL (TRUE BUG)** | OP 10 tiene 6 WEs pero SOLO 5 de las 6 M: Machine(×2), Material, Method, Man, Measurement. **Falta Environment** (ej. "Ambiente de almacen con humedad controlada" o "Aire comprimido para sopletado de bolson"). Fails la promesa de "6M obligatorio" declarada en el briefing y en el comentario `.claude/rules/injection.md`. |
| **A10** OP 30 completa | **FAIL (TRUE BUG)** | OP 30 tiene 6 WEs pero SOLO 4 de las 6 M: Machine, Method(×2), Man, Measurement(×2). **Faltan Material y Environment**. Es un control dimensional, tiene sentido tecnico omitir Material directo, pero deberia haber al menos 1 Material indirecto (ej. solvente de limpieza del banco) o un Environment (iluminacion del puesto de control, la cual aparece como failure dentro del WE Machine "Mesa / banco de control" pero deberia ser un WE Environment dedicado). |
| **A11** CC/SC no autorizado | **PASS** | 0 causas con `specialChar=CC` en el master. 0 causas con SC. Concuerda con `feedback_no_assign_ccsc.md`. |
| **A12** Integridad JSON | **PASS** | `typeof data === 'string'`, parseable, `data.operations.length === 3`. Script de rebuild usa `JSON.stringify` (linea 1439). |

**Resumen Master**: 10/12 checks PASS, 2 FAIL (A9 y A10 — 6M incompleto en OP 10 y OP 30).

---

## Seccion B: Feature de propagacion cross-family

| Check | Resultado | Evidencia |
|---|---|---|
| **B1** No regresiones en intra-family propagation | **PASS** | `triggerChangePropagation`, `propagateChangesToVariants`, `diffMasterChanges` siguen exportados con la misma firma (`core/inheritance/changePropagation.ts` lineas 75, 138, 247). |
| **B2** Nuevas exportaciones presentes | **PASS** | `propagateMasterAcrossFamilies` y `triggerCrossFamilyPropagation` estan exportados. Importados en `modules/amfe/useAmfeProjects.ts` linea 32 y llamados en linea 420. |
| **B3** Fire-and-forget sin throw | **PASS** | `triggerCrossFamilyPropagation` (linea 548) envuelve en `void (async () => {...try{...}catch{}})()`. Nunca propaga errores. Test "never throws when the database throws" PASS. |
| **B4** Gate por familia "Proceso de" Y modulo 'amfe' | **PASS** | Lineas 462 y 467: `if (!familyName.trim().toLowerCase().startsWith('proceso de'))` + `if (module !== 'amfe')`. Tests "does NOT run for non-process families" y "does NOT run for non-amfe modules" PASS. |
| **B5** `normalizeOperationName` strip diacritics + uppercase + trim | **PASS** | Linea 326: `.toUpperCase().trim().normalize('NFD').replace(/\p{Diacritic}/gu, '')`. Test "uppercases, trims, and strips diacritics" PASS (`"Inyección plástica" → "INYECCION PLASTICA"`). |
| **B6** Matching algorithm sin falsos positivos | **PASS con matiz** | `matchOperationName` (linea 376) es asimetrica: 1) exact match, 2) master op es full-token substring del target (min 6 chars, excluye stopwords). Test "short stopwords" PASS. La filosofia declarada en el comentario (lineas 358-372) es correcta: "CONTROL" del master NO matchea "CONTROL FINAL" de otros docs porque el master tiene "CONTROL DIMENSIONAL POST-INYECCION Y CORTE DE COLADA" — 39 chars — y esa substring no aparece en ningun target. Verificado empiricamente en el E2E: SOLO docs con "INYECCION" (o variantes "INYECCION DE PIEZAS", "INYECCION DE SUSTRATO", etc.) son matcheados. |
| **B7** Schema cross_doc_checks | **PASS** | `createCrossFamilyAlert` en `utils/crossDocumentAlerts.ts:121` llama a `upsertCrossDocCheck` con exactamente las 6 columnas del schema actual (`utils/repositories/crossDocRepository.ts:47`). La lista `matchedOperationNames` se loguea pero NO se persiste — esta explicitamente documentado como TODO (linea 104-107 de `crossDocumentAlerts.ts`). |
| **B8** Tests pasan | **PASS** | `npx vitest run __tests__/core/inheritance/crossFamilyPropagation.test.ts` → **17/17 tests passed** en 2.32s. Cubren: `normalizeOperationName` (2), `matchOperationName` (4), `propagateMasterAcrossFamilies` (7), `triggerCrossFamilyPropagation` fire-and-forget wrapper (4). |
| **B9** E2E cleanup | **PASS** | `node scripts/testInjectionPropagation.mjs` corrio fine. Resultado: scanned=9, affected=7, alerts_created=7, revert OK (subject vuelto al original), cleanup OK (7 rows nuevos eliminados, final=0). Estado final de la DB intacto. |
| **B10** `tsc --noEmit` sin errores nuevos | **PASS** | 9 errores detectados, TODOS en `modules/CavityCalculator/index.tsx` (`injectionMode`, `indexTimeStr`, `dailyDemand`). Cero errores en `core/inheritance/changePropagation.ts`, `utils/crossDocumentAlerts.ts`, `modules/amfe/useAmfeProjects.ts`. Los errores en CavityCalculator son pre-existentes, no introducidos por la feature. |

**Resumen feature**: 10/10 checks PASS. La feature esta tecnicamente solida.

**Hallazgo ROBUSTNESS B-R1** (no bloqueante): el E2E mostro que el Armrest matchea `INYECCION PU` via la regla substring (length("INYECCION")=9 ≥ 6, y "INYECCION" aparece como token en "INYECCION PU"). Esto genera que cuando el master de inyeccion plastica se actualiza, el Armrest recibe una alerta que tecnicamente aplica a su OP 60 (inyeccion de plastico) pero aparece junto al match espurio de la OP 70 (poliuretano). La alerta final es a nivel de doc, asi que el doc Armrest sigue siendo un match legitimo, pero el `matchedOperationNames` log incluye la OP de PU. Mejora posible: excluir tokens "PU" y "POLIURETANO" del matching cross-family o ampliar el master a un nombre mas especifico como "INYECCION PLASTICA" para que no matchee "INYECCION PU".

---

## Seccion C: 7 AMFEs de productos sincronizados

### Tabla resumen

| Producto | Inj OP | Name preservado (C2) | WEs inj | 6M types inj | H/M/L | FEF 3-persp (A6) | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| IP PAD | 20 | INYECCION | 10 | 6/6 | 0/0/44 | YES | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | N/A | N/A | ✓ | ✓ |
| Insert | 70 | INYECCION DE PIEZAS PLASTICAS | 12 | 6/6 | 2/0/41 | YES | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | N/A | N/A | ✓ | ✓ |
| Headrest Front | 40 | INYECCION DE SUSTRATO | 11 | 6+1/6 | 0/2/64 | **NO (FAIL)** | ✓ | ✓ | ✓ | ✓ | ✓(note1) | ✓ | N/A | N/A | ✓ | ✓ |
| Headrest Rear Ctr | 40 | INYECCION DE SUSTRATO | 11 | 6+1/6 | 0/2/64 | **NO (FAIL)** | ✓ | ✓ | ✓ | ✓ | ✓(note1) | ✓ | N/A | N/A | ✓ | ✓ |
| Headrest Rear Out | 40 | INYECCION DE SUSTRATO | 11 | 6+1/6 | 0/2/64 | **NO (FAIL)** | ✓ | ✓ | ✓ | ✓ | ✓(note1) | ✓ | N/A | N/A | ✓ | ✓ |
| Armrest | 60 | INYECCION DE PIEZAS PLASTICAS | **3 (BUG)** | 3/6 | 1/4/24 | YES | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **✓** | **FAIL** | ✓ | ✓ |
| Top Roll | 10 | INYECCION DE PIEZA PLASTICA | 14 | 6/6 | 0/1/61 | YES | ✓ | ✓ | ✓ | ✓ | ✓(note2) | ✓ | N/A | N/A | ✓ | ✓ |

Notas:
- note1: Headrest familia tiene una WE preexistente "Proceso Op 40" con `type: "Maquina"` (mal escrito, debe ser "Machine"). Ademas esa WE tiene `function.description=""` pero `functionDescription="..."`. No son aliases simetricos. **Pre-existente, no causado por sync** (verificado en backup).
- note2: Top Roll OP 10 WE "Máquina inyectora de plástico" preexistente tiene 2 function subentries (duplicado historico). El sync no las toco pero tampoco las consolido.

### Detalle por check (resumen)

**C1 Integridad (data parseable, operations mismo length)** — `PASS` en los 7 productos. Backup: IP PAD 15 ops, Insert 13 ops, HF 8, HRC 7, HRO 7, Armrest 17, Top Roll 10. Actuales: identicos.

**C2 Nombre operacion preservado** — `PASS` en los 7. Ningun script sobreescribio el opName con "INYECCION" del master. Confirmado por diff textual contra backup.

**C3 Efectos diferenciados en failures de la op inyeccion** — `PASS` en los 7. El script copia `effectLocal/effectNextLevel/effectEndUser` del master, que ya estan diferenciados. Ninguna failure del WE Inyectora en ningun producto tiene los 3 niveles iguales entre si (tras el sync). Los unicos `effectsDup` detectados (4 en IP PAD, 5 en Insert, 5 en HF/HRC/HRO, 9 en Top Roll, 0 en Armrest) estan TODOS en ops NO-inyeccion (OP 70 Adhesivado, OP 120 Terminacion, OP 10 Recepcion, etc) — **pre-existentes, no relacionados con la sync**.

**C4 Controles de deteccion diferenciados** — `PASS` en los 7. El master provee controles diferenciados por tipo de defecto: "Calibre/gauge por muestreo" para dimensional, "Inspeccion visual 100% con pattern board" para quemaduras, "Comparacion con muestra maestra bajo luz controlada" para color, "Verificacion manual de caudal" para refrigeracion garganta. El sync los copia al producto.

**C5 Aliases duales** — `PASS con un matiz`. Todas las causas copiadas del master tienen `ap === actionPriority` y `cause === description`. Las operaciones tienen `opNumber === operationNumber` y `name === operationName`. Las funciones nuevas que vienen del master tienen `description === functionDescription`. Los unicos mismatch detectados son en WEs PREEXISTENTES (por ejemplo "Proceso Op 40" en Headrest, "Máquina inyectora de plástico" en Top Roll con solo un alias) — **verificado contra backup: pre-existentes.**

**C6 Consistencia AP (tabla oficial)** — `PASS efectivo`. Los 3 mismatches de "Falta de mantenimiento" (1 en HF, 1 en HRC, 1 en HRO) son un FALSE POSITIVE: usan `fail.severity=8` pero `cause.severity=6` (pre-existente de una migracion antigua). El script `recomputeAp` usa `cause.severity` (linea 198 de `syncArmrestHeadrestFromInjectionMaster.mjs`) — que NO es el campo canonico en el tipo actual (`AmfeCause` no tiene `severity`; vive en `AmfeFailure`). La AP almacenada (`L`) es incorrecta si se mira `fail.severity=8`, pero correcta si se mira `cause.severity=6`. El runtime de la app (`getCauseValidationState` en `amfeValidation.ts:46`) usa `Number(failure.severity)` — o sea, la UI mostrara AP=M pero los datos guardados tienen AP=L. Ver **TRUE BUG B-R2** abajo en bugs criticos. Esto no lo introdujo la fase 1-3 pero la fase 1-3 tampoco lo arreglo.

**C7 Armrest OP 70 "INYECCION PU" intacto** — `PASS`. Verificado: backup tenia 8 failures, actual tiene 8 failures, mismos nombres, mismo WE "Inyectora de PUR" con 3 WEs total. El sync script lo marco explicitamente como `skip-pu` (linea 121 y 471 de `syncArmrestHeadrestFromInjectionMaster.mjs`). Tambien verifique el `_checkSyncState.mjs` report del usuario.

**C8 Armrest OP 60 solo con 3 WEs** — **FAIL (TRUE BUG CONFIRMADO)**. `syncArmrestHeadrestFromInjectionMaster.mjs` linea 354:
```javascript
// 2. Si el producto tiene <3 WEs, agregar los demas WEs del master que falten
if (beforeWes < 3) { ... }
```
El Armrest OP 60 tiene `beforeWes = 3` (Maquina inyectora, Operador, Hoja de operaciones), por lo que la condicion falla y el script NO agrega los 9 WEs restantes del master (Molde, Refrig tornillo, Colorante, Dossier, Procedimiento arranque, Operador setup, Operador autocontrol, Instrumentos medicion, Aire comprimido). Stats actuales: 3 WEs, 12 failures, 29 causas. Deberia tener ~12 WEs, ~25 failures, ~43 causas como Insert, Top Roll, HF, HRC, HRO.

**C9 Regresiones en otras operaciones** — `PASS`. Comparacion exhaustiva contra el backup: ninguna op no-inyeccion cambio en `workElements.length`, `failures.length` ni `causes.length`. Los scripts son estrictamente selectivos en que op tocan. Unica excepcion: el script `recomputeAp` en `syncArmrestHeadrestFromInjectionMaster.mjs` linea 329-337 tambien recalcula el AP de causas en ops no-inyeccion (iterando todo el doc), pero solo cambia `ap/actionPriority`, no severity/occurrence/detection. Verifique esto contra backup: las severidades de todas las causas de ops no-inyeccion son identicas pre y post sync.

**C10 No acciones inventadas, no CC/SC no autorizado, no "capacitacion"** — `PASS` en la op de inyeccion de los 7. El master pone `preventionAction = "Pendiente definicion equipo APQP"` SOLO cuando AP=H. El sync copia esto al producto via `cloneCauseFromMaster` (linea 133 de syncArmrestHeadrest, linea 131 de syncIpPad). Verifique 0 causas inventadas en las ops de inyeccion. Las causas "inventadas" que alarmo mi script inicial (A11-SC-LOW-S: 3 en Insert, A4-AP-MISMATCH: 4 en Armrest, 1 en HF/HRC/HRO) TODAS estan en ops NO-inyeccion (Insert OP 103/110, Armrest OP 20/50/100, Headrest OP 40 "Proceso Op 40" WE pre-existente) y son **pre-existentes verificadas contra backup**.

---

## Seccion D: Severidades del producto preservadas

**D1 Severidades con S>=7 preservadas en op inyeccion** — `PASS`. Mi primera pasada flaggeo 50+ casos de "severity lowered" pero una investigacion (`scripts/_investigateSeverity.mjs`) mostro que son TODOS **FALSE POSITIVES** de mi logica de auditoria. Mi audit comparaba `fail.severity` del backup contra `cause.severity` del now (campos distintos). Los registros son identicos entre backup y now: `fail.severity` permanece igual, y donde hay `cause.severity` como alias legacy, tambien permanece igual. Ningun script de sync baja severidades.

**Confirmacion empirica**: Headrest Front OP 10 failure 2 "Material con especificación errónea":
- Backup: `fail.severity=7`, cause "Proveedor no respeta tolerancias" con `cause.severity=7`, cause "Falta de control dimensional en recepción" con `cause.severity=6`.
- Now: Identico.

**D2 Disminuciones sospechosas**: Ninguna detectada tras descartar los false positives.

---

## BUGS CRITICOS (priorizados)

### BUG-1 (BLOQUEADOR MEDIO) — Master OP 10 y OP 30 sin 6M completo
- **Ubicacion**: `scripts/rebuildInjectionMaster.mjs` lineas 192-453 (OP 10) y 1153-1341 (OP 30).
- **Sintoma**: OP 10 carece de WE Environment. OP 30 carece de WE Material y WE Environment.
- **Impacto**: Contradice el briefing ("6M completo en cada operacion") y la regla `.claude/rules/injection.md` que declara 6M obligatorio. Cuando el CP Maestro se genere en fase 5, faltaran controles de ambiente (ej. iluminacion del puesto de control para OP 30).
- **Severidad**: Moderada — la operacion de inyeccion propiamente dicha (OP 20) si tiene 6M completo. Las ops satelite (recepcion, control dimensional) son las incompletas.
- **Accion**: Agregar WE Environment al OP 10 (ej. "Area de almacen de pellet con humedad controlada") y WE Environment + Material al OP 30 (ej. "Solvente de limpieza del banco" + "Iluminacion del banco de control"). Re-correr `rebuildInjectionMaster.mjs`. Este fix no requiere re-sincronizar los productos porque los WEs nuevos del OP 10 y OP 30 del master no se propagan a los productos (el sync solo toca la op de inyeccion, no OP 10 ni OP 30 del master).

### BUG-2 (BLOQUEADOR PARA AUDITORIA IATF) — focusElementFunction vacio en Headrest OP 40
- **Ubicacion**: `scripts/syncArmrestHeadrestFromInjectionMaster.mjs` — la funcion `mergeOperation` (lineas 311-385) no setea `focusElementFunction`.
- **Sintoma**: Headrest Front, Headrest Rear Center y Headrest Rear Outer tienen `op.focusElementFunction = undefined` en la OP 40 de inyeccion. El backup tampoco lo tenia. El sync no lo corrigio.
- **Evidencia**: `audit_inj.txt` lineas "Headrest Front OP 40 ... FEF: undefined ... split count: 1".
- **Impacto**: Campo obligatorio AIAG-VDA (3 perspectivas: interno/cliente/usuario final). La regla amfe.md linea 94 lo declara "3 FUNCIONES OBLIGATORIAS". IATF 16949 requiere esta estructura para el PFMEA.
- **Accion**: Modificar `syncArmrestHeadrestFromInjectionMaster.mjs` `mergeOperation` para copiar `focusElementFunction` del master (`masterOp20.focusElementFunction`) SOLO si el producto lo tiene vacio. Tambien considerar si debe sobreescribirse cuando el producto tiene uno propio pero de calidad inferior — decidir con Fak. Alternativamente, definir manualmente un FEF especifico para cada familia de Headrest respetando su contexto (sustrato de apoyacabezas con funcion en confort/seguridad pasajero).

### BUG-3 (BLOQUEADOR) — Armrest OP 60 solo 3 WEs (gate incorrecto)
- **Ubicacion**: `scripts/syncArmrestHeadrestFromInjectionMaster.mjs` linea 354:
  ```javascript
  if (beforeWes < 3) { ... agregar WEs del master ... }
  ```
- **Sintoma**: Armrest OP 60 "INYECCION DE PIEZAS PLASTICAS" tiene exactamente 3 WEs preexistentes (Machine:Maquina inyectora, Man:Operador, Method:Hoja de operaciones). La condicion `< 3` es falsa → los 9 WEs restantes del master no se agregan.
- **Evidencia**: `_inspectArmrestOp60.mjs` dump: "OP 60 ... WEs: 3 ... - Machine / Man / Method" (solo 3 tipos de las 6 M). Insert, Top Roll, HF, HRC, HRO tienen 11-14 WEs con los 6 tipos de M.
- **Impacto**: Armrest esta "PARCIALMENTE SYNCED" — la WE Inyectora tiene las 12 failures del master (merge funciono), pero le faltan Molde, Refrigeracion tornillo, Colorante masterbatch, Dossier, Procedimiento arranque, Operador setup/autocontrol, Instrumentos medicion, Aire comprimido. Los controles y modos de falla relacionados no existen en el Armrest. Auditor IATF detectara la inconsistencia entre la familia Headrest/Insert (completas) y el Armrest (incompleta) mismo siendo un proceso de inyeccion plastica.
- **Accion**: Cambiar el gate a siempre agregar WEs faltantes del master por `buildWeKey` (igual que `syncInsertTopRollFromInjectionMaster.mjs`, que no tiene gate). Re-correr el script para el Armrest. Verificar que OP 70 "INYECCION PU" siga intacta post re-run (tiene tests implicitos en el script por `classifyOperation` → `skip-pu`).
  Fix minimo sugerido: reemplazar `if (beforeWes < 3)` con `if (true)` (siempre ejecutar) o eliminar la condicion por completo — el dedup por `buildWeKey` ya previene duplicados.

### BUG-4 (NO BLOQUEADOR, datos legacy) — `recomputeAp` usa `cause.severity` en vez de `fail.severity`
- **Ubicacion**: `scripts/syncArmrestHeadrestFromInjectionMaster.mjs` linea 198-204:
  ```javascript
  function recomputeAp(cause) {
    const s = cause.severity;  // ← deberia ser failure.severity
    const o = cause.occurrence;
    const d = cause.detection;
    const ap = calculateAP(s, o, d);
    return { ...cause, actionPriority: ap, ap };
  }
  ```
- **Sintoma**: En `AmfeCause` (ver `amfeTypes.ts` linea 47-77), NO existe el campo `severity` — la severidad canonica vive en `AmfeFailure.severity` (linea 90). Sin embargo muchas causas legacy tienen `cause.severity` poblada como orphan field de una migracion antigua. El script usa el orphan.
- **Efecto concreto**: Headrest Front OP 40 WE "Proceso Op 40" failure "3- Puntadas irregulares o arrugas" (`fail.severity=8`) cause "Falta de mantenimiento" tiene `cause.severity=6`. Script calcula AP con S=6, O=4, D=6 → L. Pero `calculateAP(8, 4, 6) = M`. La app en runtime usa `fail.severity=8` (via `amfeValidation.ts getCauseValidationState`), asi que la UI muestra AP=M mientras el campo guardado `cause.ap="L"`.
- **Impacto**: Divergencia UI vs DB. El export Excel leera `cause.ap` (L) pero la UI muestra M. Es un bug PRE-EXISTENTE en el modelo de datos, no introducido por la sync de inyeccion, pero el script perpetua el inconsistency.
- **Severidad**: No bloquea Fase 5 porque afecta ops NO-inyeccion (la data del master tiene fail.severity y cause.severity consistentes via `mkCause`). Solo Headrest tiene esta divergencia y solo en la OP 40 WE "Proceso Op 40" preexistente.
- **Accion**: Corregir `recomputeAp` para priorizar `fail.severity` sobre `cause.severity`:
  ```javascript
  function recomputeAp(cause, failSeverity) {
    const s = failSeverity ?? cause.severity;
    ...
  }
  ```
  Y actualizar los callers (linea 269, 335) para pasar `fail.severity`. Mismo fix se aplica a `syncIpPadFromInjectionMaster.mjs ensureCauseConsistency` (linea 129).
  **NO BLOQUEADOR** para Fase 5 pero debe atenderse antes del CP master si se decide regenerar CPs desde AMFE con el generador de `controlPlanGenerator.ts`.

### BUG-5 (ROBUSTNESS BAJO) — cross-family match de "INYECCION" captura "INYECCION PU"
- **Ubicacion**: `core/inheritance/changePropagation.ts` `matchOperationName` linea 376-392.
- **Sintoma**: El E2E test mostro que Armrest es afectado por matches en AMBAS ops "INYECCION DE PIEZAS PLASTICAS" Y "INYECCION PU". Porque "INYECCION" (master) es substring full-token de "INYECCION PU".
- **Impacto**: La alerta final es a nivel documento, asi que el resultado neto es que el Armrest recibe 1 alerta — correcta, porque su OP 60 si es inyeccion plastica. Pero el log de `matchedOperationNames` incluye la OP PU, lo cual es semanticamente incorrecto y puede confundir a un auditor que lea los logs.
- **Severidad**: Baja (la alerta fatal es correcta). Si en el futuro se agregan familias de PU que NO tienen inyeccion plastica, esto se volvera un bug real.
- **Accion recomendada**: Excluir tokens terminales "PU", "POLIURETANO", "PUR" del matching cross-family. O cambiar el nombre del master de "INYECCION" a "INYECCION PLASTICA" para que el substring sea 17 chars y no matchee "INYECCION PU" (9+PU=11 chars). Este cambio afectaria a los 7 AMFEs ya sincronizados: sus ops de inyeccion NO contienen "INYECCION PLASTICA" literal, asi que el matching seria solo por Rule 1 (exact) y habria que agregar "INYECCION" como 2da op del master o agregar un synonym list. **Recomendacion concreta**: dejar el master como "INYECCION" pero agregar un stop-token "PU" al matching. Alternativa mas segura: aplicar el matching solo a pares (sourceName, targetName) donde targetName contenga "PLASTIC" o donde sourceName contenga "PLASTIC".

---

## FALSE POSITIVES del audit inicial (descartados tras investigacion)

Para transparencia, estos hallazgos iniciales fueron descartados:

1. **"50+ severidades bajadas en productos"** — FALSO. Mi logica comparaba `fail.severity` (backup) contra `cause.severity` (now) — campos distintos. Verificado por `scripts/_investigateSeverity.mjs` que los valores son identicos entre backup y now.
2. **"A5-FN-ALIASES mismatch en decenas de WEs"** — PRE-EXISTENTES. Las WEs que tienen solo `functionDescription` sin `description` (o viceversa) son WEs originales del producto, no tocadas por el sync. Verificado contra backup: los mismos WEs tienen el mismo estado. Los WEs NUEVOS agregados por el sync tienen ambos aliases correctamente (evidencia en `_investigateAliases.mjs`).
3. **"A6-FOCUS-FUNCTION fallando en Headrest en 7 ops diferentes"** — PRE-EXISTENTE. TODAS las ops de Headrest (10, 20, 30, 40, 50, 60, 70) tienen FEF vacio. El sync cross-family solo toca la OP 40 de inyeccion. Los demas son problemas pre-existentes del doc. Solo la OP 40 es imputable al sync (BUG-2 arriba).
4. **"REGRESSION-NONINJ-OP en master (OP 10 y OP 30 con +10/+6 failures)"** — FALSO POSITIVO de mi audit. El master tenia esos ops como shells vacios en el backup pre-rebuild y el rebuild deliberadamente los llena. Mi regex `/INYECC/` no matcheo "PREPARACION Y SECADO" ni "CONTROL DIMENSIONAL POST-INYECCION" — incluyo "INYECCION" en el nombre pero mi regex no los excluyo. El cambio en esas ops es ESPERADO por el rebuild plan.

---

## RECOMENDACIONES (no bloqueantes)

1. **Agregar `sourceRevision` real en `propagateMasterAcrossFamilies`**. Actualmente usa `newDoc.header?.revision ?? ''` — si falla el parse, queda string vacio. El E2E test mostro `sourceRevision='A'` — funciona. Mejora: fallback a la `revision` de la DB fila si el JSON esta mal.

2. **Persistir `matchedOperationNames` en la alerta**. El TODO en `utils/crossDocumentAlerts.ts:104` propone agregar una columna `details` JSON a `cross_doc_checks`. Con eso el popup en la UI podria decir "El AMFE Maestro de Inyeccion cambio. Tu documento tiene las siguientes ops afectadas: INYECCION DE SUSTRATO". Actualmente la UI solo puede decir "El AMFE fue actualizado" generico. Migration sugerida: `ALTER TABLE cross_doc_checks ADD COLUMN details TEXT DEFAULT NULL;` y pasarlo en `upsertCrossDocCheck`.

3. **Normalizar tipo "Maquina" a "Machine" en Headrest**. Los 3 Headrests tienen un WE con `type: "Maquina"` (spelling mistake) preexistente desde hace tiempo. El validation `amfeValidation.ts` VALID_WORK_ELEMENT_TYPES (linea 111) no incluye "Maquina" — esto deberia fallar la validacion de schema. Script de limpieza: update todas las apariciones a "Machine".

4. **Eliminar campo legacy `cause.severity`**. Como se vio en BUG-4, muchos AMFEs antiguos tienen `cause.severity` como orphan field. Como ya no es canonico, deberia limpiarse. Un solo script `fixCauseSeverityLegacy.mjs` que itere por todos los AMFEs y elimine el campo (o lo sincronice con `fail.severity` si difieren).

5. **Agregar 6M Environment a Headrest/Insert/Armrest/Top Roll OPs no-inyeccion**. Fuera del scope de Fases 1-3, pero es un patron: ninguna familia de producto tiene Environment en sus ops. Esto contradice la regla AIAG-VDA 6M. Mejor addressarlo en una sesion dedicada a calidad de datos.

6. **Enriquecer `rebuildInjectionMaster.mjs` OP 10 y OP 30 con 6M completo** — ver BUG-1. Recomendacion: agregar WE Environment "Aire comprimido para sopletado y alimentacion" al OP 10 (ya existe en OP 20, podria duplicarse con funcion distinta), y al OP 30 agregar Material "Solvente y tela de limpieza del banco" + Environment "Iluminacion del banco de control (500 lux minimo)".

---

## Estado para proceder a Fase 5 (CP Maestro)

**Condicional**. Se puede proceder si:
- BUG-1, BUG-2, BUG-3 se atienden **antes** de generar el CP Maestro.
- BUG-4 es aceptable para Fase 5 (afecta solo UI/export de Headrest OP 40 en una causa "Falta de mantenimiento" pre-existente).
- BUG-5 es un issue de propagacion futura, no de la generacion del CP maestro en si.

Alternativa: proceder a Fase 5 con el master tal como esta (OP 10 y OP 30 con 5M/4M en vez de 6M), generar el CP maestro basado en OP 20 (que si tiene 6M completo), y fixear OP 10 y OP 30 en un sprint posterior. Decide Fak.

**Tests de propagacion: listos**. La feature B (cross-family propagation) esta completamente funcional y no bloquea nada.
