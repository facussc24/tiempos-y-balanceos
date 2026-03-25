# Audit Layer 1A: Control Plan Frequency Analysis

**Date**: 2026-03-21
**Scope**: All Control Plan items across 8 product families (18 CPs)
**Status**: READ-ONLY analysis -- no data was modified

---

## 1. Data Sources Analyzed

| Source | Location | Description |
|--------|----------|-------------|
| Seed script (5 products) | `utils/seed/seedApqpDocuments.ts` | Telas Planas, Telas Termoformadas, Armrest, Insert, Top Roll |
| Headrest seed (3 families x4 levels) | `scripts/seed-headrest.mjs` | Headrest Front, Rear Center, Rear Outer (L0 + L1/L2/L3) |
| Patagonia template (manual items) | `modules/controlPlan/controlPlanPatagoniaTemplate.ts` | 10 manual CP items for Insert Patagonia |
| CP defaults (auto-generated) | `modules/controlPlan/controlPlanDefaults.ts` | Default frequencies based on AP + severity |
| CP templates (industry library) | `modules/controlPlan/controlPlanTemplates.ts` | Pre-built templates for common operations |
| DB schema | `supabase/migrations/001_initial_schema.sql` | `cp_documents` table -- data stored as JSON blob in `data` TEXT column |

**Note**: The `cp_documents` table stores items inside a `data` JSON column (field `items[]`). There is no separate `control_plan_items` table. Each item has a `sampleFrequency` field (string).

---

## 2. Complete Frequency Distribution (All Sources)

### 2.1 Frequencies Found in Seed Data (5 products, 68 items)

| Frequency Value | Count | Products Using It |
|-----------------|-------|-------------------|
| `Cada pieza` | 10 | Telas Planas, Telas Termoformadas, Armrest, Top Roll |
| `Cada pieza` (various forms) | - | See below for combined |
| `Cada recepción` | 4 | Telas Planas (x2), Telas Termoformadas, Top Roll |
| `Cada lote` | 4 | Telas Planas (x2), Armrest, Top Roll |
| `Cada lote de material` | 2 | Telas Planas, Telas Termoformadas |
| `Inicio lote` | 6 | Telas Termoformadas (x3), Armrest (x2), Insert |
| `Inicio + c/hora` | 4 | Armrest (x2), Insert, Top Roll (x2) |
| `Inicio turno` | 3 | Armrest, Insert (x2) |
| `Inicio turno + c/hora` | 1 | Telas Planas |
| `Inicio turno + cada hora` | 1 | Armrest |
| `Inicio + c/50` | 1 | Insert |
| `Inicio + c/50 pzas` | 1 | Telas Planas |
| `1x turno` | 5 | Telas Planas, Telas Termoformadas, Armrest, Insert, Top Roll |
| `Cada caja` | 4 | Telas Planas, Telas Termoformadas, Top Roll (template) |
| `Cada contenedor` | 2 | Armrest, Top Roll |
| `Cada cont.` | 1 | Insert |
| `Cada tendido` | 1 | Telas Planas |

### 2.2 Frequencies Found in Headrest Seed (3 positions, ~50 items per L0)

| Frequency Value | Count (per position) | Operations |
|-----------------|---------------------|------------|
| `Por entrega` | ~16 | Op 10 Recepcion (all material components) |
| `Inicio de turno y despues de cada intervencion mecanica` | 3-4 | Op 20 Corte, Op 30 Costura, Op 30.2 Costura Vista |
| `Inicio de turno` | ~13 | Op 20 Corte, Op 30 Costura, Op 50 Espumado (9 process params) |
| `Inicio y fin de turno / 100% Por lote` | 6-8 | Op 30 Costura Union, Op 30.2 Costura Vista |
| `Por lote` | ~14 | Op 30 Virolado, Op 40 Ensamble, Op 50 Espumado, Op 60 Inspeccion |
| `Inicio turno` | 1 | Op 50 Espumado (peso pieza) |
| `Por turno` | 2 | Op 70 Embalaje |
| `Auditoria de Producto` | 2 | Op 80 Test de Layout |

### 2.3 Frequencies in Patagonia Template (10 manual items)

| Frequency Value | Count | Operation |
|-----------------|-------|-----------|
| `Cada recepción` | 1 | Op 10 Recepcion MP |
| `Cada 2 horas` | 1 | Op 100 Tapizado - temperatura |
| `Inicio de turno` | 1 | Op 100 Tapizado - parametros maquina |
| `Inicio de turno / cambio de lote` | 1 | Op 105 Refilado post-tapizado |
| `Cada pieza` | 2 | Op 110 Inspeccion final (Aspecto CC, Costura CC) |
| `Cada caja` | 2 | Op 120 Embalaje (cantidad, etiqueta) |
| `Cada pallet` | 1 | Op 120 Embalaje (apilado) |
| `Cada caja` | 1 | Op 120 Trazabilidad P-08 |

### 2.4 Frequencies in Default Rules (controlPlanDefaults.ts)

| AP Level | Severity | Phase | sampleFrequency |
|----------|----------|-------|-----------------|
| H | any | any | `Cada pieza` |
| M | any | preLaunch | `Cada pieza (Pre-Lanzamiento)` |
| M | >= 9 | production | `Cada hora` |
| M | < 9 | production | `Cada turno` |
| L | >= 9 | any | `Cada 2 horas` |
| L | >= 5 | any | `Cada turno` |

### 2.5 Frequencies in Template Library (controlPlanTemplates.ts)

| Frequency Value | Count | Template Context |
|-----------------|-------|------------------|
| `Cada pieza` | 8 | Costura, soldadura, conformado, inspeccion visual |
| `Cada hora` | 5 | SPC peso, dimensional, dosificacion, offset |
| `Continuo` | 6 | Sensor de rotura, detector metales, poka-yoke, monitor continuo |
| `Continuo (sensor) + manual inicio turno` | 1 | Tension de hilo |
| `Cada lote` | 4 | Control dimensional, traccion, certificado proveedor, corte |
| `Cada turno` | 1 | Muestreo periodico |
| `Inicio turno` | 3 | Ensayo destructivo, pelado, adhesion |
| `Cada recepción` | 1 | Materia prima |
| `Cada 50 piezas` | 1 | Desgaste herramienta |
| `Cada setup` | 1 | Primera pieza post-setup |
| `Según tabla vida herramienta` | 1 | Cambio de herramienta CNC |

---

## 3. Consolidated Unique Frequency Values

All unique frequency strings found across ALL sources, normalized:

| # | Frequency Value (exact string) | Category |
|---|-------------------------------|----------|
| 1 | `Cada pieza` | EVENT-BASED |
| 2 | `Cada pieza (Pre-Lanzamiento)` | EVENT-BASED |
| 3 | `100%` (implied by sampleSize, not frequency) | EVENT-BASED |
| 4 | `Cada recepción` | EVENT-BASED |
| 5 | `Cada lote` | EVENT-BASED |
| 6 | `Cada lote de material` | EVENT-BASED |
| 7 | `Por lote` | EVENT-BASED |
| 8 | `Cada tendido` | EVENT-BASED |
| 9 | `Cada caja` | EVENT-BASED |
| 10 | `Cada contenedor` | EVENT-BASED |
| 11 | `Cada cont.` | EVENT-BASED |
| 12 | `Cada pallet` | EVENT-BASED |
| 13 | `Cada setup` | EVENT-BASED |
| 14 | `Cada 50 piezas` | EVENT-BASED |
| 15 | `Por entrega` | EVENT-BASED |
| 16 | `Por turno` | TIME-BASED |
| 17 | `Cada turno` | TIME-BASED |
| 18 | `1x turno` | TIME-BASED |
| 19 | `Cada hora` | TIME-BASED |
| 20 | `C/hora` | TIME-BASED |
| 21 | `Cada 2 horas` | TIME-BASED |
| 22 | `Inicio turno` | TIME-BASED |
| 23 | `Inicio de turno` | TIME-BASED |
| 24 | `Inicio lote` | EVENT-BASED |
| 25 | `Inicio + c/hora` | HYBRID |
| 26 | `Inicio + c/50` | HYBRID |
| 27 | `Inicio + c/50 pzas` | HYBRID |
| 28 | `Inicio turno + c/hora` | HYBRID |
| 29 | `Inicio turno + cada hora` | HYBRID |
| 30 | `Inicio de turno y despues de cada intervencion mecanica` | HYBRID |
| 31 | `Inicio de turno / cambio de lote` | HYBRID |
| 32 | `Inicio y fin de turno / 100% Por lote` | HYBRID |
| 33 | `Continuo` | TIME-BASED |
| 34 | `Continuo (sensor) + manual inicio turno` | TIME-BASED |
| 35 | `Auditoria de Producto` | EVENT-BASED |
| 36 | `Según tabla vida herramienta` | EVENT-BASED |

**Total unique frequency strings: 36**

---

## 4. Category Summary

### TIME-BASED frequencies (periodic, clock-driven)

| Frequency | Semantic Meaning | Approx. Interval |
|-----------|-----------------|-------------------|
| `Continuo` | Non-stop monitoring (sensor/poka-yoke) | Real-time |
| `Continuo (sensor) + manual inicio turno` | Sensor + manual verification at shift start | Real-time + 8h |
| `Cada hora` / `C/hora` | Every hour | 1 hour |
| `Cada 2 horas` | Every 2 hours | 2 hours |
| `Cada turno` / `1x turno` / `Por turno` | Once per shift | ~8 hours |
| `Inicio turno` / `Inicio de turno` | At shift start only | ~8 hours |

### EVENT-BASED frequencies (triggered by process events)

| Frequency | Trigger Event |
|-----------|--------------|
| `Cada pieza` / `Cada pieza (Pre-Lanzamiento)` | Every single piece produced |
| `Cada recepción` / `Por entrega` | Each incoming material delivery |
| `Cada lote` / `Por lote` / `Cada lote de material` / `Inicio lote` | Each production lot |
| `Cada caja` / `Cada contenedor` / `Cada cont.` / `Cada pallet` | Each packaging unit |
| `Cada tendido` | Each fabric lay-up |
| `Cada setup` | Each machine setup |
| `Cada 50 piezas` | Every 50th piece |
| `Auditoria de Producto` | Periodic product audit (not fixed schedule) |
| `Según tabla vida herramienta` | Tool life table-driven |

### HYBRID frequencies (combining time + event triggers)

| Frequency | Meaning |
|-----------|---------|
| `Inicio + c/hora` | At start + every hour thereafter |
| `Inicio + c/50` / `Inicio + c/50 pzas` | At start + every 50 pieces |
| `Inicio turno + c/hora` / `Inicio turno + cada hora` | Shift start + hourly |
| `Inicio de turno y despues de cada intervencion mecanica` | Shift start + after each mechanical intervention |
| `Inicio de turno / cambio de lote` | Shift start OR lot change (whichever first) |
| `Inicio y fin de turno / 100% Por lote` | Shift start/end + 100% within lot |

---

## 5. Frequency Count by Category

| Category | Unique Values | Estimated Usage Count (all CPs) |
|----------|--------------|--------------------------------|
| EVENT-BASED | 17 | ~55% of all items |
| TIME-BASED | 8 | ~25% of all items |
| HYBRID | 8 | ~20% of all items |

---

## 6. Product Family CP Item Frequency Detail

### 6.1 Telas Planas PWA (CP-TP-001) -- 14 items

| # | Op | Characteristic | Frequency | Control Method | Classification |
|---|-----|---------------|-----------|---------------|----------------|
| 1 | OP 10 | Estado del material | Cada recepcion | Registro de recepcion | - |
| 2 | OP 10 | Identificacion de lote | Cada recepcion | Verificacion de remito | - |
| 3 | OP 10 | Flamabilidad (FMVSS 302) | Cada lote de material | Certificado proveedor + ensayo periodico | SC |
| 4 | OP 15 | Calidad del tendido | Cada tendido | Verificacion de tendido | - |
| 5 | OP 20 | Dimensiones de corte | Inicio de lote | Planilla de control dimensional | - |
| 6 | OP 30 | Alineacion de costura | Inicio turno + cada hora | Inspeccion en proceso | - |
| 7 | OP 30 | Resistencia de costura | 1x turno | Registro de ensayo destructivo | - |
| 8 | OP 40 | Forma troquelada | Inicio + c/50 pzas | Control con gauge | - |
| 9 | OP 40 | Rebabas | Cada pieza | Inspeccion visual | - |
| 10 | OP 45 | Posicion de Aplix | Cada pieza | Inspeccion visual | - |
| 11 | OP 45 | Adherencia de Aplix | 1x turno | Registro de ensayo | - |
| 12 | OP 50 | Aspecto visual general | Cada pieza | Inspeccion final | - |
| 13 | OP 50 | Dimensiones generales | Cada lote | Planilla dimensional | - |
| 14 | OP 60 | Identificacion | Cada caja | Verificacion de etiqueta | - |

### 6.2 Telas Termoformadas PWA (CP-TT-001) -- 13 items

| # | Op | Characteristic | Frequency | Control Method | Classification |
|---|-----|---------------|-----------|---------------|----------------|
| 1 | OP 10 | Estado del material | Cada recepcion | Registro de recepcion | - |
| 2 | OP 10 | Flamabilidad (FMVSS 302) | Cada lote de material | Certificado proveedor + ensayo periodico | SC |
| 3 | OP 20 | Dimensiones | Inicio lote | Control dimensional | - |
| 4 | OP 30 | Forma 3D | Inicio + c/hora | SPC de temperatura | - |
| 5 | OP 30 | Espesor | C/hora | Registro de espesor | - |
| 6 | OP 30 | Aspecto superficial | Cada pieza | Inspeccion visual | - |
| 7 | OP 40 | Contorno de corte | Inicio lote | Control de contorno | - |
| 8 | OP 40 | Rebabas | Cada pieza | Inspeccion visual | - |
| 9 | OP 50 | Posicion de perforaciones | Inicio lote | Control de posicion | - |
| 10 | OP 60 | Adherencia | 1x turno | Registro de ensayo | - |
| 11 | OP 70 | Posicion de Aplix | Cada pieza | Inspeccion visual | - |
| 12 | OP 80 | Aspecto general | Cada pieza | Inspeccion final | - |
| 13 | OP 90 | Identificacion | Cada caja | Check de embalaje | - |

### 6.3 Armrest Door Panel Patagonia (CP-ARM-001) -- 14 items

| # | Op | Characteristic | Frequency | Control Method | Classification |
|---|-----|---------------|-----------|---------------|----------------|
| 1 | OP 10 | Color del material | Cada lote | Registro de recepcion | SC |
| 2 | OP 10 | Gramaje | Cada lote | Registro de recepcion | - |
| 3 | OP 20 | Dimensiones de corte | Inicio lote | Control dimensional | - |
| 4 | OP 30 | Bordes limpios | Cada pieza | Inspeccion visual | - |
| 5 | OP 40 | Alineacion costura | Inicio turno + c/hora | Inspeccion en proceso | - |
| 6 | OP 50 | Peso de pieza | Inicio + c/hora | SPC de peso | CC |
| 7 | OP 50 | Dimensiones criticas | Inicio turno | Control dimensional | CC |
| 8 | OP 50 | Aspecto visual | Cada pieza | Inspeccion visual | - |
| 9 | OP 60 | Adherencia | 1x turno | Registro de ensayo | SC |
| 10 | OP 70 | Ausencia de arrugas | Cada pieza | Inspeccion visual | - |
| 11 | OP 70 | Alineacion del recubrimiento | Cada pieza | Inspeccion visual | - |
| 12 | OP 80 | Aspecto visual general | Cada pieza | Inspeccion final | CC |
| 13 | OP 80 | Dimensiones funcionales | Cada lote | Planilla dimensional | - |
| 14 | OP 90 | Identificacion VWA | Cada contenedor | Check embalaje VDA | - |

### 6.4 Insert Patagonia (CP-INS-001) -- 12 items + 10 manual items

| # | Op | Characteristic | Frequency | Control Method | Classification |
|---|-----|---------------|-----------|---------------|----------------|
| 1 | OP 10 | Color del vinilo | Cada lote | Registro recepcion | SC |
| 2 | OP 20 | Dimensiones | Inicio lote | Control dimensional | - |
| 3 | OP 30 | Bordes | Cada pieza | Inspeccion visual | - |
| 4 | OP 40 | Patron costura | Cada pieza | Inspeccion visual | SC |
| 5 | OP 50 | Forma | Inicio + c/50 | Control gauge | - |
| 6 | OP 60 | Peso | Inicio + c/hora | SPC peso | CC |
| 7 | OP 60 | Dimensiones | Inicio turno | Control dimensional | CC |
| 8 | OP 70 | Posicion componentes | Cada pieza | Inspeccion funcional | - |
| 9 | OP 80 | Adherencia | 1x turno | Registro ensayo | SC |
| 10 | OP 90 | Sin arrugas | Cada pieza | Inspeccion visual | - |
| 11 | OP 100 | Aspecto general | Cada pieza | Inspeccion final | CC |
| 12 | OP 110 | Identificacion | Cada cont. | Check VDA | - |

**Manual items (Patagonia template):**

| # | Op | Characteristic | Frequency | Control Method | Classification |
|---|-----|---------------|-----------|---------------|----------------|
| M1 | 10 | Identificacion 7 materiales | Cada recepcion | Verificacion visual y documental | SC |
| M2 | 100 | Temperatura vinilo/sustrato | Cada 2 horas | Medicion y registro en planilla de set-up | SC |
| M3 | 100 | Parametros maquina (tiempos ciclo) | Inicio de turno | Lectura de display y registro | SC |
| M4 | 105 | Refilado conforme a pieza patron | Inicio de turno / cambio de lote | - | SC |
| M5 | 110 | ASPECTO (sin manchas, roturas, despegues) | Cada pieza | - | CC |
| M6 | 110 | COSTURA (continua, sin saltos) | Cada pieza | - | CC |
| M7 | 120 | 8 piezas por caja | Cada caja | Conteo visual | - |
| M8 | 120 | Apilado 3x3 | Cada pallet | Verificacion visual del apilado | - |
| M9 | 120 | Etiqueta PT | Cada caja | Verificacion visual de etiqueta | - |
| M10 | 120 | Trazabilidad P-08 | Cada caja | Verificacion datos trazabilidad | SC |

### 6.5 Top Roll Patagonia (CP-TR-001) -- 15 items

| # | Op | Characteristic | Frequency | Control Method | Classification |
|---|-----|---------------|-----------|---------------|----------------|
| 1 | OP 5 | Estado del material PP | Cada recepcion | Registro recepcion | - |
| 2 | OP 10 | Peso de pieza | Inicio + c/hora | SPC peso | CC |
| 3 | OP 10 | Dimensiones criticas | Inicio turno | Control dimensional | CC |
| 4 | OP 10 | Aspecto (sin marcas flujo) | Cada pieza | Inspeccion visual | - |
| 5 | OP 20 | Distribucion adhesivo | Inicio + c/hora | Monitoreo temperatura | SC |
| 6 | OP 30 | Textura | Cada pieza | Inspeccion visual | CC |
| 7 | OP 30 | Adherencia film | 1x turno | Registro ensayo | CC |
| 8 | OP 40 | Contorno | Inicio lote | Control contorno | - |
| 9 | OP 50 | Doblez completo | Cada pieza | Inspeccion visual | - |
| 10 | OP 50 | Sin arrugas en doblez | Cada pieza | Inspeccion visual | - |
| 11 | OP 60 | Resistencia soldadura | 1x turno | Registro ensayo | CC |
| 12 | OP 60 | Aspecto (sin quemaduras) | Cada pieza | Inspeccion visual | - |
| 13 | OP 70 | Aspecto visual general | Cada pieza | Inspeccion final | CC |
| 14 | OP 70 | Dimensiones funcionales | Cada lote | Planilla dimensional | - |
| 15 | OP 80 | Identificacion VWA | Cada contenedor | Check VDA | - |

### 6.6 Headrest Front Patagonia (L0) -- ~50 items

| # | Op | Characteristic | Frequency | Control Method | Classification |
|---|-----|---------------|-----------|---------------|----------------|
| 1-4 | 10 | Frame: Tipo, Color, Dimensional, Aspecto | Por entrega | P-10/I. Recepcion de materiales | - |
| 5-8 | 10 | Vinilo: Espesor, Flamabilidad, Color, Gramaje | Por entrega | P-10/I. Recepcion de materiales | SC (flamab.) |
| 9-12 | 10 | Espuma: Densidad, Flamabilidad, Color, Peso | Por entrega | P-10/I. Recepcion de materiales | SC (flamab.) |
| 13-15 | 10 | Hilo: Color, Cabos, Articulo | Por entrega | P-10/I. Recepcion de materiales | - |
| 16 | 20 | Set up de Maquina | Inicio de turno y despues de cada intervencion mecanica | Control visual. Set up | - |
| 17 | 20 | Cantidad de Capas | Inicio de turno | Registro de Set-up | - |
| 18 | 20 | Set up de proceso | Inicio de turno | Registro de Set-up | - |
| 19 | 20 | Dimensional de Corte | Inicio de turno | Registro de Set-up | - |
| 20 | 30 | Set up de Maquina | Inicio de turno y despues de cada intervencion mecanica | Control visual. Set up | - |
| 21-26 | 30 | Costura (aguja, salteada, floja, arrugas, falta, aspecto) | Inicio y fin de turno / 100% Por lote | Registro de control / Autocontrol | - |
| 27-31 | 30 | Virolado+Refilado (contorno, pliegues, zonas, quemado, vinilo) | Por lote | Autocontrol | - |
| 32-35 | 40 | Ensamble (insert, asta, clipar, apariencia) | Por lote | Autocontrol | - |
| 36-37 | 50 | Espumado: Apariencia, Performance | Por lote | Autocontrol | - |
| 38 | 50 | Peso de la pieza | Inicio turno | Autocontrol | - |
| 39-47 | 50 | Espumado: Params (temp molde, colada, caudal, rel, presiones, crema, poka-yoke, temp PU) | Inicio de turno | Hoja de set-up / parametro de molde | - |
| 48 | 60 | Control dimensional | Por lote | Segun Instructivo medicion | - |
| 49 | 60 | Aspecto | Por lote | Autocontrol | - |
| 50 | 60 | Carga sistema ARB | Por lote | Autocontrol | - |
| 51 | 70 | Identificacion | Por turno | Autocontrol | - |
| 52 | 70 | Cantidad | Por turno | Autocontrol | - |
| 53 | 80 | Horizontal combustibility | Auditoria de Producto | Registro de Auditoria | - |
| 54 | 80 | Control dimensional completo | Auditoria de Producto | Informe de medicion | - |

**Headrest Rear Center and Rear Outer**: Same structure as Front, without Insert in Op 40 (Rear Center and Rear Outer have 2-3 fewer items in Op 40).

**L1/L2/L3 variants**: Add Op 30.2 Costura Vista with:
- 1 item: Set up de Maquina (`Inicio de turno y despues de cada intervencion mecanica`)
- 8 items: Costura Vista checks (`Inicio y fin de turno / 100% Por lote`)

---

## 7. Frequency Normalization Issues

Several frequencies represent the same concept but use different string formats:

| Concept | Variants Found | Recommended Standard |
|---------|---------------|---------------------|
| Once per shift | `Cada turno`, `1x turno`, `Por turno` | `Cada turno` |
| Every hour | `Cada hora`, `C/hora` | `Cada hora` |
| Start of lot | `Inicio lote`, `Inicio de lote` | `Inicio de lote` |
| Every piece | `Cada pieza`, `100%` (in sampleSize) | `Cada pieza` |
| Every container | `Cada contenedor`, `Cada cont.` | `Cada contenedor` |
| Every lot | `Cada lote`, `Por lote`, `Cada lote de material` | `Cada lote` |
| Start + hourly | `Inicio + c/hora`, `Inicio turno + c/hora`, `Inicio turno + cada hora` | `Inicio de turno + cada hora` |
| Start of shift | `Inicio turno`, `Inicio de turno` | `Inicio de turno` |
| Per delivery | `Cada recepcion`, `Por entrega` | `Cada recepcion` |

**Observation**: The seed data (5 products from `seedApqpDocuments.ts`) and the headrest seed (`seed-headrest.mjs`) use different naming conventions. The headrest data is parsed from real PDF documents (more raw/Spanish-neutral), while the seed data uses more structured Spanish terms.

---

## 8. Classification vs Frequency Cross-Reference

| Classification | Most Common Frequencies | Count |
|---------------|------------------------|-------|
| CC (Critical) | `Cada pieza` (visual), `Inicio + c/hora` (SPC), `1x turno` (destructive), `Inicio turno` (dimensional) | ~15 items |
| SC (Significant) | `Cada lote` (recepcion), `Por entrega` (flamabilidad), `Cada 2 horas` (temperatura), `Cada pieza` (costura), `1x turno` (adhesion) | ~12 items |
| No classification | All frequency types | Majority |

**Key pattern**: CC items tend to use `Cada pieza` for visual inspection and `Inicio + c/hora` for measurable parameters. SC items cover a wider range based on the specific control.

---

## 9. Summary Statistics

| Metric | Value |
|--------|-------|
| Total product families | 8 |
| Total CPs (master + variants) | 18 |
| Estimated total CP items (all CPs) | ~700-800 |
| Unique frequency strings | 36 |
| EVENT-BASED frequencies | 17 unique values |
| TIME-BASED frequencies | 8 unique values |
| HYBRID frequencies | 8 unique values |
| Normalization groups needed | 9 (where same concept has multiple strings) |

### Top 5 Most Used Frequencies (across all CPs)

| Rank | Frequency | Approx. % of items |
|------|-----------|-------------------|
| 1 | `Por entrega` / `Cada recepcion` | ~20% (reception items across all headrest CPs) |
| 2 | `Cada pieza` | ~18% (visual inspections, 100% checks) |
| 3 | `Por lote` / `Cada lote` | ~15% (lot-based controls) |
| 4 | `Inicio de turno` | ~12% (setup verifications, espumado params) |
| 5 | `Inicio y fin de turno / 100% Por lote` | ~8% (costura checks in headrests) |

---

## 10. Recommendations (for future normalization)

1. **Standardize frequency strings**: Create a dropdown/enum in the UI to prevent free-text variations. Recommended canonical values:
   - `Cada pieza`
   - `Cada recepcion`
   - `Cada lote`
   - `Cada hora`
   - `Cada 2 horas`
   - `Cada turno`
   - `Inicio de turno`
   - `Inicio de turno + cada hora`
   - `Inicio de turno + despues de cada intervencion mecanica`
   - `Inicio y fin de turno`
   - `Cada caja`
   - `Cada contenedor`
   - `Cada pallet`
   - `Continuo`
   - `Auditoria de Producto`
   - `Cada setup`

2. **Headrest vs other CPs**: The headrest CPs use `Por entrega`, `Por lote`, `Por turno` while other CPs use `Cada recepcion`, `Cada lote`, `Cada turno`. Both are valid Spanish but should be aligned.

3. **Hybrid frequencies** like `Inicio y fin de turno / 100% Por lote` are complex and may be better split into two separate control items for clarity.
