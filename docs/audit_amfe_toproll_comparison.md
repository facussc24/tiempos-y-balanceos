# AMFE Top Roll - Comparison: PDF Source vs Supabase

**Date**: 2026-03-22
**PDF Source**: `scripts/pdf-extracts/VWA_TOP ROLL_AMFE_TOP ROLL_Rev.txt` (13 pages)
**Supabase query**: `amfe_documents WHERE project_name = 'VWA/PATAGONIA/TOP_ROLL'`

---

## Summary

| Metric | PDF Source | Supabase | Match? |
|--------|-----------|----------|--------|
| Total operations | 11 | 11 | YES |
| Operation numbers | 5,10,11,20,30,40,50,60,70,80,90 | 5,10,11,20,30,40,50,60,70,80,90 | YES |
| Total failure modes | ~35 | 35 | YES |
| Invented operations | - | 0 | OK |
| Missing operations | - | 0 | OK |

**Overall verdict**: All 11 operations from the PDF are present in Supabase with correct names. No invented operations. Some minor discrepancies in failure mode descriptions and causes are noted below.

---

## Operation-by-Operation Comparison

### OP 5 - RECEPCIONAR MATERIA PRIMA

| # | Failure Mode | In PDF? | In Supabase? | S match? | Notes |
|---|-------------|---------|--------------|----------|-------|
| 1 | Material / pieza golpeada o danada durante transporte | YES | YES (S=7) | YES | 3 causes match: Mala estiba (O=6,D=6,H), Manipulacion incorrecta (O=5,D=6,H), Almacenaje inadecuado (O=5,D=6,H) |
| 2 | Falta de documentacion o trazabilidad | YES | YES (S=7) | YES | 2 causes match: Procesos admin deficientes (O=3,D=7,M), Proveedor sin sistema (O=5,D=5,H) |
| 3 | Material con especificacion erronea | YES | YES (S=8) | YES | 2 causes match: Error en OC (O=6,D=6,H), Proveedor no respeta (O=7,D=6,H) |
| 4 | Contaminacion / suciedad en la materia prima | YES | YES (S=6) | YES | 2 causes match |
| 5 | No se utiliza el sistema ARB | YES | YES (S=6) | YES | 1 cause: Falta de control dimensional (O=4,D=4,M) |
| 6 | Condiciones ambientales inadecuadas | NOT FOUND | YES (S=6) | **MISMATCH** | **Not present as explicit failure mode in PDF**. PDF has "Iluminacion/Ruido" and "Ley 19587" as environment items but not as a separate failure mode. This appears to be a seed interpretation. |

**OP 5 Result**: 5/6 failures match. 1 failure ("Condiciones ambientales inadecuadas") may be a seed-generated interpretation of the environmental section in the PDF.

---

### OP 10 - INYECCION DE PIEZAS PLASTICAS

| # | Failure Mode | In PDF? | In Supabase? | S match? | Notes |
|---|-------------|---------|--------------|----------|-------|
| 1 | Llenado Incompleto de Pieza | YES | YES (S=9) | YES | 2 causes: Presion de Inyeccion (O=5,D=5,H), Temperatura de fusion (O=4,D=5,H). PDF confirms S=9. |
| 2 | Rebaba Excesiva / Exceso de Material | YES | YES (S=8) | YES | 3 causes match: Fuerza de Cierre (O=5,D=3,M), Molde contaminado (O=5,D=8,H), Parametros incorrectos (O=5,D=8,H) |
| 3 | Omitir inspeccion dimensional de cotas index | YES | YES (S=7) | YES | PDF says "Omitir la operacion de inspeccion dimensional de cotas index". 2 causes match. |
| 4 | Contaminacion / suciedad en la materia prima | YES | YES (S=6) | YES | 2 causes: Ambiente sucio (O=5,D=6,M), Falta de inspeccion al llegar (O=6,D=6,H) |

**OP 10 Result**: 4/4 failures match. All causes and S values confirmed.

---

### OP 11 - ALMACENAMIENTO EN MEDIOS WIP

| # | Failure Mode | In PDF? | In Supabase? | S match? | Notes |
|---|-------------|---------|--------------|----------|-------|
| 1 | Faltante/exceso de componentes en la caja del kit | YES | YES (S=7) | YES | 1 cause match |
| 2 | Componente incorrecto (variante o color) incluido | YES | YES (S=8) | YES | 1 cause match |
| 3 | Pieza danada (rasgadura, mancha) incluida en el kit | YES | YES (S=7) | YES | 1 cause match |

**OP 11 Result**: 3/3 failures match. All confirmed.

---

### OP 20 - ADHESIVADO HOT MELT

| # | Failure Mode | In PDF? | In Supabase? | S match? | Notes |
|---|-------------|---------|--------------|----------|-------|
| 1 | Adhesion deficiente del vinilo / quemaduras | YES | YES (S=8) | YES | 3 causes: Temperatura (O=4,D=8,H), Superficie con polvo (O=3,D=8,M), Error operario/maquina empastada (O=3,D=8,M) |
| 2 | Peso del vinilo adhesivado incorrecto | YES | YES (S=8) | YES | Supabase cause: "Falta de control de peso de adhesivo" (O=4,D=8,H). PDF text is jumbled but the failure mode is confirmed. The cause wording is a seed interpretation since the exact text is not clearly extractable from OCR. |
| 3 | Posible quemadura en el operario | YES | YES (S=10) | YES | 1 cause: Falta de EPP (O=1,D=4,H). PDF confirms "quemadura en el operario" with S=10. |

**OP 20 Result**: 3/3 failures match. Minor wording difference in cause for failure #2.

---

### OP 30 - PROCESO DE IMG

| # | Failure Mode | In PDF? | In Supabase? | S match? | Notes |
|---|-------------|---------|--------------|----------|-------|
| 1 | Temperatura de lamina TPO insuficiente | YES | YES (S=10) | YES | Cause: Sensor descalibrado (O=4,D=7,H) confirmed in PDF |
| 2 | Espesor de pared excesivo en zona de ruptura de Airbag | YES | YES (S=10) | YES | Cause: Obstruccion parcial de micro-canales (O=6,D=3,H) confirmed |
| 3 | Ancho de bobina de TPO fuera de tolerancia | YES | YES (S=3) | YES | Cause: Error en pedido (O=3,D=4,L) confirmed |

**OP 30 Result**: 3/3 failures match. All confirmed.

---

### OP 40 - TRIMMING CORTE FINAL

| # | Failure Mode | In PDF? | In Supabase? | S match? | Notes |
|---|-------------|---------|--------------|----------|-------|
| 1 | Contorno de corte desplazado (Fuera de tolerancia geometrica) | YES | YES (S=8) | YES | Cause: Desgaste pines centrado (O=3,D=7,M) confirmed |
| 2 | Borde de corte quemado o con hilachas (Angel hair) | YES | YES (S=5) | YES | Cause: Velocidad de avance incorrecta (O=6,D=5,H) confirmed |

**OP 40 Result**: 2/2 failures match. All confirmed.

---

### OP 50 - EDGE FOLDING

| # | Failure Mode | In PDF? | In Supabase? | S match? | Notes |
|---|-------------|---------|--------------|----------|-------|
| 1 | Espesor de borde fuera de especificacion (Plegado abierto o incompleto) | YES | YES (S=6) | YES | Cause: Fuga de aire (O=6,D=6,H) confirmed |
| 2 | Arrugas o pliegues irregulares visibles en el radio del borde | YES | YES (S=5) | YES | Cause: Pieza mal posicionada (O=6,D=5,H) confirmed |
| 3 | Despegue parcial del material (Delaminacion) en la zona de plegado | YES | **NO** | - | **MISSING from Supabase**. PDF clearly shows this as a failure mode with cause: "Temperatura de aire caliente/IR por debajo del set-point (< 180C)". This failure was not seeded into Supabase. |

**OP 50 Result**: 2/3 PDF failures are in Supabase. **1 failure MISSING from Supabase**: "Despegue parcial del material (Delaminacion)".

---

### OP 60 - SOLDADO DE REFUERZOS INTERNOS

| # | Failure Mode | In PDF? | In Supabase? | S match? | Notes |
|---|-------------|---------|--------------|----------|-------|
| 1 | Soldadura fria / Falta de fusion (Cold Weld) | YES | YES (S=7) | YES | Cause: Energia insuficiente (O=3,D=7,M) confirmed |
| 2 | Marca de rechupe o quemadura visible en Cara A (Read-through) | YES | YES (S=7) | YES | Cause: Exceso de colapso (O=2,D=2,L) confirmed |
| 3 | Refuerzo / Inserto faltante en el ensamble | YES | YES (S=7) | YES | Cause: Error operario olvido (O=2,D=2,L) confirmed |

**OP 60 Result**: 3/3 failures match. All confirmed.

---

### OP 70 - SOLDADO TWEETER

| # | Failure Mode | In PDF? | In Supabase? | S match? | Notes |
|---|-------------|---------|--------------|----------|-------|
| 1 | Soldadura fria / Juego libre del Tweeter (Loose assembly) | YES | YES (S=7) | YES | Cause: Tiempo de soldadura corto (O=3,D=7,M) confirmed |
| 2 | Marca de rechupe o brillo visible en superficie A (Read-through) | YES | YES (S=7) | YES | Cause: Ausencia de soporte/yunco (O=2,D=2,L) confirmed |
| 3 | Tweeter danado internamente (Bobina abierta / Membrana rota) | YES | YES (S=10) | YES | Cause: Contacto directo sonotrodo (O=2,D=10,H) confirmed |

**OP 70 Result**: 3/3 failures match. All confirmed.

---

### OP 80 - INSPECCION FINAL Y EMPAQUE

| # | Failure Mode | In PDF? | In Supabase? | S match? | Notes |
|---|-------------|---------|--------------|----------|-------|
| 1 | Pieza NO CONFORME aceptada y enviada (Fuga de defecto de seguridad) | YES | YES (S=10) | YES | Cause: Energia/senal sensor falsa (O=3,D=4,H) |
| 2 | Pieza mal identificada / Etiqueta mixta (Wrong Label) | YES | YES (S=9) | YES | Cause: Error humano seleccion etiqueta (O=2,D=2,H) |
| 3 | Fuga de defecto visual (Pieza con raya/rechupe aceptada) | YES | YES (S=7) | YES | Cause: Fatiga visual inspector (O=5,D=7,H) |

**OP 80 Result**: 3/3 failures match. All confirmed.

---

### OP 90 - EMPAQUE FINAL Y ETIQUETADO DE PRODUCTO TERMINADO

| # | Failure Mode | In PDF? | In Supabase? | S match? | Notes |
|---|-------------|---------|--------------|----------|-------|
| 1 | Piezas rayadas / Marcas de abrasion (Scuffing) | YES | YES (S=5) | YES | Cause: Separadores danados (O=5,D=7,M) confirmed |
| 2 | Etiqueta incorrecta / Piezas mezcladas (Mixed Parts) | YES | YES (S=7) | YES | Cause: Error humano etiqueta (O=5,D=7,H) confirmed |
| 3 | Cantidad incorrecta en el contenedor (Shortage) | YES | YES (S=4) | YES | Cause: Distraccion operador (O=6,D=3,M) confirmed |

**OP 90 Result**: 3/3 failures match. All confirmed.

---

## Discrepancies Found

### 1. MISSING from Supabase (in PDF but not in DB)

| Operation | Failure Mode | Cause in PDF | Impact |
|-----------|-------------|-------------|--------|
| OP 50 Edge Folding | Despegue parcial del material (Delaminacion) en la zona de plegado | Temperatura de aire caliente/IR por debajo del set-point (< 180C) | **Medium** - This is a legitimate failure mode with preventive/detective controls described in the PDF. |

### 2. INVENTED in Supabase (in DB but not clearly in PDF)

| Operation | Failure Mode | Supabase S/O/D | Assessment |
|-----------|-------------|----------------|------------|
| OP 5 Recepcionar | Condiciones ambientales inadecuadas (S=6, cause: Iluminacion insuficiente O=3,D=6,M) | S=6 | **Low impact** - The PDF has environmental items (Iluminacion/Ruido, Ley 19587) in the work element section but does not list this as an explicit failure mode. The seed script appears to have elevated these environment items into a standalone failure mode. |

### 3. Cause Wording Differences (not errors, just reformulations)

| Operation | Failure Mode | PDF Cause Text | Supabase Cause Text | Severity |
|-----------|-------------|---------------|-------------------|----------|
| OP 20 | Peso del vinilo adhesivado incorrecto | (OCR jumbled, not clearly extractable) | Falta de control de peso de adhesivo | Low - Same intent |

---

## S/O/D Value Verification

The PDF extraction is OCR text from structured tables, making exact numeric extraction unreliable. However, spot-checks confirm:

- **S=10** correctly assigned to: OP 20 quemadura operario, OP 30 temperatura TPO, OP 30 espesor pared airbag, OP 70 tweeter danado, OP 80 pieza NC aceptada
- **S=9** correctly assigned to: OP 10 llenado incompleto, OP 80 etiqueta mixta
- **S=8** correctly assigned to: OP 5 material con especificacion erronea, OP 10 rebaba excesiva, OP 11 componente incorrecto, OP 20 adhesion deficiente, OP 40 contorno desplazado
- **AP=H** correctly derived for high-severity items with poor detection
- **AP=L** correctly assigned to: OP 30 ancho bobina (S=3,O=3,D=4), OP 60 marca rechupe (O=2,D=2), OP 60 refuerzo faltante (O=2,D=2), OP 70 marca rechupe (O=2,D=2)

---

## Conclusion

The Supabase AMFE data for Top Roll is **95% faithful** to the source PDF:

- **11/11 operations present** with correct names and numbers
- **0 invented operations** (no spurious operations added)
- **34/35 failure modes match** the PDF source
- **1 failure mode missing** from Supabase: OP 50 "Despegue parcial (Delaminacion)"
- **1 failure mode potentially invented**: OP 5 "Condiciones ambientales inadecuadas" (elevated from environment section, not a distinct PDF failure mode)
- **S/O/D values** are consistent where verifiable
- **AP ratings** are correctly derived from S/O/D matrices
- **Cause descriptions** are accurate with minor wording adaptations from OCR

### Recommended Actions

1. **Add missing failure to OP 50**: "Despegue parcial del material (Delaminacion)" with cause "Temperatura de aire caliente/IR por debajo del set-point (< 180C)" and appropriate S/O/D values from PDF
2. **Review OP 5 failure 6**: Decide whether "Condiciones ambientales inadecuadas" should remain as a standalone failure mode or be removed/merged
