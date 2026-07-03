---
description: Reglas del modulo Plan de Control (generador, contenido, validaciones)
paths:
  - "modules/controlPlan/**"
---

# Plan de Control (CP)

Criterios CC/SC, severidades y escalas: regla `amfe.md`. HOs no se hacen aca (regla `no-pfd-no-ho.md`); las reglas de filtrado CP→HO quedan solo como conocimiento historico.

## Filtrado AMFE → CP
- TODO pasa del AMFE al CP: AP=H/M y CC/SC como linea individual; AP=L sin CC/SC se agrupa en lineas genericas por operacion.
- V9 de `cpCrossValidation.ts` detecta modos de falla del AMFE sin item en el CP (via `amfeFailureId`). Al modificar un AMFE, verificar cobertura.
- Trazabilidad: `amfeCauseIds`, `amfeFailureId`, `amfeAp`, `amfeSeverity`, `operationCategory` populados por el generator. `autoFilledFields[]` registra campos auto-llenados (UI: icono Sparkles + tinte violeta; editar manualmente lo saca del array).

## Reglas de contenido
- **Responsables**: SIEMPRE rol generico ("Operador de Produccion", "Inspector de Calidad", "Lider de Produccion"). NUNCA nombre de persona en items.
- **Maquina/Dispositivo**: solo maquina/herramienta/dispositivo fisico. Metodos de evaluacion ("Visual") van en `evaluationTechnique`.
- **Especificacion**: NUNCA generica ("Conforme a especificacion"). Referenciar norma, plano o valor: "Segun TL 1010 VW", "Plano N 227 ±0.5mm". El parametro numerico exacto vive ACA, no en el AMFE.
- **Familias**: UN solo CP por familia si el proceso es identico.
- **Header**: `customerApproval` es campo unico. Core team incluye Produccion: "Carlos Baptista (Ingenieria), Manuel Meszaros (Calidad), Marianna Vera (Produccion)". `approvedBy` = Ingenieria (Carlos Baptista); `plantApproval` = Planta (Gonzalo Cal) — campos distintos. Revisado y Aprobado NUNCA la misma persona.
- **Material/Componente**: columna a la IZQUIERDA junto a N° Pieza (2da del grupo Proceso), texto rotado 90°, merge vertical, ancho ~5 chars. NUNCA material dentro de `processStepNumber` (PSN = solo numero de OP). Columna Producto = propiedad medible; columna Proceso = parametro de maquina. El generador NUNCA llena `componentMaterial` — asignar a mano post-generacion en items de recepcion (validacion B1 avisa).
- **Nombres de operaciones** estandarizados con el AMFE: "RECEPCION DE MATERIA PRIMA", "CONTROL FINAL DE CALIDAD", "EMBALAJE".

## Generador (controlPlanGenerator.ts) — 4 fases
1. Recolectar causas calificadas (AP=H/M individual; AP=L+CC/SC individual; AP=L resto agrupado).
2. Filas de PROCESO (prevencion): dedup `buildProcessKey(opNumber, causeText)`; `processCharacteristic`=causa; `controlMethod`=preventionControl (multiples con " / "); `evaluationTechnique` VACIO (AIAG CP 2024 lo prohibe en prevencion).
3. Filas de PRODUCTO (deteccion): dedup `buildProductKey(opNumber, failDescription)`; `productCharacteristic`=modo de falla; `evaluationTechnique`=detectionControl; `controlMethod` VACIO.
   3.5. Fila generica AP=L: UNA por operacion ("Autocontrol visual general" / "Inspeccion visual" / "Operador de produccion").
4. Orden por `parseInt(processStepNumber)`; dentro de la OP: proceso primero, producto despues.
- **Dedup**: 1 fila por caracteristica por operacion, NUNCA 1 fila por causa. Multiples causas de la misma caracteristica → combinar metodos con " / ".

## Defaults inferidos (controlPlanDefaults.ts)
- `getControlPlanDefaults`: AP=H → 100%/100%; AP=M+preLaunch → "100% (Pre-Lanzamiento)"; AP=M+S>=9 → "1 pieza"/"Inicio y fin de turno"; AP=M otro → "1 pieza"/"Cada lote". Reaccion: S>=9 "Detener linea", S>=7 "Contener producto", S>=4 "Ajustar proceso".
- `inferReactionPlanOwner`: S>=9 o AP=H+inspeccion → "Supervisor de Calidad"; S>=9 o AP=H → "Lider de Produccion / Calidad"; S>=7 → "Lider de Produccion"; resto → "Operador de Produccion".
- `inferControlProcedure`: recepcion/almacen → "P-14."; resto → "Segun P-09/I.".
- `inferSpecification`: por keywords; sin match → "" (usuario completa).

## Validaciones pre-guardado (cpPreSaveValidation.ts)
B1 recepcion sin componentMaterial (warn); B2 especificacion generica (warn); B3 Producto Y Proceso en misma fila (**bloqueo**); B4 tecnica solo "Visual" sin detalle (warn); B5 recepcion sin P-14 (warn); B6 CC/SC difiere del AMFE (warn); B7 approvedBy y plantApproval ambos vacios (**bloqueo**).

## Procedimientos SGC para plan de reaccion
P-05 Control de Documentos (header) · P-08 Trazabilidad · P-09/I Control de Proceso (default produccion) · P-10/I Inspeccion y Ensayo (laboratorio) · P-13 Producto No Conforme (segregacion) · P-14 Recepcion de Materiales.
