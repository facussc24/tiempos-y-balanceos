# Ciclo de Mejora C6 — Flujograma de Proceso (PFD)

**Fecha:** 2026-02-25
**Módulo:** `modules/pfd/` (15 archivos fuente, 9 test files)
**Ciclo anterior:** C5 (2026-02-24)

---

## Metodología

1. **Revisión como usuario** en localhost:3000 (Chrome, 1536px viewport)
2. **Validación normativa** con NotebookLM (137 fuentes AIAG-VDA)
3. **Clasificación** de hallazgos por severidad y tipo
4. **Corrección** por prioridad: BUGS → NORMA → UX → VISUAL → EXPORTACIÓN → DOCS
5. **Verificación** con tsc + vitest + navegador

---

## Hallazgos (20 total)

### BUGS (3)

| ID | Sev. | Descripción | Resolución |
|----|------|-------------|-----------|
| B1 | Media | `insertStepAfter` generaba número secuencial global (ej: OP 60) en vez de intermedio (ej: OP 25 entre OP 20 y OP 30) | **Corregido.** Nueva función `getIntermediateStepNumber()` en `pfdTypes.ts` calcula punto medio. |
| B2 | Baja | `duplicateStep` tenía el mismo problema de numeración | **Corregido.** Reutiliza `getIntermediateStepNumber()`. |
| B3 | Baja | Dialog de draft recovery sin botón "Descartar". Solo "Recuperar" y cerrar. | **Corregido.** `onCancel` ahora llama `deletePfdDraft()` + toast "Borrador descartado". |

### NORMA (3)

| ID | Sev. | Descripción | Resolución |
|----|------|-------------|-----------|
| N1 | Media | Sin validación de que inspección tenga referencia o nota (AIAG APQP §3.1) | **Corregido.** Nueva regla V17 (info) en `pfdValidation.ts`. |
| N2 | Info | PFD no vincula operaciones al AMFE/CP. Campos existen pero no implementados. | **Pendiente P1.** Requiere cambios cross-module. |
| N3 | Info | No muestra personal/operario por paso (4M Mano de obra). | **Descartado.** Fuera del scope del PFD tabular. |

### UX (6)

| ID | Sev. | Descripción | Resolución |
|----|------|-------------|-----------|
| U1 | **ALTA** | Tabla de ~1640px, últimas columnas ocultas en 1536px viewport | **Corregido.** Anchos reducidos: machineDeviceTool 200→160, reference 120→100, department 100→80, notes 150→120, isExternalProcess 60→45. Total ~1530px. |
| U2 | Media | Botones PDF y Excel usan el mismo icono (FileDown) | **Corregido.** Excel usa `FileSpreadsheet` de lucide-react. |
| U3 | Media | "Guardar como" solo visible en `lg:` (≥1024px) | **Corregido.** Ahora `md:` (≥768px). |
| U4 | Baja | Placeholder "Nº op." muy abreviado | **Corregido.** Ahora "OP 10" como ejemplo. |
| U5 | Baja | Footer bar fija ocupa espacio visual | **Descartado.** Bajo impacto. |
| U6 | Baja | FAB sin tooltip con atajo de teclado | **Corregido.** `title="Agregar paso (Ctrl+Shift+N)"`. |

### VISUAL (3)

| ID | Sev. | Descripción | Resolución |
|----|------|-------------|-----------|
| V1 | Media | Columnas CC/SC de 70px, selects apretados | **Corregido.** 70px → 75px. |
| V2 | Baja | Header "Disposición" se trunca | **Corregido.** Label acortado a "Disp." |
| V3 | Baja | Leyenda de símbolos siempre expandida | **Descartado.** Ya funciona con persistencia en localStorage. |

### EXPORTACIÓN (2)

| ID | Sev. | Descripción | Resolución |
|----|------|-------------|-----------|
| E1 | Media | PDF colgroup desbalanceado: "Externo" 2%, "Disposición" 5% | **Corregido.** Rebalanceo: Descripción 20%, Notas 10%, Disp. 6%, Detalle 6%, Ext. 3%. |
| E2 | Baja | Excel no incluye referencia SGC "I-AC-005.1" | **Corregido.** Fila "Formulario: I-AC-005.1" agregada. |

### DOCUMENTACIÓN (3)

| ID | Sev. | Descripción | Resolución |
|----|------|-------------|-----------|
| D1 | **ALTA** | ESTADO_PROYECTO.md no lista módulo PFD | **Corregido.** Fila agregada con estado "Completo" y 60+ tests. |
| D2 | Media | package.json sin campo `repository` | **Corregido.** Agregado apuntando a `github.com/facussc24/tiempos-y-balanceos`. |
| D3 | Baja | Conteo de repositorios incorrecto (decía 6, son 7) y tablas (decía 8, son 11) | **Corregido.** |

---

## Validación Normativa (NotebookLM)

**Fuente:** Cuaderno "AIAG-VDA FMEA Harmonization" (137 fuentes)

**Campos confirmados como correctos:**
- Nº de Operación (secuencial) ✅
- Símbolo ASME (7 tipos estándar) ✅
- Descripción del proceso ✅
- Máquina/Dispositivo/Herramienta (4M recursos) ✅
- Características de Producto y Proceso ✅
- CC/SC (visibles explícitamente en el PFD) ✅
- Bucles de retrabajo con retorno claro ✅
- Procesos externos visibles ✅

**Requisitos de flujo:**
- Empieza con recepción de materia prima ✅ (V9)
- Termina con almacenamiento/envío ✅ (V10)
- Incluye todas las etapas (no solo valor agregado) ✅
- Procesos indirectos y de apoyo visibles ✅

**Conclusión: El PFD cumple con AIAG APQP / VDA.**

---

## Archivos Modificados (10)

| Archivo | Cambios |
|---------|---------|
| `modules/pfd/pfdTypes.ts` | B1/B2: `getIntermediateStepNumber()`, U1/V1/V2: anchos de columna |
| `modules/pfd/usePfdDocument.ts` | B1/B2: usa `getIntermediateStepNumber` en insertStepAfter y duplicateStep |
| `modules/pfd/PfdApp.tsx` | B3: onCancel descarta draft, U6: tooltip FAB |
| `modules/pfd/PfdTableRow.tsx` | U4: placeholder "OP 10" |
| `modules/pfd/PfdToolbar.tsx` | U2: FileSpreadsheet para Excel, U3: md: responsive |
| `modules/pfd/pfdValidation.ts` | N1: regla V17 (inspección sin referencia) |
| `modules/pfd/pfdPdfExport.ts` | E1: rebalanceo colWidths |
| `modules/pfd/pfdExcelExport.ts` | E2: fila "Formulario: I-AC-005.1" |
| `ESTADO_PROYECTO.md` | D1: módulo PFD, D3: conteo repos y tablas |
| `package.json` | D2: campo repository |

## Tests Agregados (12)

| Archivo | Tests |
|---------|-------|
| `__tests__/modules/pfd/pfdTypes.test.ts` | 7 tests para `getIntermediateStepNumber` (midpoint, +5, fallback, prefix, edge cases) |
| `__tests__/modules/pfd/pfdValidation.test.ts` | 5 tests para V17 (inspection, combined, reference, notes, operation) |

---

## Métricas Finales

| Métrica | Antes (C5) | Después (C6) |
|---------|------------|-------------|
| Test suites | 177 | 177 |
| Tests individuales | 2546 | 2558 (+12) |
| Tests fallando | 0 | 0 |
| tsc errors | 0 | 0 |
| Reglas de validación PFD | 16 (V1-V16) | 17 (V1-V17) |
| Ancho total tabla | ~1640px | ~1530px |

---

## Pendientes para Próximo Ciclo

- **N2**: Vinculación PFD ↔ AMFE ↔ CP (requiere cambios cross-module)
- **U5**: Compactar footer bar (bajo impacto)
- **N3**: Información de personal por paso (opcional, fuera del scope tabular)

---

## Resumen

Ciclo C6 enfocado en **pulir la UX del día a día** del módulo PFD. La mejora más impactante fue **U1** (reducción de ancho de tabla) que eliminó la necesidad de scroll horizontal en viewports estándar (1536px). Los bugs **B1/B2** de numeración intermedia mejoran significativamente la experiencia al insertar pasos en medio del flujo. La regla **V17** agrega cobertura normativa para puntos de inspección. La documentación se actualizó con el módulo PFD y la referencia a GitHub.

**14 hallazgos corregidos, 3 descartados (bajo impacto), 3 pendientes (fuera de scope).**
