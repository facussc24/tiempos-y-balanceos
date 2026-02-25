# Ciclo de Mejora #2 — Flujograma de Proceso (PFD)

**Fecha:** 2026-02-23
**Ciclo:** #2 (ciclo anterior: 2026-02-22, 15 hallazgos)
**Validado con:** NotebookLM (137 fuentes AIAG-VDA)

---

## Resumen Ejecutivo

Segundo ciclo de mejora del modulo PFD. Se reviso codigo fuente (14 archivos), se valido contra norma AIAG APQP / IATF 16949 con NotebookLM, y se verifico la app en vivo. Se identificaron **20 hallazgos nuevos** en 5 categorias, todos corregidos.

| Categoria | Hallazgos | Estado |
|-----------|-----------|--------|
| BUGS | 4 | 4/4 Corregidos |
| NORMA | 5 | 5/5 Corregidos |
| UX | 5 | 5/5 Corregidos |
| VISUAL | 3 | 3/3 Corregidos |
| EXPORTACION | 3 | 3/3 Corregidos |
| **TOTAL** | **20** | **20/20** |

**Tests finales:** 176 suites, 2483 tests passed, 8 skipped, 0 failures (+13 tests nuevos)

---

## Detalle de Correcciones

### BUGS (4)

| ID | Descripcion | Archivo | Correccion |
|----|-------------|---------|------------|
| B1 | `savePfdDocument` INSERT OR REPLACE no incluia `created_at` — quedaba NULL en primer guardado | `pfdRepository.ts` | COALESCE subquery preserva created_at original en updates |
| B2 | Import path `../../src/assets/ppe/ppeBase64` posiblemente incorrecto | `pfdPdfExport.ts` | Verificado: path correcto, consistente con otros modulos |
| B3 | `handleSave` pedia nombre pero NO sincronizaba con `header.partName` | `PfdApp.tsx` | Sync nombre a partName si estaba vacio antes de guardar |
| B4 | Modal "Borrador encontrado" sin boton Descartar — solo podia cerrar sin accion clara | `PfdApp.tsx` | onCancel borra draft + toast "Borrador descartado" |

### NORMA (5)

| ID | Descripcion | Referencia AIAG | Correccion |
|----|-------------|-----------------|------------|
| N1 | No validaba que ultimo paso sea almacenamiento/envio | "Terminar con almacenamiento final y expedicion" | V10: info si ultimo paso no es storage |
| N2 | V4 solo validaba partNumber/partName/customerName | "Nivel cambio ing., cod proveedor, aprobaciones" | V4 expandido: +engineeringChangeLevel, +supplierCode, +preparedBy, +approvedBy |
| N3 | Retrabajo solo tenia checkbox, no indicaba destino de retorno | "Mostrar donde se repara y como vuelve al proceso" | +reworkReturnStep campo + input "Retorno a:" + V11 warning |
| N4 | CC/SC sin marcacion visual prominente en filas | "OEM exigen marcacion visual directa en PFD" | Borde izquierdo 4px: rojo (CC) / amber (SC) en filas |
| N5 | PDF/Excel header faltaban coreTeam, keyContact, supplierCode | "Compartir misma info que AMFE y Plan de Control" | Fila extra de metadata en ambos exports |

### UX (5)

| ID | Descripcion | Correccion |
|----|-------------|------------|
| U1 | Header colapsado por defecto — usuario nuevo no ve metadata | Default expandido (localStorage fallback) |
| U2 | Leyenda de simbolos colapsada por defecto | Default expandido |
| U3 | Sin Undo/Redo — borrar paso irreversible | History stack (max 20), Ctrl+Z/Y, botones Undo/Redo en toolbar |
| U4 | Sin resumen por tipo en footer | Breakdown: "15 Op · 3 Insp · 2 Transp · 1 Alm" |
| U5 | Borrador descartado sin feedback visual | Toast "Borrador descartado" (3s auto-dismiss) |

### VISUAL (3)

| ID | Descripcion | Correccion |
|----|-------------|------------|
| V1 | Flechas de flujo entre filas poco visibles (ArrowDown cyan 16px) | ArrowDown 18px, strokeWidth 2.5, lineas conectoras verticales |
| V2 | CC/SC sin badge visual en la fila | Cubierto por N4 (borde lateral colorizado) |
| V3 | Filas retrabajo/externo sin badge textual | Badges "RETRABAJO" (rojo) / "EXTERNO" (azul) junto a descripcion |

### EXPORTACION (3)

| ID | Descripcion | Correccion |
|----|-------------|------------|
| E1 | PDF header faltaba coreTeam, keyContact, supplierCode | Cubierto por N5 — fila extra de metadata |
| E2 | Excel metadata faltaba supplierCode, coreTeam, keyContact, engineeringChangeLevel | Cubierto por N5 — 2 filas extra de metadata |
| E3 | CC/SC sin indicador visual en exports | Borde izquierdo rojo/amber en PDF y Excel |

---

## Archivos Modificados (11)

| Archivo | Cambios |
|---------|---------|
| `modules/pfd/pfdTypes.ts` | +`reworkReturnStep: string` en PfdStep + createEmptyStep |
| `modules/pfd/pfdValidation.ts` | +V10 (ultimo paso), +V11 (retrabajo destino), V4 expandido (4 campos nuevos) |
| `modules/pfd/PfdApp.tsx` | B3 (sync nombre), B4 (draft discard), U1 (header expanded), U3 (Ctrl+Z/Y), U4 (footer breakdown), U5 (toast) |
| `modules/pfd/PfdTable.tsx` | V1 (flechas prominentes con lineas conectoras) |
| `modules/pfd/PfdTableRow.tsx` | N3 (input retorno), N4 (borde CC/SC), V3 (badges RETRABAJO/EXTERNO) |
| `modules/pfd/PfdSymbolLegend.tsx` | U2 (expanded por defecto) |
| `modules/pfd/PfdToolbar.tsx` | U3 (botones Undo/Redo con Undo2/Redo2 icons) |
| `modules/pfd/usePfdDocument.ts` | U3 (history stack max 20, undo/redo, canUndo/canRedo) |
| `modules/pfd/pfdPdfExport.ts` | N5 (header metadata completo), E3 (CC/SC borde izquierdo rojo/amber) |
| `modules/pfd/pfdExcelExport.ts` | N5 (header metadata completo), E3 (CC/SC thick left border) |
| `utils/repositories/pfdRepository.ts` | B1 (created_at COALESCE fix) |

## Tests Nuevos (+13)

| Archivo | Tests |
|---------|-------|
| `pfdValidation.test.ts` | +10: V4 extended (4), V10 (3), V11 (3) |
| `pfdPdfExport.test.ts` | +3: N5 header metadata, CC borde rojo, SC borde amber |

## Resultado Final

```
Test Files:  176 passed | 1 skipped (177)
Tests:       2483 passed | 8 skipped (2491)
Duration:    ~140s
TypeScript:  0 errors
```

---

## Acumulado desde inicio del modulo

| Ciclo | Fecha | Hallazgos | Tests Totales |
|-------|-------|-----------|---------------|
| #1 | 2026-02-22 | 15 corregidos | 2470 |
| #2 | 2026-02-23 | 20 corregidos | 2483 |
| **Total** | | **35 corregidos** | **2483** |

---

## Pendientes para proximo ciclo

| # | Item | Prioridad |
|---|------|-----------|
| 1 | Trazabilidad bidireccional PFD <-> AMFE <-> CP (linkedAmfeOperationId) | P1 |
| 2 | AI Suggestions para PFD (Gemini sugiere pasos segun tipo de proceso) | P2 |
| 3 | Drag & drop para reordenar pasos | P3 |
