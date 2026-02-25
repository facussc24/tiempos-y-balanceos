# Ciclo de Mejora C5 — Flujograma de Proceso (PFD)

**Fecha:** 2026-02-24
**Módulo:** Diagrama de Flujo del Proceso (PFD)
**Ciclo anterior:** C4 (61 hallazgos acumulados, 2547 tests)
**Archivos fuente analizados:** 16 (src) + 9 (test)

---

## 1. Método de Revisión

- **Revisión de código:** Análisis línea por línea de los 16 archivos fuente del módulo PFD
- **Validación normativa:** AIAG APQP 2nd Ed. §3.1, IATF 16949:2016, ASME Y15.3
- **Verificación visual:** Dev server (Vite) + Chrome extensión
- **Tests:** Vitest 4.x con jsdom + @testing-library/react

---

## 2. Hallazgos Clasificados (13 total)

### BUGS (4)

| ID | Sev. | Descripción | Archivo |
|----|------|-------------|---------|
| B1 | **CRITICO** | `handleDispositionChange` llama `onUpdate` 2-4 veces por cambio de disposición. Cada call crea un undo entry separado. El usuario debe presionar Ctrl+Z 2-4 veces para deshacer UN cambio. | `PfdTableRow.tsx:80-87` |
| B2 | Media | Save failure invisible: `saveStatus='error'` muestra "Guardar" sin indicación de error. El usuario no sabe que el guardado falló. | `PfdToolbar.tsx:49` |
| B3 | Media | Ctrl+S no funciona cuando un `<select>` tiene foco. El keyboard handler hace `return` temprano para HTMLSelectElement sin verificar Ctrl. | `PfdApp.tsx:400-401` |
| B4 | Baja | Docblock dice "7 validation rules" cuando hay 14. Confunde a desarrolladores. | `pfdValidation.ts:5` |

### NORMA AIAG (3)

| ID | Sev. | Descripción | Referencia |
|----|------|-------------|-----------|
| N1 | Media | Sin validación de que el PFD tenga al menos un paso de inspección o combinado. AIAG APQP exige puntos de verificación explícitos. | AIAG APQP §3.1 |
| N2 | Media | Templates no incluyen pasos de transporte entre operaciones. AIAG requiere mostrar flujo de material explícitamente. | AIAG APQP §3.1 |
| N3 | Media | Retrabajo: `reworkReturnStep` acepta texto libre sin validar que el paso destino exista. | IATF 16949 cl 8.5.6 |

### UX (3)

| ID | Sev. | Descripción |
|----|------|-------------|
| U1 | Media | Sin feedback de éxito al exportar PDF/Excel. Las funciones corren silenciosamente. |
| U2 | Baja | Ctrl+P (imprimir) no capturado en keyboard shortcuts. |
| U3 | Baja | Flechas de flujo entre filas no se pueden ocultar. Para PFDs largos agregan mucha altura. |

### VISUAL (1)

| ID | Sev. | Descripción |
|----|------|-------------|
| V1 | Baja | PDF `buildTableHtml` usa `table-layout:fixed` sin `<colgroup>`. Columnas se auto-dimensionan. |

### EXPORTACIÓN (2)

| ID | Sev. | Descripción |
|----|------|-------------|
| E1 | Media | PDF: columnas sin anchos explícitos causan texto comprimido en "Descripción". (Merge con V1) |
| E2 | Baja | Excel: columna Símbolo muestra "○ Operación" (unicode+texto), difícil de filtrar en Excel. |

---

## 3. Correcciones Aplicadas

### Grupo BUGS

#### B1 — Disposition atómica (CRITICO)
- **`usePfdDocument.ts`**: Agregado `updateStepFields(stepId, updates)` — batch update en un solo undo entry
- **`PfdTableRow.tsx`**: Prop `onBatchUpdate`, refactoreado `handleDispositionChange` para construir objeto de updates y llamar una sola vez. Fallback a calls individuales si `onBatchUpdate` no está disponible.
- **`PfdTable.tsx`**: Passthrough `onBatchUpdateStep` prop
- **`PfdApp.tsx`**: Wire `pfd.updateStepFields` al PfdTable

#### B2 — Save error visible
- **`PfdToolbar.tsx`**: `saveLabel` mapea `'error'` → `'Error al guardar'`, botón rojo `bg-red-600`
- **`PfdApp.tsx`**: `executeSave` muestra toast "Error al guardar. Intente nuevamente." y auto-dismiss error status a 3s

#### B3 — Keyboard shortcuts fix
- **`PfdApp.tsx`**: Handler ahora permite Ctrl+combos cuando form element tiene foco: `if (!e.ctrlKey) return;`

#### B4 — Docblock actualizado
- **`pfdValidation.ts`**: "7 validation rules" → "16 validation rules (V1-V16)"

### Grupo NORMA

#### N1 — V15: Inspección requerida
- **`pfdValidation.ts`**: Nueva regla V15 — si doc tiene >2 pasos, debe tener al menos uno `inspection` o `combined`. Severity: warning.

#### N2 — Templates con transporte
- **`pfdTemplates.ts`**: Plantilla básica: 5→8 pasos (3 transportes intercalados). Plantilla manufactura: 8→11 pasos (3 transportes en transiciones clave).
- **`PfdTable.tsx`**: Labels actualizados "(8 pasos)" y "(11 pasos)"

#### N3 — V16: Rework destino existe
- **`pfdValidation.ts`**: Nueva regla V16 — si `reworkReturnStep` tiene valor, verifica que exista en los stepNumbers del documento. Severity: warning.

### Grupo UX

#### U1 — Toast de éxito en exportación
- **`PfdApp.tsx`**: `handleExportPdf` y `handleExportExcel` muestran toast de éxito/error

#### U2 — Ctrl+P para imprimir
- **`PfdApp.tsx`**: `if (e.ctrlKey && e.key === 'p')` → `window.print()`

#### U3 — Toggle flechas de flujo
- **`PfdApp.tsx`**: Estado `showFlowArrows` con localStorage persistence (`pfd_flow_arrows`). Toggle button en footer status bar con icono ArrowDown.
- **`PfdTable.tsx`**: Prop `showFlowArrows` (default `true`), condición en render de flechas

### Grupo VISUAL

#### V1/E1 — PDF columnas con anchos explícitos
- **`pfdPdfExport.ts`**: `<colgroup>` con 14 anchos porcentuales explícitos: `['5%', '4%', '18%', '12%', '10%', '4%', '10%', '4%', '7%', '6%', '8%', '5%', '5%', '2%']`

### Grupo EXPORTACIÓN

#### E2 — Excel símbolo sin unicode
- **`pfdExcelExport.ts`**: `getStepTypeLabel()` retorna solo texto ("Operación", "Transporte") sin unicode. Mejor para filtros y ordenamiento en Excel.

---

## 4. Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `modules/pfd/usePfdDocument.ts` | B1: `updateStepFields` + interface |
| `modules/pfd/PfdTableRow.tsx` | B1: `onBatchUpdate` prop, refactor disposition |
| `modules/pfd/PfdTable.tsx` | B1: passthrough, N2: labels, U3: `showFlowArrows` |
| `modules/pfd/PfdApp.tsx` | B1: wire, B2: error toast, B3: keyboard, U1: export toast, U2: Ctrl+P, U3: arrows state |
| `modules/pfd/PfdToolbar.tsx` | B2: error label + red styling |
| `modules/pfd/pfdValidation.ts` | B4: docblock, N1: V15, N3: V16 |
| `modules/pfd/pfdTemplates.ts` | N2: transport steps |
| `modules/pfd/pfdPdfExport.ts` | V1/E1: colgroup widths |
| `modules/pfd/pfdExcelExport.ts` | E2: text-only labels |

## 5. Tests

| Archivo test | Cambios |
|-------------|---------|
| `pfdValidation.test.ts` | +7 tests (V15 x4, V16 x3) |
| `pfdTemplates.test.ts` | Reescrito completo: +4 tests (transport steps, conteos actualizados) |
| `PfdTable.test.tsx` | Labels actualizados (8 pasos, 11 pasos) |

### Resultado Final

| Métrica | Antes C5 | Después C5 |
|---------|----------|------------|
| Test files | 177 pass | 177 pass |
| Tests | 2547 pass | 2558 pass (+11) |
| tsc errors | 0 | 0 |
| Validation rules | 14 (V1-V14) | 16 (V1-V16) |

---

## 6. Verificación en Browser

- [x] Plantilla manufactura carga 11 pasos con transporte intercalado
- [x] Plantilla básica muestra "(8 pasos)" en label
- [x] Flechas de flujo visibles por defecto, toggle funciona (botón "Flechas" en footer)
- [x] Sin flechas, tabla queda compacta y legible
- [x] Validación detecta 13 hallazgos correctamente (V4, V8, V14)
- [x] V15 no dispara cuando hay inspección (plantilla manufactura tiene combined+inspection)
- [x] Footer muestra desglose: "2 Alm · 3 Transp · 4 Op · 1 Op+Insp · 1 Insp"
- [x] Auto-save funciona (timestamp en toolbar)
- [x] Confirm modal en eliminación de paso funciona
- [x] Toolbar con 11 pasos count correcto

---

## 7. Pendientes (fuera de scope C5)

- **PFD → AMFE linkage**: Campos `linkedAmfeId`, `linkedCpId` existen en types pero no en UI
- **Drag & drop reordering**: Requiere librería (dnd-kit o similar)
- **Column visibility toggle**: Para reducir scroll horizontal en pantallas chicas
- **Import from Excel**: Round-trip workflow (export → edit → reimport)
- **Decision step OK/NOK paths**: Campos dedicados para rutas de decisión
- **V16 auto-suggest**: Dropdown con step numbers existentes para reworkReturnStep

---

## 8. Resumen Acumulado

| Ciclo | Hallazgos | Tests |
|-------|-----------|-------|
| C1 | 14 | 2362 |
| C2 | 12 | 2401 |
| C3 | 18 | 2485 |
| C4 | 17 | 2547 |
| **C5** | **13** | **2558** |
| **Total** | **74** | — |
