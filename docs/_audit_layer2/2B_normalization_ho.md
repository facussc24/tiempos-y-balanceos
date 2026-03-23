# Plan de Normalizacion 2B: EPP y Completitud de Hojas de Operacion

**Fecha**: 2026-03-23
**Fuente**: Auditorias 1C (EPP Inventory) y 1D (HO Completeness)
**Alcance**: 17 documentos HO, 171 hojas de operacion, 8 familias de producto

---

## Parte 1: EPP Estandar por Tipo de Operacion

Tabla normativa propuesta, basada en las hojas mas completas (Insert, Armrest) y buenas practicas industriales automotrices.

| Tipo de operacion | EPP minimo requerido | Justificacion |
|---|---|---|
| Recepcion MP | anteojos, guantes, zapatos | Manipulacion de materiales pesados/cortantes, carga y descarga |
| Corte/Troquelado | anteojos, guantes, zapatos, proteccionAuditiva | Particulas volantes, piezas cortantes, maquinas ruidosas (prensas, troqueladoras) |
| Costura | anteojos, guantes, zapatos, proteccionAuditiva | Maquinas de costura generan ruido continuo >80 dB, agujas, atrapamiento de dedos |
| Inyeccion Plastica | anteojos, guantes, zapatos, respirador, delantal | Vapores de plastico fundido, salpicaduras de material caliente, riesgo quimico |
| Inyeccion PU / Espumado | anteojos, guantes, zapatos, respirador, delantal | Isocianatos (MDI/TDI) toxicos por inhalacion, contacto con piel causa sensibilizacion |
| Adhesivado | anteojos, guantes, zapatos, respirador, delantal | Solventes organicos (hot melt, adhesivos base solvente), vapores irritantes |
| Termoformado / Horno | anteojos, guantes, zapatos, proteccionAuditiva, delantal | Calor radiante, material a alta temperatura, maquinas ruidosas |
| Soldadura (ultrasonica/plastica) | anteojos, guantes, zapatos, proteccionAuditiva | Ruido ultrasonico >85 dB, particulas de material fundido |
| Proceso IMG | anteojos, guantes, zapatos | Prensa/molde, riesgo mecanico estandar |
| Edge Folding / Trimming | anteojos, guantes, zapatos | Herramientas de corte, rebabas |
| Armado/Ensamble/Prearmado | anteojos, guantes, zapatos | Manipulacion de piezas con bordes, componentes pesados |
| Tapizado | anteojos, guantes, zapatos | Manipulacion de bastidores, herramientas de fijacion |
| Inspeccion Final | anteojos, guantes, zapatos | Manipulacion de piezas terminadas, estandar minimo de planta |
| Embalaje | anteojos, guantes, zapatos | Manipulacion de piezas y cajas, estandar minimo de planta |
| Control/Clasificacion NC | anteojos, guantes, zapatos | Piezas potencialmente defectuosas con bordes irregulares |
| Almacenamiento WIP | guantes, zapatos | Manipulacion basica de contenedores y racks |
| Set Up / Cambio Modelo | anteojos, guantes, zapatos | Manipulacion de herramental, ajuste mecanico |
| Mantenimiento/Limpieza | anteojos, guantes, zapatos | Productos quimicos de limpieza, herramientas |
| Preparacion (corte/costura) | anteojos, guantes, zapatos | Manipulacion de materiales y herramientas de preparacion |
| Reproceso Adhesivo | anteojos, guantes, zapatos, respirador, delantal | Mismos riesgos que adhesivado original |

### Notas sobre el estandar propuesto

1. **anteojos + guantes + zapatos** es el minimo absoluto de planta para cualquier operacion productiva (no negociable).
2. **proteccionAuditiva** se agrega en cualquier operacion con maquinas que superen 80 dB: costura industrial, corte con prensa, troquelado, soldadura ultrasonica, termoformado.
3. **respirador** es obligatorio donde haya vapores quimicos: inyeccion PU/espumado (isocianatos), adhesivado con solventes, inyeccion plastica (vapores de plastificantes).
4. **delantal** protege contra salpicaduras de material caliente o quimicos: inyeccion, espumado, adhesivado, termoformado/horno.

---

## Parte 2: Hojas que Necesitan EPP Adicional

### 2.1 CRITICO — 20 hojas sin ningun EPP (Telas Planas + Telas Termoformadas PWA)

| Producto | Op# | Nombre | EPP actual | EPP a asignar | Prioridad |
|---|---|---|---|---|---|
| Telas Planas | 10 | Recepcion de Punzonado | NINGUNO | anteojos, guantes, zapatos | CRITICA |
| Telas Planas | 10b | Recepcion con Bi-componente | NINGUNO | anteojos, guantes, zapatos | CRITICA |
| Telas Planas | 10d | Colocado de Aplix | NINGUNO | anteojos, guantes, zapatos | CRITICA |
| Telas Planas | 20 | Corte por maquina pieza Central | NINGUNO | anteojos, guantes, zapatos, proteccionAuditiva | CRITICA |
| Telas Planas | 21 | Corte por maquina Blank laterales | NINGUNO | anteojos, guantes, zapatos, proteccionAuditiva | CRITICA |
| Telas Planas | 20b | Horno | NINGUNO | anteojos, guantes, zapatos, delantal, proteccionAuditiva | CRITICA |
| Telas Planas | 30 | Termoformado | NINGUNO | anteojos, guantes, zapatos, delantal, proteccionAuditiva | CRITICA |
| Telas Planas | 40 | Corte en prensa | NINGUNO | anteojos, guantes, zapatos, proteccionAuditiva | CRITICA |
| Telas Planas | 50 | Perforado | NINGUNO | anteojos, guantes, zapatos, proteccionAuditiva | CRITICA |
| Telas Planas | 60 | Soldadura | NINGUNO | anteojos, guantes, zapatos, proteccionAuditiva | CRITICA |
| Telas Planas | 70 | Control de pieza final | NINGUNO | anteojos, guantes, zapatos | CRITICA |
| Telas Planas | 80 | Embalaje | NINGUNO | anteojos, guantes, zapatos | CRITICA |
| Telas Termoformadas | 10 | Recepcion de materiales | NINGUNO | anteojos, guantes, zapatos | CRITICA |
| Telas Termoformadas | 15 | Preparacion de corte | NINGUNO | anteojos, guantes, zapatos | CRITICA |
| Telas Termoformadas | 20 | Corte por maquina automatica | NINGUNO | anteojos, guantes, zapatos, proteccionAuditiva | CRITICA |
| Telas Termoformadas | 30 | Costura fuerte | NINGUNO | anteojos, guantes, zapatos, proteccionAuditiva | CRITICA |
| Telas Termoformadas | 40 | Colocado de clips | NINGUNO | anteojos, guantes, zapatos | CRITICA |
| Telas Termoformadas | 50 | Pegado de dots | NINGUNO | anteojos, guantes, zapatos | CRITICA |
| Telas Termoformadas | 60 | Inspeccion final | NINGUNO | anteojos, guantes, zapatos | CRITICA |
| Telas Termoformadas | 70 | Embalaje identificado | NINGUNO | anteojos, guantes, zapatos | CRITICA |

### 2.2 ALTA — Costura sin proteccion auditiva (18 hojas)

| Producto | Op# | Nombre | EPP actual | EPP faltante | Prioridad |
|---|---|---|---|---|---|
| Armrest Door Panel | 40 | COSTURA - REFILADO | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Armrest Door Panel | 50 | COSTURA - COSTURA UNION | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Armrest Door Panel | 51 | COSTURA - COSTURA DOBLE | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Armrest Door Panel | 52 | COSTURA - ALM WIP | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Headrest Front L0 | 30 | Costura Union | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Headrest Front L1 | 30 | Costura Union | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Headrest Front L2 | 30 | Costura Union | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Headrest Front L3 | 30 | Costura Union | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Headrest Rear Center L0 | 30 | Costura Union | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Headrest Rear Center L1 | 30 | Costura Union | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Headrest Rear Center L2 | 30 | Costura Union | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Headrest Rear Center L3 | 30 | Costura Union | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Headrest Rear Outer L0 | 30 | Costura Union | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Headrest Rear Outer L1 | 30 | Costura Union | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Headrest Rear Outer L2 | 30 | Costura Union | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Headrest Rear Outer L3 | 30 | Costura Union | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| Insert | 40 | COSTURA - Refilado | anteojos, guantes, zapatos | proteccionAuditiva | ALTA |
| *(Insert Op 50 ya tiene proteccionAuditiva — OK)* | | | | | |

> **Optimizacion**: Corrigiendo los 3 masters de Headrest (Front, Rear Center, Rear Outer) en Op 30, la herencia propaga automaticamente a las 9 variantes L1/L2/L3. Total de ediciones manuales: 3 masters + 1 Armrest + 1 Insert = **5 ediciones resuelven 18 hojas**.

### 2.3 ALTA — Inyeccion/Espumado sin respirador ni delantal (16 hojas)

| Producto | Op# | Nombre | EPP actual | EPP faltante | Prioridad |
|---|---|---|---|---|---|
| Armrest Door Panel | 60 | INYECCION PLASTICA | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Armrest Door Panel | 61 | INY PLASTICA - ALM WIP | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Armrest Door Panel | 70 | INYECCION PU | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Armrest Door Panel | 72 | INY PU - ALM WIP | anteojos, guantes, zapatos | respirador (minimo) | ALTA |
| Headrest Front L0 | 50 | Espumado | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Headrest Front L1 | 50 | Espumado | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Headrest Front L2 | 50 | Espumado | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Headrest Front L3 | 50 | Espumado | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Headrest Rear Center L0 | 50 | Espumado | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Headrest Rear Center L1 | 50 | Espumado | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Headrest Rear Center L2 | 50 | Espumado | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Headrest Rear Center L3 | 50 | Espumado | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Headrest Rear Outer L0 | 50 | Espumado | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Headrest Rear Outer L1 | 50 | Espumado | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Headrest Rear Outer L2 | 50 | Espumado | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Headrest Rear Outer L3 | 50 | Espumado | anteojos, guantes, zapatos | respirador, delantal | ALTA |

> **Optimizacion**: Corrigiendo los 3 masters de Headrest (Op 50) + 1 Armrest (Ops 60/61/70/72) = **4 documentos corrigen 16 hojas**.

### 2.4 ALTA — Adhesivado sin respirador ni delantal (9 hojas)

| Producto | Op# | Nombre | EPP actual | EPP faltante | Prioridad |
|---|---|---|---|---|---|
| Armrest Door Panel | 80 | ADHESIVAR PIEZAS | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Armrest Door Panel | 81 | INSPECCIONAR ADHESIVADA | anteojos, guantes, zapatos | respirador | ALTA |
| Armrest Door Panel | 82 | ADHESIVADO - ALM WIP | anteojos, guantes, zapatos | (menor — area ALM) | MEDIA |
| Armrest Door Panel | 103 | REPROCESO: FALTA ADHESIVO | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Insert | 90 | Adhesivar piezas | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Insert | 91 | Inspeccionar adhesivada | anteojos, guantes, zapatos | respirador | ALTA |
| Insert | 92 | ADHESIVADO - ALM WIP | anteojos, guantes, zapatos | (menor — area ALM) | MEDIA |
| Insert | 103 | REPROCESO: FALTA ADHESIVO | anteojos, guantes, zapatos | respirador, delantal | ALTA |
| Top Roll | 20 | ADHESIVADO HOT MELT | anteojos, guantes, zapatos | respirador, delantal | ALTA |

### 2.5 MEDIA — Insert con EPP parcial/inconsistente (7 hojas)

| Producto | Op# | Nombre | EPP actual | EPP faltante | Prioridad |
|---|---|---|---|---|---|
| Insert | 10 | RECEPCION MP | zapatos | anteojos, guantes | MEDIA |
| Insert | 50 | COSTURA CNC | anteojos, guantes, proteccionAuditiva | zapatos | MEDIA |
| Insert | 80 | PREARMADO DE ESPUMA | guantes, zapatos | anteojos | MEDIA |
| Insert | 81 | PREARMADO - ALM WIP | guantes, zapatos | anteojos | MEDIA |
| Insert | 100 | TAPIZADO SEMIAUTOMATICO | anteojos | guantes, zapatos | MEDIA |
| Insert | 105 | REFILADO DE PIEZA | anteojos, guantes | zapatos | MEDIA |
| Insert | 111 | CLASIFICACION PRODUCTO NC | guantes, zapatos | anteojos | MEDIA |

### 2.6 Resumen de ediciones EPP necesarias

| Bloque | Hojas afectadas | Ediciones reales necesarias | Motivo de diferencia |
|---|---|---|---|
| 2.1 PWA sin EPP | 20 hojas | 20 ediciones | Son masters sin variantes, cada hoja se edita individualmente |
| 2.2 Costura sin auditiva | 18 hojas | 5 ediciones | 3 masters headrest + 1 Armrest + 1 Insert (herencia propaga el resto) |
| 2.3 Inyeccion sin respirador/delantal | 16 hojas | 7 ediciones | 3 masters headrest (1 op cada uno) + 4 ops Armrest |
| 2.4 Adhesivado sin respirador/delantal | 9 hojas | 9 ediciones | Sin herencia: Armrest (4), Insert (4), Top Roll (1) |
| 2.5 Insert parcial/inconsistente | 7 hojas | 7 ediciones | Son 7 hojas individuales del Insert |
| **TOTAL** | **70 hojas** | **48 ediciones** | Herencia ahorra 22 ediciones (31%) |

---

## Parte 3: Plan para HOs Incompletas (Contenido TWI)

### 3.1 Mapa de completitud actual

| Producto | Total hojas | COMPLETA (KP+QC) | PARCIAL (solo pasos) | % Completo |
|---|---|---|---|---|
| Insert | 22 | 22 | 0 | 100% |
| Armrest Door Panel | 22 | 22 | 0 | 100% |
| Headrest Front (master) | 8 | 2 | 6 | 25% |
| Headrest Rear Center (master) | 8 | 2 | 6 | 25% |
| Headrest Rear Outer (master) | 8 | 2 | 6 | 25% |
| Top Roll | 11 | 0 | 11 | 0% |
| Telas Planas (PWA) | 12 | 0 | 12 | 0% |
| Telas Termoformadas (PWA) | 8 | 0 | 8 | 0% |
| **Total (sin variantes)** | **99** | **68** | **103** | **40%** |

> Las 72 hojas variante de Headrest (L1/L2/L3 x 3 familias) son clones del master. Completar los 3 masters propaga automaticamente.

### 3.2 Contenido propuesto basado en hojas de referencia

Para cada operacion PARCIAL, se identifica la hoja COMPLETA equivalente en otro producto que puede servir de referencia.

#### 3.2.1 Headrest — 6 operaciones PARCIAL por master (x3 familias)

| Op# Headrest | Operacion | Referencia a copiar de | Adaptaciones necesarias |
|---|---|---|---|
| 10 — Recepcion | Recepcion MP | **Insert Op 10** (7 pasos, 5 KP, 14 QC) | Cambiar materiales: vinilo PVC SANSUY, astas metalicas, inserts plasticos en lugar de los del Insert. Mantener estructura de verificacion de documentacion, inspeccion de embalaje, liberacion de lote |
| 40 — Ensamble Asta + Enfundado | Ensamble/Armado | **Armrest Op 71** (Prearmado) parcialmente + **Insert Op 30** (Enfundado) | Operacion unica de Headrest: insertar asta metalica en foam insert y enfundar con funda costurada. **Requiere consulta con produccion** — no existe equivalente directo |
| 50 — Espumado | Inyeccion PU | **Armrest Op 70** (Inyeccion PU, COMPLETA) | Adaptar: molde de headrest vs molde de armrest, parametros de mezcla PU (relacion poliol/isocianato), tiempo de curado. **Requiere consulta con produccion** para parametros especificos |
| 60 — Inspeccion final + ARB | Inspeccion Final | **Insert Op 110** (Inspeccion pieza terminada, COMPLETA) + **Armrest Op 100** (Inspeccion final, COMPLETA) | Adaptar criterios: headrest tiene test sistema ARB (air bag), verificacion funcional de asta (insercion/extraccion/bloqueo). **Requiere consulta con produccion** para criterios ARB |
| 70 — Embalaje | Embalaje | **Insert Op 120** (Embalaje, COMPLETA) o **Armrest Op 110** (Embalaje, COMPLETA) | Adaptacion menor: tipo de embalaje (bolsa/caja), cantidad por caja, etiqueta segun requerimiento VW |
| 80 — Test Lay Out | Test/Auditoria | **Insert Op 95** (Auditoria LPA, COMPLETA) o **Insert Op 99** (Liberacion primera pieza, COMPLETA) | Adaptar: layout test verifica posicion y ajuste del headrest en asiento completo. **Requiere consulta con produccion** |

#### 3.2.2 Top Roll — 11 operaciones PARCIAL (todas)

| Op# Top Roll | Operacion | Referencia a copiar de | Adaptaciones necesarias |
|---|---|---|---|
| 5 — Recepcionar MP | Recepcion | **Insert Op 10** (COMPLETA) | Adaptar materiales: plasticos para inyeccion, adhesivos hot melt, tela/vinilo para IMG |
| 10 — Inyeccion Plastica | Inyeccion | **Armrest Op 60** (Iny Plastica, COMPLETA) o **Insert Op 70** (Iny Plastica, COMPLETA) | Adaptar: parametros de maquina inyectora, material (PP/ABS), molde, ciclo. Estructura de KP+QC reutilizable |
| 11 — ALM WIP | Almacenamiento | **Armrest Op 61** (ALM WIP, COMPLETA) | Copia directa: verificacion de identificacion, condiciones de almacenamiento, FIFO |
| 20 — Adhesivado Hot Melt | Adhesivado | **Insert Op 90** (Adhesivar, COMPLETA) o **Armrest Op 80** (Adhesivar, COMPLETA) | Adaptar: tipo de adhesivo (hot melt vs base solvente), temperatura de aplicacion, patron de aplicacion |
| 30 — Proceso IMG | Proceso especial | **Sin referencia directa** | **Requiere consulta con produccion** — proceso IMG (In Mold Graining) es unico del Top Roll, no hay equivalente en Insert/Armrest |
| 40 — Trimming Corte Final | Corte/Refilado | **Insert Op 105** (Refilado, COMPLETA) | Adaptar: herramienta de corte, tolerancias dimensionales del Top Roll |
| 50 — Edge Folding | Plegado | **Insert Op 40** (Rebordeo/Edge Folding, COMPLETA) si existe | Adaptar: material y radio de plegado. Estructura de KP+QC del Insert es reutilizable |
| 60 — Soldado Refuerzos | Soldadura | No hay soldadura ultrasonica en Insert/Armrest con KP+QC | **Requiere consulta con produccion** — parametros de soldadura, frecuencia, presion, tiempo |
| 70 — Soldado Tweeter | Soldadura | Mismo patron que Op 60 | Adaptar: posicion del tweeter, verificacion electrica post-soldadura |
| 80 — Inspeccion Final | Inspeccion | **Insert Op 110** (COMPLETA) o **Armrest Op 100** (COMPLETA) | Adaptar: criterios de aceptacion visual, dimensional del Top Roll |
| 90 — Empaque Final | Embalaje | **Insert Op 120** (COMPLETA) o **Armrest Op 110** (COMPLETA) | Adaptacion menor: tipo y configuracion de embalaje |

#### 3.2.3 Telas Planas PWA — 12 operaciones PARCIAL (todas)

| Op# Telas Planas | Operacion | Referencia a copiar de | Adaptaciones necesarias |
|---|---|---|---|
| 10 — Recepcion Punzonado | Recepcion | **Insert Op 10** (COMPLETA) | Adaptar: material es rollo de punzonado textil, no vinilo/cuero |
| 10b — Recepcion Bi-componente | Recepcion | **Insert Op 10** (COMPLETA) | Similar a Op 10, material bi-componente |
| 10d — Colocado de Aplix | Manual | **Sin referencia directa** | **Requiere consulta** — operacion manual especifica de colocado de velcro/aplix |
| 20 — Corte pieza Central | Corte maquina | **Insert Op 15/16** (Corte, COMPLETA) o **Armrest Op 20** (Corte, COMPLETA) | Adaptar: maquina de corte, programa CNC, material textil |
| 21 — Corte Blank laterales | Corte maquina | Mismo patron que Op 20 | Variante de corte, misma estructura |
| 20b — Horno | Proceso termico | **Sin referencia directa** | **Requiere consulta con produccion** — parametros de horno (T, tiempo), cuidados especificos |
| 30 — Termoformado | Proceso termico | **Sin referencia directa** | **Requiere consulta con produccion** — proceso unico de telas, parametros de molde y temperatura |
| 40 — Corte en prensa | Corte | **Insert Op 60** (Troquelado, COMPLETA) | Adaptar: troquel/prensa, tolerancias de la pieza |
| 50 — Perforado | Maquina | **Sin referencia directa** | **Requiere consulta con produccion** — operacion especifica del producto |
| 60 — Soldadura | Soldadura | **Top Roll Op 60/70** (sin KP, no sirve como referencia) | **Requiere consulta con produccion** — tipo de soldadura y parametros |
| 70 — Control pieza final | Inspeccion | **Insert Op 110** (COMPLETA) | Adaptar: criterios dimensionales y visuales de telas |
| 80 — Embalaje | Embalaje | **Insert Op 120** (COMPLETA) | Adaptacion menor |

#### 3.2.4 Telas Termoformadas PWA — 8 operaciones PARCIAL (todas)

| Op# Telas Termo | Operacion | Referencia a copiar de | Adaptaciones necesarias |
|---|---|---|---|
| 10 — Recepcion materiales | Recepcion | **Insert Op 10** (COMPLETA) | Adaptar: materiales textiles para termoformado |
| 15 — Preparacion de corte | Preparacion | **Insert Op 15** (COMPLETA) | Adaptar: material y herramientas de corte |
| 20 — Corte maquina automatica | Corte | **Insert Op 16** (COMPLETA) o **Armrest Op 20** (COMPLETA) | Adaptar: maquina y programa |
| 30 — Costura | Costura | **Insert Op 50** (Costura CNC, COMPLETA) o **Armrest Op 50** (Costura, COMPLETA) | Adaptar: tipo de costura, material, especificaciones |
| 40 — Colocado de clips | Manual | **Sin referencia directa** | **Requiere consulta con produccion** — posicion y tipo de clips |
| 50 — Pegado de dots | Adhesivo manual | **Sin referencia directa** (cercano a adhesivado pero diferente proceso) | **Requiere consulta con produccion** — tipo de dot adhesivo, posicion |
| 60 — Inspeccion final | Inspeccion | **Insert Op 110** (COMPLETA) | Adaptar: criterios de aceptacion |
| 70 — Embalaje | Embalaje | **Insert Op 120** (COMPLETA) | Adaptacion menor |

### 3.3 Prioridad de completado

#### PRIORIDAD ALTA — Masters que propagan a variantes (multiplicador alto)

| # | Producto | Hojas a completar | Multiplicador | Hojas que se benefician |
|---|---|---|---|---|
| 1 | Headrest Front (master) | 6 ops (10, 40, 50, 60, 70, 80) | x4 (master + L1/L2/L3) | 24 hojas |
| 2 | Headrest Rear Center (master) | 6 ops (10, 40, 50, 60, 70, 80) | x4 | 24 hojas |
| 3 | Headrest Rear Outer (master) | 6 ops (10, 40, 50, 60, 70, 80) | x4 | 24 hojas |
| | **Subtotal** | **18 ediciones** | | **72 hojas normalizadas** |

> **ROI maximo**: 18 hojas editadas normalizan 72 hojas en total (relacion 1:4).

#### PRIORIDAD MEDIA — Productos sin variantes (sin multiplicador pero VWA)

| # | Producto | Hojas a completar | Multiplicador | Notas |
|---|---|---|---|---|
| 4 | Top Roll | 11 ops (todas) | x1 | Producto VWA sin variantes, cliente Volkswagen |
| | **Subtotal** | **11 ediciones** | | **11 hojas normalizadas** |

#### PRIORIDAD BAJA — Productos PWA

| # | Producto | Hojas a completar | Multiplicador | Notas |
|---|---|---|---|---|
| 5 | Telas Planas (PWA) | 12 ops (todas) | x1 | Producto PWA, procesos unicos sin referencia |
| 6 | Telas Termoformadas (PWA) | 8 ops (todas) | x1 | Producto PWA |
| | **Subtotal** | **20 ediciones** | | **20 hojas normalizadas** |

#### COMPLEMENTARIO — Mejoras de calidad en hojas existentes

| # | Accion | Hojas | Notas |
|---|---|---|---|
| 7 | Agregar `controlMethod` a QCs de Insert | 68 QCs en 22 hojas | 43% de QCs del Insert sin este campo |
| 8 | Agregar `controlMethod` a QCs de Armrest | 87 QCs en 22 hojas | 50% de QCs del Armrest sin este campo |

### 3.4 Estrategia de completado

#### Grupo A: Se pueden completar copiando estructura de hojas existentes (adaptacion menor)

Estas hojas tienen un equivalente funcional COMPLETO en Insert o Armrest. Se puede copiar la estructura de pasos, KP y QC adaptando solo el nombre de materiales/herramientas.

| Hoja a completar | Referencia | Esfuerzo estimado | Requiere produccion? |
|---|---|---|---|
| Headrest x3 — Op 10 (Recepcion) | Insert Op 10 | Bajo | No |
| Headrest x3 — Op 70 (Embalaje) | Insert Op 120 | Bajo | No |
| Top Roll — Op 5 (Recepcion) | Insert Op 10 | Bajo | No |
| Top Roll — Op 11 (ALM WIP) | Armrest Op 61 | Bajo | No |
| Top Roll — Op 80 (Inspeccion Final) | Insert Op 110 | Bajo | No |
| Top Roll — Op 90 (Empaque) | Insert Op 120 | Bajo | No |
| Telas Planas — Op 10/10b (Recepcion) | Insert Op 10 | Bajo | No |
| Telas Planas — Op 20/21 (Corte) | Insert Op 15/16 | Bajo | No |
| Telas Planas — Op 70 (Control) | Insert Op 110 | Bajo | No |
| Telas Planas — Op 80 (Embalaje) | Insert Op 120 | Bajo | No |
| Telas Termo — Op 10 (Recepcion) | Insert Op 10 | Bajo | No |
| Telas Termo — Op 15 (Prep corte) | Insert Op 15 | Bajo | No |
| Telas Termo — Op 20 (Corte) | Insert Op 16 | Bajo | No |
| Telas Termo — Op 30 (Costura) | Insert Op 50 | Bajo | No |
| Telas Termo — Op 60 (Inspeccion) | Insert Op 110 | Bajo | No |
| Telas Termo — Op 70 (Embalaje) | Insert Op 120 | Bajo | No |
| **Total Grupo A** | | | **22 hojas** |

#### Grupo B: Requieren adaptacion significativa pero hay referencia parcial

Hay hojas de referencia para la estructura general, pero los detalles tecnicos del proceso (KP, QC) difieren lo suficiente como para necesitar revision con produccion.

| Hoja a completar | Referencia parcial | Esfuerzo estimado | Requiere produccion? |
|---|---|---|---|
| Headrest x3 — Op 50 (Espumado) | Armrest Op 70 (Iny PU) | Medio | Si — parametros PU headrest |
| Headrest x3 — Op 60 (Inspeccion + ARB) | Insert Op 110 + criterios ARB | Medio | Si — criterios sistema ARB |
| Headrest x3 — Op 80 (Test Lay Out) | Insert Op 95/99 (LPA/First Article) | Medio | Si — procedimiento layout |
| Top Roll — Op 10 (Inyeccion) | Armrest Op 60 / Insert Op 70 | Medio | Si — parametros inyeccion Top Roll |
| Top Roll — Op 20 (Adhesivado Hot Melt) | Insert Op 90 / Armrest Op 80 | Medio | Si — parametros hot melt |
| Top Roll — Op 40 (Trimming) | Insert Op 105 | Medio | Parcial |
| Top Roll — Op 50 (Edge Folding) | Insert Op 40 (si aplica) | Medio | Si |
| Telas Planas — Op 40 (Corte prensa) | Insert Op 60 (Troquelado) | Medio | Parcial |
| **Total Grupo B** | | | **14 hojas** (contando x3 headrest = 9 + 5 top roll/telas) |

#### Grupo C: Requieren informacion nueva (sin referencia)

No existe una hoja COMPLETA equivalente en ningun producto. Requieren que personal de produccion defina los KP y QC desde cero.

| Hoja a completar | Proceso | Esfuerzo estimado | Requiere produccion? |
|---|---|---|---|
| Headrest x3 — Op 40 (Ensamble Asta + Enfundado) | Proceso unico headrest | Alto | Si — operacion exclusiva |
| Top Roll — Op 30 (Proceso IMG) | In Mold Graining | Alto | Si — proceso exclusivo Top Roll |
| Top Roll — Op 60 (Soldado Refuerzos) | Soldadura ultrasonica | Alto | Si — parametros soldadura |
| Top Roll — Op 70 (Soldado Tweeter) | Soldadura + electrica | Alto | Si — verificacion funcional |
| Telas Planas — Op 10d (Colocado Aplix) | Manual especifico | Alto | Si |
| Telas Planas — Op 20b (Horno) | Proceso termico | Alto | Si |
| Telas Planas — Op 30 (Termoformado) | Proceso termico | Alto | Si |
| Telas Planas — Op 50 (Perforado) | Proceso maquina | Alto | Si |
| Telas Planas — Op 60 (Soldadura) | Soldadura | Alto | Si |
| Telas Termo — Op 40 (Colocado clips) | Manual especifico | Alto | Si |
| Telas Termo — Op 50 (Pegado dots) | Adhesivo manual | Alto | Si |
| **Total Grupo C** | | | **13 hojas** (contando x3 headrest = 3 + 10 otros) |

---

## Parte 4: Estadisticas Consolidadas

### 4.1 Hojas que necesitan EPP adicional (por producto)

| Producto | Hojas sin EPP | Hojas con EPP insuficiente | Total hojas con problemas EPP | Total hojas del producto | % con problemas |
|---|---|---|---|---|---|
| Telas Planas (PWA) | 12 | 0 | 12 | 12 | 100% |
| Telas Termoformadas (PWA) | 8 | 0 | 8 | 8 | 100% |
| Insert | 0 | 7 parcial + 2 costura + 4 adhesivado + 1 inyeccion = 14 | 14 | 22 | 64% |
| Armrest Door Panel | 0 | 4 costura + 4 inyeccion + 4 adhesivado = 12 | 12 | 22 | 55% |
| Headrest (x12 docs) | 0 | 12 costura + 12 espumado = 24 | 24 | 96 | 25% |
| Top Roll | 0 | 2 (adhesivado + inyeccion) | 2 | 11 | 18% |
| **TOTAL** | **20** | **50** | **70** | **171** | **41%** |

### 4.2 Hojas que necesitan contenido adicional (por producto)

| Producto | Hojas PARCIAL | Hojas COMPLETA | Total | % PARCIAL |
|---|---|---|---|---|
| Top Roll | 11 | 0 | 11 | 100% |
| Telas Planas (PWA) | 12 | 0 | 12 | 100% |
| Telas Termoformadas (PWA) | 8 | 0 | 8 | 100% |
| Headrest Front (master) | 6 | 2 | 8 | 75% |
| Headrest Rear Center (master) | 6 | 2 | 8 | 75% |
| Headrest Rear Outer (master) | 6 | 2 | 8 | 75% |
| Headrest (variantes L1-L3, 9 docs) | 54 | 18 | 72 | 75% |
| Insert | 0 | 22 | 22 | 0% |
| Armrest Door Panel | 0 | 22 | 22 | 0% |
| **TOTAL** | **103** | **68** | **171** | **60%** |

### 4.3 Estimacion de esfuerzo y efecto de herencia

| Escenario | Hojas editadas manualmente | Hojas normalizadas (total) | Ratio eficiencia |
|---|---|---|---|
| Solo EPP (todas las correcciones) | 48 ediciones | 70 hojas | 1:1.5 |
| Solo contenido TWI — masters headrest | 18 ediciones | 72 hojas | 1:4 |
| Solo contenido TWI — Top Roll | 11 ediciones | 11 hojas | 1:1 |
| Solo contenido TWI — Telas PWA | 20 ediciones | 20 hojas | 1:1 |
| **Total contenido TWI** | **49 ediciones** | **103 hojas** | **1:2.1** |
| **TOTAL EPP + CONTENIDO** | **97 ediciones** | **173 correcciones** | **1:1.8** |

> Nota: hay solapamiento entre EPP y contenido — muchas hojas necesitan ambas cosas. Las 97 ediciones son el total sin contar doble.

### 4.4 Plan de ejecucion por fases

| Fase | Que se hace | Ediciones | Hojas impactadas | Requiere produccion? | Esfuerzo |
|---|---|---|---|---|---|
| **Fase 1** | EPP en 20 hojas PWA sin ninguno + EPP en masters Headrest (costura + espumado) | 23 | 32 hojas + 24 por herencia = 56 | No | 1 dia |
| **Fase 2** | EPP en Armrest/Insert (costura, inyeccion, adhesivado, parcial) + Top Roll adhesivado/inyeccion | 25 | 25 | No | 1 dia |
| **Fase 3** | Contenido TWI — Grupo A (copiar estructura de Insert/Armrest) | 22 | 22 + herencia headrest | No | 2-3 dias |
| **Fase 4** | Contenido TWI — Grupo B (adaptar con input de produccion) | 14 | 14 + herencia headrest | Si | 3-5 dias |
| **Fase 5** | Contenido TWI — Grupo C (crear desde cero con produccion) | 13 | 13 + herencia headrest | Si | 5-7 dias |
| **Fase 6** | Agregar `controlMethod` en 155 QCs de Insert/Armrest | 44 hojas | 44 | Parcial | 2 dias |
| **Fase TOTAL** | | **~97** | **171 (100%)** | | **~14-19 dias** |

### 4.5 Impacto neto de completar solo los masters

Si se completan **solo las 18 hojas PARCIAL de los 3 masters de Headrest**:

| Metrica | Antes | Despues |
|---|---|---|
| Hojas COMPLETA | 68/171 (40%) | 140/171 (82%) |
| Hojas PARCIAL | 103/171 (60%) | 31/171 (18%) |
| KP totales | 429 | ~537 (+108 estimados: 18 hojas x 6 KP promedio) |
| QC totales | 586 | ~742 (+156 estimados: 18 hojas x 8.6 QC promedio) |

Las 31 hojas restantes PARCIAL serian: Top Roll (11) + Telas Planas (12) + Telas Termoformadas (8).

---

## Anexo: Criterios de Decision

### Cuando agregar `respirador`
- Cualquier operacion que involucre: isocianatos (PU/MDI/TDI), solventes organicos, adhesivos base solvente, vapores de plastico fundido
- Operaciones tipicas: inyeccion PU, espumado, adhesivado, inyeccion plastica (si hay ventilacion deficiente)

### Cuando agregar `delantal`
- Cualquier operacion con riesgo de salpicadura de material caliente o quimico sobre el torso
- Operaciones tipicas: inyeccion PU, espumado, adhesivado, termoformado/horno, inyeccion plastica

### Cuando agregar `proteccionAuditiva`
- Cualquier maquina que genere ruido >80 dB (umbral de accion segun legislacion argentina)
- Operaciones tipicas: costura industrial, troquelado/prensa, soldadura ultrasonica, corte CNC, termoformado
- Nota: la decision final debe basarse en mediciones de ruido reales (dosimetria). Esta propuesta usa criterio conservador.

### Cuando es OK no agregar EPP extra
- Almacenamiento WIP: guantes + zapatos es suficiente (sin manipulacion de maquinas ni quimicos)
- Operaciones administrativas (trazabilidad, clasificacion, set up sin maquina activa): base minima anteojos + guantes + zapatos

---

*Nota: Esta propuesta de normalizacion se basa en buenas practicas industriales automotrices y en los datos de las hojas mas completas del sistema (Insert y Armrest). La validacion final de cada EPP y de los puntos clave TWI debe ser realizada por el area de Seguridad e Higiene y los supervisores de produccion respectivamente.*
