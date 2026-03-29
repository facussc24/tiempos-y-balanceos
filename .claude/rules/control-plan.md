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
