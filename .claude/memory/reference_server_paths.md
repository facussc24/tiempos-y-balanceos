---
name: Rutas de archivos de referencia en servidor
description: Paths del servidor donde estan los AMFEs, PCs, flujogramas y documentacion de referencia para VWA y PWA
type: reference
---

## VWA — Patagonia (base path: `\\SERVER\compartido\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\VW\VW427-1LA_K-PATAGONIA\`)

### Headrest
- **APQP**: `Headrest\APQP\`
  - AMFEs: `22- FMEA de proceso\AMFE - Apoyacabezas [Delantero|Central|Lateral] Preliminar Rev.1 - Patagonia.xlsx`
  - Plan de Control: `12-Plan de Control\PATAGONIA_[FRONT|REAR CENT|REAR OUT]_HEADREST_[L0|L1-L2-L3]_PdC preliminar.pdf`
  - Flujograma: `20- Flujograma de proceso\FLUJOGRAMA_152_APC DEL - LAT -CEN_PATAGONIA_REV.A.pdf`

### Armrest Rear
- **APQP**: `Armrest Rear\1-APQP\`
  - AMFE: `22- FMEA de proceso\AMFE - Apb Tra Rev.1 - Patagonia.xlsx`
  - Plan de Control: `12-Plan de Control\PATAGONIA-ARMREST REAR L3_PdC_Preliminar.pdf`
  - Flujograma: `20- Flujograma de proceso\FLUJOGRAMA_151_ APB TRA CEN_PATAGONIA_REV.A.pdf`

### IP PADs (producto nuevo, no en las 8 familias actuales)
- **APQP**: `IP PADs\APQP\`
  - AMFE: `22- FMEA de proceso\PATAGONIA_TRIM ASM-UPR WRAPPING_AMFE-Rev.1_Preliminar.xlsx`

### Insert, Top Roll
- AMFEs como PDF extraidos localmente (no tienen path estable en server)

### Normas VW
- Carpeta: `Normas\` — contiene TL 1010, PV 1303, VW 01054, VW 50106, etc.
- Referencia: `Automotive_Stitching_Technical_Parameters.pdf` (parametros de costura)

## PWA — Hilux

- **Telas Planas 581D**: `\\SERVER\compartido\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\PWA\1- TOYOTA_TELAS_ PLANAS_581D\APQP\`
- **Telas Termoformadas 582D**: `\\SERVER\compartido\BARACK\CALIDAD\DOCUMENTACION SGC\PPAP CLIENTES\PWA\2-TOYOTA_TELAS_TERMOFORMADAS_582D\APQP\`

## Datos extraidos (backups locales)

- PDFs VWA: `backups/amfe_pdfs/` (Top Roll 83 filas, Inserto 161 filas, Armrest 153 filas)
- Excel Headrest: `backups/amfe_headrest/` (Delantero 619 filas, Central 549 filas, Lateral 549 filas)
- Excel Armrest Rear: `backups/amfe_armrest_excel/` (amfe_armrest_rear.json — extraido del server 2026-04-06)
- Excel IP PADs: `backups/amfe_ip_pads_excel/` (amfe_ip_pads.json — extraido del server 2026-04-06, producto nuevo no en las 8 familias actuales)
