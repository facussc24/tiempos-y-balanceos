# Auditoria 1C: Inventario de EPP en Hojas de Operacion

**Fecha**: 2026-03-23
**Alcance**: 17 documentos HO, 171 hojas de operacion
**Fuente**: Supabase (campo `safetyElements` de cada `HojaOperacion`)
**Catalogo EPP disponible**: anteojos, guantes, zapatos, proteccionAuditiva, delantal, respirador (6 items)

---

## 1. Resumen Ejecutivo

| Metrica | Valor |
|---------|-------|
| Total hojas de operacion | 171 |
| Hojas CON EPP asignado | 151 (88.3%) |
| Hojas SIN EPP asignado | 20 (11.7%) |
| EPP mas usado | guantes (149 hojas), zapatos (148), anteojos (146) |
| EPP NUNCA usado | delantal (0 hojas), respirador (0 hojas) |
| Combinacion mas comun | anteojos+guantes+zapatos (128 hojas, 74.9%) |

### Hallazgo critico

**20 hojas sin ningun EPP** -- todas pertenecen a los 2 productos PWA (Telas Planas y Telas Termoformadas). El 100% de los productos VWA tienen EPP asignado en todas sus hojas.

**delantal y respirador nunca se usan** en ninguna de las 171 hojas, a pesar de que hay operaciones de Adhesivado (9 hojas) e Inyeccion/Espumado (16 hojas) que podrian requerirlos.

---

## 2. Tabla Resumen por Tipo de Operacion

| Tipo de operacion | Hojas | EPP esperado (segun proceso) | EPP actual predominante | Falta algo? |
|---|---|---|---|---|
| Recepcion MP | 17 | anteojos, guantes, zapatos (minimo) | anteojos+guantes+zapatos (14/17), NINGUNO (3/17) | SI: 3 hojas PWA sin EPP |
| Corte/Troquelado | 28 | anteojos, guantes, zapatos + proteccionAuditiva si hay maquina | anteojos+guantes+zapatos (23/28), +proteccionAuditiva (12/28), NINGUNO (5/28) | SI: 5 hojas PWA sin EPP. Proteccion auditiva inconsistente |
| Costura | 19 | anteojos, guantes, zapatos, proteccionAuditiva (maquinas ruidosas) | anteojos+guantes+zapatos (18/19), +proteccionAuditiva solo 1/19, NINGUNO (1/19) | SI: Proteccion auditiva falta en 18/19 hojas de costura |
| Inyeccion/Espumado | 16 | anteojos, guantes, zapatos, respirador (vapores quimicos), delantal | anteojos+guantes+zapatos (16/16) | SI: Falta respirador (0/16) y delantal (0/16) |
| Adhesivado | 9 | anteojos, guantes, zapatos, respirador (quimicos), delantal | anteojos+guantes+zapatos (9/9) | SI: Falta respirador (0/9) y delantal (0/9) |
| Armado/Ensamble | 15 | anteojos, guantes, zapatos (minimo) | anteojos+guantes+zapatos (13/15), guantes+zapatos (2/15) | MENOR: 2 hojas sin anteojos (Insert PREARMADO) |
| Inspeccion Final | 14 | anteojos, guantes, zapatos (minimo) | anteojos+guantes+zapatos (13/14), NINGUNO (1/14) | SI: 1 hoja PWA sin EPP |
| Embalaje | 18 | anteojos, guantes, zapatos (minimo) | anteojos+guantes+zapatos (16/18), NINGUNO (2/18) | SI: 2 hojas PWA sin EPP |
| Almacenamiento WIP | 2 | guantes, zapatos (minimo) | guantes+zapatos (2/2) | OK (minimo cubierto) |
| Termoformado | 1 | anteojos, guantes, zapatos, proteccionAuditiva, delantal (calor) | NINGUNO | CRITICO: 0 EPP en operacion de calor |
| Otros (Soldadura, Tapizado, IMG, etc.) | 31 | Variable segun operacion | anteojos+guantes+zapatos (23/31), parcial (2/31), NINGUNO (6/31) | SI: Ver detalle |

---

## 3. Las 20 Hojas Sin EPP (CRITICO)

Todas pertenecen a los 2 productos PWA. Ninguna hoja VWA tiene este problema.

| # | Producto | Op# | Nombre Operacion | Tipo | EPP sugerido |
|---|----------|-----|------------------|------|-------------|
| 1 | Telas Planas (PWA) | 10 | Recepcion de Punzonado | Recepcion MP | anteojos, guantes, zapatos |
| 2 | Telas Planas (PWA) | 10b | Recepcion de Punzonado con Bi-componente | Recepcion MP | anteojos, guantes, zapatos |
| 3 | Telas Planas (PWA) | 20 | Corte por maquina de pieza Central | Corte | anteojos, guantes, zapatos, proteccionAuditiva |
| 4 | Telas Planas (PWA) | 21 | Corte por maquina, Blank de piezas laterales | Corte | anteojos, guantes, zapatos, proteccionAuditiva |
| 5 | Telas Planas (PWA) | 10d | Colocado de Aplix | Manual | anteojos, guantes, zapatos |
| 6 | Telas Planas (PWA) | 20b | Horno | Calor | anteojos, guantes, zapatos, delantal |
| 7 | Telas Planas (PWA) | 30 | Termoformado | Calor | anteojos, guantes, zapatos, delantal, proteccionAuditiva |
| 8 | Telas Planas (PWA) | 40 | Corte de la pieza en prensa | Corte | anteojos, guantes, zapatos |
| 9 | Telas Planas (PWA) | 50 | Perforado (21-8875 R y 21-8876 L) | Maquina | anteojos, guantes, zapatos, proteccionAuditiva |
| 10 | Telas Planas (PWA) | 60 | Soldadura (21-8877, 21-8875 y 21-8876) | Soldadura | anteojos, guantes, zapatos, proteccionAuditiva |
| 11 | Telas Planas (PWA) | 70 | Control de pieza final | Inspeccion | anteojos, guantes, zapatos |
| 12 | Telas Planas (PWA) | 80 | Embalaje | Embalaje | anteojos, guantes, zapatos |
| 13 | Telas Termoformadas (PWA) | 10 | Recepcion de materiales | Recepcion MP | anteojos, guantes, zapatos |
| 14 | Telas Termoformadas (PWA) | 15 | Preparacion de corte | Preparacion | anteojos, guantes, zapatos |
| 15 | Telas Termoformadas (PWA) | 20 | Corte por maquina automatica | Corte | anteojos, guantes, zapatos, proteccionAuditiva |
| 16 | Telas Termoformadas (PWA) | 30 | Costura fuerte, sin arruga ni pliegues | Costura | anteojos, guantes, zapatos, proteccionAuditiva |
| 17 | Telas Termoformadas (PWA) | 40 | Colocado de clips en posicion correcta | Manual | anteojos, guantes, zapatos |
| 18 | Telas Termoformadas (PWA) | 50 | Pegado de dots en posicion correcta | Adhesivo | anteojos, guantes, zapatos |
| 19 | Telas Termoformadas (PWA) | 60 | Inspeccion final de la pieza | Inspeccion | anteojos, guantes, zapatos |
| 20 | Telas Termoformadas (PWA) | 70 | Embalaje identificado | Embalaje | anteojos, guantes, zapatos |

---

## 4. Hojas con EPP Insuficiente (tienen algo, pero falta mas)

### 4.1 Costura sin proteccion auditiva (18 hojas)

Las maquinas de costura generan ruido elevado. Solo 1 de 19 hojas de costura tiene proteccion auditiva.

| Producto | Op# | Operacion | EPP actual | Falta |
|----------|-----|-----------|-----------|-------|
| ARMREST DOOR PANEL | 40 | COSTURA - REFILADO | anteojos, guantes, zapatos | proteccionAuditiva |
| ARMREST DOOR PANEL | 50 | COSTURA - COSTURA UNION | anteojos, guantes, zapatos | proteccionAuditiva |
| ARMREST DOOR PANEL | 51 | COSTURA - COSTURA DOBLE | anteojos, guantes, zapatos | proteccionAuditiva |
| ARMREST DOOR PANEL | 52 | COSTURA - ALM WIP | anteojos, guantes, zapatos | proteccionAuditiva |
| Headrest Front L0 | 30 | Operacion Costura Union | anteojos, guantes, zapatos | proteccionAuditiva |
| Headrest Front L1 | 30 | Operacion Costura Union | anteojos, guantes, zapatos | proteccionAuditiva |
| Headrest Front L2 | 30 | Operacion Costura Union | anteojos, guantes, zapatos | proteccionAuditiva |
| Headrest Front L3 | 30 | Operacion Costura Union | anteojos, guantes, zapatos | proteccionAuditiva |
| Headrest Rear Center L0 | 30 | Operacion Costura Union | anteojos, guantes, zapatos | proteccionAuditiva |
| Headrest Rear Center L1 | 30 | Operacion Costura Union | anteojos, guantes, zapatos | proteccionAuditiva |
| Headrest Rear Center L2 | 30 | Operacion Costura Union | anteojos, guantes, zapatos | proteccionAuditiva |
| Headrest Rear Center L3 | 30 | Operacion Costura Union | anteojos, guantes, zapatos | proteccionAuditiva |
| Headrest Rear Outer L0 | 30 | Operacion Costura Union | anteojos, guantes, zapatos | proteccionAuditiva |
| Headrest Rear Outer L1 | 30 | Operacion Costura Union | anteojos, guantes, zapatos | proteccionAuditiva |
| Headrest Rear Outer L2 | 30 | Operacion Costura Union | anteojos, guantes, zapatos | proteccionAuditiva |
| Headrest Rear Outer L3 | 30 | Operacion Costura Union | anteojos, guantes, zapatos | proteccionAuditiva |
| INSERT | 40 | COSTURA - Refilado | anteojos, guantes, zapatos | proteccionAuditiva |
| *(INSERT Op 50 SI tiene proteccionAuditiva)* | | | | |

### 4.2 Inyeccion/Espumado sin respirador ni delantal (16 hojas)

Operaciones con vapores quimicos (poliuretano, plastico fundido) requieren respirador y ropa de proteccion.

| Producto | Op# | Operacion | EPP actual | Falta |
|----------|-----|-----------|-----------|-------|
| ARMREST DOOR PANEL | 60 | INYECCION PLASTICA | anteojos, guantes, zapatos | respirador, delantal |
| ARMREST DOOR PANEL | 61 | INY PLASTICA - ALM WIP | anteojos, guantes, zapatos | respirador, delantal |
| ARMREST DOOR PANEL | 70 | INYECCION PU | anteojos, guantes, zapatos | respirador, delantal |
| ARMREST DOOR PANEL | 72 | INY PU - ALM WIP | anteojos, guantes, zapatos | (al menos en op activa) |
| Todos los 12 Headrest (L0-L3 x 3 modelos) | 50 | Espumado | anteojos, guantes, zapatos | respirador, delantal |

### 4.3 Adhesivado sin respirador ni delantal (9 hojas)

Uso de adhesivos quimicos (hot melt, solventes) requiere proteccion respiratoria y corporal.

| Producto | Op# | Operacion | EPP actual | Falta |
|----------|-----|-----------|-----------|-------|
| ARMREST DOOR PANEL | 80 | ADHESIVAR PIEZAS | anteojos, guantes, zapatos | respirador, delantal |
| ARMREST DOOR PANEL | 81 | INSPECCIONAR ADHESIVADA | anteojos, guantes, zapatos | respirador (al menos) |
| ARMREST DOOR PANEL | 82 | ADHESIVADO - ALM WIP | anteojos, guantes, zapatos | (menor) |
| ARMREST DOOR PANEL | 103 | REPROCESO: FALTA ADHESIVO | anteojos, guantes, zapatos | respirador, delantal |
| INSERT | 90 | Adhesivar piezas | anteojos, guantes, zapatos | respirador, delantal |
| INSERT | 91 | Inspeccionar adhesivada | anteojos, guantes, zapatos | respirador (al menos) |
| INSERT | 92 | ADHESIVADO - ALM WIP | anteojos, guantes, zapatos | (menor) |
| INSERT | 103 | REPROCESO: FALTA ADHESIVO | anteojos, guantes, zapatos | respirador, delantal |
| TOP ROLL | 20 | ADHESIVADO HOT MELT | anteojos, guantes, zapatos | respirador, delantal |

### 4.4 Hojas con EPP parcial (inconsistencias puntuales)

| Producto | Op# | Operacion | EPP actual | Observacion |
|----------|-----|-----------|-----------|-------------|
| INSERT | 10 | RECEPCION MP | zapatos (solo) | Falta anteojos y guantes (otros 14 recepciones tienen ambos) |
| INSERT | 50 | COSTURA CNC | anteojos, guantes, proteccionAuditiva | Falta zapatos (unica hoja de costura sin zapatos) |
| INSERT | 80 | PREARMADO DE ESPUMA | guantes, zapatos | Falta anteojos (otros prearmados lo tienen) |
| INSERT | 81 | PREARMADO - ALM WIP | guantes, zapatos | Falta anteojos |
| INSERT | 100 | TAPIZADO SEMIAUTOMATICO | anteojos (solo) | Falta guantes y zapatos |
| INSERT | 105 | REFILADO DE PIEZA | anteojos, guantes | Falta zapatos |
| INSERT | 111 | CLASIFICACION PRODUCTO NC | guantes, zapatos | Falta anteojos |

---

## 5. Consistencia por Familia de Producto

### 5.1 Headrest (12 documentos: Front/Rear Center/Rear Outer x L0/L1/L2/L3)

**CONSISTENTE**: Todas las 96 hojas de headrest tienen la misma estructura de EPP:
- Op 10 (Recepcion): anteojos + guantes + zapatos
- Op 20 (Corte): anteojos + guantes + proteccionAuditiva + zapatos
- Op 30 (Costura): anteojos + guantes + zapatos *(falta proteccionAuditiva)*
- Op 40 (Ensamble): anteojos + guantes + zapatos
- Op 50 (Espumado): anteojos + guantes + zapatos *(falta respirador, delantal)*
- Op 60 (Inspeccion final): anteojos + guantes + zapatos
- Op 70 (Embalaje): anteojos + guantes + zapatos
- Op 80 (Test Lay Out): anteojos + guantes + zapatos

Nota: La herencia maestro-variante funciona correctamente para EPP en Headrest.

### 5.2 Armrest Door Panel (1 documento, 22 hojas)

**CONSISTENTE** internamente: todas las hojas tienen anteojos+guantes+zapatos. Proteccion auditiva no presente en ninguna hoja.

### 5.3 Insert (1 documento, 22 hojas)

**INCONSISTENTE**: Es el producto con mas variacion de EPP:
- 7 hojas con combinaciones parciales (ver seccion 4.4)
- Unico producto donde proteccionAuditiva aparece en costura (Op 50) y en inyeccion (Op 70)

### 5.4 Top Roll (1 documento, 11 hojas)

**CONSISTENTE** internamente: todas las hojas tienen anteojos+guantes+zapatos. Proteccion auditiva solo en Soldado (Op 60, 70) que es razonable.

### 5.5 Telas Planas y Termoformadas (PWA, 2 documentos, 20 hojas)

**SIN EPP**: Ninguna de las 20 hojas tiene EPP asignado. Esto es una no-conformidad mayor.

---

## 6. Combinaciones de EPP Encontradas

| Combinacion EPP | Cantidad | % del total | Observacion |
|-----------------|----------|-------------|-------------|
| anteojos + guantes + zapatos | 128 | 74.9% | Combinacion standard |
| (NINGUNO) | 20 | 11.7% | CRITICO - Solo PWA |
| anteojos + guantes + proteccionAuditiva + zapatos | 15 | 8.8% | Para operaciones ruidosas |
| guantes + zapatos | 4 | 2.3% | Falta anteojos - Insert |
| zapatos (solo) | 1 | 0.6% | Muy insuficiente - Insert Op 10 |
| anteojos + guantes + proteccionAuditiva | 1 | 0.6% | Falta zapatos - Insert Op 50 |
| anteojos (solo) | 1 | 0.6% | Muy insuficiente - Insert Op 100 |
| anteojos + guantes | 1 | 0.6% | Falta zapatos - Insert Op 105 |

---

## 7. Uso de EPP por Item

| EPP Item | Hojas que lo usan | % | Observacion |
|----------|-------------------|---|-------------|
| guantes | 149/171 | 87.1% | Falta en 22 hojas (20 PWA + 2 Insert) |
| zapatos | 148/171 | 86.5% | Falta en 23 hojas (20 PWA + 3 Insert) |
| anteojos | 146/171 | 85.4% | Falta en 25 hojas (20 PWA + 5 Insert) |
| proteccionAuditiva | 16/171 | 9.4% | Muy bajo. Solo en Corte headrest (12) + Insert costura CNC (1) + Insert inyeccion (1) + Top Roll soldado (2) |
| **delantal** | **0/171** | **0%** | **NUNCA USADO** - Deberia estar en Inyeccion, Adhesivado, Termoformado |
| **respirador** | **0/171** | **0%** | **NUNCA USADO** - Deberia estar en Inyeccion PU, Adhesivado, Espumado |

---

## 8. Comparacion con PDFs Originales

**Estado**: No fue posible leer los PDFs originales de HO por las siguientes razones:
- `HO - INSERT PATAGONIA.pdf`: No se pudo renderizar (falta `pdftoppm` en el sistema)
- `TOP ROLL.pdf`: No se pudo renderizar (misma razon)
- `COSTURA APC DELANTERO.pdf`: Archivo no encontrado en la ruta indicada

**Recomendacion**: Verificar manualmente los EPP de los PDFs originales contra los datos de Supabase. Especialmente verificar si los PDFs de Insert y Top Roll muestran iconos de respirador o delantal que no se cargaron al sistema.

---

## 9. Resumen de Hallazgos y Acciones Recomendadas

### CRITICO (requiere correccion inmediata)

| # | Hallazgo | Hojas afectadas | Accion |
|---|----------|----------------|--------|
| C1 | **20 hojas PWA sin ningun EPP** | 12 Telas Planas + 8 Telas Termoformadas | Asignar EPP basico (anteojos+guantes+zapatos) + adicional segun operacion |
| C2 | **Respirador nunca usado** en Inyeccion PU / Espumado / Adhesivado | 25 hojas (16 inyeccion + 9 adhesivado) | Agregar respirador en operaciones con vapores quimicos |
| C3 | **Delantal nunca usado** en Inyeccion / Termoformado | 17+ hojas | Agregar delantal en operaciones con material caliente o quimicos |

### IMPORTANTE (corregir antes de auditorias externas)

| # | Hallazgo | Hojas afectadas | Accion |
|---|----------|----------------|--------|
| I1 | Costura sin proteccion auditiva | 18 de 19 hojas de costura | Agregar proteccionAuditiva en todas las costuras con maquina |
| I2 | Insert Op 10 solo tiene zapatos | 1 hoja | Agregar anteojos y guantes (como las otras 14 recepciones) |
| I3 | Insert con EPP parcial inconsistente | 7 hojas | Normalizar: agregar anteojos+guantes+zapatos como base minima |

### MENOR (mejoras de consistencia)

| # | Hallazgo | Hojas afectadas | Accion |
|---|----------|----------------|--------|
| M1 | Proteccion auditiva inconsistente en Corte | 12/28 hojas de corte la tienen | Evaluar si todas las cortadoras generan ruido y unificar |
| M2 | Top Roll Soldado tiene proteccionAuditiva pero Insert Costura CNC tambien | 3 hojas | Correcto, son operaciones ruidosas. Solo verificar completitud |

---

## 10. Tabla Detallada: Las 171 Hojas

### ARMREST DOOR PANEL (22 hojas)

| Op# | Operacion | EPP | Obs |
|-----|-----------|-----|-----|
| 10 | RECEPCIONAR MATERIA PRIMA | anteojos, guantes, zapatos | OK |
| 15 | CORTE - PREPARACION DE CORTE | anteojos, guantes, zapatos | OK |
| 20 | CORTE DE VINILO O TELA | anteojos, guantes, zapatos | OK |
| 25 | CORTE - CONTROL CON MYLAR | anteojos, guantes, zapatos | OK |
| 30 | CORTE - ALM WIP | anteojos, guantes, zapatos | OK |
| 40 | COSTURA - REFILADO | anteojos, guantes, zapatos | Falta proteccionAuditiva |
| 50 | COSTURA - COSTURA UNION | anteojos, guantes, zapatos | Falta proteccionAuditiva |
| 51 | COSTURA - COSTURA DOBLE | anteojos, guantes, zapatos | Falta proteccionAuditiva |
| 52 | COSTURA - ALM WIP | anteojos, guantes, zapatos | Falta proteccionAuditiva |
| 60 | INYECCION PLASTICA | anteojos, guantes, zapatos | Falta respirador, delantal |
| 61 | INY PLASTICA - ALM WIP | anteojos, guantes, zapatos | - |
| 70 | INYECCION PU | anteojos, guantes, zapatos | Falta respirador, delantal |
| 71 | PREARMADO DE ESPUMA | anteojos, guantes, zapatos | OK |
| 72 | INY PU - ALM WIP | anteojos, guantes, zapatos | - |
| 80 | ADHESIVADO - ADHESIVAR | anteojos, guantes, zapatos | Falta respirador, delantal |
| 81 | ADHESIVADO - INSPECCIONAR | anteojos, guantes, zapatos | Falta respirador |
| 82 | ADHESIVADO - ALM WIP | anteojos, guantes, zapatos | - |
| 90 | TAPIZADO SEMIAUTOMATICO | anteojos, guantes, zapatos | OK |
| 100 | INSPECCION FINAL | anteojos, guantes, zapatos | OK |
| 101 | CLASIF PRODUCTO NO CONFORME | anteojos, guantes, zapatos | OK |
| 103 | REPROCESO: FALTA ADHESIVO | anteojos, guantes, zapatos | Falta respirador, delantal |
| 110 | EMBALAJE Y ETIQUETADO | anteojos, guantes, zapatos | OK |

### HEADREST FRONT - L0 (8 hojas) -- Representativo de los 12 docs Headrest

| Op# | Operacion | EPP | Obs |
|-----|-----------|-----|-----|
| 10 | Recepcion | anteojos, guantes, zapatos | OK |
| 20 | Corte de Vinilo SANSUY PVC | anteojos, guantes, proteccionAuditiva, zapatos | OK |
| 30 | Operacion Costura Union | anteojos, guantes, zapatos | Falta proteccionAuditiva |
| 40 | Ensamble Asta + Insert + Enfundado | anteojos, guantes, zapatos | OK |
| 50 | Espumado (llenado de molde) | anteojos, guantes, zapatos | Falta respirador, delantal |
| 60 | Inspeccion final + Sistema ARB | anteojos, guantes, zapatos | OK |
| 70 | Embalaje | anteojos, guantes, zapatos | OK |
| 80 | TEST DE LAY OUT | anteojos, guantes, zapatos | OK |

*Los 11 documentos headrest restantes (L1/L2/L3 x Front/Rear Center/Rear Outer) tienen exactamente los mismos EPP por operacion.*

### TAPIZADO INSERT (22 hojas)

| Op# | Operacion | EPP | Obs |
|-----|-----------|-----|-----|
| 10 | RECEPCION MP | zapatos | **INSUFICIENTE** - Falta anteojos, guantes |
| 15 | CORTE - Preparacion | anteojos, guantes, zapatos | OK |
| 20 | CORTE - Cortar componentes | anteojos, guantes, zapatos | OK |
| 25 | CORTE - Control mylar | anteojos, guantes, zapatos | OK |
| 30 | CORTE - ALM WIP | anteojos, guantes, zapatos | OK |
| 40 | COSTURA - Refilado | anteojos, guantes, zapatos | Falta proteccionAuditiva |
| 50 | COSTURA - Costura CNC | anteojos, guantes, proteccionAuditiva | **Falta zapatos** |
| 60 | TROQUELADO - Troquelado espuma | anteojos, guantes, zapatos | OK |
| 61 | TROQUELADO - ALM WIP | anteojos, guantes, zapatos | OK |
| 70 | INYECCION PLASTICA | anteojos, guantes, proteccionAuditiva, zapatos | Falta respirador, delantal |
| 71 | INY PLASTICA - ALM WIP | guantes, zapatos | Falta anteojos |
| 80 | PREARMADO DE ESPUMA | guantes, zapatos | Falta anteojos |
| 81 | PREARMADO - ALM WIP | guantes, zapatos | Falta anteojos |
| 90 | ADHESIVADO - Adhesivar | anteojos, guantes, zapatos | Falta respirador, delantal |
| 91 | ADHESIVADO - Inspeccionar | anteojos, guantes, zapatos | Falta respirador |
| 92 | ADHESIVADO - ALM WIP | anteojos, guantes, zapatos | - |
| 100 | TAPIZADO SEMIAUTOMATICO | anteojos | **INSUFICIENTE** - Falta guantes, zapatos |
| 103 | REPROCESO: FALTA ADHESIVO | anteojos, guantes, zapatos | Falta respirador, delantal |
| 105 | REFILADO DE PIEZA | anteojos, guantes | **Falta zapatos** |
| 110 | INSPECCION PIEZA TERMINADA | anteojos, guantes, zapatos | OK |
| 111 | CLASIF PRODUCTO NO CONFORME | guantes, zapatos | Falta anteojos |
| 120 | EMBALAJE | anteojos, guantes, zapatos | OK |

### TOP ROLL FRONT DI - DD TAOS (11 hojas)

| Op# | Operacion | EPP | Obs |
|-----|-----------|-----|-----|
| 5 | RECEPCIONAR MP | anteojos, guantes, zapatos | OK |
| 10 | INYECCION PLASTICA | anteojos, guantes, zapatos | Falta respirador, delantal |
| 11 | ALM WIP | anteojos, guantes, zapatos | - |
| 20 | ADHESIVADO HOT MELT | anteojos, guantes, zapatos | Falta respirador, delantal |
| 30 | PROCESO DE IMG | anteojos, guantes, zapatos | OK |
| 40 | TRIMMING CORTE FINAL | anteojos, guantes, zapatos | OK |
| 50 | EDGE FOLDING | anteojos, guantes, zapatos | OK |
| 60 | SOLDADO REFUERZOS INTERNOS | anteojos, guantes, proteccionAuditiva, zapatos | OK |
| 70 | SOLDADO TWEETER | anteojos, guantes, proteccionAuditiva, zapatos | OK |
| 80 | INSPECCION FINAL Y EMPAQUE | anteojos, guantes, zapatos | OK |
| 90 | EMPAQUE FINAL Y ETIQUETADO | anteojos, guantes, zapatos | OK |

### TELA ASSENTO DIANTEIRO - Telas Planas PWA (12 hojas)

| Op# | Operacion | EPP | Obs |
|-----|-----------|-----|-----|
| 10 | Recepcion de Punzonado | **(NINGUNO)** | CRITICO |
| 10b | Recepcion con Bi-componente | **(NINGUNO)** | CRITICO |
| 20 | Corte por maquina pieza Central | **(NINGUNO)** | CRITICO |
| 21 | Corte por maquina, Blank laterales | **(NINGUNO)** | CRITICO |
| 10d | Colocado de Aplix | **(NINGUNO)** | CRITICO |
| 20b | Horno | **(NINGUNO)** | CRITICO - Operacion de calor |
| 30 | Termoformado | **(NINGUNO)** | CRITICO - Operacion de calor |
| 40 | Corte de la pieza en prensa | **(NINGUNO)** | CRITICO |
| 50 | Perforado | **(NINGUNO)** | CRITICO |
| 60 | Soldadura | **(NINGUNO)** | CRITICO |
| 70 | Control de pieza final | **(NINGUNO)** | CRITICO |
| 80 | Embalaje | **(NINGUNO)** | CRITICO |

### TELAS TERMOFORMADAS PWA (8 hojas)

| Op# | Operacion | EPP | Obs |
|-----|-----------|-----|-----|
| 10 | Recepcion de materiales | **(NINGUNO)** | CRITICO |
| 15 | Preparacion de corte | **(NINGUNO)** | CRITICO |
| 20 | Corte por maquina automatica | **(NINGUNO)** | CRITICO |
| 30 | Costura fuerte | **(NINGUNO)** | CRITICO |
| 40 | Colocado de clips | **(NINGUNO)** | CRITICO |
| 50 | Pegado de dots | **(NINGUNO)** | CRITICO |
| 60 | Inspeccion final | **(NINGUNO)** | CRITICO |
| 70 | Embalaje identificado | **(NINGUNO)** | CRITICO |

---

## 11. Estadisticas Finales

| Categoria | Hojas | % |
|-----------|-------|---|
| EPP completo y adecuado al proceso | ~80 | 46.8% |
| EPP basico OK pero faltan items especificos (respirador/delantal/auditiva) | ~71 | 41.5% |
| EPP parcial/inconsistente | 7 | 4.1% |
| Sin ningun EPP | 20 | 11.7% |
| **TOTAL** | **171** | **100%** |

---

*Nota: La clasificacion de "EPP esperado segun proceso" se basa en buenas practicas industriales para procesos automotrices. Las evaluaciones de riesgo especificas de la planta pueden determinar requisitos diferentes. Consultar con el area de Seguridad e Higiene para validar.*
