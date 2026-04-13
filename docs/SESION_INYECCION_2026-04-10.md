# Sesion: Maestro de Inyeccion Plastica + Propagacion Cross-Family + CP Maestro

Fecha: 2026-04-10 / 2026-04-11
Executor: Claude Opus 4.6 + 7 agentes especializados

---

## Entregables

### 1. Knowledge base de inyeccion (nuevo)
- `.claude/rules/injection.md` — regla contextual que se carga al tocar archivos de inyeccion. Lista de defectos tipicos, 6M de inyeccion, jerarquia de controles, retrabajos tipificados, materiales higroscopicos.
- `docs/GUIA_INYECCION.md` — guia tecnica larga con el conocimiento del gerente experto (recepcion MP, secado, refrigeracion tornillo, mantenimiento molde, defectos, mapeo CP).

### 2. AMFE Maestro de Inyeccion reconstruido
- `amfe_documents.id = 4a5fa0d1-46ee-4d6b-b699-2cbaeb14602c`
- `amfe_number = AMFE-MAESTRO-INY-001`
- Familia 15 "Proceso de Inyeccion Plastica"
- 3 operaciones con 6M completo:
  - OP 10 RECEPCION Y PREPARACION DE MATERIA PRIMA — 7 WEs
  - OP 20 INYECCION — 10 WEs (Machine Inyectora, Machine Molde, Machine Refrigeracion tornillo, Material Colorante, Method Dossier, Method Arranque, Man Setup, Man Autocontrol, Measurement Instrumentos, Environment Aire)
  - OP 30 CONTROL DIMENSIONAL + DESMOLDEO — 8 WEs
- Efectos VDA 3 niveles diferenciados por tipo de defecto (scrap / retrabajo / apariencia).
- Controles de deteccion diferenciados (calibre / pattern board / muestra maestra / certificado).
- Controles de prevencion con jerarquia (sensor > poka-yoke > instruccion > capacitacion).
- AP calculado con tabla oficial `modules/amfe/apTable.ts` (no formula S*O*D).

### 3. Feature de propagacion cross-family
- `core/inheritance/changePropagation.ts` extendido con:
  - `propagateMasterAcrossFamilies()` — escanea otros AMFE cuando se guarda un master de familia "Proceso de ..."
  - `triggerCrossFamilyPropagation()` — wrapper fire-and-forget
  - `normalizeOperationName()`, `matchOperationName()` — matching tolerante (uppercase + trim + NFD + blocklist de markers incompatibles PU/POLIURETANO/ESPUMADO)
- `utils/crossDocumentAlerts.ts` — `createCrossFamilyAlert()`
- `modules/amfe/useAmfeProjects.ts` — integrado en `saveAmfeDocument` post `triggerChangePropagation`
- `__tests__/core/inheritance/crossFamilyPropagation.test.ts` — **19 tests, 19 passing**
- `scripts/testInjectionPropagation.mjs` — test E2E contra Supabase real, revierte y limpia

**Gates implementados:**
1. Solo corre si `familyName` empieza con "Proceso de"
2. Solo corre si `module === 'amfe'`
3. **Short-circuit** si el set de operationNames de `oldDoc` y `newDoc` son identicos (evita ruido en cambios cosmeticos — fix del audit E2)
4. **Blocklist** de markers incompatibles PU/POLIURETANO/POLYURETHANE/PUR/ESPUMADO (evita false-positive E11)
5. Fire-and-forget — nunca throw al caller

### 4. 7 productos sincronizados con el maestro

| Producto | Operacion | WEs | Failures | Causes |
|---|---|---|---|---|
| IP PAD (VWA-PAT-IPPADS-001) | OP 20 INYECCION | 10 | 25 | 44 |
| Insert (AMFE-INS-PAT) | OP 70 INYECCION DE PIEZAS PLASTICAS | 12 | 25 | 43 |
| Top Roll (AMFE-TR-PAT) | OP 10 INYECCION DE PIEZA PLASTICA | 14 | 37 | 62 |
| Armrest (AMFE-ARM-PAT) | OP 60 INYECCION DE PIEZAS PLASTICAS | 10 | 25 | 44 |
| Headrest Front (AMFE-HF-PAT) | OP 40 INYECCION DE SUSTRATO | 11 | 39 | 73 |
| Headrest Rear Center (AMFE-HRC-PAT) | OP 40 INYECCION DE SUSTRATO | 11 | 39 | 73 |
| Headrest Rear Outer (AMFE-HRO-PAT) | OP 40 INYECCION DE SUSTRATO | 11 | 39 | 73 |

**Exclusion intencional**: `OP 70 INYECCION PU` del Armrest (poliuretano) NO fue sincronizada — es proceso distinto (espumado, sin tornillo de plastificacion, sin secado higroscopico). El matcher la rechaza por el blocklist.

### 5. CP Maestro de Inyeccion preliminar
- `cp_documents.id = 81b60cdd-1296-4821-a348-a8e3c2433b0d`
- `cp_number = CP-MAESTRO-INY-001`
- Familia 15, `family_documents.id = 107`, `is_master = 1`, `module = cp`
- **17 items** (5 de proceso + 1 de producto + 3 genericas AP=L + 8 manuales tecnicos + 1 flamabilidad condicional)
- Cobertura de 13 controles obligatorios de `GUIA_INYECCION.md` seccion 10: **13/13 (100%)** tras fixes

---

## Auditorias realizadas

### Auditor AMFE (`docs/AUDITORIA_INYECCION_2026-04-10.md`)
- 5 TRUE BUGs, 6 ROBUSTNESS, 4 FALSE POSITIVES descartados
- Top 3 bloqueadores (fixeados):
  1. Armrest OP 60 quedo con 3 WEs (gate del script incorrecto) → fixeado a 10 WEs
  2. Headrests OP 40 sin `focusElementFunction` → copiado del maestro
  3. Maestro OP 10/30 sin Environment/Material → agregados WEs faltantes
- 17/17 tests propagation PASS
- `tsc --noEmit` sin errores nuevos
- E2E test: revert + cleanup OK

### Auditor Propagation (`docs/AUDITORIA_PROPAGATION_2026-04-10.md`)
- 2 TRUE BUGs, 9 ROBUSTNESS, 1 FALSE POSITIVE confirmado
- Bloqueadores fixeados:
  1. E2: cambios cosmeticos de header disparaban alertas falsas → short-circuit agregado
  2. E11: matcher incluia "INYECCION PU" como match del maestro de inyeccion plastica → blocklist INCOMPATIBLE_PROCESS_MARKERS agregado
- 2 tests nuevos agregados cubriendo los fixes (19/19 PASS total)

### Auditor CP (`docs/AUDITORIA_CP_INYECCION_2026-04-10.md`)
- 8 TRUE BUGs, 7 ROBUSTNESS, 0 FALSE POSITIVES
- 5 fixes aplicados (los mas criticos):
  1. Items AP=L genericas tenian `evaluationTechnique` llena → limpiado (regla AIAG CP 2024)
  2. Item con spec "Conforme a pieza patron y plano" para recepcion de pellet → corregido a spec de certificado
  3. Agregado item E9 Flamabilidad como control condicional
  4. TBD contextualizados
  5. Sample sizes corregidos
- 3 bugs NO fixeados (ROBUSTNESS / menores):
  - 11 items manuales sin `amfeCauseIds` (trazabilidad parcial — requiere decision de Fak)
  - `inferReactionPlan` del generator usa template generico para recepcion (bug del generator, no del CP — fuera de scope)
  - Sample sizes TBD residuales requieren validacion con Metrologia

### Observacion critica: calibracion del AMFE maestro
Los 3 auditores detectaron que el AMFE maestro tiene **0 AP=H y solo 1 AP=M** de 65 causas, todas con S=5-6, O=2, D=6-8. Esto hace que el CP generado desde este AMFE tenga pocos controles individuales y muchas filas genericas AP=L.

**Recomendacion para Fak (pendiente de su decision)**:
- "Dimensional NOK" deberia ser S=7-8 (falla de encastre que para linea VW) → AP=M
- "Humedad residual en pellet" deberia tener O=3-4 (ocurre si falla el control de secado) → probablemente AP=M
- "Boca atascada por refrigeracion del tornillo" deberia tener D=8 (no hay sensor automatico con interlock) → AP=M
- "Quemaduras visibles" podria tener S=6 + O=3 dependiendo del historial → probablemente AP=L/M

Si Fak aprueba recalibrar estos 3-5 casos, el CP Maestro se regenera con filas individuales para esos modos de falla y el contenido queda mucho mas solido.

---

## Scripts creados

| Script | Proposito |
|---|---|
| `scripts/rebuildInjectionMaster.mjs` | Reconstruye el AMFE maestro desde cero con 6M completo |
| `scripts/syncIpPadFromInjectionMaster.mjs` | Sync IP PAD con el maestro |
| `scripts/syncInsertTopRollFromInjectionMaster.mjs` | Sync Insert + Top Roll |
| `scripts/syncArmrestHeadrestFromInjectionMaster.mjs` | Sync Armrest + 3 Headrests (excluye INYECCION PU) |
| `scripts/testInjectionPropagation.mjs` | Test E2E cross-family (revierte y limpia) |
| `scripts/createInjectionCpMaster.mjs` | Crea CP Maestro desde el AMFE maestro |
| `scripts/_fixAuditBugs.mjs` | Fixes BUG-1/2/3 del audit AMFE |
| `scripts/_fixCpAuditBugs.mjs` | Fixes del audit CP |

---

## Hallazgos tecnicos importantes para futuras sesiones

### 1. Columna `data` de amfe_documents y cp_documents es TEXT (no JSONB)
A pesar de lo que dice la regla `.claude/rules/database.md`, en Supabase estos campos son TEXT:
- **Leer**: `JSON.parse(row.data)` en scripts .mjs
- **Escribir**: `.update({ data: JSON.stringify(obj) })` en scripts .mjs
- **Verificar post-update**: `typeof row.data === 'string'` es lo esperado

La regla vigente decia "NUNCA double-serializar JSONB" — eso sigue siendo valido para columnas JSONB reales, pero no aplica a estas tablas. **Pendiente**: actualizar `.claude/rules/database.md` para aclarar cuales tablas son TEXT y cuales son JSONB.

### 2. Cross-family vs intra-family propagation
- **Intra-family** (ya existia): `triggerChangePropagation` → `propagateChangesToVariants` → crea `family_change_proposals`. Usado para propagar un master de producto a sus variantes (ej. Headrest Front master → Headrest Front L1/L2/L3).
- **Cross-family** (nuevo): `triggerCrossFamilyPropagation` → `propagateMasterAcrossFamilies` → crea `cross_doc_checks`. Usado para propagar un master de proceso a AMFEs de cualquier familia que tengan operaciones que matchean.

Los dos mecanismos conviven sin interferencia. Ambos son fire-and-forget.

### 3. Schema de `cross_doc_checks` no tiene `details` JSON
La tabla solo tiene `source_module, source_doc_id, target_module, target_doc_id, source_revision, source_updated, acknowledged_at`. No hay campo para guardar los `matchedOperationNames` de la alerta cross-family. Por ahora los nombres matched se loggean via `logger.info` pero no persisten. **Mejora futura**: migrar schema para agregar columna `details JSONB` y actualizar la UI para distinguir alertas cross-family de cascada APQP.

### 4. `inferReactionPlan` del generator no distingue recepcion
El bug esta en `modules/controlPlan/controlPlanDefaults.ts`: para items de OP 10 recepcion, la funcion devuelve el template generico de produccion en vez de uno especifico de recepcion con P-14. **Fuera de scope** de esta sesion pero pendiente para sprint futuro.

---

## Estado final del proyecto

- **10 AMFE documents** (incluyendo el maestro)
- **9 CP documents** (incluyendo el nuevo CP maestro de inyeccion)
- **9 product_families** (incluyendo "Proceso de Inyeccion Plastica" id=15)
- **34 family_documents links** (incluyendo el nuevo CP maestro)
- Backup final: `backups/2026-04-11T01-49-39/`
- Tests: 19/19 passing en cross-family propagation + 21/21 en tests relacionados (38/38 total)
- TypeScript: 0 errores nuevos (9 pre-existentes en `modules/CavityCalculator/index.tsx` — no relacionados)

---

## Correcciones finales aplicadas (2026-04-11)

### Recalibracion AMFE Maestro (resuelto)
- Script: `scripts/recalibrateInjectionMaster.mjs`
- AMFE maestro: 11 causas recalibradas, AP H=0/M=6/L=59 (antes 0/1/64)
- Reglas: Dimensional NOK S 6→7, Humedad O 2→3, Certificado/material S 6→7, Linea junta O 2→3
- Re-sincronizo los 7 productos con los nuevos S/O/D preservando causas especificas de producto
- IDs de causas preservados 100% (verificado contra backup pre-cambio)
- Ninguna accion inventada

### Trazabilidad CP → AMFE (resuelto)
- Script: `scripts/fixCpTraceability.mjs`
- 11 de 12 items manuales ahora con `amfeCauseIds` no vacios linkeados a causas reales
- Item sin match: Flamabilidad (nota agregada explicando ausencia en AMFE)
- 0 referencias invalidas en los amfeCauseIds

### Auditor final (2026-04-11)
- Reporte: `docs/AUDITORIA_FINAL_INYECCION_2026-04-11.md`
- **0 TRUE BUGs, 0 ROBUSTNESS, 39+ PASS**
- Tests: 19/19 cross-family propagation PASS
- `tsc --noEmit`: 0 errores nuevos
- **Dictamen: APTO PARA CERRAR**

## Decisiones pendientes que NO bloquean el cierre

1. **Valores numericos TBD** (quedan como TBD por decision de Fak): temperaturas exactas de secadora por material, tiempos de ciclo, tolerancias dimensionales, frecuencias de muestreo en OP 30.
2. **Migracion schema `cross_doc_checks.details JSON`**: para que la UI distinga cross-family de cascada APQP (sprint futuro).
3. **Armrest OP 70 INYECCION PU**: NO se crea segundo maestro por ahora (decision de Fak). Queda intacto con su contenido original de poliuretano.
4. **Accion sobre cross_doc_checks pendientes**: cuando Fak guarde el maestro en produccion, el scanner generara 7 alertas que necesitan ser ack'd. Flujo manual por ahora.
