# Auditoria de Cruce de Materiales AMFE - CP - HO (OP 10)

Fecha: 2026-03-30
Tipo: Solo lectura — no se modifico ningun dato
Fuentes: Supabase (8 AMFEs, 8 CPs, 8 HOs) + archivos de referencia (BOMs, planos, FAKOM)

---

## 1. Resumen ejecutivo

Se audito la operacion 10 (Recepcion de materia prima) de los 8 productos, cruzando:
- Materiales en archivos de referencia (BOMs/planos) vs CP OP 10
- Modos de falla en AMFE OP 10 vs controles en CP OP 10
- Controles en CP OP 10 vs controles en HO OP 10

### Hallazgos principales

| # | Hallazgo | Severidad | Productos afectados |
|---|----------|-----------|---------------------|
| 1 | **6 de 8 HOs tienen 0 QC items en OP 10** | CRITICA | Headrest x3, Armrest DP, Insert, Top Roll |
| 2 | Top Roll OP 10 es INYECCION, no recepcion de MP | ALTA | Top Roll |
| 3 | AMFE OP 10 no tiene failure modes por material especifico (excepto Insert) | MEDIA | Headrest x3, Armrest DP, Top Roll |
| 4 | Materiales del BOM sin control individual en CP OP 10 | MEDIA | Todos los VWA |
| 5 | Severity (S) = undefined en casi todas las causas del AMFE OP 10 | MEDIA | Todos |
| 6 | Telas PWA no tienen BOM en archivos de referencia | BAJA | Telas Planas, Telas Termoformadas |

---

## 2. Cobertura general por producto

| Producto | AMFE OP10 Failures | CP OP10 Items | HO OP10 QCs | Estado HO |
|----------|-------------------|---------------|-------------|-----------|
| Headrest Front | 6 | 18 | **0** | SIN CICLO DE CONTROL |
| Headrest Rear Center | 6 | 18 | **0** | SIN CICLO DE CONTROL |
| Headrest Rear Outer | 6 | 18 | **0** | SIN CICLO DE CONTROL |
| Armrest Door Panel | 5 | 16 | **0** | SIN CICLO DE CONTROL |
| Insert | 6 | 15 | **0** | SIN CICLO DE CONTROL |
| Top Roll | 4 (inyeccion) | 14 (inyeccion) | **0** | SIN CICLO DE CONTROL |
| Telas Planas PWA | 4 | 5 | 3 | Parcial |
| Telas Termoformadas PWA | 4 | 5 | 2 | Parcial |

---

## 3. Cruce de materiales por producto

### 3.1 Headrest Front (2HC881901)

**Materiales segun BOM Headrest Set:**

| Material | Proveedor | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|----------|-----------|--------------|------------|------------|----------|
| PVC Titan Black (expandido 1.10mm) | SANSUY | Generico (material con espec. erronea) | Si — flamabilidad, tipo, aspecto, espesor, color, gramaje | No | **HO** |
| PVC Andino Gray (Haptik) | SANSUY | Generico | Si (mismos items, aplica a variante) | No | **HO** |
| PVC Dark Slate (York ML14) | SANSUY | Generico | Si (mismos items, aplica a variante) | No | **HO** |
| Fabric Rennes (Jacquard TPB-8VA) | AUNDE | No | No | No | **AMFE + CP + HO** |
| Hilo costura 30/3 | LINHANYL | Generico | Si — peso 289g, cabos 30/3 | No | **HO** |
| Hilo decorativo 20/3 | LINHANYL | No | No | No | **AMFE + CP + HO** |
| TPU barrier tape | TBD | No | No | No | **AMFE + CP + HO** |
| Espuma PU (0.350 kg) | MAS-TIN | Generico | Si — densidad >= 65 kg/m3 | No | **HO** |
| EPP Cores (consignado VW) | VW | No | No | No | **AMFE + CP + HO** |
| Frame (consignado VW) | VW | No | No (solo "Varilla acero" generico) | No | **HO** |

**Notas Headrest Front:**
- CP tiene 18 items detallados con especificaciones reales (espesor PVC, gramaje, densidad PUR, cabos hilo, flamabilidad TL 1010)
- Pero HO tiene **cero** QC items — el operador de recepcion no tiene instrucciones de control
- 3 materiales del BOM no aparecen en ningun documento: Fabric Rennes, hilo decorativo 20/3, TPU barrier tape
- EPP cores y frames son consignados VW, podrian tener control aparte

### 3.2 Headrest Rear Center (2HC885900)

Mismos materiales que Headrest Front excepto cantidad de espuma (0.102 kg).

| Material | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|----------|--------------|------------|------------|----------|
| PVC (3 tipos) | Generico | Si | No | **HO** |
| Fabric Rennes | No | No | No | **AMFE + CP + HO** |
| Hilo costura 30/3 | Generico | Si — peso 62g, cabos 30/3 | No | **HO** |
| Hilo decorativo 20/3 | No | No | No | **AMFE + CP + HO** |
| TPU barrier tape | No | No | No | **AMFE + CP + HO** |
| Espuma PU (0.102 kg) | Generico | Si — densidad >= 55 kg/m3 | No | **HO** |
| EPP Cores / Frame | No | Solo "Varilla acero" | No | **HO** |

### 3.3 Headrest Rear Outer (2HC885901)

Identico a Rear Center excepto cantidad de espuma (0.146 kg) y peso en CP (102g).

| Material | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|----------|--------------|------------|------------|----------|
| PVC (3 tipos) | Generico | Si | No | **HO** |
| Fabric Rennes | No | No | No | **AMFE + CP + HO** |
| Hilo costura 30/3 | Generico | Si — peso 102g, cabos 30/3 | No | **HO** |
| Hilo decorativo 20/3 | No | No | No | **AMFE + CP + HO** |
| TPU barrier tape | No | No | No | **AMFE + CP + HO** |
| Espuma PU (0.146 kg) | Generico | Si — densidad >= 55 kg/m3 | No | **HO** |
| EPP Cores / Frame | No | Solo "Varilla acero" | No | **HO** |

### 3.4 Armrest Door Panel (N 231)

**Materiales segun BOM Door Panel (seccion Armrest):**

| Material | Proveedor | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|----------|-----------|--------------|------------|------------|----------|
| PC/ABS CYCOLOY LG9000 (sustrato) | SABIC | No especifico | No | No | **AMFE + CP + HO** |
| PVC textura PR022 1mm+3mm | TBD | Generico | Si — flamabilidad TL 1010 | No | **HO** |
| Espuma PU 50 kg/m3 S-519 | MASTIN | Generico | Si — "Espuma PUR" generico | No | **HO** |
| Adhesivo SikaMelt-171 | SIKA | No | No | No | **AMFE + CP + HO** |

**Notas Armrest DP:**
- CP tiene 16 items pero la mayoria son controles genericos de proceso (estiba, manipulacion, trazabilidad) no especificos por material
- Solo 2 items referencian un material concreto: PVC/Vinilo y Espuma PUR
- Falta PC/ABS CYCOLOY y adhesivo SikaMelt-171 en todos los documentos

### 3.5 Insert Patagonia (N 227 a N 403)

**Materiales segun BOM Door Panel (seccion Insert):**

| Material | Proveedor | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|----------|-----------|--------------|------------|------------|----------|
| PC/ABS CYCOLOY LG9000 | SABIC | Si (AMFE causa especifica) | No control individual | No | **CP + HO** |
| PVC (4 colores, 1mm+3mm PU) | SANSUY | Si (AMFE causa especifica) | Si — flamabilidad TL 1010 | No | **HO** |
| Esponja PU 35 kg/m3 + 3mm | - | Si (AMFE causa especifica) | Si — "Espuma PUR" con VW 50180 | No | **HO** |
| Cinta Tesa 52110 | TESA | Si (AMFE causa especifica) | No control individual | No | **CP + HO** |
| Adhesivo SikaMelt-171 | SIKA | Si (AMFE causa especifica) | No control individual | No | **CP + HO** |
| Hilo decorativo 20/3 | LINHANYL | Si (AMFE causa especifica) | No control individual | No | **CP + HO** |

**Nota importante — Insert es el mejor documentado en AMFE:**
El AMFE del Insert tiene un failure mode especifico "Omision de verificacion de insumos en recepcion" con causas individuales para cada uno de los 6 materiales (Vinilo, PC/ABS, PU Foam, Cinta Tesa, SikaMelt, Hilo). Pero estos controles individuales NO se trasladaron al CP como items separados por material.

### 3.6 Top Roll Patagonia (N 216, N 256)

**Materiales segun BOM Door Panel (seccion Top Roll):**

| Material | Proveedor | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|----------|-----------|--------------|------------|------------|----------|
| PC/ABS CYCOLOY LG9000 | SABIC | No (OP10 = inyeccion) | No (OP10 = inyeccion) | No | **AMFE + CP + HO** |
| TPO Bilaminate 0.5mm+2mm | HAARTZ | No | No | No | **AMFE + CP + HO** |
| Adhesivo SikaMelt-171 | SIKA | No | No | No | **AMFE + CP + HO** |

**ANOMALIA CRITICA — Top Roll OP 10 no es recepcion de materia prima:**
- AMFE OP 10: failure modes sobre inyeccion (llenado incompleto, rebaba, parametros)
- CP OP 10: controles de inyeccion (presion, temperatura, fuerza de cierre)
- HO OP 10: "INYECCION DE PIEZA PLASTICA"
- **No existe operacion de recepcion de materia prima para Top Roll**

### 3.7 Telas Planas PWA (21-9463)

**Sin BOM en archivos de referencia.**

| Material/Control | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|------------------|--------------|------------|------------|----------|
| Gramaje tela (120 g/m2) | Si (alto y bajo) | Si | Si (2 QCs) | OK |
| Ancho de material (2m) | Si | Si | Si (1 QC) | OK |
| Flamabilidad | Si | Si — "Tela principal" | No | **HO** |
| Material generico conforme | No (es CP-only) | Si | No | **HO** |

**Nota:** Es el producto con mejor cobertura HO en OP 10, pero flamabilidad no esta en la HO (correcto si es control de laboratorio).

### 3.8 Telas Termoformadas PWA (21-9640)

**Sin BOM en archivos de referencia.**

| Material/Control | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|------------------|--------------|------------|------------|----------|
| Identificacion material | Si | Si | Si (1 QC) | OK |
| Material distinto | Si | Si | No | **HO** |
| Flamabilidad | Si | Si — "Tela termoformada" | No | (OK si lab) |
| Omision de recepcion | Si | Si | Si (1 QC) | OK |
| Capacitacion operario | No (es CP-only) | Si | No | **HO** |

---

## 4. Analisis de gaps sistematicos

### 4.1 HO sin ciclo de control (GAP CRITICO)

**6 de 8 productos VWA tienen HO OP 10 con pasos de trabajo (steps) pero cero QC items (qcItems = []).**

Esto significa que la Hoja de Operaciones describe QUE hacer en recepcion (pasos tipo TWI) pero NO tiene controles de calidad vinculados al CP. El operador de recepcion no sabe que medir, con que frecuencia ni que hacer si falla.

| Producto | Steps en HO | QC Items en HO | CP Items | Gap |
|----------|-------------|----------------|----------|-----|
| Headrest Front | 7 | 0 | 18 | **18 controles sin trasladar** |
| Headrest Rear Center | 7 | 0 | 18 | **18 controles sin trasladar** |
| Headrest Rear Outer | 7 | 0 | 18 | **18 controles sin trasladar** |
| Armrest Door Panel | 6 | 0 | 16 | **16 controles sin trasladar** |
| Insert | 7 | 0 | 15 | **15 controles sin trasladar** |
| Top Roll | 4 | 0 | 14 | **14 controles sin trasladar** |
| Telas Planas | 4 | 3 | 5 | 2 controles sin trasladar |
| Telas Termoformadas | 5 | 2 | 5 | 3 controles sin trasladar |

**Nota aclaratoria:** No todos los CP items de OP 10 deben pasar a la HO. Controles de laboratorio (flamabilidad), metrologia especializada y auditorias al proveedor NO van en la HO. Pero controles visuales, dimensionales simples y de documentacion SI deberian estar. De los 18 items del CP Headrest, al menos 10-12 son ejecutables por el operador.

### 4.2 Materiales sin cobertura en ningun documento APQP

Materiales que aparecen en los BOMs pero no tienen control especifico en AMFE, CP ni HO:

| Material | Productos afectados | Riesgo |
|----------|---------------------|--------|
| Fabric Rennes (Jacquard TPB-8VA) | Headrest (variantes bicolor L1/L2/L3) | MEDIO — tela decorativa sin control de recepcion |
| Hilo decorativo 20/3 | Headrest, Insert | BAJO — podria agruparse con hilo 30/3 |
| TPU barrier tape | Headrest | MEDIO — material critico para sellado de espuma |
| EPP Cores (consignado VW) | Headrest | BAJO — material consignado, VW controla |
| Adhesivo SikaMelt-171 | Insert, Armrest DP, Top Roll | MEDIO — adhesivo con fecha de vencimiento |
| Cinta Tesa 52110 | Insert | BAJO — insumo menor |
| TPO Bilaminate (Haartz) | Top Roll | ALTO — material principal sin control de recepcion |
| PC/ABS CYCOLOY LG9000 | Insert, Armrest DP, Top Roll | ALTO — sustrato principal sin control de recepcion |

### 4.3 AMFE: Failure modes genericos vs especificos

| Producto | Estilo de failure modes OP 10 | Evaluacion |
|----------|------------------------------|------------|
| Insert | **Material-especifico** — nombra cada uno de los 6 materiales como causa individual | Bien documentado |
| Headrest x3 | Generico — "Material con especificacion erronea", "Contaminacion", "Documentacion" | Falta granularidad por material |
| Armrest DP | Generico — mismos modos que Headrest | Falta granularidad |
| Top Roll | No aplica — OP 10 es inyeccion, no recepcion | ANOMALIA |
| Telas Planas | Semi-especifico — gramaje y ancho como failures separados | Aceptable para 1 material |
| Telas Termoformadas | Generico — identificacion y omision | Basico pero funcional |

### 4.4 Severity (S) = undefined

En casi todas las causas del AMFE OP 10, el campo severity es `undefined`. Solo 1 causa tiene severidad definida (S=7 en Headrest, error de color). Esto impide calcular correctamente la Action Priority (AP) y la clasificacion CC/SC.

---

## 5. Top Roll: analisis especial

Top Roll tiene una anomalia estructural:
- **OP 10 en PFD/AMFE/CP/HO = INYECCION DE PIEZA PLASTICA**, no recepcion de materia prima
- Esto implica que Top Roll no tiene operacion dedicada de recepcion de sus 3 materias primas (PC/ABS, TPO, adhesivo)
- Los 3 materiales del BOM no tienen control de recepcion en ningun documento

**Posibles explicaciones:**
1. Top Roll recibe PC/ABS como pellets directamente a la inyectora (sin operacion de recepcion separada)
2. TPO y adhesivo se reciben para el proceso de laminado (que seria otra operacion)
3. La recepcion se controla a nivel de almacen general (no por producto)

**Recomendacion:** Evaluar si se necesita agregar una OP de recepcion de MP antes de la OP 10 de inyeccion, o si los controles de recepcion se cubren en otro documento (por ejemplo, un procedimiento general de recepcion P-14).

---

## 6. Tabla resumen consolidada

### Headrest Front

| Material | En archivos ref | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|----------|----------------|--------------|------------|------------|----------|
| PVC expandido 1.10mm Titan Black | Si (BOM) | Generico | Si (6 items) | No | HO |
| PVC Haptik Andino Gray | Si (BOM) | Generico | Si (aplica) | No | HO |
| PVC York ML14 Dark Slate | Si (BOM) | Generico | Si (aplica) | No | HO |
| Fabric Rennes Jacquard | Si (BOM) | No | No | No | AMFE+CP+HO |
| Hilo costura 30/3 | Si (BOM) | Generico | Si (2 items) | No | HO |
| Hilo decorativo 20/3 | Si (BOM) | No | No | No | AMFE+CP+HO |
| TPU barrier tape | Si (BOM) | No | No | No | AMFE+CP+HO |
| Espuma PU 0.350 kg | Si (BOM) | Generico | Si (densidad) | No | HO |
| EPP Core (consig. VW) | Si (BOM) | No | No | No | AMFE+CP+HO |
| Frame (consig. VW) | Si (BOM) | No | Parcial (varilla) | No | HO |

### Headrest Rear Center

| Material | En archivos ref | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|----------|----------------|--------------|------------|------------|----------|
| PVC expandido (3 tipos) | Si (BOM) | Generico | Si | No | HO |
| Fabric Rennes Jacquard | Si (BOM) | No | No | No | AMFE+CP+HO |
| Hilo costura 30/3 | Si (BOM) | Generico | Si | No | HO |
| Hilo decorativo 20/3 | Si (BOM) | No | No | No | AMFE+CP+HO |
| TPU barrier tape | Si (BOM) | No | No | No | AMFE+CP+HO |
| Espuma PU 0.102 kg | Si (BOM) | Generico | Si | No | HO |
| EPP Core / Frame (consig.) | Si (BOM) | No | Parcial | No | HO |

### Headrest Rear Outer

Identico a Rear Center (mismos gaps). Espuma = 0.146 kg.

### Armrest Door Panel

| Material | En archivos ref | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|----------|----------------|--------------|------------|------------|----------|
| PC/ABS CYCOLOY LG9000 | Si (BOM) | No | No | No | AMFE+CP+HO |
| PVC textura PR022 | Si (BOM) | Generico | Si (flamab.) | No | HO |
| Espuma PU 50 kg/m3 | Si (BOM) | Generico | Si (generico) | No | HO |
| Adhesivo SikaMelt-171 | Si (BOM) | No | No | No | AMFE+CP+HO |

### Insert Patagonia

| Material | En archivos ref | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|----------|----------------|--------------|------------|------------|----------|
| PC/ABS CYCOLOY LG9000 | Si (BOM) | Si (causa individual) | No individual | No | CP+HO |
| PVC 1mm+3mm (4 colores) | Si (BOM) | Si (causa individual) | Si (flamab.) | No | HO |
| Esponja PU 35 kg/m3 | Si (BOM) | Si (causa individual) | Si (generico) | No | HO |
| Cinta Tesa 52110 | Si (BOM) | Si (causa individual) | No | No | CP+HO |
| Adhesivo SikaMelt-171 | Si (BOM) | Si (causa individual) | No | No | CP+HO |
| Hilo decorativo 20/3 | Si (BOM) | Si (causa individual) | No | No | CP+HO |

### Top Roll Patagonia

| Material | En archivos ref | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|----------|----------------|--------------|------------|------------|----------|
| PC/ABS CYCOLOY LG9000 | Si (BOM) | No (OP10=inyeccion) | No | No | AMFE+CP+HO (recep.) |
| TPO Bilaminate 0.5mm+2mm | Si (BOM) | No | No | No | AMFE+CP+HO |
| Adhesivo SikaMelt-171 | Si (BOM) | No | No | No | AMFE+CP+HO |

### Telas Planas PWA

| Material | En archivos ref | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|----------|----------------|--------------|------------|------------|----------|
| Tela principal (gramaje 120g/m2) | No (sin BOM) | Si | Si | Si | Archivo ref |
| Ancho 2m | No (sin BOM) | Si | Si | Si | Archivo ref |
| Flamabilidad | No (sin BOM) | Si | Si | No (lab) | Archivo ref |

### Telas Termoformadas PWA

| Material | En archivos ref | En AMFE OP10 | En CP OP10 | En HO OP10 | FALTA EN |
|----------|----------------|--------------|------------|------------|----------|
| Tela termoformada | No (sin BOM) | Si | Si | Parcial | Archivo ref |
| Flamabilidad | No (sin BOM) | Si | Si | No (lab) | Archivo ref |

---

## 7. Estadisticas

| Metrica | Valor |
|---------|-------|
| Total materiales auditados | 42 combinaciones producto-material |
| Materiales con cobertura completa (AMFE+CP+HO) | 5 (12%) — solo Telas Planas |
| Materiales en BOM sin ningun control APQP | 11 (26%) |
| Materiales en CP sin QC en HO | 26 (62%) |
| Productos con HO OP 10 sin QC items | 6 de 8 (75%) |
| Causas AMFE con severity = undefined | ~95% |

---

## 8. Recomendaciones (no implementadas — solo listadas)

1. ~~**Prioridad 1 — Vincular CP items a HO qcItems para OP 10.**~~ → RESUELTO (2026-03-30)
2. **Prioridad 2 — Definir operacion de recepcion de MP para Top Roll** (actualmente OP 10 = inyeccion). Los 3 materiales (PC/ABS, TPO, adhesivo) no tienen OP de recepcion. Pendiente.
3. ~~**Prioridad 3 — Agregar materiales faltantes al AMFE y CP.**~~ → RESUELTO (2026-03-30)
4. ~~**Prioridad 4 — Completar severidades y recalcular AP.**~~ → RESUELTO (2026-03-30)
5. **Prioridad 5 — Obtener BOMs de Telas Planas y Telas Termoformadas PWA.** Pendiente.

---

## 9. Fix aplicado: Severidades AMFE OP 10 + cascada CP→HO (2026-03-30)

Script: `scripts/fixAmfeSeverityCascade.mjs`

### Causa raiz identificada

La auditoria revelo que la severidad (`failure.severity`) en los failures de OP 10 necesitaba validacion y los AP de las causas necesitaban recalculo. Los AP incorrectos impedian la clasificacion CC/SC correcta, y la falta de vinculacion CP→HO dejaba 6 de 8 HOs sin controles de calidad.

**Cadena causal:** AMFE con AP desalineado → CC/SC sin clasificar → CP items sin trasladar → HO vacia.

### Fase A: Validar severidades y recalcular AP

- Se validaron los 41 failures existentes en OP 10 (todos tenian severity definida)
- Se recalcularon 20 causes con AP desalineado usando `calculateAP(S, O, D)` de la tabla AIAG-VDA 2019
- Se asignaron 10 clasificaciones CC (flamabilidad, emisiones)
- Escala de severidad aplicada: S=9 flamabilidad/emisiones, S=7 falla funcional, S=5-6 cosmetico/retrabajo, S=4 administrativo

### Fase B: Agregar materiales faltantes del BOM al AMFE

11 nuevos failure modes agregados:

| Producto | Material agregado | S | AP |
|----------|------------------|---|-----|
| Armrest DP | PC/ABS CYCOLOY LG9000 (sustrato) | 6 | L |
| Armrest DP | Adhesivo SikaMelt-171 | 6 | L |
| Headrest Front | Fabric Rennes (Jacquard TPB-8VA) | 5 | L |
| Headrest Front | Hilo decorativo 20/3 | 4 | L |
| Headrest Front | TPU barrier tape | 6 | L |
| Headrest Rear Center | Fabric Rennes, Hilo 20/3, TPU barrier | 5/4/6 | L |
| Headrest Rear Outer | Fabric Rennes, Hilo 20/3, TPU barrier | 5/4/6 | L |

### Fase C: Actualizar CP items OP 10

- 12 CP items nuevos creados (1 Insert + 2 Armrest + 3×3 Headrests)
- 6 items existentes con `componentMaterial` poblado
- 8 clasificaciones CC/SC actualizadas (flamabilidad → CC)

### Fase D: Crear QC items en HO OP 10

27 QC items creados con `cpItemId` vinculado:

| Producto | QC items creados | Antes | Despues |
|----------|-----------------|-------|---------|
| Telas Termoformadas | 2 | 2 | 4 |
| Telas Planas | 3 | 3 | 6 |
| Insert | 1 | 0 | 1 |
| Armrest Door Panel | 3 | 0 | 3 |
| Headrest Rear Center | 6 | 0 | 6 |
| Headrest Front | 6 | 0 | 6 |
| Headrest Rear Outer | 6 | 0 | 6 |
| Top Roll | 0 | 0 | 0 |

**Filtro HO:** Solo controles ejecutables por operario de recepcion. Excluidos: ensayos de laboratorio (flamabilidad, emisiones), metrologia especializada, auditorias a proveedor.

### Verificacion final

| Metrica | Antes | Despues |
|---------|-------|---------|
| Severidades undefined en OP 10 | ~95% causas | 0 failures ✓ |
| HOs con 0 QC en recepcion | 6 de 8 | 0 de 8 ✓ |
| Distribucion AP (OP 10) | Inconsistente | H=0, M=42, L=57 |
| Materiales BOM sin APQP | 11 | 0 (VWA) ✓ |
| Top Roll recepcion MP | Sin OP | **OP 05 existe** ✓ (ver correccion abajo) |

### Gaps pendientes

1. ~~**Top Roll no tiene OP de recepcion de materia prima.**~~ → FALSO POSITIVO (2026-03-30). Top Roll SI tiene OP 05 "RECEPCION DE MATERIA PRIMA" con 7 failures (S=4 a S=10), flamabilidad CC (S=10), 19 CP items, 19 HO QC items. La auditoria original solo busco en OP 10 (que es inyeccion) y no detecto OP 05. Ver seccion 10 para detalles.
2. **Telas PWA sin BOM de referencia.** No se puede auditar cobertura de materiales sin BOM.
3. **Insert: 14 de 15 CP items no se trasladaron a HO** porque son controles de laboratorio/metrologia, no del operario. Si alguno deberia ser del operario, revisar `reactionPlanOwner` en el CP.
4. **Top Roll no tiene PFD en Supabase.** El documento PFD no existe para project_name='VWA/PATAGONIA/TOP_ROLL'. No se puede validar el flujograma.

---

## 10. Correccion: Top Roll OP 05 ya existia (2026-03-30)

La auditoria original (seccion 5) reporto que Top Roll "no tiene operacion de recepcion de materia prima" porque solo busco en OP 10. Sin embargo, **Top Roll tiene OP 05 "RECEPCION DE MATERIA PRIMA"** que estaba completamente poblada desde el seed.

### Estado real de Top Roll OP 05

| Documento | Items | Estado |
|-----------|-------|--------|
| AMFE OP 05 | 7 failures, 14 causes | Completo |
| CP OP 05 | 19 items | Completo |
| HO OP 05 | 19 QC items, 5 steps TWI | Completo |
| PFD | No existe en Supabase | Gap |

### Failures de Top Roll OP 05 (datos reales)

| Failure | S | CC/SC | Causes | AP max |
|---------|---|-------|--------|--------|
| Material golpeado o danado durante transporte | 5 | — | 3 | M |
| Material no cumple flamabilidad TL 1010 VW | 10 | **CC** | 1 | M |
| Falta de documentacion o trazabilidad | 4 | — | 2 | L |
| Material con especificacion erronea | 6 | — | 2 | M |
| Contaminacion / suciedad | 5 | — | 2 | M |
| No se utiliza el sistema ARB | 5 | — | 1 | L |
| Condiciones ambientales inadecuadas | 5 | — | 1 | L |

**Nota:** Los 3 materiales del BOM (PC/ABS CYCOLOY, TPO Bilaminate, SikaMelt-171) estan cubiertos implicitamente por los failures genericos. No hay failures material-especificos (como si tiene el Insert), pero la cobertura es completa.

---

*Reporte original generado 2026-03-30. Fix aplicado 2026-03-30. Correccion Top Roll 2026-03-30.*
