---
description: Reglas del modulo Plan de Control y cross-validation
globs:
  - "modules/controlPlan/**/*.ts"
  - "modules/controlPlan/**/*.tsx"
---

# Plan de Control (CP)

## Cross-Validation (cpCrossValidation.ts)
- validateCpAgainstAmfe: comparacion general CP vs AMFE
- validateSpecialCharConsistency: CC/SC consistencia (severity-derived vs specialChar explicito)
- validateOrphanFailures: causas AMFE AP=H/M no cubiertas en CP — error AP=H, warning AP=M
- validate4MAlignment: machineDeviceTool vs work element names
- validateReactionPlanOwners: reaction plan owners (CP 2024 mandatory)
- validatePokaYokeFrequency: Poka-Yoke frequency verification
- validatePokaYokeDetectionCoherence: coherencia poka-yoke vs detection rating
- validateSamplingConsistency: muestreo coherente con tipo de control
- validateMachineConsolidation: maquinas consolidadas por operacion
- validateFailureCoverage: modos de falla AMFE sin CP item vinculado (a nivel de failure)

## Deteccion automatica de gaps AMFE→CP y CP→HO
- `cpCrossValidation.ts` V9: detecta modos de falla del AMFE sin item correspondiente en el CP (via amfeFailureId)
- `hoCpLinkValidation.ts` validateCpHoCoverage: detecta CP items sin qcItem en la HO (filtra lab/metrologia/auditor)
- Cuando se modifica un AMFE, verificar si hay modos de falla nuevos sin cobertura en CP
- El generador de CP crea 1 item por caracteristica, AP=L agrupado, CC/SC individual

## Trazabilidad AMFE → CP
- `amfeCauseIds`, `amfeFailureId` en ControlPlanItem
- `amfeAp`, `amfeSeverity`, `operationCategory` populados en generator
- Auto-filled indicator (Sparkles icon + purple tint) en ControlPlanTable

## Reglas de Contenido

### Filtrado AMFE → CP
- TODO pasa del AMFE al CP, pero AP=L se agrupa en lineas genericas por operacion.
- AP=H/M y CC/SC van como linea individual en el CP.

### Filtrado CP → HO
- SOLO pasan al HO los controles que el operario ejecuta en su estacion.
- Controles de laboratorio, metrologia especializada y auditoria NO van en la HO.

### Responsables
- SIEMPRE usar rol generico: "Operador de produccion", "Inspector de Calidad", "Lider de Produccion".
- NUNCA usar nombre de persona como responsable en items del CP.

### Columna Maquina/Dispositivo
- NUNCA contiene metodos de evaluacion (ej: "Visual"). Eso va en `evaluationTechnique`.
- Solo maquina, herramienta o dispositivo fisico.

### Especificacion
- NUNCA generica ("Conforme a especificacion"). Siempre referenciar norma, plano o valor concreto.
- Ejemplo correcto: "Segun TL 1010 VW", "Plano N 227 ±0.5mm".

### Familias
- UN solo CP por familia de producto si el proceso es identico (mismo concepto que AMFE).

### Header
- `customerApproval` es campo UNICO (no separar ingenieria/calidad).
- Core team incluye Produccion: "Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Marianna Vera (Produccion)".
- `approvedBy` = Aprobacion de Ingenieria (Carlos Baptista). Campo separado de planta.
- `plantApproval` = Aprobacion de Planta (Gonzalo Cal / G.Cal). NUNCA usar `approvedBy` para esto.

### Dedup del Generador
- CP items: 1 fila por caracteristica por operacion. NUNCA 1 fila por causa del AMFE.
- Si hay multiples causas para la misma caracteristica, combinar metodos de deteccion en 1 fila (separados con " / ").
- `buildProcessKey` agrupa por (opNumber + causeText). `buildProductKey` agrupa por (opNumber + failDescription).

### Material/Componente en CP
- Columna "Componente/Material": va a la IZQUIERDA junto a N° Pieza/Proceso en el export (2da columna del grupo Proceso).
- Texto rotado 90° vertical en el Excel, merge vertical para agrupar controles del mismo material. Ancho angosto (~5 chars).
- NUNCA meter material dentro de processStepNumber. El PSN debe ser SOLO el numero de operacion ("10", "20").
- Para operaciones que NO son recepcion, componentMaterial queda vacio.
- Columna Producto = propiedad medible del producto (espesor, color, aspecto). NUNCA nombre de componente.
- Columna Proceso = parametro de maquina/proceso (temperatura, presion). NUNCA tipo de producto ni color.

### Nombres de Operaciones
- Nombres estandarizados entre PFD, AMFE, CP y HO:
  - Recepcion: "RECEPCION DE MATERIA PRIMA" (no "RECEPCIONAR", no "RECEPCION DE MATERIALES")
  - Control final: "CONTROL FINAL DE CALIDAD" (no "INSPECCION FINAL", no variantes)
  - Embalaje: "EMBALAJE" (no "EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO")

## Fases del Generador de CP (controlPlanGenerator.ts)

El generador crea CP items desde un AMFE en 4 fases:

### Fase 1: Recolectar causas calificadas
- AP=H o AP=M → individual
- AP=L + CC/SC → individual
- AP=L sin CC/SC → se agrupan por operacion (Fase 3.5)

### Fase 2: Filas de PROCESO (prevencion)
- Clave de dedup: `buildProcessKey(opNumber, causeText)`
- `processCharacteristic` = causa (que parametro de proceso fallo)
- `productCharacteristic` = VACIO
- `controlMethod` = preventionControl (combinado con " / " si multiples)
- `evaluationTechnique` = VACIO (AIAG CP 2024 prohibe en filas de prevencion)

### Fase 3: Filas de PRODUCTO (deteccion)
- Clave de dedup: `buildProductKey(opNumber, failDescription)`
- `productCharacteristic` = modo de falla (que defecto se detecta)
- `processCharacteristic` = VACIO
- `evaluationTechnique` = detectionControl (combinado con " / " si multiples)
- `controlMethod` = VACIO

### Fase 3.5: Filas genericas AP=L
- UNA fila por operacion agrupando TODAS las causas AP=L sin CC/SC
- processCharacteristic = "Autocontrol visual general"
- evaluationTechnique = "Inspeccion visual"
- reactionPlanOwner = "Operador de produccion"

### Fase 4: Ordenamiento
- Por parseInt(processStepNumber) numerico
- Dentro de misma operacion: filas de proceso primero, producto despues

## Funciones de inferencia (controlPlanDefaults.ts)

### getControlPlanDefaults(ap, severity, phase)
- AP=H → sampleSize="100%", sampleFrequency="100%"
- AP=M + preLaunch → "100% (Pre-Lanzamiento)"
- AP=M + S>=9 → "1 pieza" / "Inicio y fin de turno"
- AP=M + otro → "1 pieza" / "Cada lote"
- Reaction plan: S>=9 "Detener linea", S>=7 "Contener producto", S>=4 "Ajustar proceso"

### inferReactionPlanOwner(severity, ap, operationCategory)
- S>=9 o AP=H + inspeccion/control → "Supervisor de Calidad"
- S>=9 o AP=H + otro → "Lider de Produccion / Calidad"
- S>=7 → "Lider de Produccion"
- Otro → "Operador de Produccion"

### inferSpecification(rowType, failDescription, causeDescription)
- Busca keywords en la descripcion y sugiere especificacion
- Producto: "fuera de medida" → "Segun plano / tolerancia dimensional"
- Proceso: "temperatura" → "Rango de temperatura segun set-up"
- Si no matchea → "" (vacio, el usuario debe completar)

### inferControlProcedure(operationCategory)
- Recepcion/almacen → "P-14."
- Todo lo demas → "Segun P-09/I."

## autoFilledFields
- Array de strings en ControlPlanItem que registra que campos fueron auto-llenados
- UI muestra icono Sparkles + tinte violeta en esos campos
- Al editar manualmente un campo auto-llenado, el campo se saca del array
- Al regenerar desde AMFE, el array se recalcula

## Validaciones preventivas (pre-guardado)

El modulo CP tiene validacion automatica antes de cada guardado (`cpPreSaveValidation.ts`).
7 reglas:

| # | Regla | Tipo |
|---|-------|------|
| B1 | Items recepcion (OP<=10) sin componentMaterial | warning |
| B2 | Especificacion generica ("TBD", "Segun especificacion", vacia) | warning |
| B3 | Producto Y Proceso en la misma fila | bloqueo |
| B4 | Tecnica evaluacion solo "Visual" o "Inspeccion" sin detalle | warning |
| B5 | Items recepcion sin P-14 en plan de reaccion | warning |
| B6 | CC/SC difiere entre CP y AMFE vinculado | warning |
| B7 | approvedBy Y plantApproval ambos vacios | bloqueo |

## Valores numericos (pesos, tolerancias, consumos)
NUNCA confirmar ni conservar valores numericos sin confirmacion explicita de Fak.
En caso de duda: TBD. Solo Fak valida datos de ingenieria.

## Procedimientos SGC para Plan de Reaccion
| Procedimiento | Nombre | Uso en CP |
|---------------|--------|-----------|
| P-05 | Control de Documentos | Referencia en header |
| P-08 | Identificacion y Trazabilidad | Items de trazabilidad |
| P-09/I | Control de Proceso | Reaccion default produccion |
| P-10/I | Inspeccion y Ensayo | Controles de laboratorio |
| P-13 | Producto No Conforme | Segregacion de rechazos |
| P-14 | Recepcion de Materiales | Reaccion recepcion MP |
