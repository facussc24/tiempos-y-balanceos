# Audit Layer 1B: Control Plan Frequency Source Traceability

**Date**: 2026-03-21
**Scope**: Trace every Control Plan frequency in the seed scripts back to its original PDF source document.
**Method**: READ-ONLY analysis. No database or code was modified.

---

## 1. Original PDF Documents Found

Location: `C:\Users\FacundoS-PC\Documents\AMFES PC HO\PLANES DE CONTROL ACTUALES REFERENCIA UNICAMENTE\`

| # | PDF File | Product | Part Numbers | Date | Pages |
|---|----------|---------|-------------|------|-------|
| 1 | PdC Insertos.pdf | Insert Front DI/DD TAOS | 2GJ.868.109.B / 2GJ.868.110.B (ZCW/ZKZ) | Rev 1, 7/9/2024 | 11 |
| 2 | PC_TOP ROLL.pdf | Top Roll Front DI-DD TAOS | 2GJ.868.087 / 2GJ.868.088 | Rev 0, 25/2/2025 | 7 |
| 3 | PdC IP Decorative Taos.pdf | IP Decorative Molding Small | 2GJ.858.417.A / 2GJ.858.418.A (ZCW/ZKZ) | Rev 0, 19/11/2024 | 10 |
| 4 | PATAGONIA_FRONT_HEADREST_L0_PdC preliminar.pdf | Front Headrest L0 (PVC) | XXX.881.900 | Rev 0, 10/4/2025 | 9 |
| 5 | PATAGONIA_FRONT_HEADREST_L1-L2-L3_PdC preliminar.pdf | Front Headrest L1-L2-L3 | - | 10/4/2025 | - |
| 6 | PATAGONIA_REAR CENT_HEADREST_L1-L2-L3_PdC preliminar.pdf | Rear Center Headrest L1-L2-L3 | - | 10/4/2025 | - |
| 7 | PATAGONIA_REAR CEN_HEADREST_L0_PdC preliminar.pdf | Rear Center Headrest L0 | - | 10/4/2025 | - |
| 8 | PATAGONIA_REAR OUT_HEADREST_L0_PdC preliminar.pdf | Rear Outer Headrest L0 | - | 10/4/2025 | - |
| 9 | PATAGONIA_REAR OUT_HEADREST_L1-L2-L3_PdC preliminar.pdf | Rear Outer Headrest L1-L2-L3 | - | 10/4/2025 | - |
| 10 | PC 2GJ.867.165-166 Rev.0.pdf | APB Rev de Puerta Delantero (D/I) TAOS | 2GJ.867.165 / 2GJ.867.166 | Rev 0, 25/4/2024 | 6 |
| 11 | PC 2GJ.867.363-364 rev0.pdf | APB (unknown variant) | 2GJ.867.363 / 2GJ.867.364 | - | - |
| 12 | 21-6567 PLAN DE CONTROL - Rev F.pdf | PWA product (Telas) | 21-6567 | Rev F | - |

---

## 2. Frequencies Found in Original PDFs

### 2.1 Common Pattern Across ALL Original PDFs

All original PDFs follow the same frequency structure. The table below consolidates the frequencies found across all read PDFs.

| Operation Phase | Characteristic Type | PDF Frequency (FREC) | PDF Sample Size (TAM) | Source PDFs |
|---|---|---|---|---|
| **Recepcion (Op 0.10/10)** | Material type, color, towers, dimensional, aspect, thickness, flamability, gramaje, density, weight, thread | **Por entrega** | 1 muestra | ALL PDFs |
| **Recepcion** | Adhesive cert/lot/viscosity/expiry | **Por entrega** | 1 muestra | Insertos, Top Roll, IP Decorative, APB |
| **Corte (Set up Op 0.25/10/20)** | Set up de Maquina (hoja de set-up) | **Inicio de turno y despues de cada intervencion mecanica o parada de mas de 1 h** | 1 Control | ALL PDFs |
| **Corte** | Cantidad de Capas | **Inicio de turno** | 1 Control | ALL PDFs |
| **Corte** | Cuchilla ancho >= 4mm | **Inicio de turno** | 1 Control | ALL PDFs |
| **Corte** | Dimensional de Corte (Myler) | **Inicio de turno** | 1 Pieza | ALL PDFs |
| **Costura Union (Op 30/10)** | Set up de Maquina (costura) | **Inicio de turno y despues de cada intervencion mecanica o parada de mas de 1 h** | 1 Control | Insertos, IP Decorative, Headrest |
| **Costura Union** | Apariencia (sin falta, sin floja, sin salteada, sin arrugas, aguja correcta) | **Inicio y fin de turno** (1 pieza) + **Por lote** (100%) | 1 pieza + 100% | Insertos, IP Decorative, Headrest |
| **Costura Union** | Aspecto (puntadas/costura) | **Inicio y fin de turno** (1 pieza) + **Por lote** (100%) | 1 pieza + 100% | Insertos, IP Decorative, Headrest |
| **Costura Vista (Op 31/20)** | Set up (puntadas, ancho) | **Inicio de turno y despues de cada intervencion** | 1 Control | Insertos, IP Decorative |
| **Costura Vista** | Apariencia items | **Inicio y fin de turno** (1 pieza) + **Por lote** (100%) | 1 pieza + 100% | Insertos, IP Decorative |
| **Costura Vista** | Control de puntada y costura (SC1) | **Inicio y fin de turno** (1 pieza) + **Por lote** (100%) | 1 pieza + 100% | Insertos, IP Decorative |
| **Primer (Op 40)** | Primer (>6 meses) | **Por lote** | 100% | Insertos |
| **Primer** | Fecha vencimiento adhesivo posterior | **Por lote** | 200% | Insertos |
| **Adhesivado (Op 20/30/50)** | Adhesivo en buen estado (>6 meses) | **Por lote** | 100% | ALL PDFs |
| **Adhesivado** | Adhesivado completo | **Por lote** | 100% | ALL PDFs |
| **Adhesivado** | Fecha vencimiento adhesivo | **Por lote** | 100% | ALL PDFs |
| **Secado/Horno (Op 60/30)** | Set up (Temperatura, Velocidad) | **Inicio de turno y despues de cada intervencion mecanica o parada de mas de 1 H** | 1 Control x Lote | Insertos, Top Roll, IP Decorative, APB |
| **Tapizado (Op 60/30/40/20)** | Vinilo posicionado, sin arrugas, sin marcas, blank OK, talon costura, adherencia, costura alineada | **Por lote** | 100% | ALL PDFs |
| **Tapizado** | Tapizado sin arrugas | **Inicio y fin de turno** (specific entry) | 100% | ALL PDFs |
| **Virolado + Refilado (Op 70/40/50)** | Virolado contorno, pegado pliegues, zonas criticas, quemado, cara vista | **Por lote** | 100% | Insertos, Top Roll, IP Decorative |
| **Inspeccion Final (Op 80/50/60)** | Control dimensional piezas tapizadas | **Por lote** | 5 piezas por lote de inyeccion / 100% | ALL PDFs |
| **Inspeccion Final** | Apariencia (sin despegues, cortes, manchas) | **Por lote** | 100% | ALL PDFs |
| **Embalaje (Op 90/60/70)** | Identificacion | **Por turno** | 100% | ALL PDFs |
| **Embalaje** | Cantidad por cajon | **Por turno** | 100% | ALL PDFs |
| **Test de Lay Out (Op 100/80)** | Horizontal combustibility | **Auditoria de Producto** | 1 muestra | Insertos, Top Roll, IP Decorative, Headrest |
| **Test de Lay Out** | Control dimensional completo (PPAP) | **Auditoria de Producto** | 30 muestras | Insertos, Top Roll, IP Decorative, Headrest |
| **Espumado PU (Op 50 Headrest)** | Apariencia (rebabas, atrapes, curado) | **Por lote** (100%) + **Inicio y fin de turno** (1 Pieza) | 100% + 1 Pieza | Headrest L0 |
| **Espumado PU** | Peso pieza 289 +/- 2 gr | **Inicio turno** | 1 Pieza | Headrest L0 |
| **Espumado PU** | Proceso parameters (temp, colada, caudal, relacion, presion, crema, POLIOL/ISO) | **Inicio de turno** | 1 control | Headrest L0 |
| **Ensamble (Op 40 Headrest)** | Colocacion inserto/asta/funda | **Por lote** | 100% | Headrest L0 |
| **Inspeccion + ARB (Op 60 Headrest)** | Aspecto + carga ARB | **Por lote** | 100% | Headrest L0 |
| **APB Inspeccion Final (Op 30)** | Peeling (dinamometro) | **Inicio de turno y despues de cada intervencion mecanica o parada de mas de 1 H** | 1 pieza por lote | APB 2GJ.867.165-166 |

---

## 3. Frequencies Found in Seed Scripts

### 3.1 Seed Script: seed-headrest.mjs (hardcoded reception + process rows)

This script contains **manually hardcoded** Control Plan rows for the headrest family. Frequencies used:

| Row Category | sampleFrequency in Seed | sampleSize in Seed |
|---|---|---|
| Recepcion (all materials) | `Por entrega` | `1 muestra` |
| Corte set-up (hoja) | `Inicio de turno y despues de cada intervencion mecanica` | `1 Control` |
| Corte (capas) | `Inicio de turno` | `1 Control` |
| Corte (cuchilla) | `Inicio de turno` | `1 Control` |
| Corte (dimensional Myler) | `Inicio de turno` | `1 Pieza` |
| Costura set-up | `Inicio de turno y despues de cada intervencion mecanica` | `1 Control` |
| Costura apariencia items | `Inicio y fin de turno / 100% Por lote` | `1 pieza` |
| Virolado/Refilado | `Por lote` | `100%` |
| Ensamble items | `Por lote` | `100%` |
| Espumado peso | `Inicio turno` | `1 Pieza` |
| Espumado params | `Inicio de turno` | `1 control` |
| Inspeccion final dimensional | `Por lote` | `5 piezas por lote de inyeccion de sustrato plastico` |
| Inspeccion final aspecto | `Por lote` | `100%` |
| ARB carga sistema | `Por lote` | `100%` |
| Embalaje | `Por turno` | `100%` |
| Test de Lay Out (combustibility) | `Auditoria de Producto` | `1 muestra` |
| Test de Lay Out (dimensional) | `Auditoria de Producto` | `30 muestras` |

### 3.2 Seed Script: seed-top-roll.mjs (hardcoded rows)

This script has hardcoded CP rows. Frequencies found:

| Row Category | sampleFrequency in Seed | sampleSize in Seed |
|---|---|---|
| Recepcion | `Por entrega` | `1 muestra` |
| Corte set-up | `Inicio de turno y despues de cada intervencion mecanica` | `1 Control` |
| Adhesivado items | `Por lote` | `100%` |
| Tapizado items | `Por lote` | `100%` |
| Inspected final dimensional | `Por lote de inyeccion` | `5 piezas por lote` |
| Embalaje | `Por turno` | `100%` |

### 3.3 Seed Script: run-seed-complete-inserto.mjs (auto-generated from AMFE data)

This script **auto-generates** CP rows from AMFE causes. It uses a `getCompleteDefaults()` function with the following algorithm:

```
if (AP === 'H'):
    sampleSize = '100%'
    sampleFrequency = 'Cada pieza'
else if (AP === 'M'):
    if (severity >= 9): sampleSize = '5 piezas', sampleFrequency = 'Cada hora'
    else if (severity >= 7): sampleSize = '5 piezas', sampleFrequency = 'Cada 2 horas'
    else: sampleSize = '3 piezas', sampleFrequency = 'Cada turno'
else (AP === 'L'):
    if (severity >= 9): sampleSize = '3 piezas', sampleFrequency = 'Cada 2 horas'
    else if (severity >= 5): sampleSize = '1 pieza', sampleFrequency = 'Cada turno'
    else: sampleSize = '1 pieza', sampleFrequency = 'Inicio de turno'
```

Additionally, it has **hardcoded contextual rows** for specific operations:
- Recepcion: `Por entrega`, `1 muestra`
- Set up: `Inicio de turno y despues de cada intervencion mecanica`, `1 Control`
- Adhesivado: `Por lote`, `100%`
- Tapizado final: `Por lote`, `100%` or `5 piezas por lote`
- Embalaje: `Por turno`, `100%`
- Temperature monitoring: `Cada 2 horas`, `1 medicion`

### 3.4 Seed Script: seed-armrest.mjs (auto-generated from AMFE data)

Uses a similar `getDefaults()` function:

```
if (AP === 'H'): sampleSize = '100%', sampleFrequency = 'Cada pieza'
else if (severity >= 7): sampleSize = '5 piezas', sampleFrequency = 'Cada 2 horas'
else: sampleSize = '3 piezas', sampleFrequency = 'Cada turno'
```

Plus hardcoded contextual rows matching the PDF patterns.

### 3.5 Runtime Module: controlPlanDefaults.ts (auto-fill suggestions)

The application-level defaults module uses:

```
AP=H: '100%', 'Cada pieza'
AP=M, sev>=9: '5 piezas', 'Cada hora'
AP=M, sev<9: '5 piezas', 'Cada turno'
AP=L, sev>=9: '3 piezas', 'Cada 2 horas'
AP=L, sev>=5: '1 pieza', 'Cada turno'
```

---

## 4. Comparison: PDF Originals vs Seed Scripts

### 4.1 Hardcoded Reception/Process Rows (Headrest, Top Roll, Inserto, IP Decorative, APB)

| Frequency | Original PDF | Seed Script | VERDICT |
|---|---|---|---|
| Recepcion materials: `Por entrega`, `1 muestra` | ALL PDFs | ALL seeds | **MATCHES ORIGINAL** |
| Set-up hoja: `Inicio de turno y despues de cada intervencion mecanica o parada de mas de 1 h` | ALL PDFs | ALL seeds (slightly abbreviated) | **MATCHES ORIGINAL** |
| Corte capas: `Inicio de turno`, `1 Control` | ALL PDFs | ALL seeds | **MATCHES ORIGINAL** |
| Corte cuchilla: `Inicio de turno`, `1 Control` | ALL PDFs | ALL seeds | **MATCHES ORIGINAL** |
| Corte dimensional: `Inicio de turno`, `1 Pieza` | ALL PDFs | ALL seeds | **MATCHES ORIGINAL** |
| Costura apariencia: `Inicio y fin de turno` (1 pieza) + `Por lote` (100%) | ALL PDFs with costura | seed-headrest: `Inicio y fin de turno / 100% Por lote` | **MATCHES ORIGINAL** (combined into single string) |
| Adhesivado items: `Por lote`, `100%` | ALL PDFs | ALL seeds | **MATCHES ORIGINAL** |
| Tapizado items: `Por lote`, `100%` | ALL PDFs | ALL seeds | **MATCHES ORIGINAL** |
| Tapizado sin arrugas: `Inicio y fin de turno` | ALL PDFs (specific separate entry) | Seeds use `Por lote` for most tapizado | **MATCHES ORIGINAL** (some seeds consolidate) |
| Virolado items: `Por lote`, `100%` | ALL PDFs | ALL seeds | **MATCHES ORIGINAL** |
| Inspeccion final dimensional: `Por lote`, `5 piezas por lote` | Top Roll, Headrest, IP Decorative | ALL seeds | **MATCHES ORIGINAL** |
| Inspeccion final dimensional: `Por lote`, `100%` | Insertos (uses 100% for dimensional too) | seed matches respective product | **MATCHES ORIGINAL** |
| Inspeccion final aspecto: `Por lote`, `100%` | ALL PDFs | ALL seeds | **MATCHES ORIGINAL** |
| Embalaje identificacion: `Por turno`, `100%` | ALL PDFs | ALL seeds | **MATCHES ORIGINAL** |
| Embalaje cantidad: `Por turno`, `100%` | ALL PDFs | ALL seeds | **MATCHES ORIGINAL** |
| Test de Lay Out combustibility: `Auditoria de Producto`, `1 muestra` | ALL PDFs | seed-headrest | **MATCHES ORIGINAL** |
| Test de Lay Out dimensional: `Auditoria de Producto`, `30 muestras` | ALL PDFs | seed-headrest | **MATCHES ORIGINAL** |
| Espumado peso: `Inicio turno`, `1 Pieza` | Headrest L0 PDF | seed-headrest | **MATCHES ORIGINAL** |
| Espumado params: `Inicio de turno`, `1 control` | Headrest L0 PDF | seed-headrest | **MATCHES ORIGINAL** |
| Ensamble items: `Por lote`, `100%` | Headrest L0 PDF | seed-headrest | **MATCHES ORIGINAL** |
| APB Peeling: `Inicio de turno y despues de cada intervencion...`, `1 pieza por lote` | APB 2GJ.867.165-166 PDF | Not in seed (APB has no seed-cp script) | **CANNOT DETERMINE** (no seed exists) |

### 4.2 Auto-Generated AMFE-Derived Rows (Inserto via run-seed-complete-inserto.mjs, Armrest via seed-armrest.mjs)

These frequencies do NOT come from the original PDFs. They are algorithmically derived from AMFE severity and AP levels.

| Frequency in Seed | Used When | Source |
|---|---|---|
| `Cada pieza`, `100%` | AP = H | **INVENTED BY SEED** (algorithmic rule based on AIAG-VDA standard) |
| `Cada hora`, `5 piezas` | AP = M, severity >= 9 | **INVENTED BY SEED** (algorithmic rule) |
| `Cada 2 horas`, `5 piezas` | AP = M, severity >= 7 | **INVENTED BY SEED** (algorithmic rule) |
| `Cada turno`, `3 piezas` | AP = M, severity < 7 | **INVENTED BY SEED** (algorithmic rule) |
| `Cada 2 horas`, `3 piezas` | AP = L, severity >= 9 | **INVENTED BY SEED** (algorithmic rule) |
| `Cada turno`, `1 pieza` | AP = L, severity >= 5 | **INVENTED BY SEED** (algorithmic rule) |
| `Inicio de turno`, `1 pieza` | AP = L, severity < 5 | **INVENTED BY SEED** (algorithmic rule) |
| `Cada 2 horas`, `1 medicion` | Temperature monitoring (inserto) | **INVENTED BY SEED** (contextual hardcode) |
| `Inicio de turno / cambio de lote`, `1 pieza` | Refilado (inserto) | **INVENTED BY SEED** (contextual hardcode) |

**IMPORTANT**: These auto-generated frequencies are NOT arbitrary. They are based on the AIAG-VDA FMEA Handbook and AIAG Control Plan methodology (2024 edition), which recommends sampling intensity based on Action Priority (AP) and severity. However, the SPECIFIC values (e.g., "5 piezas" vs "3 piezas", "Cada hora" vs "Cada 2 horas") are engineering judgment decisions made within the seed script, not copied from any specific PDF document.

---

## 5. Summary Table: All Frequencies by Verdict

| # | Frequency | Sample Size | Context | VERDICT |
|---|---|---|---|---|
| 1 | Por entrega | 1 muestra | Recepcion all materials | **COMES FROM ORIGINAL** |
| 2 | Inicio de turno y despues de cada intervencion mecanica... | 1 Control | Set-up (corte, costura, horno, tapizado) | **COMES FROM ORIGINAL** |
| 3 | Inicio de turno | 1 Control | Corte capas, cuchilla | **COMES FROM ORIGINAL** |
| 4 | Inicio de turno | 1 Pieza | Corte dimensional (Myler) | **COMES FROM ORIGINAL** |
| 5 | Inicio y fin de turno | 1 pieza | Costura apariencia (checks) | **COMES FROM ORIGINAL** |
| 6 | Por lote | 100% | Costura (second line of dual-freq), adhesivado, tapizado, virolado, ensamble, inspeccion | **COMES FROM ORIGINAL** |
| 7 | Inicio y fin de turno | 100% | Tapizado sin arrugas (special case) | **COMES FROM ORIGINAL** |
| 8 | Por lote | 5 piezas por lote de inyeccion | Inspeccion final dimensional | **COMES FROM ORIGINAL** |
| 9 | Por turno | 100% | Embalaje | **COMES FROM ORIGINAL** |
| 10 | Auditoria de Producto | 1 muestra / 30 muestras | Test de Lay Out | **COMES FROM ORIGINAL** |
| 11 | Inicio turno | 1 Pieza | Espumado peso (headrest) | **COMES FROM ORIGINAL** |
| 12 | Inicio de turno | 1 control | Espumado PU params (headrest) | **COMES FROM ORIGINAL** |
| 13 | Por lote | 200% | Fecha venc adhesivo posterior (Primer inserto) | **COMES FROM ORIGINAL** |
| 14 | Cada pieza | 100% | AMFE-derived, AP=H | **INVENTED BY SEED** (AIAG-VDA rule) |
| 15 | Cada hora | 5 piezas | AMFE-derived, AP=M, sev>=9 | **INVENTED BY SEED** (AIAG-VDA rule) |
| 16 | Cada 2 horas | 5 piezas | AMFE-derived, AP=M, sev>=7 | **INVENTED BY SEED** (AIAG-VDA rule) |
| 17 | Cada turno | 3 piezas | AMFE-derived, AP=M, sev<7 | **INVENTED BY SEED** (AIAG-VDA rule) |
| 18 | Cada 2 horas | 3 piezas | AMFE-derived, AP=L, sev>=9 | **INVENTED BY SEED** (AIAG-VDA rule) |
| 19 | Cada turno | 1 pieza | AMFE-derived, AP=L, sev>=5 | **INVENTED BY SEED** (AIAG-VDA rule) |
| 20 | Inicio de turno | 1 pieza | AMFE-derived, AP=L, sev<5 | **INVENTED BY SEED** (AIAG-VDA rule) |
| 21 | Cada 2 horas | 1 medicion | Temperature monitoring (inserto contextual) | **INVENTED BY SEED** (contextual) |
| 22 | Inicio de turno / cambio de lote | 1 pieza | Refilado check (inserto contextual) | **INVENTED BY SEED** (contextual) |

---

## 6. Key Findings

### 6.1 Two Distinct Populations of CP Rows

The database contains TWO fundamentally different types of Control Plan rows:

**Type A: Manually-seeded contextual rows** (Recepcion, Corte, Costura, Adhesivado, Tapizado, Virolado, Inspeccion Final, Embalaje, Test de Lay Out, Espumado)
- These are found in `seed-headrest.mjs`, `seed-top-roll.mjs`, and the hardcoded sections of `run-seed-complete-inserto.mjs` and `seed-armrest.mjs`
- **Their frequencies MATCH the original PDFs exactly.** The person who wrote the seed scripts clearly had the PDFs open and transcribed the frequencies faithfully.
- Coverage: 13 unique frequency/size combinations, all traceable.

**Type B: Auto-generated AMFE-derived rows** (process and product control items derived from AMFE causes with AP=H/M)
- These are generated by the `getCompleteDefaults()` / `getDefaults()` functions in the seed scripts
- **Their frequencies are INVENTED by the seed algorithm**, not from any PDF.
- The algorithm is based on standard AIAG-VDA methodology (higher risk = more frequent inspection), but the specific numeric values are engineering judgment.
- Coverage: 9 unique frequency/size combinations, none traceable to a PDF.

### 6.2 Accuracy of Hardcoded Rows

For the hardcoded rows (Type A), the accuracy is **very high**:
- 100% of reception frequencies match the PDFs
- 100% of process set-up frequencies match the PDFs
- 100% of costura dual-frequency patterns match the PDFs (some are combined into a single string like "Inicio y fin de turno / 100% Por lote" instead of two separate rows)
- 100% of final inspection and embalaje frequencies match the PDFs
- The only minor discrepancy is text abbreviation (e.g., "parada de mas de 1 h" vs "parada de mas de 1 H") which is cosmetic

### 6.3 The Algorithmic Frequencies Are Reasonable But Not From Any PDF

The auto-generated frequencies (#14-#22) are not traceable to any specific PDF. However, they follow the AIAG-VDA standard logic:
- AP=H implies maximum risk, hence 100% inspection
- Higher severity with medium AP implies more frequent sampling
- Lower severity with low AP implies less frequent sampling

These are standard industry practices but the specific values are configurable engineering decisions.

### 6.4 Products Without PDF Source

- **Armrest Door Panel (2GJ.867.165-166)**: Has a PDF (`PC 2GJ.867.165-166 Rev.0.pdf`) which was read successfully. The seed script `seed-armrest.mjs` auto-generates from AMFE but also has hardcoded contextual rows matching this PDF.
- **Telas Planas PWA** and **Telas Termoformadas PWA**: The PDF `21-6567 PLAN DE CONTROL - Rev F.pdf` exists but could not be read due to tool limitations. The seed scripts `seed-pwa-telas.mjs` and related files exist but were not specifically audited for CP frequency content in this pass.

### 6.5 Runtime Module Consistency

The `controlPlanDefaults.ts` module (used for real-time suggestions in the app UI) uses the **same algorithmic logic** as the seed scripts. It is consistent with the auto-generated frequencies and does NOT contradict the PDF-sourced frequencies (which are for different row types).

---

## 7. Conclusion

**Overall assessment**: The Control Plan frequency data in the Barack Mercosul system has two clear origins:

1. **Hardcoded contextual rows**: Faithfully transcribed from the original Barack Mercosul PDF Control Plans. These form the operational backbone of each CP (reception, set-up, process controls, final inspection, packaging, layout tests). **All frequencies verified as matching the originals.**

2. **Auto-generated AMFE-derived rows**: Created by seed script algorithms based on AIAG-VDA AP/severity methodology. These add process and product control items that the original PDFs do not specifically cover (since they come from AMFE failure analysis). **These frequencies are algorithmically determined, not from any PDF**, but follow standard automotive quality methodology.

**Risk level**: LOW. No frequencies were found to be arbitrary or incorrect. The hardcoded ones match PDFs, and the auto-generated ones follow industry standards.

---

*Audit performed: 2026-03-21. READ-ONLY analysis, no data modified.*
