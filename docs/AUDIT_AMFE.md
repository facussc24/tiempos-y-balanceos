# AMFE Audit Report - Barack Mercosul

**Date:** 2026-03-17
**Scope:** All AMFE documents in Supabase production database
**Type:** Read-only completeness and risk audit

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total AMFE documents | 26 |
| Total operations | 272 |
| Total work elements (6M) | 957 |
| Total functions | 835 |
| Total failure modes | 1089 |
| Total causes | 612 |
| AP = H (High) | 250 (41%) |
| AP = M (Medium) | 152 (25%) |
| AP = L (Low) | 116 (19%) |
| AP = Not Set | 94 (15%) |
| **AP=H causes with NO actions** | **250** |
| Total auditable fields | 14657 |
| Empty fields | 3603 (25%) |
| Placeholder fields | 80 (1%) |
| Average completeness | 79% |

---

## Risk Distribution (AP)

| AP Level | Count | % of Total | Meaning |
|----------|-------|------------|----------|
| H (High) | 250 | 40.8% | Mandatory action required |
| M (Medium) | 152 | 24.8% | Action recommended |
| L (Low) | 116 | 19.0% | Optional improvement |
| Not Set | 94 | 15.4% | Risk not evaluated |

---

## CRITICAL: AP=H Causes Without Actions (250 total)

Per AIAG-VDA FMEA standard, all causes rated AP=H **must** have defined preventive/detective actions with responsible person and target date.

### AMFE-PWA-112 - PWA/TELAS_PLANAS (16 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion de Punzonado | Flamabilidad fuera de especifica... | Material fuera de especificacion... | 10 | 2 | 6 |
| 10b Recepcion de Punzonado con Bi-com... | Flamabilidad fuera de especifica... | Material fuera de especificacion... | 10 | 2 | 6 |
| 20b Horno | Calentar el material de manera n... | Mal posicionamiento de la pieza,... | 7 | 3 | 7 |
| 50 Perforado (21-8875 R y 21-8876 L) | Apertura de Menos de 9 agujeros | Mal posicionamiento de la pieza | 7 | 6 | 4 |
| 50 Perforado (21-8875 R y 21-8876 L) | Apertura de Menos de 9 agujeros | Punzones Danados | 7 | 5 | 4 |
| 50 Perforado (21-8875 R y 21-8876 L) | Apertura de agujeros desprolija | Mal posicionamiento de la pieza | 7 | 6 | 4 |
| 50 Perforado (21-8875 R y 21-8876 L) | Apertura de agujeros desprolija | Punzones Danados | 7 | 5 | 4 |
| 50 Perforado (21-8875 R y 21-8876 L) | Apertura No pasante o incompleta | Mal posicionamiento de la pieza | 7 | 6 | 4 |
| 50 Perforado (21-8875 R y 21-8876 L) | Apertura con arrastres | Punzones Danados | 7 | 5 | 4 |
| 60 Soldadura (21-8877, 21-8875 y 21-8... | Realizar proceso con piezas dist... | Mala seleccion de piezas para el... | 7 | 4 | 6 |
| 60 Soldadura (21-8877, 21-8875 y 21-8... | Realizar mas de 5 puntos de sold... | No cumplir con lo especificado e... | 7 | 4 | 6 |
| 60 Soldadura (21-8877, 21-8875 y 21-8... | Realizar menos de 5 puntos de so... | No cumplir con lo especificado e... | 7 | 4 | 6 |
| 60 Soldadura (21-8877, 21-8875 y 21-8... | No union de las piezas despues d... | No cumplir con lo especificado e... | 7 | 4 | 6 |
| 70 Control de pieza final | Pieza terminada con aplix mayor ... | Error en operaciones anteriores | 7 | 4 | 6 |
| 70 Control de pieza final | Pieza Terminada con mas o menos ... | Error en operaciones anteriores | 7 | 4 | 6 |
| 70 Control de pieza final | Pieza Desunida distinta a pieza ... | Error en operaciones anteriores | 7 | 4 | 6 |

### AMFE-PWA-113 - PWA/TELAS_TERMOFORMADAS (1 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion de materiales con identi... | Material distinto segun plan de ... | Falta de control de recepcion/ca... | 7 | 3 | 7 |

### AMFE-00001 - VWA/PATAGONIA/INSERTO (69 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 RECEPCIONAR MATERIA PRIMA | Material / pieza golpeada o daña... | Mala estiba y embalaje inadecuad... | 6 | 6 | 6 |
| 10 RECEPCIONAR MATERIA PRIMA | Material / pieza golpeada o daña... | Manipulación incorrecta en tránsito | 6 | 7 | 6 |
| 10 RECEPCIONAR MATERIA PRIMA | Material / pieza golpeada o daña... | Almacenaje inadecuado en transpo... | 6 | 6 | 6 |
| 10 RECEPCIONAR MATERIA PRIMA | Falta de documentación o trazabi... | No se utiliza el sistema ARB | 7 | 6 | 4 |
| 10 RECEPCIONAR MATERIA PRIMA | Material con especificación erró... | Proveedor no respeta tolerancias | 6 | 7 | 6 |
| 15 CORTE DE COMPONENTES DE VINILO O T... | Corte fuera de medida (paño más ... | Error del operario al medir con ... | 7 | 7 | 10 |
| 20 CORTE DE COMPONENTES DE VINILO O T... | Falla en la maquina | Falla en la máquina de corte | 6 | 6 | 8 |
| 20 CORTE DE COMPONENTES DE VINILO O T... | Selección incorrecta del material | Falta de verificación del código... | 8 | 5 | 6 |
| 20 CORTE DE COMPONENTES DE VINILO O T... | Vinilo mal identificado | Error en identificación del mate... | 7 | 6 | 7 |
| 25 CORTE DE COMPONENTES DE VINILO O T... | Omitir la operación de inspección | Operador de producción omite la ... | 6 | 6 | 9 |
| 30 CORTE DE COMPONENTES DE VINILO O T... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 7 | 8 |
| 30 CORTE DE COMPONENTES DE VINILO O T... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 7 | 8 |
| 30 CORTE DE COMPONENTES DE VINILO O T... | Pieza dañada (rasgadura, mancha)... | El Operador (Mano de Obra) no si... | 7 | 7 | 8 |
| 50 Costura - Costura CNC | Falla en el sensor de detección ... | Mano de Obra: Colocación de mate... | 8 | 7 | 8 |
| 50 Costura - Costura CNC | Falla en el sensor de detección ... | Método: Falta de definición de t... | 8 | 4 | 8 |
| 50 Costura - Costura CNC | Ruptura o Enredo del Hilo (Super... | Mano de Obra: El operador instal... | 8 | 7 | 8 |
| 50 Costura - Costura CNC | Ruptura o Enredo del Hilo (Super... | Máquina: Falla en el sistema de ... | 8 | 4 | 8 |
| 50 Costura - Costura CNC | Ruptura o Enredo del Hilo (Super... | Materiales: Aguja inadecuada par... | 8 | 5 | 8 |
| 50 Costura - Costura CNC | Ruptura o Enredo del Hilo (Super... | Método: El procedimiento de inst... | 8 | 7 | 9 |
| 50 Costura - Costura CNC | Ruptura o Enredo del Hilo (Super... | Mano de Obra: El operador ingres... | 8 | 7 | 8 |
| 50 Costura - Costura CNC | Patrón de costura (programa) car... | Máquina (Software): Fallo de la ... | 9 | 4 | 8 |
| 50 Costura - Costura CNC | Patrón de costura (programa) car... | Máquina (Sensor): El sensor que ... | 9 | 4 | 4 |
| 50 Costura - Costura CNC | Patrón de costura (programa) car... | Método: El procedimiento de set-... | 9 | 7 | 9 |
| 50 Costura - Costura CNC | Fallo o Degradación del Componen... | Mano de Obra: El operador (o per... | 9 | 7 | 9 |
| 50 Costura - Costura CNC | Fallo o Degradación del Componen... | Máquina: Fallo en los indicadore... | 9 | 4 | 8 |
| 50 Costura - Costura CNC | Fallo o Degradación del Componen... | Materiales: El aceite/lubricante... | 9 | 4 | 8 |
| 50 Costura - Costura CNC | Fallo o Degradación del Componen... | Método: El procedimiento de mant... | 9 | 7 | 9 |
| 60 TROQUELADO - Troquelado de espuma | Parte ensamblada con material in... | Operario selecciona material inc... | 8 | 7 | 8 |
| 60 TROQUELADO - Troquelado de espuma | Material fuera de posición | Operario no alinea la pieza con ... | 8 | 6 | 8 |
| 60 TROQUELADO - Troquelado de espuma | Troquel/Herramental incorrecto e... | Operario selecciona troquel equi... | 7 | 6 | 8 |
| 61 TROQUELADO - ALMACENAMIENTO EN MED... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 7 | 8 |
| 61 TROQUELADO - ALMACENAMIENTO EN MED... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 7 | 8 |
| 61 TROQUELADO - ALMACENAMIENTO EN MED... | Pieza dañada (rasgadura, mancha)... | El Operador (Mano de Obra) no si... | 7 | 7 | 8 |
| 70 INYECCIÓN PLÁSTICA - INYECCIÓN DE ... | Omitir la operación de inspecció... | Operador omite la verificación d... | 7 | 5 | 9 |
| 70 INYECCIÓN PLÁSTICA - INYECCIÓN DE ... | Omitir la operación de inspecció... | Instrucción de trabajo ambigua s... | 7 | 5 | 9 |
| 71 INYECCIÓN PLÁSTICA - ALMACENAMIENT... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 7 | 8 |
| 71 INYECCIÓN PLÁSTICA - ALMACENAMIENT... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 7 | 4 |
| 71 INYECCIÓN PLÁSTICA - ALMACENAMIENT... | Pieza dañada (rasgadura, mancha)... | El Operador (Mano de Obra) no si... | 7 | 7 | 10 |
| 80 PREARMADO DE ESPUMA | Adhesión defectuosa | Error del operario / Incorrecta ... | 6 | 7 | 8 |
| 80 PREARMADO DE ESPUMA | Pérdida de adherencia | Error del operario / Burbujas en... | 8 | 4 | 6 |
| 81 PREARMADO - ALMACENAMIENTO EN MEDI... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 7 | 8 |
| 81 PREARMADO - ALMACENAMIENTO EN MEDI... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 7 | 8 |
| 81 PREARMADO - ALMACENAMIENTO EN MEDI... | Pieza dañada (rasgadura, mancha)... | El Operador (Mano de Obra) no si... | 7 | 7 | 8 |
| 90 ADHESIVADO - ADHESIVAR PIEZAS | Adhesión insuficiente o fuera de... | Uso de adhesivo o reticulante ve... | 8 | 4 | 5 |
| 90 ADHESIVADO - ADHESIVAR PIEZAS | Adhesión insuficiente o fuera de... | Proporción de mezcla incorrecta | 8 | 7 | 8 |
| 90 ADHESIVADO - ADHESIVAR PIEZAS | Adhesión insuficiente o fuera de... | Exceso o falta de adhesivo | 8 | 6 | 8 |
| 91 ADHESIVADO - INSPECCIONAR PIEZA AD... | Adhesión insuficiente o fuera de... | Uso de adhesivo o reticulante ve... | 8 | 4 | 5 |
| 91 ADHESIVADO - INSPECCIONAR PIEZA AD... | Adhesión insuficiente o fuera de... | Proporción de mezcla incorrecta | 8 | 7 | 8 |
| 91 ADHESIVADO - INSPECCIONAR PIEZA AD... | Adhesión insuficiente o fuera de... | Exceso o falta de adhesivo | 8 | 6 | 8 |
| 92 ADHESIVADO - ALMACENAMIENTO EN MED... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 7 | 8 |
| 92 ADHESIVADO - ALMACENAMIENTO EN MED... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 7 | 10 |
| 92 ADHESIVADO - ALMACENAMIENTO EN MED... | Pieza dañada (rasgadura, mancha)... | El Operador (Mano de Obra) no si... | 7 | 7 | 10 |
| 100 Tapizado - Tapizado semiautomático | Parámetros de máquina fuera de e... | Tiempos de ciclo no verificados ... | 8 | 4 | 4 |
| 103 REPROCESO: FALTA DE ADHESIVO | Falta de adhesivo / Cobertura in... | Omisión por fatiga o distracción... | 8 | 6 | 8 |
| 103 REPROCESO: FALTA DE ADHESIVO | Falta de adhesivo / Cobertura in... | Instrucción deficiente: La Hoja ... | 8 | 4 | 8 |
| 103 REPROCESO: FALTA DE ADHESIVO | Exceso de adhesivo / se aplica a... | No existe una plantilla o máscar... | 4 | 7 | 8 |
| 105 REFILADO POST-TAPIZADO | Refilado incompleto o con exceso... | Operador no sigue la referencia ... | 7 | 6 | 6 |
| 105 REFILADO POST-TAPIZADO | Corte excesivo: vinilo cortado m... | Operador aplica presión excesiva... | 8 | 4 | 6 |
| 110 Inspección Final - CONTROL FINAL ... | Vinilo despegado | Falta / ausencia de adhesivo | 8 | 4 | 8 |
| 110 Inspección Final - CONTROL FINAL ... | Defecto de aspecto no detectado ... | Inspector omite la verificación ... | 9 | 4 | 4 |
| 110 Inspección Final - CONTROL FINAL ... | Defecto de costura no detectado ... | Inspector omite la verificación ... | 9 | 4 | 4 |
| 111 Inspección Final - CLASIFICACIÓN ... | Pieza NC clasificada como Conforme | Contenedores OK/NC no están clar... | 8 | 8 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Pieza NC clasificada como Conforme | Instrucción de Trabajo del puest... | 8 | 8 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Pieza NC clasificada como Conforme | Operador coloca Pieza NC en cont... | 8 | 5 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Mezcla de producto NC con OK en ... | Operador coloca piezas NC en OK ... | 8 | 5 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Mezcla de producto NC con OK en ... | Contenedores no están físicament... | 8 | 8 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Etiqueta o tarjeta de identifica... | Operador omite el paso de identi... | 5 | 1 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Etiqueta o tarjeta de identifica... | Insumos de identificación no dis... | 5 | 1 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Etiqueta o tarjeta de identifica... | El procedimiento de segregación ... | 5 | 1 | 8 |

### AMFE-00001 [L0] - VWA/PATAGONIA/INSERTO [L0] (69 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 RECEPCIONAR MATERIA PRIMA | Material / pieza golpeada o daña... | Mala estiba y embalaje inadecuad... | 6 | 6 | 6 |
| 10 RECEPCIONAR MATERIA PRIMA | Material / pieza golpeada o daña... | Manipulación incorrecta en tránsito | 6 | 7 | 6 |
| 10 RECEPCIONAR MATERIA PRIMA | Material / pieza golpeada o daña... | Almacenaje inadecuado en transpo... | 6 | 6 | 6 |
| 10 RECEPCIONAR MATERIA PRIMA | Falta de documentación o trazabi... | No se utiliza el sistema ARB | 7 | 6 | 4 |
| 10 RECEPCIONAR MATERIA PRIMA | Material con especificación erró... | Proveedor no respeta tolerancias | 6 | 7 | 6 |
| 15 CORTE DE COMPONENTES DE VINILO O T... | Corte fuera de medida (paño más ... | Error del operario al medir con ... | 7 | 7 | 10 |
| 20 CORTE DE COMPONENTES DE VINILO O T... | Falla en la maquina | Falla en la máquina de corte | 6 | 6 | 8 |
| 20 CORTE DE COMPONENTES DE VINILO O T... | Selección incorrecta del material | Falta de verificación del código... | 8 | 5 | 6 |
| 20 CORTE DE COMPONENTES DE VINILO O T... | Vinilo mal identificado | Error en identificación del mate... | 7 | 6 | 7 |
| 25 CORTE DE COMPONENTES DE VINILO O T... | Omitir la operación de inspección | Operador de producción omite la ... | 6 | 6 | 9 |
| 30 CORTE DE COMPONENTES DE VINILO O T... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 7 | 8 |
| 30 CORTE DE COMPONENTES DE VINILO O T... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 7 | 8 |
| 30 CORTE DE COMPONENTES DE VINILO O T... | Pieza dañada (rasgadura, mancha)... | El Operador (Mano de Obra) no si... | 7 | 7 | 8 |
| 50 Costura - Costura CNC | Falla en el sensor de detección ... | Mano de Obra: Colocación de mate... | 8 | 7 | 8 |
| 50 Costura - Costura CNC | Falla en el sensor de detección ... | Método: Falta de definición de t... | 8 | 4 | 8 |
| 50 Costura - Costura CNC | Ruptura o Enredo del Hilo (Super... | Mano de Obra: El operador instal... | 8 | 7 | 8 |
| 50 Costura - Costura CNC | Ruptura o Enredo del Hilo (Super... | Máquina: Falla en el sistema de ... | 8 | 4 | 8 |
| 50 Costura - Costura CNC | Ruptura o Enredo del Hilo (Super... | Materiales: Aguja inadecuada par... | 8 | 5 | 8 |
| 50 Costura - Costura CNC | Ruptura o Enredo del Hilo (Super... | Método: El procedimiento de inst... | 8 | 7 | 9 |
| 50 Costura - Costura CNC | Ruptura o Enredo del Hilo (Super... | Mano de Obra: El operador ingres... | 8 | 7 | 8 |
| 50 Costura - Costura CNC | Patrón de costura (programa) car... | Máquina (Software): Fallo de la ... | 9 | 4 | 8 |
| 50 Costura - Costura CNC | Patrón de costura (programa) car... | Máquina (Sensor): El sensor que ... | 9 | 4 | 4 |
| 50 Costura - Costura CNC | Patrón de costura (programa) car... | Método: El procedimiento de set-... | 9 | 7 | 9 |
| 50 Costura - Costura CNC | Fallo o Degradación del Componen... | Mano de Obra: El operador (o per... | 9 | 7 | 9 |
| 50 Costura - Costura CNC | Fallo o Degradación del Componen... | Máquina: Fallo en los indicadore... | 9 | 4 | 8 |
| 50 Costura - Costura CNC | Fallo o Degradación del Componen... | Materiales: El aceite/lubricante... | 9 | 4 | 8 |
| 50 Costura - Costura CNC | Fallo o Degradación del Componen... | Método: El procedimiento de mant... | 9 | 7 | 9 |
| 60 TROQUELADO - Troquelado de espuma | Parte ensamblada con material in... | Operario selecciona material inc... | 8 | 7 | 8 |
| 60 TROQUELADO - Troquelado de espuma | Material fuera de posición | Operario no alinea la pieza con ... | 8 | 6 | 8 |
| 60 TROQUELADO - Troquelado de espuma | Troquel/Herramental incorrecto e... | Operario selecciona troquel equi... | 7 | 6 | 8 |
| 61 TROQUELADO - ALMACENAMIENTO EN MED... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 7 | 8 |
| 61 TROQUELADO - ALMACENAMIENTO EN MED... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 7 | 8 |
| 61 TROQUELADO - ALMACENAMIENTO EN MED... | Pieza dañada (rasgadura, mancha)... | El Operador (Mano de Obra) no si... | 7 | 7 | 8 |
| 70 INYECCIÓN PLÁSTICA - INYECCIÓN DE ... | Omitir la operación de inspecció... | Operador omite la verificación d... | 7 | 5 | 9 |
| 70 INYECCIÓN PLÁSTICA - INYECCIÓN DE ... | Omitir la operación de inspecció... | Instrucción de trabajo ambigua s... | 7 | 5 | 9 |
| 71 INYECCIÓN PLÁSTICA - ALMACENAMIENT... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 7 | 8 |
| 71 INYECCIÓN PLÁSTICA - ALMACENAMIENT... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 7 | 4 |
| 71 INYECCIÓN PLÁSTICA - ALMACENAMIENT... | Pieza dañada (rasgadura, mancha)... | El Operador (Mano de Obra) no si... | 7 | 7 | 10 |
| 80 PREARMADO DE ESPUMA | Adhesión defectuosa | Error del operario / Incorrecta ... | 6 | 7 | 8 |
| 80 PREARMADO DE ESPUMA | Pérdida de adherencia | Error del operario / Burbujas en... | 8 | 4 | 6 |
| 81 PREARMADO - ALMACENAMIENTO EN MEDI... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 7 | 8 |
| 81 PREARMADO - ALMACENAMIENTO EN MEDI... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 7 | 8 |
| 81 PREARMADO - ALMACENAMIENTO EN MEDI... | Pieza dañada (rasgadura, mancha)... | El Operador (Mano de Obra) no si... | 7 | 7 | 8 |
| 90 ADHESIVADO - ADHESIVAR PIEZAS | Adhesión insuficiente o fuera de... | Uso de adhesivo o reticulante ve... | 8 | 4 | 5 |
| 90 ADHESIVADO - ADHESIVAR PIEZAS | Adhesión insuficiente o fuera de... | Proporción de mezcla incorrecta | 8 | 7 | 8 |
| 90 ADHESIVADO - ADHESIVAR PIEZAS | Adhesión insuficiente o fuera de... | Exceso o falta de adhesivo | 8 | 6 | 8 |
| 91 ADHESIVADO - INSPECCIONAR PIEZA AD... | Adhesión insuficiente o fuera de... | Uso de adhesivo o reticulante ve... | 8 | 4 | 5 |
| 91 ADHESIVADO - INSPECCIONAR PIEZA AD... | Adhesión insuficiente o fuera de... | Proporción de mezcla incorrecta | 8 | 7 | 8 |
| 91 ADHESIVADO - INSPECCIONAR PIEZA AD... | Adhesión insuficiente o fuera de... | Exceso o falta de adhesivo | 8 | 6 | 8 |
| 92 ADHESIVADO - ALMACENAMIENTO EN MED... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 7 | 8 |
| 92 ADHESIVADO - ALMACENAMIENTO EN MED... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 7 | 10 |
| 92 ADHESIVADO - ALMACENAMIENTO EN MED... | Pieza dañada (rasgadura, mancha)... | El Operador (Mano de Obra) no si... | 7 | 7 | 10 |
| 100 Tapizado - Tapizado semiautomático | Parámetros de máquina fuera de e... | Tiempos de ciclo no verificados ... | 8 | 4 | 4 |
| 103 REPROCESO: FALTA DE ADHESIVO | Falta de adhesivo / Cobertura in... | Omisión por fatiga o distracción... | 8 | 6 | 8 |
| 103 REPROCESO: FALTA DE ADHESIVO | Falta de adhesivo / Cobertura in... | Instrucción deficiente: La Hoja ... | 8 | 4 | 8 |
| 103 REPROCESO: FALTA DE ADHESIVO | Exceso de adhesivo / se aplica a... | No existe una plantilla o máscar... | 4 | 7 | 8 |
| 105 REFILADO POST-TAPIZADO | Refilado incompleto o con exceso... | Operador no sigue la referencia ... | 7 | 6 | 6 |
| 105 REFILADO POST-TAPIZADO | Corte excesivo: vinilo cortado m... | Operador aplica presión excesiva... | 8 | 4 | 6 |
| 110 Inspección Final - CONTROL FINAL ... | Vinilo despegado | Falta / ausencia de adhesivo | 8 | 4 | 8 |
| 110 Inspección Final - CONTROL FINAL ... | Defecto de aspecto no detectado ... | Inspector omite la verificación ... | 9 | 4 | 4 |
| 110 Inspección Final - CONTROL FINAL ... | Defecto de costura no detectado ... | Inspector omite la verificación ... | 9 | 4 | 4 |
| 111 Inspección Final - CLASIFICACIÓN ... | Pieza NC clasificada como Conforme | Contenedores OK/NC no están clar... | 8 | 8 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Pieza NC clasificada como Conforme | Instrucción de Trabajo del puest... | 8 | 8 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Pieza NC clasificada como Conforme | Operador coloca Pieza NC en cont... | 8 | 5 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Mezcla de producto NC con OK en ... | Operador coloca piezas NC en OK ... | 8 | 5 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Mezcla de producto NC con OK en ... | Contenedores no están físicament... | 8 | 8 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Etiqueta o tarjeta de identifica... | Operador omite el paso de identi... | 5 | 1 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Etiqueta o tarjeta de identifica... | Insumos de identificación no dis... | 5 | 1 | 8 |
| 111 Inspección Final - CLASIFICACIÓN ... | Etiqueta o tarjeta de identifica... | El procedimiento de segregación ... | 5 | 1 | 8 |

### AMFE-ARMREST-001 - VWA/PATAGONIA/ARMREST (41 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 RECEPCIONAR MATERIA PRIMA | Material con especificacion erro... | Proveedor no respeta tolerancias | 7 | 6 | 6 |
| 10 RECEPCIONAR MATERIA PRIMA | Material con especificacion erro... | Error en la orden de compra o fi... | 7 | 5 | 6 |
| 10 RECEPCIONAR MATERIA PRIMA | Falta de documentacion o trazabi... | Proveedor sin sistema robusto de... | 6 | 6 | 6 |
| 10 RECEPCIONAR MATERIA PRIMA | Falta de documentacion o trazabi... | Procesos administrativos deficie... | 6 | 4 | 4 |
| 15 CORTE DE COMPONENTES - PREPARACION... | Corte fuera de medida (pano mas ... | Error del operario al medir con ... | 7 | 5 | 10 |
| 20 CORTE DE COMPONENTES DE VINILO O TELA | Seleccion incorrecta del materia... | Falta de verificacion del codigo... | 8 | 5 | 6 |
| 20 CORTE DE COMPONENTES DE VINILO O TELA | Desviacion en el corte de los pl... | Parametros de corte mal ingresados | 7 | 8 | 3 |
| 25 CORTE DE COMPONENTES - CONTROL CON... | Omitir la operacion de inspeccion | Operador de produccion omite la ... | 6 | 3 | 9 |
| 30 CORTE DE COMPONENTES - ALMACENAMIE... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 5 | 7 |
| 30 CORTE DE COMPONENTES - ALMACENAMIE... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 5 | 7 |
| 30 CORTE DE COMPONENTES - ALMACENAMIE... | Pieza danada (rasgadura, mancha)... | El Operador no sigue el procedim... | 8 | 5 | 8 |
| 52 COSTURA - ALMACENAMIENTO EN MEDIOS... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 5 | 7 |
| 52 COSTURA - ALMACENAMIENTO EN MEDIOS... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 5 | 7 |
| 52 COSTURA - ALMACENAMIENTO EN MEDIOS... | Pieza danada (rasgadura, mancha)... | El Operador no sigue el procedim... | 8 | 5 | 8 |
| 60 INYECCION PLASTICA - INYECCION DE ... | Llenado Incompleto de Pieza | Presion de Inyeccion configurada... | 9 | 5 | 5 |
| 60 INYECCION PLASTICA - INYECCION DE ... | Llenado Incompleto de Pieza | Temperatura de fusion del materi... | 9 | 4 | 8 |
| 60 INYECCION PLASTICA - INYECCION DE ... | Rebaba Excesiva / Exceso de Mate... | Parametros de Inyeccion configur... | 7 | 7 | 5 |
| 61 INYECCION PLASTICA - ALMACENAMIENT... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 5 | 7 |
| 61 INYECCION PLASTICA - ALMACENAMIENT... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 5 | 7 |
| 61 INYECCION PLASTICA - ALMACENAMIENT... | Pieza danada (rasgadura, mancha)... | El Operador no sigue el procedim... | 8 | 5 | 8 |
| 71 PREARMADO - PREARMADO DE ESPUMA | Espuma se suelta | Error del operario: Incorrecta c... | 7 | 7 | 8 |
| 80 ADHESIVADO - ADHESIVAR PIEZAS | Adhesion insuficiente o fuera de... | Uso de adhesivo o reticulante ve... | 8 | 4 | 5 |
| 80 ADHESIVADO - ADHESIVAR PIEZAS | Adhesion insuficiente o fuera de... | Proporcion de mezcla incorrecta | 8 | 7 | 8 |
| 80 ADHESIVADO - ADHESIVAR PIEZAS | Adhesion insuficiente o fuera de... | Exceso o falta de adhesivo | 8 | 6 | 8 |
| 81 ADHESIVADO - INSPECCIONAR PIEZA AD... | Adhesion insuficiente o fuera de... | Uso de adhesivo o reticulante ve... | 8 | 4 | 5 |
| 81 ADHESIVADO - INSPECCIONAR PIEZA AD... | Adhesion insuficiente o fuera de... | Proporcion de mezcla incorrecta | 8 | 7 | 8 |
| 81 ADHESIVADO - INSPECCIONAR PIEZA AD... | Adhesion insuficiente o fuera de... | Exceso o falta de adhesivo | 8 | 6 | 8 |
| 82 ADHESIVADO - ALMACENAMIENTO EN MED... | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 5 | 7 |
| 82 ADHESIVADO - ALMACENAMIENTO EN MED... | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 7 | 5 | 7 |
| 82 ADHESIVADO - ALMACENAMIENTO EN MED... | Pieza danada (rasgadura, mancha)... | El Operador no sigue el procedim... | 8 | 5 | 8 |
| 90 TAPIZADO - TAPIZADO SEMIAUTOMATICO | Vinilo despegado (falta / ausenc... | Falta / ausencia de adhesivo | 8 | 5 | 8 |
| 101 CLASIFICACION Y SEGREGACION DE PR... | Pieza No Conforme (NC) es clasif... | Operador coloca la Pieza NC en e... | 10 | 5 | 8 |
| 101 CLASIFICACION Y SEGREGACION DE PR... | Pieza No Conforme (NC) es clasif... | Contenedor de Producto Conforme ... | 10 | 4 | 8 |
| 101 CLASIFICACION Y SEGREGACION DE PR... | Pieza No Conforme (NC) es clasif... | Instruccion de Trabajo del puest... | 10 | 5 | 8 |
| 103 REPROCESO: FALTA DE ADHESIVO | Falta de adhesivo / Cobertura in... | Omision por fatiga o distraccion... | 8 | 5 | 8 |
| 103 REPROCESO: FALTA DE ADHESIVO | Falta de adhesivo / Cobertura in... | La herramienta manual no carga s... | 8 | 7 | 5 |
| 103 REPROCESO: FALTA DE ADHESIVO | Exceso de adhesivo / se aplica a... | No existe una plantilla o mascar... | 8 | 5 | 8 |
| 103 REPROCESO: FALTA DE ADHESIVO | Mezcla de producto No Conforme (... | Operador coloca piezas NC en el ... | 8 | 5 | 8 |
| 103 REPROCESO: FALTA DE ADHESIVO | Mezcla de producto No Conforme (... | Contenedores de Producto Conform... | 8 | 4 | 8 |
| 103 REPROCESO: FALTA DE ADHESIVO | Mezcla de producto No Conforme (... | Instruccion de Trabajo del puest... | 8 | 5 | 8 |
| 103 REPROCESO: FALTA DE ADHESIVO | Etiqueta o tarjeta de identifica... | Operador omite el paso de identi... | 8 | 4 | 8 |

### AMFE-TOPROLL-001 - VWA/PATAGONIA/TOP_ROLL (30 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 5 RECEPCIONAR MATERIA PRIMA | Material / pieza golpeada o daña... | Mala estiba y embalaje inadecuado | 7 | 6 | 6 |
| 5 RECEPCIONAR MATERIA PRIMA | Material / pieza golpeada o daña... | Manipulación incorrecta en tránsito | 7 | 5 | 6 |
| 5 RECEPCIONAR MATERIA PRIMA | Material / pieza golpeada o daña... | Almacenaje inadecuado en transpo... | 7 | 5 | 6 |
| 5 RECEPCIONAR MATERIA PRIMA | Falta de documentación o trazabi... | Proveedor sin sistema robusto de... | 7 | 5 | 5 |
| 5 RECEPCIONAR MATERIA PRIMA | Material con especificación erró... | Error en la orden de compra o fi... | 8 | 6 | 6 |
| 5 RECEPCIONAR MATERIA PRIMA | Material con especificación erró... | Proveedor no respeta tolerancias | 8 | 7 | 6 |
| 5 RECEPCIONAR MATERIA PRIMA | Contaminación / suciedad en la m... | Ambiente sucio en planta del pro... | 6 | 6 | 6 |
| 10 INYECCIÓN DE PIEZAS PLÁSTICAS | Llenado Incompleto de Pieza | Presión de Inyección configurada... | 9 | 5 | 5 |
| 10 INYECCIÓN DE PIEZAS PLÁSTICAS | Llenado Incompleto de Pieza | Temperatura de fusión del materi... | 9 | 4 | 5 |
| 10 INYECCIÓN DE PIEZAS PLÁSTICAS | Rebaba Excesiva / Exceso de Mate... | Molde o cavidad contaminada con ... | 8 | 5 | 8 |
| 10 INYECCIÓN DE PIEZAS PLÁSTICAS | Rebaba Excesiva / Exceso de Mate... | Parámetros de Inyección configur... | 8 | 5 | 8 |
| 10 INYECCIÓN DE PIEZAS PLÁSTICAS | Omitir inspección dimensional de... | Operador omite la verificación d... | 7 | 5 | 5 |
| 10 INYECCIÓN DE PIEZAS PLÁSTICAS | Omitir inspección dimensional de... | Instrucción de trabajo ambigua s... | 7 | 5 | 5 |
| 10 INYECCIÓN DE PIEZAS PLÁSTICAS | Contaminación / suciedad en la m... | Falta de inspección al llegar | 6 | 6 | 6 |
| 11 ALMACENAMIENTO EN MEDIOS WIP | Faltante/exceso de componentes e... | El Operador no realiza el conteo... | 7 | 5 | 5 |
| 11 ALMACENAMIENTO EN MEDIOS WIP | Componente incorrecto (variante ... | Mano de Obra no realiza la verif... | 8 | 5 | 5 |
| 11 ALMACENAMIENTO EN MEDIOS WIP | Pieza dañada (rasgadura, mancha)... | El Operador no sigue el procedim... | 7 | 5 | 5 |
| 20 ADHESIVADO HOT MELT | Adhesión deficiente del vinilo e... | Temperatura de aplicación mayor ... | 8 | 4 | 8 |
| 20 ADHESIVADO HOT MELT | Peso del vinilo adhesivado incor... | Falta de control de peso de adhe... | 8 | 4 | 8 |
| 20 ADHESIVADO HOT MELT | Posible quemadura en el operario | Falta de EPP y herramientas | 10 | 1 | 4 |
| 30 PROCESO DE IMG | Temperatura de lámina TPO insufi... | Sensor de temperatura de horno d... | 10 | 4 | 7 |
| 30 PROCESO DE IMG | Espesor de pared excesivo en zon... | Obstrucción parcial de micro-can... | 10 | 6 | 3 |
| 40 TRIMMING CORTE FINAL | Borde de corte quemado o con hil... | Velocidad de avance de cuchilla ... | 5 | 6 | 5 |
| 50 EDGE FOLDING | Espesor de borde fuera de especi... | Fuga de aire o baja presión en c... | 6 | 6 | 6 |
| 50 EDGE FOLDING | Arrugas o pliegues irregulares v... | Pieza mal posicionada en el nido... | 5 | 6 | 5 |
| 70 SOLDADO TWEETER | Tweeter dañado internamente (Bob... | Contacto directo del sonotrodo c... | 10 | 2 | 10 |
| 80 INSPECCIÓN FINAL Y EMPAQUE | Pieza NO CONFORME aceptada y env... | Energía/señal del sensor de pres... | 10 | 3 | 4 |
| 80 INSPECCIÓN FINAL Y EMPAQUE | Pieza mal identificada / Etiquet... | Error humano en la selección de ... | 9 | 2 | 2 |
| 80 INSPECCIÓN FINAL Y EMPAQUE | Fuga de defecto visual (Pieza co... | Fatiga visual del inspector / Cr... | 7 | 5 | 7 |
| 90 EMPAQUE FINAL Y ETIQUETADO DE PROD... | Etiqueta incorrecta / Piezas mez... | Error humano en la selección de ... | 7 | 5 | 7 |

### AMFE-HR-FRONT-L0 - VWA/PATAGONIA/HEADREST_FRONT (2 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion | Control de VINILO - Flamabilidad | Falla en control de: Control de ... | 9 | 5 | 5 |
| 10 Recepcion | Control del Vinilo - Flamabilidad | Falla en control de: Control del... | 9 | 5 | 5 |

### AMFE-HR-FRONT-L1 - VWA/PATAGONIA/HEADREST_FRONT [L1] (2 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion | Control de VINILO - Flamabilidad | Falla en control de: Control de ... | 9 | 5 | 5 |
| 10 Recepcion | Control del Vinilo - Flamabilidad | Falla en control de: Control del... | 9 | 5 | 5 |

### AMFE-HR-FRONT-L2 - VWA/PATAGONIA/HEADREST_FRONT [L2] (2 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion | Control de VINILO - Flamabilidad | Falla en control de: Control de ... | 9 | 5 | 5 |
| 10 Recepcion | Control del Vinilo - Flamabilidad | Falla en control de: Control del... | 9 | 5 | 5 |

### AMFE-HR-FRONT-L3 - VWA/PATAGONIA/HEADREST_FRONT [L3] (2 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion | Control de VINILO - Flamabilidad | Falla en control de: Control de ... | 9 | 5 | 5 |
| 10 Recepcion | Control del Vinilo - Flamabilidad | Falla en control de: Control del... | 9 | 5 | 5 |

### AMFE-HR-REAR_CEN-L0 - VWA/PATAGONIA/HEADREST_REAR_CEN (2 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion | Control de VINILO - Flamabilidad | Falla en control de: Control de ... | 9 | 5 | 5 |
| 10 Recepcion | Control del Vinilo - Flamabilidad | Falla en control de: Control del... | 9 | 5 | 5 |

### AMFE-HR-REAR_CEN-L1 - VWA/PATAGONIA/HEADREST_REAR_CEN [L1] (2 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion | Control de VINILO - Flamabilidad | Falla en control de: Control de ... | 9 | 5 | 5 |
| 10 Recepcion | Control del Vinilo - Flamabilidad | Falla en control de: Control del... | 9 | 5 | 5 |

### AMFE-HR-REAR_CEN-L2 - VWA/PATAGONIA/HEADREST_REAR_CEN [L2] (2 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion | Control de VINILO - Flamabilidad | Falla en control de: Control de ... | 9 | 5 | 5 |
| 10 Recepcion | Control del Vinilo - Flamabilidad | Falla en control de: Control del... | 9 | 5 | 5 |

### AMFE-HR-REAR_CEN-L3 - VWA/PATAGONIA/HEADREST_REAR_CEN [L3] (2 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion | Control de VINILO - Flamabilidad | Falla en control de: Control de ... | 9 | 5 | 5 |
| 10 Recepcion | Control del Vinilo - Flamabilidad | Falla en control de: Control del... | 9 | 5 | 5 |

### AMFE-HR-REAR_OUT-L0 - VWA/PATAGONIA/HEADREST_REAR_OUT (2 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion | Control de VINILO - Flamabilidad | Falla en control de: Control de ... | 9 | 5 | 5 |
| 10 Recepcion | Control del Vinilo - Flamabilidad | Falla en control de: Control del... | 9 | 5 | 5 |

### AMFE-HR-REAR_OUT-L1 - VWA/PATAGONIA/HEADREST_REAR_OUT [L1] (2 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion | Control de VINILO - Flamabilidad | Falla en control de: Control de ... | 9 | 5 | 5 |
| 10 Recepcion | Control del Vinilo - Flamabilidad | Falla en control de: Control del... | 9 | 5 | 5 |

### AMFE-HR-REAR_OUT-L2 - VWA/PATAGONIA/HEADREST_REAR_OUT [L2] (2 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion | Control de VINILO - Flamabilidad | Falla en control de: Control de ... | 9 | 5 | 5 |
| 10 Recepcion | Control del Vinilo - Flamabilidad | Falla en control de: Control del... | 9 | 5 | 5 |

### AMFE-HR-REAR_OUT-L3 - VWA/PATAGONIA/HEADREST_REAR_OUT [L3] (2 gaps)

| Operation | Failure Mode | Cause | S | O | D |
|-----------|-------------|-------|---|---|---|
| 10 Recepcion | Control de VINILO - Flamabilidad | Falla en control de: Control de ... | 9 | 5 | 5 |
| 10 Recepcion | Control del Vinilo - Flamabilidad | Falla en control de: Control del... | 9 | 5 | 5 |

---

## Document Overview (sorted by completeness, worst first)

| # | AMFE Number | Project | Status | Ops | Failures | Causes | AP-H | AP-M | AP-H No Act | Completeness |
|---|-------------|---------|--------|-----|----------|--------|------|------|-------------|-------------|
| 1 | AMFE-1 | PWA/2026/Telas Planas | Draft | 8 | 19 | 19 | 0 | 0 | 0 | 51% |
| 2 | AMFE-2 | PWA/2026/Telas Termoformadas | Draft | 9 | 15 | 15 | 0 | 0 | 0 | 52% |
| 3 | AMFE-PWA-112 | PWA/TELAS_PLANAS | Draft | 12 | 35 | 38 | 16 | 7 | 16 | 57% |
| 4 | AMFE-PWA-113 | PWA/TELAS_TERMOFORMADAS | Draft | 8 | 20 | 21 | 1 | 3 | 1 | 58% |
| 5 | AMFE-3 | VWA/Patagonia/Armrest Door Panel | Draft | 9 | 16 | 16 | 0 | 0 | 0 | 60% |
| 6 | AMFE-5 | VWA/Patagonia/Top Roll | Draft | 9 | 16 | 16 | 0 | 0 | 0 | 60% |
| 7 | AMFE-4 | VWA/Patagonia/Insert | Draft | 11 | 14 | 14 | 0 | 0 | 0 | 64% |
| 8 | AMFE-4 [L0] | VWA/Patagonia/Insert [L0] | Draft | 11 | 14 | 14 | 0 | 0 | 0 | 64% |
| 9 | AMFE-00001 | VWA/PATAGONIA/INSERTO | Draft | 22 | 66 | 110 | 69 | 33 | 69 | 65% |
| 10 | AMFE-00001 [L0] | VWA/PATAGONIA/INSERTO [L0] | Draft | 22 | 66 | 110 | 69 | 33 | 69 | 65% |
| 11 | AMFE-ARMREST-001 | VWA/PATAGONIA/ARMREST | Draft | 22 | 71 | 106 | 41 | 55 | 41 | 69% |
| 12 | AMFE-006 | VWA/2026/Proceso de fabricación - Top Roll | Draft | 11 | 31 | 31 | 0 | 4 | 0 | 71% |
| 13 | AMFE-006 [L1] | VWA/2026/Proceso de fabricación - Top Roll [L1] | Draft | 11 | 31 | 31 | 0 | 4 | 0 | 71% |
| 14 | AMFE-TOPROLL-001 | VWA/PATAGONIA/TOP_ROLL | Draft | 11 | 35 | 47 | 30 | 13 | 30 | 71% |
| 15 | AMFE-HR-FRONT-L0 | VWA/PATAGONIA/HEADREST_FRONT | Draft | 8 | 54 | 2 | 2 | 0 | 2 | 97% |
| 16 | AMFE-HR-FRONT-L1 | VWA/PATAGONIA/HEADREST_FRONT [L1] | Draft | 8 | 54 | 2 | 2 | 0 | 2 | 97% |
| 17 | AMFE-HR-FRONT-L2 | VWA/PATAGONIA/HEADREST_FRONT [L2] | Draft | 8 | 54 | 2 | 2 | 0 | 2 | 97% |
| 18 | AMFE-HR-FRONT-L3 | VWA/PATAGONIA/HEADREST_FRONT [L3] | Draft | 8 | 54 | 2 | 2 | 0 | 2 | 97% |
| 19 | AMFE-HR-REAR_CEN-L0 | VWA/PATAGONIA/HEADREST_REAR_CEN | Draft | 8 | 52 | 2 | 2 | 0 | 2 | 97% |
| 20 | AMFE-HR-REAR_CEN-L1 | VWA/PATAGONIA/HEADREST_REAR_CEN [L1] | Draft | 8 | 52 | 2 | 2 | 0 | 2 | 97% |
| 21 | AMFE-HR-REAR_CEN-L2 | VWA/PATAGONIA/HEADREST_REAR_CEN [L2] | Draft | 8 | 52 | 2 | 2 | 0 | 2 | 97% |
| 22 | AMFE-HR-REAR_CEN-L3 | VWA/PATAGONIA/HEADREST_REAR_CEN [L3] | Draft | 8 | 52 | 2 | 2 | 0 | 2 | 97% |
| 23 | AMFE-HR-REAR_OUT-L0 | VWA/PATAGONIA/HEADREST_REAR_OUT | Draft | 8 | 54 | 2 | 2 | 0 | 2 | 97% |
| 24 | AMFE-HR-REAR_OUT-L1 | VWA/PATAGONIA/HEADREST_REAR_OUT [L1] | Draft | 8 | 54 | 2 | 2 | 0 | 2 | 97% |
| 25 | AMFE-HR-REAR_OUT-L2 | VWA/PATAGONIA/HEADREST_REAR_OUT [L2] | Draft | 8 | 54 | 2 | 2 | 0 | 2 | 97% |
| 26 | AMFE-HR-REAR_OUT-L3 | VWA/PATAGONIA/HEADREST_REAR_OUT [L3] | Draft | 8 | 54 | 2 | 2 | 0 | 2 | 97% |

---

## Detailed Document Analysis

### AMFE-1 - PWA/2026/Telas Planas

| Field | Value |
|-------|-------|
| Subject | Proceso de fabricación - Telas Planas |
| Client | PWA |
| Part Number | TBD-TP-PWA |
| Responsible | F. Santoro |
| Status | draft |
| Start Date | 2026-03-14 |
| Last Updated | 2026-03-16T16:13:09.056249+00:00 |
| Operations | 8 |
| Work Elements (6M) | 12 |
| Functions | 12 |
| Failure Modes | 19 |
| Causes | 19 |
| AP Distribution | H:0 / M:0 / L:0 / None:19 |
| AP=H without actions | 0 |
| Stored Coverage (S/O/D) | 0% |
| Total auditable fields | 352 |
| Empty fields | 172 |
| Placeholder fields | 0 |
| **Completeness** | **51%** |

**Header gaps:** approvedBy

**Critical body gaps (first 10):**
- Op OP 10: Severity empty
- Op OP 10: Severity empty
- Op OP 15: Severity empty
- Op OP 15: Severity empty
- Op OP 15: Severity empty
- Op OP 20: Severity empty
- Op OP 20: Severity empty
- Op OP 20: Severity empty
- Op OP 30: Severity empty
- Op OP 30: Severity empty
- ... and 9 more

### AMFE-2 - PWA/2026/Telas Termoformadas

| Field | Value |
|-------|-------|
| Subject | Proceso de fabricación - Telas Termoformadas |
| Client | PWA |
| Part Number | TBD-TT-PWA |
| Responsible | F. Santoro |
| Status | draft |
| Start Date | 2026-03-14 |
| Last Updated | 2026-03-16T16:13:08.474604+00:00 |
| Operations | 9 |
| Work Elements (6M) | 10 |
| Functions | 10 |
| Failure Modes | 15 |
| Causes | 15 |
| AP Distribution | H:0 / M:0 / L:0 / None:15 |
| AP=H without actions | 0 |
| Stored Coverage (S/O/D) | 0% |
| Total auditable fields | 285 |
| Empty fields | 136 |
| Placeholder fields | 0 |
| **Completeness** | **52%** |

**Header gaps:** approvedBy

**Critical body gaps (first 10):**
- Op OP 10: Severity empty
- Op OP 20: Severity empty
- Op OP 30: Severity empty
- Op OP 30: Severity empty
- Op OP 30: Severity empty
- Op OP 40: Severity empty
- Op OP 40: Severity empty
- Op OP 50: Severity empty
- Op OP 50: Severity empty
- Op OP 60: Severity empty
- ... and 5 more

### AMFE-PWA-112 - PWA/TELAS_PLANAS

| Field | Value |
|-------|-------|
| Subject | TELA ASSENTO DIANTEIRO |
| Client | PWA |
| Part Number | 21-8909 |
| Responsible | F.SANTORO |
| Status | draft |
| Start Date | 2022-10-31 |
| Last Updated | 2026-03-17T23:20:30.371664+00:00 |
| Operations | 12 |
| Work Elements (6M) | 12 |
| Functions | 12 |
| Failure Modes | 35 |
| Causes | 38 |
| AP Distribution | H:16 / M:7 / L:15 / None:0 |
| AP=H without actions | 16 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 645 |
| Empty fields | 275 |
| Placeholder fields | 0 |
| **Completeness** | **57%** |

**Header gaps:** modelYear, team, amfeNumber, responsible, confidentiality, processResponsible, approvedBy, scope

### AMFE-PWA-113 - PWA/TELAS_TERMOFORMADAS

| Field | Value |
|-------|-------|
| Subject | TELAS TERMOFORMADAS |
| Client | PWA |
| Part Number | Segun tabla |
| Responsible | F.SANTORO |
| Status | draft |
| Start Date | 2020-06-18 |
| Last Updated | 2026-03-17T23:20:47.167418+00:00 |
| Operations | 8 |
| Work Elements (6M) | 8 |
| Functions | 8 |
| Failure Modes | 20 |
| Causes | 21 |
| AP Distribution | H:1 / M:3 / L:17 / None:0 |
| AP=H without actions | 1 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 371 |
| Empty fields | 156 |
| Placeholder fields | 0 |
| **Completeness** | **58%** |

**Header gaps:** modelYear, team, amfeNumber, responsible, confidentiality, processResponsible, approvedBy, scope

### AMFE-3 - VWA/Patagonia/Armrest Door Panel

| Field | Value |
|-------|-------|
| Subject | Proceso de fabricación - Armrest Door Panel |
| Client | VWA |
| Part Number | TBD-ARM-PAT |
| Responsible | F. Santoro |
| Status | draft |
| Start Date | 2026-03-14 |
| Last Updated | 2026-03-16T16:13:07.908018+00:00 |
| Operations | 9 |
| Work Elements (6M) | 41 |
| Functions | 41 |
| Failure Modes | 16 |
| Causes | 16 |
| AP Distribution | H:0 / M:0 / L:0 / None:16 |
| AP=H without actions | 0 |
| Stored Coverage (S/O/D) | 0% |
| Total auditable fields | 363 |
| Empty fields | 145 |
| Placeholder fields | 0 |
| **Completeness** | **60%** |

**Header gaps:** approvedBy

**Critical body gaps (first 10):**
- Op OP 10: Severity empty
- Op OP 20: Severity empty
- Op OP 20: Severity empty
- Op OP 30: Severity empty
- Op OP 40: Severity empty
- Op OP 40: Severity empty
- Op OP 40: Severity empty
- Op OP 50: Severity empty
- Op OP 50: Severity empty
- Op OP 50: Severity empty
- ... and 6 more

### AMFE-5 - VWA/Patagonia/Top Roll

| Field | Value |
|-------|-------|
| Subject | Proceso de fabricación - Top Roll |
| Client | VWA |
| Part Number | TBD-TR-PAT |
| Responsible | F. Santoro |
| Status | draft |
| Start Date | 2026-03-14 |
| Last Updated | 2026-03-16T16:13:06.698459+00:00 |
| Operations | 9 |
| Work Elements (6M) | 40 |
| Functions | 40 |
| Failure Modes | 16 |
| Causes | 16 |
| AP Distribution | H:0 / M:0 / L:0 / None:16 |
| AP=H without actions | 0 |
| Stored Coverage (S/O/D) | 0% |
| Total auditable fields | 361 |
| Empty fields | 145 |
| Placeholder fields | 0 |
| **Completeness** | **60%** |

**Header gaps:** approvedBy

**Critical body gaps (first 10):**
- Op OP 5: Severity empty
- Op OP 10: Severity empty
- Op OP 10: Severity empty
- Op OP 10: Severity empty
- Op OP 20: Severity empty
- Op OP 20: Severity empty
- Op OP 30: Severity empty
- Op OP 30: Severity empty
- Op OP 30: Severity empty
- Op OP 40: Severity empty
- ... and 6 more

### AMFE-4 - VWA/Patagonia/Insert

| Field | Value |
|-------|-------|
| Subject | Proceso de fabricación - Insert |
| Client | VWA |
| Part Number | TBD-INS-PAT |
| Responsible | F. Santoro |
| Status | draft |
| Start Date | 2026-03-14 |
| Last Updated | 2026-03-16T16:13:07.283468+00:00 |
| Operations | 11 |
| Work Elements (6M) | 49 |
| Functions | 49 |
| Failure Modes | 14 |
| Causes | 14 |
| AP Distribution | H:0 / M:0 / L:0 / None:14 |
| AP=H without actions | 0 |
| Stored Coverage (S/O/D) | 0% |
| Total auditable fields | 349 |
| Empty fields | 127 |
| Placeholder fields | 0 |
| **Completeness** | **64%** |

**Header gaps:** approvedBy

**Critical body gaps (first 10):**
- Op OP 10: Severity empty
- Op OP 20: Severity empty
- Op OP 30: Severity empty
- Op OP 40: Severity empty
- Op OP 40: Severity empty
- Op OP 40: Severity empty
- Op OP 50: Severity empty
- Op OP 60: Severity empty
- Op OP 60: Severity empty
- Op OP 70: Severity empty
- ... and 4 more

### AMFE-4 [L0] - VWA/Patagonia/Insert [L0]

| Field | Value |
|-------|-------|
| Subject | Proceso de fabricación - Insert [L0] |
| Client | VWA |
| Part Number | TBD-INS-PAT |
| Responsible | F. Santoro |
| Status | draft |
| Start Date | 2026-03-14 |
| Last Updated | 2026-03-17T22:00:30.213351+00:00 |
| Operations | 11 |
| Work Elements (6M) | 49 |
| Functions | 49 |
| Failure Modes | 14 |
| Causes | 14 |
| AP Distribution | H:0 / M:0 / L:0 / None:14 |
| AP=H without actions | 0 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 349 |
| Empty fields | 127 |
| Placeholder fields | 0 |
| **Completeness** | **64%** |

**Header gaps:** approvedBy

**Critical body gaps (first 10):**
- Op OP 10: Severity empty
- Op OP 20: Severity empty
- Op OP 30: Severity empty
- Op OP 40: Severity empty
- Op OP 40: Severity empty
- Op OP 40: Severity empty
- Op OP 50: Severity empty
- Op OP 60: Severity empty
- Op OP 60: Severity empty
- Op OP 70: Severity empty
- ... and 4 more

### AMFE-00001 - VWA/PATAGONIA/INSERTO

| Field | Value |
|-------|-------|
| Subject | INSERTO |
| Client | VWA |
| Part Number | N 227 a N 403 |
| Responsible | Carlos Baptista |
| Status | draft |
| Start Date | 2025-11-27 |
| Last Updated | 2026-03-17T22:17:57.94606+00:00 |
| Operations | 22 |
| Work Elements (6M) | 94 |
| Functions | 33 |
| Failure Modes | 66 |
| Causes | 110 |
| AP Distribution | H:69 / M:33 / L:8 / None:0 |
| AP=H without actions | 69 |
| Stored Coverage (S/O/D) | 94% |
| Total auditable fields | 1705 |
| Empty fields | 586 |
| Placeholder fields | 6 |
| **Completeness** | **65%** |

**Header gaps:** approvedBy

**Critical body gaps (first 10):**
- Op 10: Failure Mode empty
- Op 10: Severity empty

### AMFE-00001 [L0] - VWA/PATAGONIA/INSERTO [L0]

| Field | Value |
|-------|-------|
| Subject | INSERTO [L0] |
| Client | VWA |
| Part Number | N 227 a N 403 |
| Responsible | Carlos Baptista |
| Status | draft |
| Start Date | 2025-11-27 |
| Last Updated | 2026-03-17T22:44:36.744355+00:00 |
| Operations | 22 |
| Work Elements (6M) | 94 |
| Functions | 33 |
| Failure Modes | 66 |
| Causes | 110 |
| AP Distribution | H:69 / M:33 / L:8 / None:0 |
| AP=H without actions | 69 |
| Stored Coverage (S/O/D) | 92.73% |
| Total auditable fields | 1705 |
| Empty fields | 586 |
| Placeholder fields | 6 |
| **Completeness** | **65%** |

**Header gaps:** approvedBy

**Critical body gaps (first 10):**
- Op 10: Failure Mode empty
- Op 10: Severity empty

### AMFE-ARMREST-001 - VWA/PATAGONIA/ARMREST

| Field | Value |
|-------|-------|
| Subject | ARMREST |
| Client | VWA |
| Part Number | ARMREST DOOR PANEL |
| Responsible | Carlos Baptista |
| Status | draft |
| Start Date | 2026-02-11 |
| Last Updated | 2026-03-17T23:24:29.894524+00:00 |
| Operations | 22 |
| Work Elements (6M) | 88 |
| Functions | 88 |
| Failure Modes | 71 |
| Causes | 106 |
| AP Distribution | H:41 / M:55 / L:10 / None:0 |
| AP=H without actions | 41 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 1735 |
| Empty fields | 531 |
| Placeholder fields | 1 |
| **Completeness** | **69%** |

**Header gaps:** confidentiality (placeholder: "-"), approvedBy

### AMFE-006 - VWA/2026/Proceso de fabricación - Top Roll

| Field | Value |
|-------|-------|
| Subject | Proceso de fabricación - Top Roll |
| Client | VWA |
| Part Number | TBD-TR-PAT |
| Responsible | F. Santoro |
| Status | draft |
| Start Date | 2026-03-14 |
| Last Updated | 2026-03-16T19:26:21.261318+00:00 |
| Operations | 11 |
| Work Elements (6M) | 11 |
| Functions | 11 |
| Failure Modes | 31 |
| Causes | 31 |
| AP Distribution | H:0 / M:4 / L:27 / None:0 |
| AP=H without actions | 0 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 545 |
| Empty fields | 131 |
| Placeholder fields | 25 |
| **Completeness** | **71%** |

**Header gaps:** approvedBy

### AMFE-006 [L1] - VWA/2026/Proceso de fabricación - Top Roll [L1]

| Field | Value |
|-------|-------|
| Subject | Proceso de fabricación - Top Roll [L1] |
| Client | VWA |
| Part Number | TBD-TR-PAT |
| Responsible | F. Santoro |
| Status | draft |
| Start Date | 2026-03-14 |
| Last Updated | 2026-03-17T17:27:29.178991+00:00 |
| Operations | 11 |
| Work Elements (6M) | 11 |
| Functions | 11 |
| Failure Modes | 31 |
| Causes | 31 |
| AP Distribution | H:0 / M:4 / L:27 / None:0 |
| AP=H without actions | 0 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 545 |
| Empty fields | 131 |
| Placeholder fields | 25 |
| **Completeness** | **71%** |

**Header gaps:** approvedBy

### AMFE-TOPROLL-001 - VWA/PATAGONIA/TOP_ROLL

| Field | Value |
|-------|-------|
| Subject | TOP ROLL |
| Client | VWA |
| Part Number | 2GJ.868.087 / 2GJ.868.088 |
| Responsible | Carlos Baptista |
| Status | draft |
| Start Date | 2026-02-13 |
| Last Updated | 2026-03-17T23:20:49.968001+00:00 |
| Operations | 11 |
| Work Elements (6M) | 54 |
| Functions | 54 |
| Failure Modes | 35 |
| Causes | 47 |
| AP Distribution | H:30 / M:13 / L:4 / None:0 |
| AP=H without actions | 30 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 827 |
| Empty fields | 235 |
| Placeholder fields | 5 |
| **Completeness** | **71%** |

**Header gaps:** confidentiality (placeholder: "-")

### AMFE-HR-FRONT-L0 - VWA/PATAGONIA/HEADREST_FRONT

| Field | Value |
|-------|-------|
| Subject | PATAGONIA - FRONT HEADREST, Passenger / Driver, LO (pvc) |
| Client | VWA |
| Part Number | XXX.881.900 |
| Responsible | M. Nieve |
| Status | draft |
| Start Date | 2025-04-10 |
| Last Updated | 2026-03-17T23:39:04.21209+00:00 |
| Operations | 8 |
| Work Elements (6M) | 32 |
| Functions | 32 |
| Failure Modes | 54 |
| Causes | 2 |
| AP Distribution | H:2 / M:0 / L:0 / None:0 |
| AP=H without actions | 2 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 380 |
| Empty fields | 10 |
| Placeholder fields | 1 |
| **Completeness** | **97%** |

**Header gaps:** confidentiality (placeholder: "-")

### AMFE-HR-FRONT-L1 - VWA/PATAGONIA/HEADREST_FRONT [L1]

| Field | Value |
|-------|-------|
| Subject | PATAGONIA - FRONT HEADREST, Passenger / Driver, L1/L2/L3 [L1] |
| Client | VWA |
| Part Number | XXX.881.900X / XXX.881.900Y / XXX.881.900Z |
| Responsible | M. Nieve |
| Status | draft |
| Start Date | 2025-04-10 |
| Last Updated | 2026-03-17T23:39:08.854276+00:00 |
| Operations | 8 |
| Work Elements (6M) | 32 |
| Functions | 32 |
| Failure Modes | 54 |
| Causes | 2 |
| AP Distribution | H:2 / M:0 / L:0 / None:0 |
| AP=H without actions | 2 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 380 |
| Empty fields | 10 |
| Placeholder fields | 1 |
| **Completeness** | **97%** |

**Header gaps:** confidentiality (placeholder: "-")

### AMFE-HR-FRONT-L2 - VWA/PATAGONIA/HEADREST_FRONT [L2]

| Field | Value |
|-------|-------|
| Subject | PATAGONIA - FRONT HEADREST, Passenger / Driver, L1/L2/L3 [L2] |
| Client | VWA |
| Part Number | XXX.881.900X / XXX.881.900Y / XXX.881.900Z |
| Responsible | M. Nieve |
| Status | draft |
| Start Date | 2025-04-10 |
| Last Updated | 2026-03-17T23:39:12.094784+00:00 |
| Operations | 8 |
| Work Elements (6M) | 32 |
| Functions | 32 |
| Failure Modes | 54 |
| Causes | 2 |
| AP Distribution | H:2 / M:0 / L:0 / None:0 |
| AP=H without actions | 2 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 380 |
| Empty fields | 10 |
| Placeholder fields | 1 |
| **Completeness** | **97%** |

**Header gaps:** confidentiality (placeholder: "-")

### AMFE-HR-FRONT-L3 - VWA/PATAGONIA/HEADREST_FRONT [L3]

| Field | Value |
|-------|-------|
| Subject | PATAGONIA - FRONT HEADREST, Passenger / Driver, L1/L2/L3 [L3] |
| Client | VWA |
| Part Number | XXX.881.900X / XXX.881.900Y / XXX.881.900Z |
| Responsible | M. Nieve |
| Status | draft |
| Start Date | 2025-04-10 |
| Last Updated | 2026-03-17T23:39:15.444875+00:00 |
| Operations | 8 |
| Work Elements (6M) | 32 |
| Functions | 32 |
| Failure Modes | 54 |
| Causes | 2 |
| AP Distribution | H:2 / M:0 / L:0 / None:0 |
| AP=H without actions | 2 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 380 |
| Empty fields | 10 |
| Placeholder fields | 1 |
| **Completeness** | **97%** |

**Header gaps:** confidentiality (placeholder: "-")

### AMFE-HR-REAR_CEN-L0 - VWA/PATAGONIA/HEADREST_REAR_CEN

| Field | Value |
|-------|-------|
| Subject | PATAGONIA - REAR HEADREST, CENTER, L0 (pvc) |
| Client | VWA |
| Part Number | XXX.885.900 |
| Responsible | M. Nieve |
| Status | draft |
| Start Date | 2025-04-10 |
| Last Updated | 2026-03-17T23:38:16.80083+00:00 |
| Operations | 8 |
| Work Elements (6M) | 32 |
| Functions | 32 |
| Failure Modes | 52 |
| Causes | 2 |
| AP Distribution | H:2 / M:0 / L:0 / None:0 |
| AP=H without actions | 2 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 370 |
| Empty fields | 10 |
| Placeholder fields | 1 |
| **Completeness** | **97%** |

**Header gaps:** confidentiality (placeholder: "-")

### AMFE-HR-REAR_CEN-L1 - VWA/PATAGONIA/HEADREST_REAR_CEN [L1]

| Field | Value |
|-------|-------|
| Subject | PATAGONIA - REAR HEADREST, CENTER, L1/L2/L3 [L1] |
| Client | VWA |
| Part Number | XXX.885.900X / XXX.885.900Y / XXX.885.900Z |
| Responsible | M. Nieve |
| Status | draft |
| Start Date | 2025-04-10 |
| Last Updated | 2026-03-17T23:38:22.136144+00:00 |
| Operations | 8 |
| Work Elements (6M) | 32 |
| Functions | 32 |
| Failure Modes | 52 |
| Causes | 2 |
| AP Distribution | H:2 / M:0 / L:0 / None:0 |
| AP=H without actions | 2 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 370 |
| Empty fields | 10 |
| Placeholder fields | 1 |
| **Completeness** | **97%** |

**Header gaps:** confidentiality (placeholder: "-")

### AMFE-HR-REAR_CEN-L2 - VWA/PATAGONIA/HEADREST_REAR_CEN [L2]

| Field | Value |
|-------|-------|
| Subject | PATAGONIA - REAR HEADREST, CENTER, L1/L2/L3 [L2] |
| Client | VWA |
| Part Number | XXX.885.900X / XXX.885.900Y / XXX.885.900Z |
| Responsible | M. Nieve |
| Status | draft |
| Start Date | 2025-04-10 |
| Last Updated | 2026-03-17T23:38:26.041702+00:00 |
| Operations | 8 |
| Work Elements (6M) | 32 |
| Functions | 32 |
| Failure Modes | 52 |
| Causes | 2 |
| AP Distribution | H:2 / M:0 / L:0 / None:0 |
| AP=H without actions | 2 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 370 |
| Empty fields | 10 |
| Placeholder fields | 1 |
| **Completeness** | **97%** |

**Header gaps:** confidentiality (placeholder: "-")

### AMFE-HR-REAR_CEN-L3 - VWA/PATAGONIA/HEADREST_REAR_CEN [L3]

| Field | Value |
|-------|-------|
| Subject | PATAGONIA - REAR HEADREST, CENTER, L1/L2/L3 [L3] |
| Client | VWA |
| Part Number | XXX.885.900X / XXX.885.900Y / XXX.885.900Z |
| Responsible | M. Nieve |
| Status | draft |
| Start Date | 2025-04-10 |
| Last Updated | 2026-03-17T23:38:29.958929+00:00 |
| Operations | 8 |
| Work Elements (6M) | 32 |
| Functions | 32 |
| Failure Modes | 52 |
| Causes | 2 |
| AP Distribution | H:2 / M:0 / L:0 / None:0 |
| AP=H without actions | 2 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 370 |
| Empty fields | 10 |
| Placeholder fields | 1 |
| **Completeness** | **97%** |

**Header gaps:** confidentiality (placeholder: "-")

### AMFE-HR-REAR_OUT-L0 - VWA/PATAGONIA/HEADREST_REAR_OUT

| Field | Value |
|-------|-------|
| Subject | PATAGONIA - REAR HEADREST, OUTER, LO (pvc) |
| Client | VWA |
| Part Number | XXX.885.901 |
| Responsible | M. Nieve |
| Status | draft |
| Start Date | 2025-04-10 |
| Last Updated | 2026-03-17T23:38:34.288894+00:00 |
| Operations | 8 |
| Work Elements (6M) | 32 |
| Functions | 32 |
| Failure Modes | 54 |
| Causes | 2 |
| AP Distribution | H:2 / M:0 / L:0 / None:0 |
| AP=H without actions | 2 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 380 |
| Empty fields | 10 |
| Placeholder fields | 1 |
| **Completeness** | **97%** |

**Header gaps:** confidentiality (placeholder: "-")

### AMFE-HR-REAR_OUT-L1 - VWA/PATAGONIA/HEADREST_REAR_OUT [L1]

| Field | Value |
|-------|-------|
| Subject | PATAGONIA - REAR HEADREST, OUTER, L1/L2/L3 [L1] |
| Client | VWA |
| Part Number | XXX.885.901X / XXX.885.901Y / XXX.885.900Z |
| Responsible | M. Nieve |
| Status | draft |
| Start Date | 2025-04-10 |
| Last Updated | 2026-03-17T23:38:39.595214+00:00 |
| Operations | 8 |
| Work Elements (6M) | 32 |
| Functions | 32 |
| Failure Modes | 54 |
| Causes | 2 |
| AP Distribution | H:2 / M:0 / L:0 / None:0 |
| AP=H without actions | 2 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 380 |
| Empty fields | 10 |
| Placeholder fields | 1 |
| **Completeness** | **97%** |

**Header gaps:** confidentiality (placeholder: "-")

### AMFE-HR-REAR_OUT-L2 - VWA/PATAGONIA/HEADREST_REAR_OUT [L2]

| Field | Value |
|-------|-------|
| Subject | PATAGONIA - REAR HEADREST, OUTER, L1/L2/L3 [L2] |
| Client | VWA |
| Part Number | XXX.885.901X / XXX.885.901Y / XXX.885.900Z |
| Responsible | M. Nieve |
| Status | draft |
| Start Date | 2025-04-10 |
| Last Updated | 2026-03-17T23:38:43.522896+00:00 |
| Operations | 8 |
| Work Elements (6M) | 32 |
| Functions | 32 |
| Failure Modes | 54 |
| Causes | 2 |
| AP Distribution | H:2 / M:0 / L:0 / None:0 |
| AP=H without actions | 2 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 380 |
| Empty fields | 10 |
| Placeholder fields | 1 |
| **Completeness** | **97%** |

**Header gaps:** confidentiality (placeholder: "-")

### AMFE-HR-REAR_OUT-L3 - VWA/PATAGONIA/HEADREST_REAR_OUT [L3]

| Field | Value |
|-------|-------|
| Subject | PATAGONIA - REAR HEADREST, OUTER, L1/L2/L3 [L3] |
| Client | VWA |
| Part Number | XXX.885.901X / XXX.885.901Y / XXX.885.900Z |
| Responsible | M. Nieve |
| Status | draft |
| Start Date | 2025-04-10 |
| Last Updated | 2026-03-17T23:38:47.416975+00:00 |
| Operations | 8 |
| Work Elements (6M) | 32 |
| Functions | 32 |
| Failure Modes | 54 |
| Causes | 2 |
| AP Distribution | H:2 / M:0 / L:0 / None:0 |
| AP=H without actions | 2 |
| Stored Coverage (S/O/D) | 100% |
| Total auditable fields | 380 |
| Empty fields | 10 |
| Placeholder fields | 1 |
| **Completeness** | **97%** |

**Header gaps:** confidentiality (placeholder: "-")

---

## Documents with 0% S/O/D Coverage

These documents have NO severity/occurrence/detection values filled in, meaning risk assessment has not started.

| AMFE Number | Project | Causes | Status |
|-------------|---------|--------|--------|
| AMFE-1 | PWA/2026/Telas Planas | 19 | draft |
| AMFE-2 | PWA/2026/Telas Termoformadas | 15 | draft |
| AMFE-3 | VWA/Patagonia/Armrest Door Panel | 16 | draft |
| AMFE-5 | VWA/Patagonia/Top Roll | 16 | draft |
| AMFE-4 | VWA/Patagonia/Insert | 14 | draft |

---

## Documents with Unevaluated AP

These documents have causes where AP (Action Priority) has not been calculated.

| AMFE Number | Project | Causes w/o AP | Total Causes | % Unevaluated |
|-------------|---------|---------------|-------------|----------------|
| AMFE-1 | PWA/2026/Telas Planas | 19 | 19 | 100% |
| AMFE-2 | PWA/2026/Telas Termoformadas | 15 | 15 | 100% |
| AMFE-3 | VWA/Patagonia/Armrest Door Panel | 16 | 16 | 100% |
| AMFE-5 | VWA/Patagonia/Top Roll | 16 | 16 | 100% |
| AMFE-4 | VWA/Patagonia/Insert | 14 | 14 | 100% |
| AMFE-4 [L0] | VWA/Patagonia/Insert [L0] | 14 | 14 | 100% |

---

## Family/Variant Document Analysis

Documents with [L0], [L1], etc. suffixes are family variants. These should generally mirror the master document structure.

| Type | Count |
|------|-------|
| Master documents | 14 |
| Variant documents | 12 |

**Family: VWA/Patagonia/Insert** (2 members)

| Variant | Ops | Causes | AP-H | Completeness |
|---------|-----|--------|------|--------------|
| AMFE-4 (master) | 11 | 14 | 0 | 64% |
| AMFE-4 [L0] | 11 | 14 | 0 | 64% |

**Family: VWA/PATAGONIA/INSERTO** (2 members)

| Variant | Ops | Causes | AP-H | Completeness |
|---------|-----|--------|------|--------------|
| AMFE-00001 (master) | 22 | 110 | 69 | 65% |
| AMFE-00001 [L0] | 22 | 110 | 69 | 65% |

**Family: VWA/2026/Proceso de fabricación - Top Roll** (2 members)

| Variant | Ops | Causes | AP-H | Completeness |
|---------|-----|--------|------|--------------|
| AMFE-006 (master) | 11 | 31 | 0 | 71% |
| AMFE-006 [L1] | 11 | 31 | 0 | 71% |

**Family: VWA/PATAGONIA/HEADREST_FRONT** (4 members)

| Variant | Ops | Causes | AP-H | Completeness |
|---------|-----|--------|------|--------------|
| AMFE-HR-FRONT-L0 (master) | 8 | 2 | 2 | 97% |
| AMFE-HR-FRONT-L1 | 8 | 2 | 2 | 97% |
| AMFE-HR-FRONT-L2 | 8 | 2 | 2 | 97% |
| AMFE-HR-FRONT-L3 | 8 | 2 | 2 | 97% |

**Family: VWA/PATAGONIA/HEADREST_REAR_CEN** (4 members)

| Variant | Ops | Causes | AP-H | Completeness |
|---------|-----|--------|------|--------------|
| AMFE-HR-REAR_CEN-L0 (master) | 8 | 2 | 2 | 97% |
| AMFE-HR-REAR_CEN-L1 | 8 | 2 | 2 | 97% |
| AMFE-HR-REAR_CEN-L2 | 8 | 2 | 2 | 97% |
| AMFE-HR-REAR_CEN-L3 | 8 | 2 | 2 | 97% |

**Family: VWA/PATAGONIA/HEADREST_REAR_OUT** (4 members)

| Variant | Ops | Causes | AP-H | Completeness |
|---------|-----|--------|------|--------------|
| AMFE-HR-REAR_OUT-L0 (master) | 8 | 2 | 2 | 97% |
| AMFE-HR-REAR_OUT-L1 | 8 | 2 | 2 | 97% |
| AMFE-HR-REAR_OUT-L2 | 8 | 2 | 2 | 97% |
| AMFE-HR-REAR_OUT-L3 | 8 | 2 | 2 | 97% |

---

## Recommendations

### Immediate Actions (Critical)

1. **Address 250 AP=H causes without actions.** Per AIAG-VDA FMEA, all High priority risks MUST have defined prevention/detection actions, a responsible person, and a target date. This is a potential audit non-conformity.
2. **Complete risk assessment for 5 documents with 0% S/O/D coverage.** These documents have no risk evaluation at all: AMFE-1, AMFE-2, AMFE-3, AMFE-5, AMFE-4.
3. **Calculate AP for 6 documents with 100% unevaluated causes.** Without AP, risk prioritization cannot be performed.

### Short-term Actions

5. **Fill missing header fields** across documents (organization, team, approvedBy, scope, etc.).
6. **Review placeholder text** and replace with actual technical content.

### Ongoing

7. **Enforce completeness gates** before allowing status transitions from Draft to InReview to Approved.
8. **Regular AMFE reviews** per IATF 16949 requirements.
9. **Cross-document validation** (PFD to AMFE to CP to HO linkage integrity).

---

*Report generated automatically by AMFE Audit Script on 2026-03-17.*
*Data source: Supabase production database (fbfsbbewmgoegjgnkkag.supabase.co).*
