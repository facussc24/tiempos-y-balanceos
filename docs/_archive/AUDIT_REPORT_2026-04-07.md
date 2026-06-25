# Reporte de Auditoría APQP — 2026-04-07

## Contexto
Auditoría post-fix del error "Cannot read properties of undefined (reading 'trim')".
Se corrigió la causa raíz (normalización de datos en amfeRepository.ts) y se aplicaron fixes defensivos en 6 archivos.

---

## 1. AMFE — Integridad de Datos (9 documentos)

### Sin double-serialization — LIMPIO

### Metadata desincronizada (CRITICO — 9/9 docs)
- `operation_count` y `cause_count` en columnas de Supabase NO coinciden con el JSON real
- Requiere re-sync ejecutando `computeAmfeStats()` y actualizando cada doc

### Estructura incompleta
| Documento | Ops reales | Causas reales | Problema |
|-----------|-----------|---------------|----------|
| INSERT | 1 | 15 | stored=11 ops, actual=1 — posible pérdida de datos |
| TOP_ROLL | 11 | 44 | 29 funciones sin modos de falla |
| ARMREST_DOOR_PANEL | 6 | 45 | 3 funciones sin modos de falla |

### CC/SC fuera de benchmark
- CC=0% en: HEADREST_FRONT, HEADREST_REAR_CEN, HEADREST_REAR_OUT, TELAS_PLANAS (flamabilidad DEBE ser CC)
- SC=0% en 8/9 docs (solo TOP_ROLL tiene SC=13.6%)

---

## 2. AMFE — Severidades y AP (437 causas totales, 48 issues)

### AP con tabla oficial — LIMPIO (0 mismatches)

### Severidades mal calibradas (23 issues)
- "Rotura del vinilo en zona de costura" con S=10 en IP PADs, Armrest, 3 Headrests — NO es seguridad/flamabilidad, debería ser S=7-8 máx
- "Puntadas irregulares o arrugas" con S=8 — cosmético, debería ser S=5-6
- "Cup holder no encastra" con S=6 — tiene keyword encastre, debería ser S=7-8
- PWA docs (Telas Planas/Termoformadas): 0 causas con S/O/D llenados

### AP=H sin acciones (7 causas)
- **IP PADs Patagonia:** 6 causas AP=H sin acción (OP 50, 60, 70, 100, 110, 120)
- **TOP_ROLL:** 1 causa AP=H sin acción (zona de ruptura airbag, OP 30 — CRITICO)

---

## 3. CP — Plan de Control (8 documentos, 744 items)

### Blockers (15)
- **Telas Planas PWA:** 7 items con violación B3 (producto Y proceso en misma fila)
- **Telas Termoformadas PWA:** 8 items con violación B3

### Warnings (42)
- 42 items con especificación "TBD" en INSERT, 3 Headrests, Telas Planas/Termoformadas

---

## 4. HO — Hojas de Operaciones (8 documentos)

### Blockers (16)
- **8/8 docs** tienen `preparedBy` y `approvedBy` vacíos
- Debería ser: preparedBy="Facundo Santoro", approvedBy="Carlos Baptista"

### Warnings (1)
- Telas Planas: `sector` vacío

---

## 5. PFD — Diagramas de Flujo (7 documentos)

### Warnings (169)
- 169 steps con nombres vacíos distribuidos en 7 PFDs
- Los steps tienen stepNumber pero no name

---

## Resumen Global

| Tipo | Blockers | Warnings | Total |
|------|----------|----------|-------|
| AMFE integridad | 2 | 7 | 9 |
| AMFE severidad | 7 | 41 | 48 |
| CP | 15 | 42 | 57 |
| HO | 16 | 1 | 17 |
| PFD | 0 | 169 | 169 |
| **TOTAL** | **40** | **260** | **300** |

---

## Hallazgos específicos del IP PAD Patagonia

Ver sección dedicada abajo.

---

## IP PAD Patagonia — Issues para entrega

**Documento:** "IP PADs Patagonia" (TRIM ASM-UPR WRAPPING | VWA)
**Ubicación en app:** Proyectos AMFE > Sin clasificar
**Stats:** 14 operaciones, 104 causas

### BLOCKERS para entrega

1. **6 causas AP=H sin acciones** (OP 50, 60, 70, 100, 110, 120)
   - El equipo APQP debe definir acciones o documentar justificación en Observaciones
   - NO se pueden inventar acciones

2. **Metadata desincronizada** — cause_count stored=75, actual=104
   - Necesita re-sync antes de exportar

3. **Clasificación "Sin clasificar"** en el panel de proyectos
   - No está asignado a un proyecto/cliente (debería ser VWA/PATAGONIA)
   - El path debería ser VWA/PATAGONIA/IP_PADS o similar

### WARNINGS para entrega

4. **2x S=10 en "Rotura del vinilo en zona de costura" (OP 30, 40)**
   - S=10 solo justificado para flamabilidad/VOC/airbag/seguridad
   - Rotura de vinilo en costura es funcional/estructural → S=7-8 máx

5. **2x S=8 en "Puntadas irregulares o arrugas" (OP 30, 40)**
   - Cosmético → debería ser S=5-6

6. **0% SC** — benchmark es 10-15%, el equipo APQP debe revisar qué items merecen SC

7. **No tiene PFD vinculado** — para entregar AMFE + Flujograma necesitás un PFD
