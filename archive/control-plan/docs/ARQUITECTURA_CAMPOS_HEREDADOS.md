# Arquitectura de campos heredados vs locales

Documentacion de la arquitectura implementada en `modules/controlPlan/fieldClassification.ts`.
Validada con AIAG CTS y manual CP 2024.

## Concepto

Cada campo de un documento APQP downstream es:
- **HEREDADO**: viene del documento upstream, se actualiza automaticamente al regenerar
- **LOCAL**: exclusivo del documento, el usuario lo completa, NUNCA se sobreescribe al regenerar

## CP items (AMFE → CP)

| Campo | Tipo | Fuente |
|-------|------|--------|
| processStepNumber | HEREDADO | AMFE operacion (opNumber) |
| processDescription | HEREDADO | AMFE operacion (name) |
| productCharacteristic | HEREDADO | AMFE failure mode (description) |
| processCharacteristic | HEREDADO | AMFE causa (description) |
| specialCharClass | HEREDADO | AMFE CC/SC (severity-derived o explicito) |
| characteristicNumber | HEREDADO | AMFE causa (characteristicNumber) |
| machineDeviceTool | HEREDADO | AMFE work element (name) |
| amfeFailureId | HEREDADO | AMFE failure ID (trazabilidad) |
| amfeSeverity | HEREDADO | AMFE severidad |
| amfeAp | HEREDADO | AMFE prioridad de accion |
| amfeCauseIds | HEREDADO | AMFE causa IDs (trazabilidad) |
| amfeFailureIds | HEREDADO | AMFE failure IDs (agrupados) |
| operationCategory | HEREDADO | AMFE categoria de operacion |
| specification | LOCAL | Usuario completa |
| sampleSize | LOCAL | Usuario completa (defaults auto-sugeridos) |
| sampleFrequency | LOCAL | Usuario completa (defaults auto-sugeridos) |
| evaluationTechnique | LOCAL | Usuario completa |
| reactionPlan | LOCAL | Usuario completa (defaults auto-sugeridos) |
| reactionPlanOwner | LOCAL | Usuario completa (defaults auto-sugeridos) |
| componentMaterial | LOCAL | Usuario completa |
| controlMethod | LOCAL | Usuario completa |
| controlProcedure | LOCAL | Usuario completa (inferido por operationCategory) |

## HO Quality Checks (CP → HO)

| Campo | Tipo | Fuente |
|-------|------|--------|
| characteristic | HEREDADO | CP item (productCharacteristic o processCharacteristic) |
| specification | HEREDADO | CP item (specification) |
| evaluationTechnique | HEREDADO | CP item (evaluationTechnique) |
| frequency | HEREDADO | CP item (sampleFrequency) |
| controlMethod | HEREDADO | CP item (controlMethod) |
| reactionAction | HEREDADO | CP item (reactionPlan) |
| reactionContact | HEREDADO | CP item (reactionPlanOwner) |
| specialCharSymbol | HEREDADO | CP item (specialCharClass) |
| cpItemId | HEREDADO | CP item ID (trazabilidad) |
| registro | LOCAL | Usuario completa (formulario/planilla donde registrar) |

## HO Sheets (AMFE → HO)

| Campo | Tipo | Fuente |
|-------|------|--------|
| amfeOperationId | HEREDADO | AMFE operacion ID |
| operationNumber | HEREDADO | AMFE operacion (opNumber) |
| operationName | HEREDADO | AMFE operacion (name) |
| hoNumber | HEREDADO | Derivado: "HO-{opNumber}" |
| partCodeDescription | HEREDADO | AMFE header (partNumber + subject) |
| vehicleModel | HEREDADO | AMFE header (modelYear) |
| reactionContact | HEREDADO | Primer CP item (reactionPlanOwner) |
| steps | LOCAL | Usuario edita (pasos TWI) |
| visualAids | LOCAL | Usuario sube imagenes |
| safetyElements | LOCAL | EPP (inferido inicialmente, usuario edita) |
| sector | LOCAL | Usuario completa |
| puestoNumber | LOCAL | Usuario completa |
| preparedBy | LOCAL | Usuario completa |
| approvedBy | LOCAL | Usuario completa |
| date | LOCAL | Default hoy, usuario edita |
| revision | LOCAL | Default 'A' |
| status | LOCAL | Default 'borrador' |
| reactionPlanText | LOCAL | Default texto estandar |

## Reglas del generador

### Al regenerar CP desde AMFE (`mergeGeneratedWithExisting`)

1. Generar items nuevos desde AMFE (4 fases: causas calificadas, filas proceso, filas producto, AP=L agrupadas)
2. Para cada item generado, buscar match en items existentes por dedup key
3. Si match encontrado: actualizar SOLO campos heredados, preservar campos locales
4. Si campo local esta vacio Y esta en `autoFilledFields`: actualizar con nueva sugerencia
5. Si campo local tiene valor Y NO esta en `autoFilledFields`: NO tocar (dato del usuario)
6. Si item existente sin match en generados: marcar `orphaned: true`, NO eliminar
7. Items nuevos sin match en existentes: crear con locales en blanco (o auto-sugeridos)

### Al regenerar HO desde CP (`mergeHoWithExisting`)

- Misma logica: UPSERT heredados, preservar locales, marcar huerfanos
- Match de sheets por `operationNumber` (primario) o `amfeOperationId` (fallback)
- Match de QCs dentro de sheets por `cpItemId`

## `autoFilledFields` — concepto ortogonal

Un campo puede ser LOCAL (no se sobreescribe con datos heredados) y al mismo tiempo tener un valor auto-sugerido. El array `autoFilledFields` registra que campos fueron llenados automaticamente por las funciones de inferencia (`getControlPlanDefaults`, `inferSpecification`, etc.).

La regla es:
- Si un campo local tiene valor Y esta en `autoFilledFields` → se puede actualizar con nueva sugerencia
- Si un campo local tiene valor Y NO esta en `autoFilledFields` → el usuario lo edito, NO tocar

En la UI, los campos auto-sugeridos muestran icono Sparkles y tinte violeta.

## Archivos clave

| Archivo | Contenido |
|---------|-----------|
| `modules/controlPlan/fieldClassification.ts` | Constantes CP_INHERITED_FIELDS, CP_LOCAL_FIELDS, HO_QC_*, HO_SHEET_* |
| `modules/controlPlan/controlPlanGenerator.ts` | `mergeGeneratedWithExisting()` — merge CP con preservacion |
| `modules/hojaOperaciones/hojaOperacionesGenerator.ts` | `mergeHoWithExisting()` — merge HO con preservacion |
| `modules/controlPlan/controlPlanDefaults.ts` | Funciones de auto-sugerencia (defaults, specification, owner) |
