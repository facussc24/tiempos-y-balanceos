---
description: Reglas del modulo Plan de Control y cross-validation
globs:
  - "modules/controlPlan/**/*.ts"
  - "modules/controlPlan/**/*.tsx"
---

# Plan de Control (CP)

## Cross-Validation (cpCrossValidation.ts)
- V1: CC/SC consistencia (severity-derived vs specialChar explicito)
- V2: Orphan failures (causas AMFE AP=H/M no cubiertas en CP) — error AP=H, warning AP=M
- V3: 4M alignment (machineDeviceTool vs work element names)
- V4: Reaction plan owners (CP 2024 mandatory)
- V5: Poka-Yoke frequency verification

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
- Columna adicional "Componente/Material" (AIAG CP 2024 Cap 1.1 avala columnas extra).
- Se usa para identificar a que material aplica cada control, especialmente en Recepcion MP.
- En el export Excel, mergear celdas verticalmente cuando items consecutivos tienen el mismo componentMaterial.
- El processStepNumber debe ser SOLO el numero de operacion ("10", "20"). NUNCA agregar sufijos de material.
- Para operaciones que NO son recepcion, componentMaterial queda vacio.
- Columna Producto = propiedad medible del producto (espesor, color, aspecto). NUNCA nombre de componente.
- Columna Proceso = parametro de maquina/proceso (temperatura, presion). NUNCA tipo de producto ni color.

### Nombres de Operaciones
- Nombres estandarizados entre PFD, AMFE, CP y HO:
  - Recepcion: "RECEPCION DE MATERIA PRIMA" (no "RECEPCIONAR", no "RECEPCION DE MATERIALES")
  - Control final: "CONTROL FINAL DE CALIDAD" (no "INSPECCION FINAL", no variantes)
  - Embalaje: "EMBALAJE" (no "EMBALAJE Y ETIQUETADO DE PRODUCTO TERMINADO")
