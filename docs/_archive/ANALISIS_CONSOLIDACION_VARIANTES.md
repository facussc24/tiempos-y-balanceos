# Analisis de Consolidacion de Variantes Headrest

Fecha: 2026-03-26
Generado automaticamente por `scripts/analyze-headrest-consolidation.mjs`

## Resumen

| Familia | Modulo | L1 vs Master | L2 vs Master | L3 vs Master |
|---------|--------|-------------|-------------|-------------|
| Headrest Front | AMFE | IDENTICO | IDENTICO | IDENTICO |
| Headrest Front | CP | DIFERENTE | DIFERENTE | DIFERENTE |
| Headrest Front | HO | DIFERENTE | DIFERENTE | DIFERENTE |
| Headrest Rear Center | AMFE | IDENTICO | IDENTICO | IDENTICO |
| Headrest Rear Center | CP | DIFERENTE | DIFERENTE | DIFERENTE |
| Headrest Rear Center | HO | DIFERENTE | DIFERENTE | DIFERENTE |
| Headrest Rear Outer | AMFE | IDENTICO | IDENTICO | IDENTICO |
| Headrest Rear Outer | CP | DIFERENTE | DIFERENTE | DIFERENTE |
| Headrest Rear Outer | HO | DIFERENTE | DIFERENTE | DIFERENTE |

| Familia | Modulo | L0 vs Master | | |
|---------|--------|-------------|---|---|
| Insert | AMFE | DIFERENTE | | |
| Insert | CP | DIFERENTE | | |
| Insert | HO | No existe | | |

## Detalle por familia

### Headrest Front

#### AMFE

**[L1] vs Master:**

- Contenido: **IDENTICO** (9 operations, solo difieren UUIDs/linkeos)
- Header: 4 campo(s) distinto(s):
  - `subject`: master=`Apoyacabezas Delantero Con Costura Vista - Patagonia` / variante=`PATAGONIA - FRONT HEADREST, Passenger / Driver, L1 (2HC881901A GFV)`
  - `amfeNumber`: master=`AMFE-151` / variante=`AMFE-HR-FRONT-L1`
  - `partNumber`: master=`Apoyacabezas Delantero Con Costura Vista - Patagonia` / variante=`2HC881901A GFV`
  - `applicableParts`: master=`` / variante=`2HC881901A GFV`

**[L2] vs Master:**

- Contenido: **IDENTICO** (9 operations, solo difieren UUIDs/linkeos)
- Header: 4 campo(s) distinto(s):
  - `subject`: master=`Apoyacabezas Delantero Con Costura Vista - Patagonia` / variante=`PATAGONIA - FRONT HEADREST, Passenger / Driver, L2 (2HC881901B GEV)`
  - `amfeNumber`: master=`AMFE-151` / variante=`AMFE-HR-FRONT-L2`
  - `partNumber`: master=`Apoyacabezas Delantero Con Costura Vista - Patagonia` / variante=`2HC881901B GEV`
  - `applicableParts`: master=`` / variante=`2HC881901B GEV`

**[L3] vs Master:**

- Contenido: **IDENTICO** (9 operations, solo difieren UUIDs/linkeos)
- Header: 4 campo(s) distinto(s):
  - `subject`: master=`Apoyacabezas Delantero Con Costura Vista - Patagonia` / variante=`PATAGONIA - FRONT HEADREST, Passenger / Driver, L3 (2HC881901C EFG)`
  - `amfeNumber`: master=`AMFE-151` / variante=`AMFE-HR-FRONT-L3`
  - `partNumber`: master=`Apoyacabezas Delantero Con Costura Vista - Patagonia` / variante=`2HC881901C EFG`
  - `applicableParts`: master=`` / variante=`2HC881901C EFG`

#### CP

**[L1] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de items: master=63, variante=63
  Total items con diferencias: 63 de 63
  Campos afectados:
    - processDescription: 61 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - processStepNumber: 32 items
      ej item 31: master="40" / variante="30.2"
    - amfeSeverity: 20 items (derivado AMFE)
      ej item 40: master="9" / variante="8"
    - specialCharClass: 18 items (derivado AMFE)
      ej item 40: master="CC" / variante=""
    - amfeAp: 18 items (derivado AMFE)
      ej item 40: master="H" / variante="M"
```
- Header: 5 campo(s) distinto(s):
  - `controlPlanNumber`: master=`CP-HR-FRONT-L0` / variante=`CP-HR-FRONT-L1`
  - `partNumber`: master=`XXX.881.900` / variante=`2HC881901A GFV`
  - `partName`: master=`PATAGONIA - FRONT HEADREST, Passenger / Driver, LO (pvc)` / variante=`PATAGONIA - FRONT HEADREST, Passenger / Driver, L1 (2HC881901A GFV)`
  - `applicableParts`: master=`XXX.881.900` / variante=`2HC881901A GFV`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_FRONT` / variante=`VWA/PATAGONIA/HEADREST_FRONT [L1]`

**[L2] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de items: master=63, variante=63
  Total items con diferencias: 63 de 63
  Campos afectados:
    - processDescription: 61 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - processStepNumber: 32 items
      ej item 31: master="40" / variante="30.2"
    - amfeSeverity: 20 items (derivado AMFE)
      ej item 40: master="9" / variante="8"
    - specialCharClass: 18 items (derivado AMFE)
      ej item 40: master="CC" / variante=""
    - amfeAp: 18 items (derivado AMFE)
      ej item 40: master="H" / variante="M"
```
- Header: 5 campo(s) distinto(s):
  - `controlPlanNumber`: master=`CP-HR-FRONT-L0` / variante=`CP-HR-FRONT-L2`
  - `partNumber`: master=`XXX.881.900` / variante=`2HC881901B GEV`
  - `partName`: master=`PATAGONIA - FRONT HEADREST, Passenger / Driver, LO (pvc)` / variante=`PATAGONIA - FRONT HEADREST, Passenger / Driver, L2 (2HC881901B GEV)`
  - `applicableParts`: master=`XXX.881.900` / variante=`2HC881901B GEV`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_FRONT` / variante=`VWA/PATAGONIA/HEADREST_FRONT [L2]`

**[L3] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de items: master=63, variante=63
  Total items con diferencias: 63 de 63
  Campos afectados:
    - processDescription: 61 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - processStepNumber: 32 items
      ej item 31: master="40" / variante="30.2"
    - amfeSeverity: 20 items (derivado AMFE)
      ej item 40: master="9" / variante="8"
    - specialCharClass: 18 items (derivado AMFE)
      ej item 40: master="CC" / variante=""
    - amfeAp: 18 items (derivado AMFE)
      ej item 40: master="H" / variante="M"
```
- Header: 5 campo(s) distinto(s):
  - `controlPlanNumber`: master=`CP-HR-FRONT-L0` / variante=`CP-HR-FRONT-L3`
  - `partNumber`: master=`XXX.881.900` / variante=`2HC881901C EFG`
  - `partName`: master=`PATAGONIA - FRONT HEADREST, Passenger / Driver, LO (pvc)` / variante=`PATAGONIA - FRONT HEADREST, Passenger / Driver, L3 (2HC881901C EFG)`
  - `applicableParts`: master=`XXX.881.900` / variante=`2HC881901C EFG`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_FRONT` / variante=`VWA/PATAGONIA/HEADREST_FRONT [L3]`

#### HO

**[L1] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de sheets: master=9, variante=8
  (distinta cantidad de items — no se compara item-a-item)
```
- Header: 5 campo(s) distinto(s):
  - `partNumber`: master=`XXX.881.900` / variante=`2HC881901A GFV`
  - `partDescription`: master=`PATAGONIA - FRONT HEADREST, Passenger / Driver, LO (pvc)` / variante=`PATAGONIA - FRONT HEADREST, Passenger / Driver, L1 (2HC881901A GFV)`
  - `applicableParts`: master=`XXX.881.900` / variante=`2HC881901A GFV`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_FRONT` / variante=`VWA/PATAGONIA/HEADREST_FRONT [L1]`
  - `linkedCpProject`: master=`VWA/PATAGONIA/HEADREST_FRONT` / variante=`VWA/PATAGONIA/HEADREST_FRONT [L1]`

**[L2] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de sheets: master=9, variante=8
  (distinta cantidad de items — no se compara item-a-item)
```
- Header: 5 campo(s) distinto(s):
  - `partNumber`: master=`XXX.881.900` / variante=`2HC881901B GEV`
  - `partDescription`: master=`PATAGONIA - FRONT HEADREST, Passenger / Driver, LO (pvc)` / variante=`PATAGONIA - FRONT HEADREST, Passenger / Driver, L2 (2HC881901B GEV)`
  - `applicableParts`: master=`XXX.881.900` / variante=`2HC881901B GEV`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_FRONT` / variante=`VWA/PATAGONIA/HEADREST_FRONT [L2]`
  - `linkedCpProject`: master=`VWA/PATAGONIA/HEADREST_FRONT` / variante=`VWA/PATAGONIA/HEADREST_FRONT [L2]`

**[L3] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de sheets: master=9, variante=8
  (distinta cantidad de items — no se compara item-a-item)
```
- Header: 5 campo(s) distinto(s):
  - `partNumber`: master=`XXX.881.900` / variante=`2HC881901C EFG`
  - `partDescription`: master=`PATAGONIA - FRONT HEADREST, Passenger / Driver, LO (pvc)` / variante=`PATAGONIA - FRONT HEADREST, Passenger / Driver, L3 (2HC881901C EFG)`
  - `applicableParts`: master=`XXX.881.900` / variante=`2HC881901C EFG`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_FRONT` / variante=`VWA/PATAGONIA/HEADREST_FRONT [L3]`
  - `linkedCpProject`: master=`VWA/PATAGONIA/HEADREST_FRONT` / variante=`VWA/PATAGONIA/HEADREST_FRONT [L3]`

### Headrest Rear Center

#### AMFE

**[L1] vs Master:**

- Contenido: **IDENTICO** (8 operations, solo difieren UUIDs/linkeos)
- Header: 4 campo(s) distinto(s):
  - `subject`: master=`Apoyacabezas Trasero Central Con Costura Vista - Patagonia` / variante=`PATAGONIA - REAR HEADREST, CENTER, L1 (2HC885900A EIF)`
  - `amfeNumber`: master=`AMFE-153` / variante=`AMFE-HR-REAR_CEN-L1`
  - `partNumber`: master=`Apoyacabezas Trasero Central Con Costura Vista - Patagonia` / variante=`2HC885900A EIF`
  - `applicableParts`: master=`` / variante=`2HC885900A EIF`

**[L2] vs Master:**

- Contenido: **IDENTICO** (8 operations, solo difieren UUIDs/linkeos)
- Header: 4 campo(s) distinto(s):
  - `subject`: master=`Apoyacabezas Trasero Central Con Costura Vista - Patagonia` / variante=`PATAGONIA - REAR HEADREST, CENTER, L2 (2HC885900B SIY)`
  - `amfeNumber`: master=`AMFE-153` / variante=`AMFE-HR-REAR_CEN-L2`
  - `partNumber`: master=`Apoyacabezas Trasero Central Con Costura Vista - Patagonia` / variante=`2HC885900B SIY`
  - `applicableParts`: master=`` / variante=`2HC885900B SIY`

**[L3] vs Master:**

- Contenido: **IDENTICO** (8 operations, solo difieren UUIDs/linkeos)
- Header: 4 campo(s) distinto(s):
  - `subject`: master=`Apoyacabezas Trasero Central Con Costura Vista - Patagonia` / variante=`PATAGONIA - REAR HEADREST, CENTER, L3 (2HC885900C SIY)`
  - `amfeNumber`: master=`AMFE-153` / variante=`AMFE-HR-REAR_CEN-L3`
  - `partNumber`: master=`Apoyacabezas Trasero Central Con Costura Vista - Patagonia` / variante=`2HC885900C SIY`
  - `applicableParts`: master=`` / variante=`2HC885900C SIY`

#### CP

**[L1] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de items: master=61, variante=61
  Total items con diferencias: 61 de 61
  Campos afectados:
    - processDescription: 59 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - processStepNumber: 30 items
      ej item 31: master="40" / variante="30.2"
    - amfeSeverity: 2 items (derivado AMFE)
      ej item 40: master="4" / variante="8"
    - amfeAp: 1 items (derivado AMFE)
      ej item 40: master="L" / variante="M"
```
- Header: 5 campo(s) distinto(s):
  - `controlPlanNumber`: master=`CP-HR-REAR_CEN-L0` / variante=`CP-HR-REAR_CEN-L1`
  - `partNumber`: master=`XXX.885.900` / variante=`2HC885900A EIF`
  - `partName`: master=`PATAGONIA - REAR HEADREST, CENTER, L0 (pvc)` / variante=`PATAGONIA - REAR HEADREST, CENTER, L1 (2HC885900A EIF)`
  - `applicableParts`: master=`XXX.885.900` / variante=`2HC885900A EIF`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_REAR_CEN` / variante=`VWA/PATAGONIA/HEADREST_REAR_CEN [L1]`

**[L2] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de items: master=61, variante=61
  Total items con diferencias: 61 de 61
  Campos afectados:
    - processDescription: 59 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - processStepNumber: 30 items
      ej item 31: master="40" / variante="30.2"
    - amfeSeverity: 2 items (derivado AMFE)
      ej item 40: master="4" / variante="8"
    - amfeAp: 1 items (derivado AMFE)
      ej item 40: master="L" / variante="M"
```
- Header: 5 campo(s) distinto(s):
  - `controlPlanNumber`: master=`CP-HR-REAR_CEN-L0` / variante=`CP-HR-REAR_CEN-L2`
  - `partNumber`: master=`XXX.885.900` / variante=`2HC885900B SIY`
  - `partName`: master=`PATAGONIA - REAR HEADREST, CENTER, L0 (pvc)` / variante=`PATAGONIA - REAR HEADREST, CENTER, L2 (2HC885900B SIY)`
  - `applicableParts`: master=`XXX.885.900` / variante=`2HC885900B SIY`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_REAR_CEN` / variante=`VWA/PATAGONIA/HEADREST_REAR_CEN [L2]`

**[L3] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de items: master=61, variante=61
  Total items con diferencias: 61 de 61
  Campos afectados:
    - processDescription: 59 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - processStepNumber: 30 items
      ej item 31: master="40" / variante="30.2"
    - amfeSeverity: 2 items (derivado AMFE)
      ej item 40: master="4" / variante="8"
    - amfeAp: 1 items (derivado AMFE)
      ej item 40: master="L" / variante="M"
```
- Header: 5 campo(s) distinto(s):
  - `controlPlanNumber`: master=`CP-HR-REAR_CEN-L0` / variante=`CP-HR-REAR_CEN-L3`
  - `partNumber`: master=`XXX.885.900` / variante=`2HC885900C SIY`
  - `partName`: master=`PATAGONIA - REAR HEADREST, CENTER, L0 (pvc)` / variante=`PATAGONIA - REAR HEADREST, CENTER, L3 (2HC885900C SIY)`
  - `applicableParts`: master=`XXX.885.900` / variante=`2HC885900C SIY`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_REAR_CEN` / variante=`VWA/PATAGONIA/HEADREST_REAR_CEN [L3]`

#### HO

**[L1] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de sheets: master=8, variante=8
  Total items con diferencias: 8 de 8
  Campos afectados:
    - steps: 8 items
      ej item 0: master="[7 items]" / variante="[5 items]"
    - qualityChecks: 8 items
      ej item 0: master="[14 items]" / variante="[0 items]"
    - operationName: 7 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - safetyElements: 1 items
      ej item 4: master="[5 items]" / variante="[3 items]"
```
- Header: 5 campo(s) distinto(s):
  - `partNumber`: master=`XXX.885.900` / variante=`2HC885900A EIF`
  - `partDescription`: master=`PATAGONIA - REAR HEADREST, CENTER, L0 (pvc)` / variante=`PATAGONIA - REAR HEADREST, CENTER, L1 (2HC885900A EIF)`
  - `applicableParts`: master=`XXX.885.900` / variante=`2HC885900A EIF`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_REAR_CEN` / variante=`VWA/PATAGONIA/HEADREST_REAR_CEN [L1]`
  - `linkedCpProject`: master=`VWA/PATAGONIA/HEADREST_REAR_CEN` / variante=`VWA/PATAGONIA/HEADREST_REAR_CEN [L1]`

**[L2] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de sheets: master=8, variante=8
  Total items con diferencias: 8 de 8
  Campos afectados:
    - steps: 8 items
      ej item 0: master="[7 items]" / variante="[5 items]"
    - qualityChecks: 8 items
      ej item 0: master="[14 items]" / variante="[0 items]"
    - operationName: 7 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - safetyElements: 1 items
      ej item 4: master="[5 items]" / variante="[3 items]"
```
- Header: 5 campo(s) distinto(s):
  - `partNumber`: master=`XXX.885.900` / variante=`2HC885900B SIY`
  - `partDescription`: master=`PATAGONIA - REAR HEADREST, CENTER, L0 (pvc)` / variante=`PATAGONIA - REAR HEADREST, CENTER, L2 (2HC885900B SIY)`
  - `applicableParts`: master=`XXX.885.900` / variante=`2HC885900B SIY`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_REAR_CEN` / variante=`VWA/PATAGONIA/HEADREST_REAR_CEN [L2]`
  - `linkedCpProject`: master=`VWA/PATAGONIA/HEADREST_REAR_CEN` / variante=`VWA/PATAGONIA/HEADREST_REAR_CEN [L2]`

**[L3] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de sheets: master=8, variante=8
  Total items con diferencias: 8 de 8
  Campos afectados:
    - steps: 8 items
      ej item 0: master="[7 items]" / variante="[5 items]"
    - qualityChecks: 8 items
      ej item 0: master="[14 items]" / variante="[0 items]"
    - operationName: 7 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - safetyElements: 1 items
      ej item 4: master="[5 items]" / variante="[3 items]"
```
- Header: 5 campo(s) distinto(s):
  - `partNumber`: master=`XXX.885.900` / variante=`2HC885900C SIY`
  - `partDescription`: master=`PATAGONIA - REAR HEADREST, CENTER, L0 (pvc)` / variante=`PATAGONIA - REAR HEADREST, CENTER, L3 (2HC885900C SIY)`
  - `applicableParts`: master=`XXX.885.900` / variante=`2HC885900C SIY`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_REAR_CEN` / variante=`VWA/PATAGONIA/HEADREST_REAR_CEN [L3]`
  - `linkedCpProject`: master=`VWA/PATAGONIA/HEADREST_REAR_CEN` / variante=`VWA/PATAGONIA/HEADREST_REAR_CEN [L3]`

### Headrest Rear Outer

#### AMFE

**[L1] vs Master:**

- Contenido: **IDENTICO** (8 operations, solo difieren UUIDs/linkeos)
- Header: 4 campo(s) distinto(s):
  - `subject`: master=`Apoyacabezas Trasero Lateral Con Costura Vista - Patagonia` / variante=`PATAGONIA - REAR HEADREST, OUTER, L1 (2HC885901A GFU)`
  - `amfeNumber`: master=`AMFE-155` / variante=`AMFE-HR-REAR_OUT-L1`
  - `partNumber`: master=`Apoyacabezas Trasero Lateral Con Costura Vista - Patagonia` / variante=`2HC885901A GFU`
  - `applicableParts`: master=`` / variante=`2HC885901A GFU`

**[L2] vs Master:**

- Contenido: **IDENTICO** (8 operations, solo difieren UUIDs/linkeos)
- Header: 4 campo(s) distinto(s):
  - `subject`: master=`Apoyacabezas Trasero Lateral Con Costura Vista - Patagonia` / variante=`PATAGONIA - REAR HEADREST, OUTER, L2 (2HC885901B GEQ)`
  - `amfeNumber`: master=`AMFE-155` / variante=`AMFE-HR-REAR_OUT-L2`
  - `partNumber`: master=`Apoyacabezas Trasero Lateral Con Costura Vista - Patagonia` / variante=`2HC885901B GEQ`
  - `applicableParts`: master=`` / variante=`2HC885901B GEQ`

**[L3] vs Master:**

- Contenido: **IDENTICO** (8 operations, solo difieren UUIDs/linkeos)
- Header: 4 campo(s) distinto(s):
  - `subject`: master=`Apoyacabezas Trasero Lateral Con Costura Vista - Patagonia` / variante=`PATAGONIA - REAR HEADREST, OUTER, L3 (2HC885901C DZS)`
  - `amfeNumber`: master=`AMFE-155` / variante=`AMFE-HR-REAR_OUT-L3`
  - `partNumber`: master=`Apoyacabezas Trasero Lateral Con Costura Vista - Patagonia` / variante=`2HC885901C DZS`
  - `applicableParts`: master=`` / variante=`2HC885901C DZS`

#### CP

**[L1] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de items: master=63, variante=63
  Total items con diferencias: 63 de 63
  Campos afectados:
    - processDescription: 61 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - processStepNumber: 32 items
      ej item 31: master="40" / variante="30.2"
    - amfeSeverity: 4 items (derivado AMFE)
      ej item 40: master="4" / variante="8"
    - amfeAp: 3 items (derivado AMFE)
      ej item 40: master="L" / variante="M"
```
- Header: 5 campo(s) distinto(s):
  - `controlPlanNumber`: master=`CP-HR-REAR_OUT-L0` / variante=`CP-HR-REAR_OUT-L1`
  - `partNumber`: master=`XXX.885.901` / variante=`2HC885901A GFU`
  - `partName`: master=`PATAGONIA - REAR HEADREST, OUTER, LO (pvc)` / variante=`PATAGONIA - REAR HEADREST, OUTER, L1 (2HC885901A GFU)`
  - `applicableParts`: master=`XXX.885.901` / variante=`2HC885901A GFU`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_REAR_OUT` / variante=`VWA/PATAGONIA/HEADREST_REAR_OUT [L1]`

**[L2] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de items: master=63, variante=63
  Total items con diferencias: 63 de 63
  Campos afectados:
    - processDescription: 61 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - processStepNumber: 32 items
      ej item 31: master="40" / variante="30.2"
    - amfeSeverity: 4 items (derivado AMFE)
      ej item 40: master="4" / variante="8"
    - amfeAp: 3 items (derivado AMFE)
      ej item 40: master="L" / variante="M"
```
- Header: 5 campo(s) distinto(s):
  - `controlPlanNumber`: master=`CP-HR-REAR_OUT-L0` / variante=`CP-HR-REAR_OUT-L2`
  - `partNumber`: master=`XXX.885.901` / variante=`2HC885901B GEQ`
  - `partName`: master=`PATAGONIA - REAR HEADREST, OUTER, LO (pvc)` / variante=`PATAGONIA - REAR HEADREST, OUTER, L2 (2HC885901B GEQ)`
  - `applicableParts`: master=`XXX.885.901` / variante=`2HC885901B GEQ`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_REAR_OUT` / variante=`VWA/PATAGONIA/HEADREST_REAR_OUT [L2]`

**[L3] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de items: master=63, variante=63
  Total items con diferencias: 63 de 63
  Campos afectados:
    - processDescription: 61 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - processStepNumber: 32 items
      ej item 31: master="40" / variante="30.2"
    - amfeSeverity: 4 items (derivado AMFE)
      ej item 40: master="4" / variante="8"
    - amfeAp: 3 items (derivado AMFE)
      ej item 40: master="L" / variante="M"
```
- Header: 5 campo(s) distinto(s):
  - `controlPlanNumber`: master=`CP-HR-REAR_OUT-L0` / variante=`CP-HR-REAR_OUT-L3`
  - `partNumber`: master=`XXX.885.901` / variante=`2HC885901C DZS`
  - `partName`: master=`PATAGONIA - REAR HEADREST, OUTER, LO (pvc)` / variante=`PATAGONIA - REAR HEADREST, OUTER, L3 (2HC885901C DZS)`
  - `applicableParts`: master=`XXX.885.901` / variante=`2HC885901C DZS`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_REAR_OUT` / variante=`VWA/PATAGONIA/HEADREST_REAR_OUT [L3]`

#### HO

**[L1] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de sheets: master=8, variante=8
  Total items con diferencias: 8 de 8
  Campos afectados:
    - steps: 8 items
      ej item 0: master="[7 items]" / variante="[5 items]"
    - qualityChecks: 8 items
      ej item 0: master="[14 items]" / variante="[0 items]"
    - operationName: 7 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - safetyElements: 1 items
      ej item 4: master="[5 items]" / variante="[3 items]"
```
- Header: 5 campo(s) distinto(s):
  - `partNumber`: master=`XXX.885.901` / variante=`2HC885901A GFU`
  - `partDescription`: master=`PATAGONIA - REAR HEADREST, OUTER, LO (pvc)` / variante=`PATAGONIA - REAR HEADREST, OUTER, L1 (2HC885901A GFU)`
  - `applicableParts`: master=`XXX.885.901` / variante=`2HC885901A GFU`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_REAR_OUT` / variante=`VWA/PATAGONIA/HEADREST_REAR_OUT [L1]`
  - `linkedCpProject`: master=`VWA/PATAGONIA/HEADREST_REAR_OUT` / variante=`VWA/PATAGONIA/HEADREST_REAR_OUT [L1]`

**[L2] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de sheets: master=8, variante=8
  Total items con diferencias: 8 de 8
  Campos afectados:
    - steps: 8 items
      ej item 0: master="[7 items]" / variante="[5 items]"
    - qualityChecks: 8 items
      ej item 0: master="[14 items]" / variante="[0 items]"
    - operationName: 7 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - safetyElements: 1 items
      ej item 4: master="[5 items]" / variante="[3 items]"
```
- Header: 5 campo(s) distinto(s):
  - `partNumber`: master=`XXX.885.901` / variante=`2HC885901B GEQ`
  - `partDescription`: master=`PATAGONIA - REAR HEADREST, OUTER, LO (pvc)` / variante=`PATAGONIA - REAR HEADREST, OUTER, L2 (2HC885901B GEQ)`
  - `applicableParts`: master=`XXX.885.901` / variante=`2HC885901B GEQ`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_REAR_OUT` / variante=`VWA/PATAGONIA/HEADREST_REAR_OUT [L2]`
  - `linkedCpProject`: master=`VWA/PATAGONIA/HEADREST_REAR_OUT` / variante=`VWA/PATAGONIA/HEADREST_REAR_OUT [L2]`

**[L3] vs Master:**

- Contenido: **DIFERENTE**
```
Cantidad de sheets: master=8, variante=8
  Total items con diferencias: 8 de 8
  Campos afectados:
    - steps: 8 items
      ej item 0: master="[7 items]" / variante="[5 items]"
    - qualityChecks: 8 items
      ej item 0: master="[14 items]" / variante="[0 items]"
    - operationName: 7 items
      ej item 0: master="RECEPCIONAR MATERIA PRIMA" / variante="Recepcion"
    - safetyElements: 1 items
      ej item 4: master="[5 items]" / variante="[3 items]"
```
- Header: 5 campo(s) distinto(s):
  - `partNumber`: master=`XXX.885.901` / variante=`2HC885901C DZS`
  - `partDescription`: master=`PATAGONIA - REAR HEADREST, OUTER, LO (pvc)` / variante=`PATAGONIA - REAR HEADREST, OUTER, L3 (2HC885901C DZS)`
  - `applicableParts`: master=`XXX.885.901` / variante=`2HC885901C DZS`
  - `linkedAmfeProject`: master=`VWA/PATAGONIA/HEADREST_REAR_OUT` / variante=`VWA/PATAGONIA/HEADREST_REAR_OUT [L3]`
  - `linkedCpProject`: master=`VWA/PATAGONIA/HEADREST_REAR_OUT` / variante=`VWA/PATAGONIA/HEADREST_REAR_OUT [L3]`

## Insert: Master vs [L0]

### AMFE

- Contenido: **DIFERENTE**
```
Cantidad de operations: master=22, variante=22
  Total items con diferencias: 22 de 22
  Campos afectados:
    - workElements: 22 items
      ej item 0: master="[6 items]" / variante="[6 items]"
```
- Header: 2 campo(s) distinto(s):
  - `subject`: master=`INSERTO` / variante=`INSERT [L0]`
  - `amfeNumber`: master=`AMFE-00001` / variante=`AMFE-00001 [L0]`

### CP

- Contenido: **DIFERENTE**
```
Cantidad de items: master=315, variante=210
  (distinta cantidad de items — no se compara item-a-item)
```
- Header: 3 campo(s) distinto(s):
  - `controlPlanNumber`: master=`CP-INSERT-001` / variante=`CP-INSERT-001 [L0]`
  - `partName`: master=`INSERT TAPIZADO` / variante=`INSERT TAPIZADO [L0]`
  - `itemCount`: master=`314` / variante=`undefined`

### HO

Variante [L0] no existe en la base de datos.

## Recomendacion

### Estadisticas

- Total de comparaciones realizadas: 30
- Contenido identico (solo difieren UUIDs y headers): 9
- Contenido diferente: 20
- Variantes no encontradas: 1

### Conclusion

Se encontraron 20 comparaciones con diferencias de contenido (9 identicas, 1 no encontradas).

#### Por modulo:

**AMFE:** Todas las variantes (L1, L2, L3) tienen contenido identico al master en las 3 familias headrest. Las operaciones, work elements, modos de falla, causas y controles son los mismos. Solo difieren los headers. **Consolidable inmediatamente.**

**CP:** Todas las variantes muestran diferencias reales vs el master. Los campos que difieren son:
- `processDescription`: nombres de operacion distintos (ej. master usa mayusculas con nombres actualizados, variante tiene los nombres originales del clonado)
- `processStepNumber`: numeracion de pasos distinta (el master fue re-numerado)
- `specialCharClass`, `amfeAp`, `amfeSeverity`: clasificaciones derivadas del AMFE que no se propagaron

Estas diferencias son **accidentales**: el master fue mejorado/corregido despues del clonado y los cambios no se propagaron a las variantes. El proceso productivo es el mismo para todas las variantes de color.

**HO:** Mismo patron que CP. Las variantes tienen nombres de operacion y controles de calidad del momento del clonado, no las versiones actualizadas del master. Headrest Front master tiene 9 sheets vs 8 en variantes (se agrego una sheet al master despues del clonado).

#### Diagnostico general

Las diferencias en CP y HO **no son intencionales**. Son el resultado de:

1. Las variantes se crearon clonando el master con `regenerateUuids()`
2. Despues del clonado, el master recibio mejoras (renombrado de operaciones a mayusculas, re-numeracion de pasos, correccion de clasificaciones CC/SC)
3. Esos cambios no se propagaron a las variantes

#### Recomendacion

Dado que el proceso productivo es identico para todas las variantes de color dentro de cada familia headrest, se recomienda:

1. **Consolidar cada familia** en un unico juego de documentos (AMFE + CP + HO + PFD)
2. Listar todos los part numbers en `applicableParts` del header
3. Eliminar los 27 documentos variante (3 familias x 3 variantes x 3 modulos)
4. Esto eliminaria el riesgo de desincronizacion y simplificaria el mantenimiento

Alternativa menos invasiva: propagar los cambios del master a todas las variantes (usando el sistema de herencia existente), pero esto mantiene la complejidad de tener multiples documentos identicos.

