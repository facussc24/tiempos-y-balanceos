# Ciclo de Mejora #3 — Flujograma de Proceso (PFD)

**Fecha:** 2026-02-23
**Modulo:** `modules/pfd/`
**Ciclos anteriores:** C1 (15 hallazgos), C2 (20 hallazgos)
**Hallazgos este ciclo:** 12

---

## Resumen Ejecutivo

Tercer ciclo de revision del modulo PFD. Se corrigieron 12 hallazgos en 5 categorias:
- 2 bugs de logica (save duplicado, shortcut conflicto)
- 2 cumplimientos de norma AIAG (disposicion de rechazo, exports)
- 4 mejoras de UX (focus, teclado, plantilla, click-to-scroll)
- 2 mejoras visuales (header compacto, tinte por tipo)
- 2 mejoras de exportacion (legend legible, boton imprimir)

## Hallazgos y Correcciones

### BUGS (2)

| ID | Severidad | Descripcion | Archivo | Estado |
|----|-----------|-------------|---------|--------|
| B1 | Alta | `handleSave` tenia logica duplicada (lineas 159-167 y 172-180), causando posible doble-save | `PfdApp.tsx` | Corregido — extraido `executeSave()` helper |
| B2 | Media | `Ctrl+N` conflictuaba con "nueva ventana" del browser | `PfdApp.tsx` | Corregido — cambiado a `Ctrl+Shift+N` |

### NORMA AIAG (2)

| ID | Severidad | Descripcion | Referencia | Archivo | Estado |
|----|-----------|-------------|------------|---------|--------|
| N1 | Alta | Solo habia opcion "Retrabajo" — faltaba "Descarte" y "Seleccion" | AIAG PFD: disposicion de rechazo (rework/scrap/sort) | `pfdTypes.ts`, `PfdTableRow.tsx`, `pfdValidation.ts`, `usePfdDocument.ts` | Corregido — `RejectDisposition` type, dropdown, sub-campos, V12, backward compat |
| N2 | Media | Exports no incluian disposicion completa ni retorno de retrabajo | AIAG: PDF/Excel deben reflejar toda la info del PFD | `pfdPdfExport.ts`, `pfdExcelExport.ts` | Corregido — columnas Disposicion + Detalle en ambos exports |

### UX (4)

| ID | Severidad | Descripcion | Archivo | Estado |
|----|-----------|-------------|---------|--------|
| U1 | Baja | Sin indicador visual de fila en edicion | `PfdTableRow.tsx` | Corregido — `focus-within:ring-2 focus-within:ring-cyan-400` |
| U2 | Media | Symbol picker sin navegacion por teclado | `PfdSymbolPicker.tsx` | Corregido — ArrowUp/Down, Enter, Escape, `aria-activedescendant` |
| U3 | Media | Estado vacio sin plantilla rapida | `pfdTemplates.ts` (nuevo), `PfdTable.tsx`, `PfdApp.tsx` | Corregido — plantilla basica 5 pasos + boton en empty state |
| U4 | Baja | Click en hallazgo de validacion no scrolleaba | `PfdApp.tsx` | Corregido — `scrollIntoView` + highlight temporal amber |

### VISUAL (2)

| ID | Severidad | Descripcion | Archivo | Estado |
|----|-----------|-------------|---------|--------|
| V1 | Media | Header ocupaba mucho espacio vertical (4 fieldsets apilados) | `PfdHeader.tsx` | Corregido — layout 2x2 compacto |
| V2 | Baja | Filas sin tinte por tipo de paso | `PfdTableRow.tsx` | Corregido — tintes sutiles: transport=slate, inspection=emerald, storage=amber, delay=red, decision=purple |

### EXPORTACION (2)

| ID | Severidad | Descripcion | Archivo | Estado |
|----|-----------|-------------|---------|--------|
| E1 | Media | Leyenda de simbolos en PDF con font 7px — ilegible impreso | `pfdPdfExport.ts` | Corregido — font 9px, SVGs 20x20 |
| E2 | Media | Sin boton Imprimir ni CSS print-friendly | `PfdApp.tsx`, `PfdToolbar.tsx` | Corregido — boton Printer, `@media print` CSS, clases `no-print` |

## Cambios Tecnicos

### Nuevo tipo: `RejectDisposition`
```typescript
export type RejectDisposition = 'none' | 'rework' | 'scrap' | 'sort';
```

### Nuevos campos en `PfdStep`
- `rejectDisposition: RejectDisposition` — tipo de disposicion de rechazo
- `scrapDescription: string` — motivo/criterio para descarte o seleccion

### Nueva funcion: `normalizePfdStep()`
Backward compat para documentos viejos que no tienen `rejectDisposition`. Deriva el valor de `isRework`.

### Nueva regla de validacion: V12
Advierte cuando un paso tiene disposicion descarte/seleccion pero no tiene descripcion.

### Nuevo archivo: `pfdTemplates.ts`
Plantilla basica de 5 pasos: Recepcion MP → Operacion → Inspeccion final → Embalaje → Almacenamiento/Envio.

## Archivos Modificados (13 + 1 nuevo)

| Archivo | Cambios principales |
|---------|-------------------|
| `modules/pfd/pfdTypes.ts` | +RejectDisposition, +scrapDescription, +normalizePfdStep, PFD_COLUMNS update |
| `modules/pfd/pfdTemplates.ts` | **NUEVO** — createBasicProcessTemplate() |
| `modules/pfd/PfdApp.tsx` | executeSave refactor, Ctrl+Shift+N, template, click-to-scroll, print CSS |
| `modules/pfd/PfdTable.tsx` | Empty state con botones plantilla/agregar |
| `modules/pfd/PfdTableRow.tsx` | Disposition dropdown, sub-campos, focus-within, type tints |
| `modules/pfd/PfdHeader.tsx` | Layout 2x2 compacto |
| `modules/pfd/PfdToolbar.tsx` | Boton Imprimir, no-print class |
| `modules/pfd/PfdSymbolPicker.tsx` | Keyboard navigation (ArrowUp/Down/Enter/Escape) |
| `modules/pfd/usePfdDocument.ts` | normalizePfdStep en loadData |
| `modules/pfd/pfdValidation.ts` | +V12 scrap/sort sin descripcion |
| `modules/pfd/pfdPdfExport.ts` | Disposition columns, legend font 9px, SVGs 20x20 |
| `modules/pfd/pfdExcelExport.ts` | Disposition columns, scrap/sort backgrounds |

### Tests modificados/nuevos (6 archivos)

| Archivo | Tests nuevos |
|---------|-------------|
| `pfdTemplates.test.ts` | **NUEVO** — 9 tests (template structure, unique IDs, defaults) |
| `pfdTypes.test.ts` | +8 tests (normalizePfdStep, disposition fields, PFD_COLUMNS) |
| `pfdValidation.test.ts` | +5 tests (V12 scrap/sort without description) |
| `pfdPdfExport.test.ts` | +6 tests (disposition columns, legend font, detail column) |
| `pfdExcelExport.test.ts` | +2 tests (disposition columns, 14-column header) |
| `PfdTable.test.tsx` | +7 tests (template buttons, disposition backgrounds, focus-within) |

## Metricas

| Metrica | Antes (C2) | Despues (C3) | Delta |
|---------|-----------|-------------|-------|
| Test files | 176 | 177 | +1 |
| Tests | 2483 | 2521 | +38 |
| Tests fallidos | 0 | 0 | 0 |
| TSC errores | 0 | 0 | 0 |
| PFD test files | 8 | 9 | +1 |
| PFD tests | 94 | 132 | +38 |

## Diferidos a Ciclo 4

- Vista visual de flujo (flowchart SVG con simbolos conectados)
- Decision con ramas Si/No (requiere modelo de datos tipo arbol)
- Trazabilidad PFD ↔ AMFE ↔ CP (linkage bidireccional)
- Columna Operador/Personal
- Toggle de visibilidad de columnas
- Drag & drop para reordenar pasos
