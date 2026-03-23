# Auditoria de Consistencia contra Documentos de Referencia

**Fecha**: 2026-03-23
**Alcance**: 62 documentos APQP (18 AMFE, 18 CP, 17 HO) — 8 familias de producto
**Referencia**: PDFs originales en C:\Users\FacundoS-PC\Documents\AMFES PC HO

---

## 1. RESUMEN EJECUTIVO

La fidelidad general de los datos en Supabase respecto a los PDFs originales es **heterogenea**: los productos PWA (Telas Planas y Termoformadas) son ~95% literales del PDF, mientras que los productos VWA mas recientes (Insert, Armrest) presentan reformulaciones significativas y contenido inventado. Los CPs de Insert y Top Roll fueron **reemplazados** por versiones auto-generadas desde AMFE, perdiendo **22 valores numericos criticos** de especificacion (espesores, temperaturas, tolerancias, velocidades). Las HOs muestran un patron de degradacion claro: Insert y Armrest al 100% completas, pero el 60% de las 171 hojas (Top Roll, Telas, y partes de Headrest) carecen de puntos clave TWI y controles de calidad. Los 3 hallazgos mas criticos son: (1) perdida de especificaciones numericas en CPs de Insert/Top Roll, (2) 20 hojas PWA sin ningun EPP asignado, y (3) 103 hojas sin puntos clave ni QCs. La correccion estimada requiere ~97 ediciones manuales que impactan 171 hojas gracias al efecto multiplicador de la herencia maestro-variante (relacion 1:1.8).

---

## 2. AMFE — Diferencias de Estilo vs Referencia

### 2.1 Tabla resumen de fidelidad por producto

| Producto | PDF Legible | Ops Coinciden | Fallas Fieles | S/O/D Fieles | Contenido Inventado | Clasificacion |
|----------|-------------|---------------|---------------|--------------|---------------------|---------------|
| Telas Planas (PWA) | Si | 12/12 (100%) | ~95% | ~95% | 0 | ACEPTABLE |
| Telas Termoformadas (PWA) | Si | 8/8 (100%) | ~95% | ~90% | 0 | ACEPTABLE |
| Top Roll | Si | 11/11 (100%) | ~95% | ~90% | 1 falla menor | MEJORAR |
| Insert Patagonia | Si | 19/22 (86%) | ~85% | ~80% | 3 ops + 6 causas | CORREGIR |
| Armrest Door Panel | Si | Renumerado | ~80% | ~70% | 0 (pero proceso extendido vs PDF) | CORREGIR |
| Headrest (x3) | No (PDF ilegible) | No verificable | No verificable | No verificable | No verificable | PENDIENTE |

### 2.2 Propuestas de correccion AMFE (priorizadas)

**CORREGIR — Errores vs referencia PDF (25 items)**

| Tipo | Producto | Detalle | Cantidad |
|------|----------|---------|----------|
| Operaciones inventadas | Insert | OP 60 (Troquelado), OP 100 (Tapizado), OP 105 (Refilado) — no existen en PDF | 3 ops |
| Causas inventadas | Insert | Verificacion hilo Linanhyl, vencimiento SikaMelt, seleccion material vinilo | 3 causas |
| Falla reclasificar | Top Roll | "Condiciones ambientales inadecuadas" es item ambiental, no modo de falla | 1 falla |
| Falla reclasificar | Top Roll | "No se utiliza sistema ARB" elevada de causa a falla — devolver a causa | 1 item |
| S/O/D discrepantes | Insert | OP10 FM2 D: PDF=4, Supabase=7; OP15 FM1 O: PDF=8, Supabase=7; OP15 FM1 D: PDF=7, Supabase=10 | 5 ratings |
| S/O/D discrepantes | Armrest | OP10 S: PDF=7, Supabase=6; OP10 O: PDF=2, Supabase=6 (NRP sube de 84 a 216) | 4 ratings |
| Textos truncados | Insert | 4 controles de prevencion/deteccion cortados a ~80 caracteres | 4 textos |
| Fallas/causas faltantes | Armrest | OP30 Costura: falla "Costura salteada" + causas "Peine danado", "Aguja despuntada", "Hilo enredado" | 4 items |

**MEJORAR — Unificacion de estilo**

| Propuesta | Productos afectados | Docs afectados |
|-----------|---------------------|----------------|
| Usar Title Case o MAYUSCULAS consistente (no mezclar) | Insert (hibrido), Telas (mixed case) | 4 AMFEs master |
| Eliminar prefijo seccion padre en nombres de operacion | Insert | 1 AMFE (8 ops) |
| Estandarizar sin punto final en fallas/causas | Insert, Telas Planas | 2 AMFEs (~10 textos) |

**ACEPTABLE — No requiere accion**

- Telas Planas y Termoformadas: ~95% literales del PDF, conservan incluso typos originales ("termonada", "cimplir"). Referencia de calidad de carga.
- Remocion de prefijo "OP. XX" en Telas: correcto porque el numero es campo separado.
- Headrest (x3): pendiente verificacion cuando se disponga de herramienta para leer PDFs.

---

## 3. CP — Diferencias de Estilo vs Referencia

### 3.1 Hallazgo critico: dos poblaciones de CP completamente distintas

| Poblacion | CPs | Origen | Fidelidad al PDF |
|-----------|-----|--------|-----------------|
| **A — Parseados del PDF** | Headrest x6 (L0 y variantes) | Copiados del PDF original | Alta (diferencias cosmeticas) |
| **B — Generados desde AMFE** | Insert, Top Roll, Armrest, Telas x2 (12 CPs) | Auto-generados a partir de causas AMFE | Baja (contenido tecnico diferente) |

### 3.2 Especificaciones numericas perdidas (22 valores criticos)

Los CPs generados desde AMFE NO transfieren los valores de especificacion de los PDFs originales. Ejemplos representativos:

| Parametro | Producto | Valor PDF (perdido) | Valor Supabase (actual) |
|-----------|----------|---------------------|-------------------------|
| Espesor vinilo | Insert | min 1,5 - max 2,5 | "Segun instruccion de proceso" |
| Gramaje vinilo | Insert | min 800 - max 1000 GMS/MT2 | No presente |
| Viscosidad adhesivo | Insert/Top Roll | 950cPoise +/- 15% | No presente |
| Temperatura adhesivado | Insert | 85C +/- 5C | No presente |
| Velocidad adhesivado | Insert | 4 mts/min | No presente |
| Temperatura horno | Top Roll | 60-70C | No presente |
| Puntadas costura | Insert | 11 +/- 1 puntadas / 5 cm | No presente |
| Tolerancia costura | Insert/Top Roll | 100mm +/- 1mm | No presente |
| Capas de corte | Insert / Top Roll | 10 / 2 | No presente |
| Embalaje | Insert / Top Roll | 6 pzas/cajon / 8 pzas/cajon | No presente |

**Total**: 12 valores faltantes en Insert + 10 en Top Roll = **22 especificaciones a restaurar**.

### 3.3 Enfoque de caracteristicas incorrecto

| Aspecto | PDF Original | Supabase (generado AMFE) |
|---------|-------------|--------------------------|
| Tipo de items | Caracteristicas de PRODUCTO (que se mide) | Causas de FALLA (que puede salir mal) |
| Especificaciones | Valores numericos concretos | "Segun instruccion de proceso" |
| Tecnica evaluacion | Instrumentos: "Medidor de espesor", "Calibre digital", "Mylar" | Metodos genericos: "Inspeccion visual" |
| Plan de reaccion | Referencia SGC: "P-10/I. P-14." | Texto descriptivo: "Contener producto. Ajustar proceso." |
| Clasificacion CC/SC | SC solo en flamabilidad y costuras criticas | SC en todos los items con AP=H y AP=M |

**Decision de negocio requerida**: Opcion A (recomendada) — complementar CP generado con items de especificacion del PDF. Opcion B — re-cargar CP completo desde PDF, perdiendo trazabilidad AMFE-CP.

### 3.4 Propuestas de correccion CP

| Clasificacion | Accion | Productos | Items estimados |
|---------------|--------|-----------|-----------------|
| CORREGIR | Restaurar/agregar 22 valores numericos de especificacion | Insert, Top Roll | 22 items |
| CORREGIR | Agregar referencias SGC a planes de reaccion | Insert, Top Roll | ~6 planes |
| CORREGIR | Verificar mapeo P-10/P-14 vs P-09 en Headrest | 3 Headrests L0 | 3 items |
| CORREGIR | Revisar clasificacion CC/SC excesiva | Insert, Top Roll | ~50 items |
| MEJORAR | Agregar instrumentos especificos de evaluacion | Insert, Top Roll | ~15 items |
| MEJORAR | Estandarizar frecuencia a "Por entrega" en recepcion | Headrest x6 | 6 items |
| ACEPTABLE | Headrest L0 x3 sin cambios (alta fidelidad al PDF) | Headrests | 0 |

---

## 4. HO — EPP Faltantes

### 4.1 Estado general de EPP

| Metrica | Valor |
|---------|-------|
| Hojas CON EPP asignado | 151/171 (88%) |
| Hojas SIN EPP | 20/171 (12%) — todas PWA |
| Hojas con EPP insuficiente | 50 hojas adicionales |
| EPP NUNCA usado en ninguna hoja | delantal (0/171), respirador (0/171) |

### 4.2 EPP faltante por tipo de operacion

| Tipo de operacion | EPP estandar propuesto | Hojas afectadas | Prioridad |
|-------------------|------------------------|-----------------|-----------|
| Todas las ops PWA (sin ningun EPP) | anteojos + guantes + zapatos (minimo) + adicional segun tipo | 20 hojas | CRITICA |
| Inyeccion PU / Espumado | + respirador + delantal | 16 hojas (12 headrest + 4 armrest) | ALTA |
| Costura industrial | + proteccionAuditiva | 18 hojas (12 headrest + 4 armrest + 1 insert) | ALTA |
| Adhesivado (hot melt, solventes) | + respirador + delantal | 9 hojas (4 armrest + 4 insert + 1 top roll) | ALTA |
| Insert con EPP parcial/inconsistente | Completar base anteojos+guantes+zapatos | 7 hojas | MEDIA |

### 4.3 Optimizacion por herencia maestro-variante

| Bloque de correccion | Hojas impactadas | Ediciones reales | Ahorro por herencia |
|----------------------|------------------|------------------|---------------------|
| PWA sin EPP | 20 | 20 | 0 (sin variantes) |
| Costura sin auditiva | 18 | 5 | 13 (3 masters headrest propagan) |
| Inyeccion sin respirador/delantal | 16 | 7 | 9 (3 masters headrest propagan) |
| Adhesivado sin respirador/delantal | 9 | 9 | 0 (sin herencia) |
| Insert parcial | 7 | 7 | 0 |
| **TOTAL** | **70** | **48** | **22 (31% ahorro)** |

---

## 5. HO — Hojas Incompletas

### 5.1 Estadisticas de completitud

| Estado | Hojas | % | Descripcion |
|--------|-------|---|-------------|
| COMPLETA (pasos + KP + QC) | 68 | 40% | Insert (22) + Armrest (22) + 2 ops x 12 docs Headrest (24) |
| PARCIAL (solo pasos, sin KP ni QC) | 103 | 60% | Top Roll (11) + Telas Planas (12) + Telas Termo (8) + 6 ops x 12 docs Headrest (72) |

### 5.2 Patron de degradacion por orden de carga

| Orden | Producto | % Completo | Avg paso (chars) | KP/hoja | QC/hoja | Nivel |
|-------|----------|------------|------------------|---------|---------|-------|
| 1ro | Insert | 100% | 110 | 3.6 | 7.3 | PREMIUM |
| 2do | Armrest | 100% | 114 | 3.9 | 7.9 | PREMIUM |
| 3ro | Headrest (x3) | 25% | 70 | 2.8 | 2.6 | MIXTO |
| 4to | Top Roll | 0% | 53 | 0 | 0 | BASICO |
| 5to | Telas Planas | 0% | 52 | 0 | 0 | BASICO |
| 5to | Telas Termoformadas | 0% | 53 | 0 | 0 | BASICO |

### 5.3 Top 10 hojas prioritarias para completar

| # | Producto | Op# | Operacion | Problema | Impacto si se corrige master |
|---|----------|-----|-----------|----------|------------------------------|
| 1 | Headrest (x3) | 50 | Espumado | 0 KP, 0 QC — operacion critica CC | x12 docs (3 fam x 4 variantes) |
| 2 | Headrest (x3) | 40 | Ensamble Asta + Enfundado | 0 KP, 0 QC — ensamble critico | x12 docs |
| 3 | Headrest (x3) | 60 | Inspeccion final + ARB | 0 KP, 0 QC — ultima barrera deteccion | x12 docs |
| 4 | Headrest (x3) | 10 | Recepcion | 0 KP, 0 QC | x12 docs |
| 5 | Top Roll | 30 | Proceso IMG | 0 KP, 0 QC — operacion core | x1 |
| 6 | Top Roll | 50 | Edge Folding | 0 KP, 0 QC — aspecto visual | x1 |
| 7 | Top Roll | 80 | Inspeccion Final | 0 KP, 0 QC | x1 |
| 8 | Telas Planas | 30 | Termoformado | 0 KP, 0 QC — proceso core | x1 |
| 9 | Telas Planas | 70 | Control pieza final | 0 KP, 0 QC | x1 |
| 10 | Telas Termoformadas | 30 | Costura | 0 KP, 0 QC | x1 |

### 5.4 Estrategia de completado

| Grupo | Descripcion | Hojas | Esfuerzo | Requiere produccion? |
|-------|-------------|-------|----------|----------------------|
| **A** | Copiar estructura de Insert/Armrest (adaptacion menor) | 22 | Bajo | No |
| **B** | Adaptar referencia parcial con input tecnico | 14 | Medio | Si |
| **C** | Crear desde cero (procesos exclusivos sin referencia) | 13 | Alto | Si |

Completando solo los 3 masters de Headrest (18 hojas), la herencia propaga automaticamente y las hojas COMPLETA pasan de 68/171 (40%) a **140/171 (82%)** — ROI maximo 1:4.

### 5.5 Dato complementario: 155 QCs sin controlMethod

En Insert (68 QCs, 43%) y Armrest (87 QCs, 50%), el campo `controlMethod` esta vacio a pesar de ser los productos mas completos en otros aspectos. Corregir como Fase complementaria.

---

## 6. Inconsistencias entre Productos

### 6.1 Tabla comparativa de nomenclatura por operacion comun

| Operacion | Insert | Armrest | Top Roll | Headrests | Telas Planas | Telas Termo | Propuesta Unificada |
|-----------|--------|---------|----------|-----------|--------------|-------------|---------------------|
| Recepcion | RECEPCIONAR MP | RECEPCIONAR MP | RECEPCIONAR MP | RECEPCIONAR MP | Recepcion de Punzonado | Recepcion de materiales... | **RECEPCION DE MATERIA PRIMA** |
| Corte | CORTE DE COMP. DE VINILO O TELA - Prep/Cortar/Control | CORTE DE COMP. - PREP/CORTE/CONTROL | --- | CORTE DEL VINILO/TELA | Corte por maquina de pieza Central | Corte por maquina automatica | **CORTE DE COMPONENTES - [DETALLE]** |
| Costura | Costura - Refilado / CNC | COSTURA - REFILADO / UNION / DOBLE | --- | COSTURA UNION ENTRE PANELES | --- | Costura fuerte, sin arruga | **COSTURA - [TIPO]** |
| Inspeccion | Inspeccion Final - CONTROL FINAL | INSPECCION FINAL - CONTROL FINAL | INSPECCION FINAL Y EMPAQUE | INSPECCION FINAL - APOYACABEZAS | Control de pieza final | Inspeccion final de la pieza | **INSPECCION FINAL** |
| Embalaje | Embalaje - EMBALAJE Y ETIQUETADO PT | EMBALAJE Y ETIQUETADO PT | EMPAQUE FINAL Y ETIQUETADO PT | EMBALAJE | Embalaje | Embalaje identificado con... | **EMBALAJE Y ETIQUETADO** |

### 6.2 Convencion de nomenclatura propuesta

| Regla | Convencion | Justificacion |
|-------|------------|---------------|
| Case | TODO MAYUSCULAS | 6 de 8 productos VWA ya lo usan; estandar industrial |
| Patron | CATEGORIA - DETALLE (cuando hay sub-ops) | Ej: "COSTURA - UNION DE PANELES" |
| Vocabulario | EMBALAJE (no Empaque), INSPECCION (no Control), RECEPCION (no Recepcionar) | Consistencia |
| Prohibido en nombres | Part numbers, descripciones de resultado esperado, nombre de producto | Mantenibilidad |
| Separador | Guion con espacios " - " | Ej: "CORTE DE COMPONENTES - CONTROL CON MYLAR" |

### 6.3 Modos de falla que necesitan armonizacion (ejemplos representativos)

| Modo de falla comun | Variantes encontradas (resumidas) | Propuesta unificada |
|---------------------|------------------------------------|---------------------|
| Material fuera de spec | 5 redacciones distintas entre productos | "Material fuera de especificacion" + sub-items por atributo |
| Costura floja | "Costura floja", "Tension inadecuada", "Costura debil (sin fuerza)" | "Costura floja / tension de hilo inadecuada" |
| Defecto visual no detectado | 5 redacciones distintas | "Pieza con defecto visual no detectado en inspeccion" |
| Cantidad incorrecta embalaje | 6 redacciones distintas | "Cantidad incorrecta en embalaje" |

### 6.4 Frecuencias de muestreo a armonizar

| Operacion | Situacion actual | Propuesta |
|-----------|------------------|-----------|
| Recepcion | "1 muestra" (Headrest) vs "100%/3 pzas" (Insert/Armrest) vs "100%" (Telas) | 100% visual + 3 pzas dimensional |
| Costura | "100%" vs "5 pzas" vs "1 pza" segun producto | 5 pzas / inicio y fin de turno + 100% visual |
| Embalaje | "3 pzas/contenedor" vs "5 pzas/caja" vs "100%/sensor" | 100% por contenedor |

### 6.5 Hallazgo critico cross-documental: desalineacion AMFE-CP en Headrests

Desde Op 40, los nombres de operacion en AMFE y CP de Headrests no coinciden:

| AMFE Op | AMFE Nombre | CP Step | CP Nombre |
|---------|-------------|---------|-----------|
| 40 | COSTURA VISTA | 40 | Ensamble Asta + Enfundado |
| 50 | ENSAMBLE DE VARILLA + EPP | 50 | Espumado |
| 60 | INYECCION PUR | 60 | Inspeccion final |

Ademas, el CP L0 de los 3 Headrests **no tiene step de Costura Vista**, aunque el AMFE analiza 8 modos de falla para esa operacion. Esto es un **gap de control documentado**.

---

## 7. ACCIONES RECOMENDADAS

### Prioridad CRITICA

| # | Accion | Docs afectados | Multiplicador herencia | Prerequisito |
|---|--------|----------------|------------------------|--------------|
| C1 | **Restaurar 22 especificaciones numericas** en CPs de Insert y Top Roll (espesores, temperaturas, velocidades, tolerancias) | 2 CPs master + 1 variante Insert = 3 | x1 | No (datos estan en PDFs) |
| C2 | **Asignar EPP a 20 hojas PWA** que no tienen ningun equipo de proteccion | 2 HOs (20 hojas) | x1 | No |
| C3 | **Agregar respirador + delantal** en operaciones de Inyeccion PU, Espumado y Adhesivado | 5 HOs (25 hojas via herencia) | x3 (masters) | Validar con Seguridad e Higiene |
| C4 | **Agregar Costura Vista al CP L0** de los 3 Headrests para cerrar gap AMFE-CP | 3 CPs master (propagan a 9 variantes) | x4 | No |
| C5 | **Eliminar 3 operaciones inventadas** del AMFE de Insert (OP 60, 100, 105) | 1 AMFE master + 1 variante | x2 | Verificar con ingenieria de proceso |

### Prioridad IMPORTANTE

| # | Accion | Docs afectados | Multiplicador herencia | Prerequisito |
|---|--------|----------------|------------------------|--------------|
| I1 | **Corregir 9 ratings S/O/D** en AMFEs de Insert (5) y Armrest (4) — el mas critico: Armrest OP10 O sube de 2 a 6, inflando NRP de 84 a 216 | 2 AMFEs | x1 | No (datos estan en PDFs) |
| I2 | **Completar KP + QC en 18 hojas** de los 3 masters de Headrest (Ops 10, 40, 50, 60, 70, 80) — pasa completitud de 40% a 82% | 3 HOs master | x4 (propaga a 72 hojas) | Ops 40, 50, 60, 80 requieren produccion |
| I3 | **Agregar proteccionAuditiva** en 18 hojas de Costura sin proteccion auditiva | 5 ediciones (3 masters headrest + armrest + insert) | x4 (masters) | Validar mediciones de ruido |
| I4 | **Alinear numeracion AMFE-CP** en los 3 Headrests (nombres de step desfasados desde Op 40) | 3 CPs master + 9 variantes | x4 | No |
| I5 | **Uniformizar case** en AMFE de Insert (mezcla MAYUSCULAS y mixed case) | 1 AMFE | x2 | No |
| I6 | **Agregar 4 fallas/causas** del PDF al AMFE de Armrest (Costura salteada, Peine danado, Aguja despuntada, Hilo enredado) | 1 AMFE | x1 | No |
| I7 | **Agregar referencias SGC** a planes de reaccion de CPs de Insert y Top Roll ("Segun P-10/I.", "P-09/I.") | 2 CPs | x1 | No |

### Prioridad MENOR

| # | Accion | Docs afectados | Prerequisito |
|---|--------|----------------|--------------|
| M1 | Completar KP + QC en 11 hojas de Top Roll | 1 HO | 3 ops requieren produccion (IMG, Soldado x2) |
| M2 | Completar KP + QC en 20 hojas de Telas (Planas + Termoformadas) | 2 HOs | 8 ops requieren produccion |
| M3 | Agregar `controlMethod` a 155 QCs de Insert (68) y Armrest (87) | 2 HOs | Parcial |
| M4 | Uniformizar nomenclatura cross-product (MAYUSCULAS, patron CATEGORIA-DETALLE) | 18 AMFEs + 18 CPs | No |
| M5 | Armonizar frecuencias de muestreo entre productos | 18 CPs | Validar con Calidad |
| M6 | Restaurar textos truncados en controles de AMFE Insert (4 textos a ~80 chars) | 1 AMFE | No |
| M7 | Eliminar part numbers de nombres de operacion en Telas Planas | 1 AMFE + 1 CP | No |
| M8 | Revisar clasificacion CC/SC excesiva en CPs generados de Insert y Top Roll | 2 CPs | Definir criterio con Calidad |

### Estimacion de esfuerzo total

| Fase | Que se hace | Ediciones | Hojas impactadas | Dias estimados | Produccion? |
|------|-------------|-----------|------------------|----------------|-------------|
| 1 | EPP critico (PWA + masters Headrest) | 23 | 56 | 1 | No |
| 2 | EPP restante (Armrest/Insert/Top Roll) | 25 | 25 | 1 | No |
| 3 | Contenido TWI — Grupo A (copiar estructura) | 22 | 22 + herencia | 2-3 | No |
| 4 | Contenido TWI — Grupo B (adaptar con produccion) | 14 | 14 + herencia | 3-5 | Si |
| 5 | Contenido TWI — Grupo C (crear desde cero) | 13 | 13 + herencia | 5-7 | Si |
| 6 | Correcciones AMFE + CP (ratings, specs, refs SGC) | ~50 items | 21 docs | 3-4 | Parcial |
| **TOTAL** | | **~97 ediciones** | **171 hojas (100%)** | **~15-21 dias** | |

---

## Anexo A: Reportes Intermedios

### Layer 1 — Investigacion

| Archivo | Contenido | Hallazgos principales |
|---------|-----------|----------------------|
| `docs/_audit_layer1/1A_amfe_style.md` | Diferencias AMFE PDF vs Supabase por producto | 3 ops inventadas en Insert, ~95% fidelidad en PWA, S/O/D discrepantes en Insert/Armrest |
| `docs/_audit_layer1/1B_cp_style.md` | Diferencias CP PDF vs Supabase | 22 valores numericos perdidos, 2 poblaciones de CP (parseadas vs generadas AMFE) |
| `docs/_audit_layer1/1C_epp_inventory.md` | Inventario EPP en 171 hojas | 20 hojas sin EPP, respirador y delantal nunca usados |
| `docs/_audit_layer1/1D_ho_completeness.md` | Completitud TWI de 171 hojas | 60% parciales, patron de degradacion, 429 KP concentrados en 2 productos |
| `docs/_audit_layer1/1E_cross_product_consistency.md` | Consistencia entre 8 productos | 5 estilos de "Inspeccion Final", desalineacion AMFE-CP en Headrests |

### Layer 2 — Analisis

| Archivo | Contenido | Propuestas principales |
|---------|-----------|------------------------|
| `docs/_audit_layer2/2A_normalization_amfe_cp.md` | Plan normalizacion AMFE+CP con orden de ejecucion | 25 items AMFE a corregir, 44+ items CP, decision de negocio sobre enfoque de CPs |
| `docs/_audit_layer2/2B_normalization_ho.md` | Plan normalizacion HO (EPP + contenido TWI) | Tabla EPP estandar, 48 ediciones EPP, 49 ediciones contenido, fases de ejecucion |
| `docs/_audit_layer2/2C_cross_product_map.md` | Mapa de inconsistencias y propuestas de nomenclatura | Convencion MAYUSCULAS + CATEGORIA-DETALLE, vocabulario estandar, modos de falla unificados |

### Gaps de informacion

- **Headrest PDFs (AMFE-151, AMFE-153, AMFE-155)**: No se pudieron leer por falta de herramienta `pdftoppm`. El contenido de los 3 AMFEs de Headrest en Supabase no pudo verificarse contra los PDFs originales.
- **HO PDFs originales**: No se pudieron renderizar por la misma razon. La verificacion de EPP de los PDFs originales queda pendiente.
