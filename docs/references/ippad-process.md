---
name: Proceso productivo IP PAD Patagonia
description: Flujo de proceso correcto del IP PAD con 4 versiones (PL0-PL3), correcciones de terminologia y part numbers
type: project
---

## IP PAD Patagonia — Proceso productivo

### Códigos y descripciones IP PAD (listado de piezas nominales)
| Part Number VW | Nivel | Descripcion oficial | Version |
|---------------|-------|---------------------|---------|
| 2HC.858.417.B FAM | L1 | PLATE ASM-I/P CTR OTLT AIR | IP PAD - LOW VERSION |
| 2HC.858.417.C GKK | L2 | PLATE ASM-I/P CTR OTLT AIR | IP PAD - HIGH VERSION |
| 2HC.858.417.C GKN | L3 | PLATE ASM-I/P CTR OTLT AIR | IP PAD - HIGH VERSION |

### Materiales por version (FAKOM RZ00349)
| Version | Part Number | Material | Proceso |
|---------|------------|----------|---------|
| PL0 Workhorse | 2HC.858.417.D | PP+EPDM-T20 (inyectado) | Inyeccion directa, SIN tapizado |
| PL1 (L1) | 2HC.858.417.B FAM | PVC 1.1mm + PU Foam 2mm | PVC tapizado |
| PL2 (L2) | 2HC.858.417.C GKK | PVC 1.1mm + PU Foam 2mm | PVC tapizado |
| PL3 (L3) | 2HC.858.417.C GKN | PVC 1.1mm + PU Foam 2mm | PVC tapizado |

### Flujo PL1/PL2/PL3 (PVC tapizado) — Preliminar (actualizado 2026-04-08)
3 ramas paralelas desde Recepcion:
- Rama A (Sustrato): OP 20 Inyeccion → WIP Sustrato Inyectado
- Rama B (Cobertura PVC): OP 30 Corte → OP 40 Costura → WIP Funda Cosida
- Rama C (Espuma): OP 50 Troquelado de espumas → WIP Espuma Troquelada
Merge A+C → OP 60 Ensamble sustrato+espuma → WIP Sustrato Ensamblado
Merge B+60+KD adhesivo → OP 70 Adhesivado → WIP Pieza Adhesivada
→ OP 80 Control de Calidad Adhesivado (si NOK → OP 81 Retrabajo → vuelve a OP 80)
→ OP 90 Alineacion costura (Pre-Fixing) → OP 100 Wrapping + Edge Folding
→ OP 110 Soldadura con ultrasonido → OP 120 Terminacion → WIP Pieza Terminada
→ OP 130 Control Final de Calidad (si NOK → Scrap)
→ OP 140 Embalaje de Producto Terminado → Almacen PT

Numeracion definitiva (de 10 en 10, sub-ops con decimal):
| OP | Nombre |
|---|---|
| 10 | RECEPCION DE MATERIA PRIMA |
| 20 | INYECCION |
| 30 | CORTE |
| 40 | COSTURA |
| 50 | TROQUELADO DE ESPUMAS |
| 60 | ENSAMBLE SUSTRATO + ESPUMA |
| 70 | ADHESIVADO |
| 80 | CONTROL DE CALIDAD ADHESIVADO |
| 81 | RETRABAJO DE ADHESIVADO |
| 90 | ALINEACION DE COSTURA (PRE-FIXING) |
| 100 | WRAPPING + EDGE FOLDING |
| 110 | SOLDADURA CON ULTRASONIDO |
| 120 | TERMINACION |
| 130 | CONTROL FINAL DE CALIDAD |
| 140 | EMBALAJE DE PRODUCTO TERMINADO |

- Elaborado: Facundo Santoro / Aprobado: Leonardo Lattanzi
- PFD doc ID: pfd-ippads-trim-asm-upr-wrapping
- AMFE doc ID: c9b93b84-f804-4cd0-91c1-c4878db41b97

### Flujo PL0 (PP+EPDM inyectado) — Preliminar
10: Recepcion de materia prima → 20: Inyeccion → 30: Control dimensional → 40: Embalaje → Almacenamiento PT

### Correcciones criticas
- NO lleva PRIMER
- Espumas se TROQUELAN (Troqueladora), no se cortan en mesa
- Ultrasonido = "Dispositivo de ultrasonido" (prensa), no "pistola"
- El nombre correcto es "IP PAD" (no "IPO PAD")

**Why:** IP PAD es entrega prioritaria de Fak. Estos datos son validados directamente por el.

**How to apply:** Usar estos datos como base para generar PFD, AMFE, CP y HO del IP PAD. No inventar pasos adicionales.
