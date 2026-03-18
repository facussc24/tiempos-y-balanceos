# Auditoria de Validacion Cruzada APQP

**Fecha:** 2026-03-17
**Ejecutado por:** Claude Code (audit automatizado)
**Base de datos:** Supabase (PostgreSQL) - fbfsbbewmgoegjgnkkag.supabase.co
**Metodo:** Ejecucion offline de las reglas de validacion del codebase contra datos reales de Supabase

---

## Resumen Ejecutivo

| Metrica | Valor |
|---------|-------|
| Documentos PFD analizados | 11 |
| Documentos AMFE analizados | 26 |
| Documentos CP analizados | 26 |
| Documentos HO analizados | 25 |
| **Total ERRORES** | **0** |
| **Total WARNINGS** | **308** |
| **Total INFO** | **266** |

### Desglose por regla de validacion

| Regla | Codigo | Errores | Warnings | Info | Total |
|-------|--------|---------|----------|------|-------|
| V1: CC/SC Clasificacion faltante | CC_SC_MISSING | 0 | 203 | 0 | 203 |
| V1: CC/SC Clasificacion incorrecta | CC_SC_MISMATCH | 0 | 77 | 0 | 77 |
| V2: Fallas AMFE sin cobertura en CP | ORPHAN_FAILURE | 0 | 24 | 0 | 24 |
| V3: 4M Desalineacion maquina/elemento | 4M_MISMATCH | 0 | 0 | 33 | 33 |
| V4: Responsable plan de reaccion faltante | MISSING_OWNER | 0 | 0 | 0 | 0 |
| V5: Poka-Yoke sin frecuencia de verificacion | POKAYOKE_NO_VERIFY | 0 | 3 | 0 | 3 |
| V6: Poka-Yoke con deteccion AMFE alta | POKAYOKE_HIGH_D | 0 | 1 | 0 | 1 |
| V7: Muestra 100% sin frecuencia continua | SAMPLE_INCONSISTENCY | 0 | 0 | 203 | 203 |
| V8: Multiples maquinas por proceso | MULTIPLE_MACHINES | 0 | 0 | 30 | 30 |
| PFD->AMFE Links rotos | BROKEN_PFD_LINK | 0 | 0 | 0 | 0 |
| AMFE->PFD Links rotos | BROKEN_AMFE_LINK | 0 | 0 | 0 | 0 |
| HO->CP Links rotos | BROKEN_HO_CP_LINK | 0 | 0 | 0 | 0 |

---

## 1. PFD <-> AMFE Links Rotos

**Resultado: 0 links rotos encontrados.**

Todas las referencias bidireccionales entre PFD steps y AMFE operations son validas. No se encontraron `linkedAmfeOperationId` en PFD apuntando a operaciones inexistentes, ni `linkedPfdStepId` en AMFE apuntando a pasos inexistentes.

---

## 2. HO -> CP Links Rotos

**Resultado: 0 links rotos encontrados.**

Todos los `cpItemId` en quality checks de HO apuntan a items validos dentro de sus respectivos Control Plans vinculados. No se encontraron referencias huerfanas.

---

## 3. CP <-> AMFE Validacion Cruzada (V1-V8)

### V1: CC/SC Clasificacion (280 warnings)

Regla: Los items del CP deben reflejar la clasificacion CC/SC derivada de la severidad del AMFE (S>=9 -> CC, S>=5 -> SC).

#### V1a: CC_SC_MISSING (203 warnings) - Clasificacion faltante en CP

Items de CP que deberian tener clasificacion CC o SC segun el AMFE vinculado, pero no la tienen.

**Productos afectados (resumen deduplicado por proceso unico):**

| Producto | Proceso CP afectado | Clasificacion esperada | AMFE Severidad | Falla AMFE |
|----------|---------------------|------------------------|----------------|------------|
| VWA/PATAGONIA/INSERTO | RECEPCIONAR MATERIA PRIMA | SC | S=6 | Material/pieza golpeada o danada durante transporte |
| VWA/PATAGONIA/INSERTO | Embalaje - EMBALAJE Y ETIQUETADO | SC | S=7 | Pieza deformada por mal posicionamiento en el embalaje |
| VWA/PATAGONIA/INSERTO [L0] | RECEPCIONAR MATERIA PRIMA | SC | S=6 | Material/pieza golpeada o danada durante transporte |
| VWA/PATAGONIA/INSERTO [L0] | Embalaje - EMBALAJE Y ETIQUETADO | SC | S=7 | Pieza deformada por mal posicionamiento en el embalaje |
| VWA/PATAGONIA/TOP_ROLL | Multiples procesos (recepcion, inyeccion, adhesivado, IMG, trimming, edge folding, inspeccion, empaque) | SC | S=5-8 | Varias fallas |
| PWA/TELAS_TERMOFORMADAS | Multiples procesos | SC | S=5-8 | Varias fallas |
| VWA/PATAGONIA/HEADREST_* (todos los niveles) | Recepcion | SC | S=9 | Control de VINILO - Flamabilidad |
| VWA/PATAGONIA/HEADREST_* (todos los niveles) | Virolado + Refilado | SC | S=5+ | Varias fallas |
| VWA/PATAGONIA/ARMREST | Multiples procesos | SC | S=5-8 | Varias fallas |

**Nota:** Muchos de estos warnings se multiplican porque hay multiple CP items por proceso (uno por caracteristica). El numero real de procesos unicos afectados es significativamente menor que 203.

#### V1b: CC_SC_MISMATCH (77 warnings) - Clasificacion incorrecta en CP

Items que tienen una clasificacion CC/SC pero no coincide con la esperada del AMFE.

| Producto | Proceso CP | Tiene | Esperado | AMFE S |
|----------|-----------|-------|----------|--------|
| VWA/PATAGONIA/INSERTO | Tapizado - Tapizado semiautomatico | SC | CC | S=10 |
| VWA/PATAGONIA/INSERTO | Inspeccion Final - CONTROL FINAL | SC | CC | S=9 |
| VWA/PATAGONIA/INSERTO [L0] | Tapizado - Tapizado semiautomatico | SC | CC | S=10 |
| VWA/PATAGONIA/INSERTO [L0] | Inspeccion Final - CONTROL FINAL | SC | CC | S=9 |
| VWA/PATAGONIA/TOP_ROLL | Multiples procesos | SC | CC | S=9-10 |

**Accion recomendada:** Los items con S>=9 deben ser CC (Critical Characteristic), no SC. Verificar con ingenieria de calidad si la severidad del AMFE es correcta o si la clasificacion del CP debe actualizarse.

---

### V2: Fallas AMFE Huerfanas sin cobertura en CP (24 warnings)

Regla: Cada causa AMFE con AP=H, AP=M, o clasificacion SC/CC debe tener un item correspondiente en el CP.

**PWA/TELAS_PLANAS (10 fallas huerfanas):**

| Operacion AMFE | Falla | Causa | AP |
|----------------|-------|-------|----|
| Corte por maquina de pieza Central | Agujeros de O4 menor a 17 por pieza | Material fuera de especificacion requerida | L [SC] |
| Corte por maquina de pieza Central | Orificios fuera de posicion segun pieza patron | Programacion equivocada de la maquina de corte automatica | L [SC] |
| Corte por maquina de pieza Central | Material distinto a punzonado de 120g/m2 | Material fuera de especificacion requerida | L [SC] |
| Corte por maquina, Blank de piezas laterales | Medida mayor a 550mmx500mm | Material fuera de especificacion requerida | L [SC] |
| Colocado de Aplix | Colocacion de menos de 9 aplix | Orificios fuera de posicion / Error del operario | L [SC] |
| Colocado de Aplix | Colocacion de Aplix en posicion distinta | Orificios fuera de posicion / Error del operario | L [SC] |
| Embalaje | Mayor de 25 piezas por medio | Error de conteo | L [SC] |
| Embalaje | Menor de 25 piezas por medio | Error de conteo | L [SC] |
| Embalaje | Error de identificacion | Error de identificacion por parte del operador | L [SC] |
| Embalaje | Falta de identificacion | Etiqueta mal colocada | L [SC] |

**PWA/TELAS_TERMOFORMADAS (14 fallas huerfanas):**

| Operacion AMFE | Falla | Causa | AP |
|----------------|-------|-------|----|
| Preparacion de corte | Desplazamiento involuntario del material TNT | Operario no verifico enrase | L [SC] |
| Preparacion de corte | TNT plegado involuntariamente al cargar | El operario carga el TNT con un pliegue | L [SC] |
| Corte por maquina automatica | Largo distinto al especificado | Programacion equivocada | L [SC] |
| Corte por maquina automatica | Falta de orificios | Programacion equivocada | L [SC] |
| Corte por maquina automatica | Orificios fuera de posicion | Programacion equivocada | L [SC] |
| Costura fuerte | Refuerzo costurado opuesto al airbag inverso | Falla del operario | L [SC] |
| Costura fuerte | Falta de costura | Carreteles mal ubicados | L [SC] |
| Costura fuerte | Falta de costura | Aguja mal ubicada | L [SC] |
| Costura fuerte | Costura floja / deficiente | Falla en la tension del hilo | L [SC] |
| Colocado de clips | Clips en posicion incorrecta | Orificios fuera de posicion | L [SC] |
| Colocado de clips | Falta de clips | Falta de orificios | L [SC] |
| Pegado de dots | Dots en posicion incorrecta | Orificios fuera de posicion | L [SC] |
| Pegado de dots | Falta de dots | Falta de orificios | L [SC] |
| Inspeccion final | Dimensional fuera de especificacion | Programacion equivocada | L [SC] |

**Nota:** Todas estas fallas tienen AP=L pero severidad S>=5, lo cual les asigna clasificacion SC. Segun IATF 16949 parrafo 8.3.3.3, las caracteristicas SC/CC deben tener cobertura en el CP independientemente del AP. El matching es por nombre de operacion normalizado; si los nombres difieren ligeramente entre AMFE y CP, puede generar falsos positivos.

---

### V3: 4M Desalineacion Maquina/Elemento (33 info)

Regla: El campo `machineDeviceTool` del CP debe coincidir con los work elements del AMFE para la misma operacion.

**Productos afectados:**

| Producto | Cantidad de items |
|----------|-------------------|
| VWA/PATAGONIA/INSERTO | 9 |
| VWA/PATAGONIA/INSERTO [L0] | 18 (duplicado por dos CPs L0) |
| VWA/PATAGONIA/TOP_ROLL | 6 |

**Procesos tipicos con desalineacion:**
- RECEPCIONAR MATERIA PRIMA: CP dice "Planilla de recepcion / Documentacion", AMFE lista "Autoelevador, Calibres, Hoja de operaciones..."
- Tapizado semiautomatico: CP dice "Termometro infrarrojo" o "Timer / Display", AMFE lista "Maquina de tapizado..."
- Inspeccion Final: CP dice "Puesto de inspeccion", AMFE lista "Operador de calidad, Hoja de operaciones..."
- Embalaje: CP dice "Caja 496mm...", AMFE lista "Etiquetas / Bolsas / Lapicera / Medios..."

**Nota:** Estos son info (no errores). La desalineacion es comun porque CP y AMFE describen las 4M desde perspectivas diferentes (CP lista el instrumento de medicion, AMFE lista el equipo de proceso).

---

### V4: Responsable Plan de Reaccion (0 issues)

**Resultado: Todos los items de CP tienen responsable de plan de reaccion asignado.**

Esto indica cumplimiento con AIAG CP 1st Ed (2024) respecto a la obligatoriedad de este campo.

---

### V5: Poka-Yoke sin Frecuencia de Verificacion (3 warnings)

| Producto | Proceso CP | Metodo | Frecuencia actual |
|----------|-----------|--------|-------------------|
| Proceso de fabricacion - Top Roll | Soldado refuerzos y tweeter | Poka-Yoke | (sin "verificacion" en frecuencia) |
| VWA/PATAGONIA/TOP_ROLL | EDGE FOLDING | Poka-Yoke | (sin "verificacion" en frecuencia) |
| VWA/PATAGONIA/TOP_ROLL | EMPAQUE FINAL Y ETIQUETADO | Poka-Yoke | (sin "verificacion" en frecuencia) |

**Accion recomendada:** Agregar frecuencia de verificacion del dispositivo Poka-Yoke (ej: "Verificar pieza patron al inicio de turno").

---

### V6: Poka-Yoke con Deteccion AMFE Alta (1 warning)

| Producto | Proceso CP | Deteccion AMFE | Esperado |
|----------|-----------|----------------|----------|
| VWA/PATAGONIA/TOP_ROLL | EDGE FOLDING | D=5 | D<=3 |

**Accion recomendada:** Si el Poka-Yoke esta activo, la deteccion en el AMFE deberia reflejar la mejora (D<=3). Verificar si el AMFE fue actualizado despues de implementar el Poka-Yoke.

---

### V7: Muestra 100% con Frecuencia Inconsistente (203 info)

Regla: Si la muestra es "100%", la frecuencia deberia indicar muestreo continuo ("cada pieza", "continuo", etc.).

**Frecuencias detectadas como inconsistentes:**
- "Cada recepcion" (recepcion de materia prima)
- "Cada tendido" (preparacion de corte)
- "Cada caja" (embalaje)
- "Cada contenedor" / "Cada cont." (embalaje)
- "Por lote" (headrests - virolado, ensamble, espumado, inspeccion)
- "Por turno" (headrests - embalaje)
- "Cada caja/pallet" (embalaje)
- "Cada pallet" (embalaje)

**Distribucion por producto:**

| Producto | Items afectados |
|----------|----------------|
| VWA/PATAGONIA/HEADREST_FRONT [L1-L3] | 15 c/u |
| VWA/PATAGONIA/HEADREST_REAR_OUT [L0-L3] | 15 c/u |
| VWA/PATAGONIA/HEADREST_FRONT [L0] | 15 |
| VWA/PATAGONIA/HEADREST_REAR_CEN [L0-L3] | 13 c/u |
| VWA/PATAGONIA/INSERTO [L0] | 8 |
| Proceso de fabricacion - Top Roll | 7 |
| VWA/PATAGONIA/INSERTO | 4 |
| VWA/PATAGONIA/TOP_ROLL | 4 |
| Otros (Telas Planas, Telas Termoformadas, etc.) | 1-3 c/u |

**Nota:** Muchas de estas frecuencias son semanticamente correctas (ej: "Cada recepcion" es 100% de las recepciones) pero no contienen las palabras clave que el validador busca ("pieza", "continuo", "cada una"). Es un tema de terminologia, no necesariamente un error de contenido.

---

### V8: Multiples Maquinas por Proceso (30 info)

| Producto | Procesos afectados |
|----------|-------------------|
| VWA/PATAGONIA/INSERTO [L0] | 12 |
| VWA/PATAGONIA/TOP_ROLL | 7 |
| VWA/PATAGONIA/INSERTO | 6 |
| Telas Planas PWA | 1 |
| Armrest Door Panel Patagonia | 1 |
| Top Roll Patagonia | 1 |
| Proceso de fabricacion - Top Roll | 1 |
| VWA/PATAGONIA/ARMREST | 1 |

**Nota:** AIAG CP 2024 recomienda consolidar maquinas por proceso, pero no es obligatorio. Es informativo.

---

## 4. Resumen por Producto

| Producto | Errores | Warnings | Info | Total |
|----------|---------|----------|------|-------|
| VWA/PATAGONIA/INSERTO [L0] | 0 | 52 | 38 | 90 |
| VWA/PATAGONIA/TOP_ROLL | 0 | 38 | 17 | 55 |
| VWA/PATAGONIA/INSERTO | 0 | 26 | 19 | 45 |
| PWA/TELAS_TERMOFORMADAS | 0 | 14 | 0 | 14 |
| VWA/PATAGONIA/HEADREST_REAR_CEN | 0 | 13 | 13 | 26 |
| VWA/PATAGONIA/HEADREST_REAR_CEN [L1] | 0 | 13 | 13 | 26 |
| VWA/PATAGONIA/HEADREST_REAR_CEN [L2] | 0 | 13 | 13 | 26 |
| VWA/PATAGONIA/HEADREST_REAR_CEN [L3] | 0 | 13 | 13 | 26 |
| VWA/PATAGONIA/HEADREST_FRONT | 0 | 13 | 15 | 28 |
| VWA/PATAGONIA/HEADREST_FRONT [L1] | 0 | 13 | 15 | 28 |
| VWA/PATAGONIA/HEADREST_FRONT [L2] | 0 | 13 | 15 | 28 |
| VWA/PATAGONIA/HEADREST_FRONT [L3] | 0 | 13 | 15 | 28 |
| VWA/PATAGONIA/HEADREST_REAR_OUT | 0 | 13 | 15 | 28 |
| VWA/PATAGONIA/HEADREST_REAR_OUT [L1] | 0 | 13 | 15 | 28 |
| VWA/PATAGONIA/HEADREST_REAR_OUT [L2] | 0 | 13 | 15 | 28 |
| VWA/PATAGONIA/HEADREST_REAR_OUT [L3] | 0 | 13 | 15 | 28 |
| VWA/PATAGONIA/ARMREST | 0 | 11 | 1 | 12 |
| PWA/TELAS_PLANAS | 0 | 10 | 0 | 10 |
| Proceso de fabricacion - Top Roll | 0 | 1 | 8 | 9 |
| Telas Planas PWA | 0 | 0 | 4 | 4 |
| Armrest Door Panel Patagonia | 0 | 0 | 2 | 2 |
| Top Roll Patagonia | 0 | 0 | 2 | 2 |
| Telas Termoformadas PWA | 0 | 0 | 1 | 1 |
| Insert Patagonia | 0 | 0 | 1 | 1 |
| Insert Patagonia [L0] | 0 | 0 | 1 | 1 |

---

## 5. Reglas de Validacion Documentadas

### Motor 1: PFD <-> AMFE (`utils/pfdAmfeLinkValidation.ts`)
- **Direccion PFD->AMFE:** Verifica que cada `linkedAmfeOperationId` en PFD steps apunte a un operation existente en el AMFE
- **Direccion AMFE->PFD:** Verifica que cada `linkedPfdStepId` en AMFE operations apunte a un step existente en el PFD

### Motor 2: HO -> CP (`utils/hoCpLinkValidation.ts`)
- **Direccion unica HO->CP:** Verifica que cada `cpItemId` en quality checks de HO apunte a un item existente en el CP vinculado
- HO referencia CP pero CP no referencia HO (unidireccional)

### Motor 3: CP <-> AMFE (`modules/controlPlan/cpCrossValidation.ts`)
8 reglas implementadas:
- **V1 (CC_SC):** Consistencia de clasificacion CC/SC entre CP y severidad AMFE (S>=9->CC, S>=5->SC)
- **V2 (ORPHAN_FAILURE):** Causas AMFE con AP=H/M o SC/CC sin cobertura en CP
- **V3 (4M_MISMATCH):** Alineacion de machineDeviceTool del CP con work elements del AMFE
- **V4 (MISSING_OWNER):** Responsable del plan de reaccion obligatorio (AIAG CP 2024)
- **V5 (POKAYOKE_NO_VERIFY):** Metodo Poka-Yoke sin frecuencia de verificacion del dispositivo
- **V6 (POKAYOKE_HIGH_D):** Poka-Yoke presente pero deteccion AMFE D>3 (deberia ser D<=3)
- **V7 (SAMPLE_INCONSISTENCY):** Muestra 100% sin frecuencia de muestreo continuo
- **V8 (MULTIPLE_MACHINES):** Multiples maquinas distintas en un mismo proceso

### Motor 4: Cascada APQP (`utils/crossDocumentAlerts.ts`)
- Detecta cambios upstream en la cadena PFD -> AMFE -> CP -> HO
- Genera alertas cuando un documento upstream fue revisado pero el downstream no se actualizo
- No genera hallazgos de links rotos (opera sobre revisiones, no datos)

---

## 6. Conclusiones

### Fortalezas
1. **Integridad referencial excelente:** 0 links rotos entre PFD<->AMFE y HO->CP en 88 documentos
2. **V4 cumplido al 100%:** Todos los items de CP tienen responsable de plan de reaccion
3. **Sin errores criticos:** No se encontraron errores de severidad "error" en ninguna regla

### Areas de mejora prioritarias
1. **V1 CC/SC (280 warnings):** El area mas grande. Muchos items de CP no reflejan la clasificacion CC/SC derivada del AMFE. Priorizar los CC (S>=9) que estan marcados como SC.
2. **V2 Fallas huerfanas (24 warnings):** 24 causas AMFE con clasificacion SC no tienen cobertura en el CP. Concentradas en PWA (Telas Planas y Telas Termoformadas).
3. **V5/V6 Poka-Yoke (4 warnings):** 3 items con Poka-Yoke sin frecuencia de verificacion y 1 con deteccion AMFE no actualizada. Todos en Top Roll.

### Areas informativas (no requieren accion inmediata)
4. **V7 Muestra (203 info):** Frecuencias como "Por lote" o "Cada recepcion" son semanticamente correctas para 100% pero no usan la terminologia esperada. Considerar expandir el vocabulario del validador.
5. **V8 Multiples maquinas (30 info):** Normal en procesos complejos. Informativo solamente.
6. **V3 4M (33 info):** Desalineacion entre nomenclatura de CP y AMFE. Comun porque describen perspectivas diferentes.

---

*Informe generado automaticamente. Los datos raw de la auditoria estan en `docs/_audit_results.json`.*
