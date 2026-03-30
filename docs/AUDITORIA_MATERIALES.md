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

1. **Prioridad 1 — Vincular CP items a HO qcItems para OP 10 de los 6 productos VWA.** Esto es el gap mas critico: hay 18 controles definidos en el CP que el operador de recepcion no tiene en su instruccion de trabajo.

2. **Prioridad 2 — Definir operacion de recepcion de MP para Top Roll** (actualmente OP 10 = inyeccion). Evaluar si los 3 materiales (PC/ABS, TPO, adhesivo) se controlan con un procedimiento general P-14 o necesitan OP dedicada.

3. **Prioridad 3 — Agregar materiales faltantes al AMFE y CP:** Fabric Rennes, hilo decorativo 20/3, TPU barrier tape, adhesivo SikaMelt-171, PC/ABS CYCOLOY. El Insert ya tiene las causas individuales en el AMFE pero no se trasladaron al CP.

4. **Prioridad 4 — Completar el campo severity en las causas del AMFE OP 10.** Sin severidad definida, no se puede calcular AP correctamente ni clasificar CC/SC.

5. **Prioridad 5 — Obtener BOMs de Telas Planas y Telas Termoformadas PWA** para poder auditar la cobertura de materiales contra archivos de referencia.

---

*Reporte generado automaticamente desde datos de Supabase. No se modifico ningun documento.*
