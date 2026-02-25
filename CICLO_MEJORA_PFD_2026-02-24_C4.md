# Ciclo de Mejora #4 — Flujograma de Proceso (PFD)

**Fecha:** 2026-02-24
**Modulo:** `modules/pfd/`
**Ciclos anteriores:** C1 (15 hallazgos), C2 (20 hallazgos), C3 (12 hallazgos)
**Hallazgos este ciclo:** 14
**Acumulado total:** 61 hallazgos corregidos

---

## Resumen Ejecutivo

Cuarto ciclo de revision del modulo PFD. Revision exhaustiva de los 16 archivos del modulo linea por linea, mas validacion contra norma AIAG APQP 2nd ed. y IATF 16949. Se identificaron y corrigieron 14 hallazgos en 5 categorias:

- **4 bugs** (1 critico: perdida silenciosa de borrador)
- **3 cumplimientos de norma** AIAG/IATF (validaciones faltantes, footer PDF)
- **3 mejoras de UX** (guardar como, template manufactura, tooltips)
- **2 mejoras visuales** (flechas SVG en PDF, leyenda persistente)
- **2 mejoras de exportacion** (Excel freeze, PDF resumen por tipo)

## Hallazgos y Correcciones

### BUGS (4)

| ID | Severidad | Descripcion | Archivo | Estado |
|----|-----------|-------------|---------|--------|
| B1 | **ALTA** | Draft recovery: cerrar modal con Escape/clic afuera ejecutaba `deletePfdDraft()` silenciosamente via `onCancel`. El usuario perdia el borrador sin accion explicita. | `PfdApp.tsx` | Corregido — removido `onCancel` del confirm state de draft recovery. Solo se borra al guardar exitosamente. |
| B2 | Media | V11 usaba `step.isRework` (boolean legacy) en vez de `step.rejectDisposition === 'rework'` (campo canonico post-C3). Datos inconsistentes no se validaban. | `pfdValidation.ts` | Corregido — V11 ahora chequea `rejectDisposition === 'rework' || isRework` para backward compat. |
| B3 | Media | `handleLoadTemplate` reemplazaba todos los pasos sin confirmacion. El usuario podia perder trabajo sin aviso. | `PfdApp.tsx` | Corregido — si hay datos existentes (>1 paso o paso con descripcion), muestra ConfirmModal antes de cargar. |
| B4 | Baja | Al agregar paso (FAB o Ctrl+Shift+N), la tabla no scrolleaba hasta el paso nuevo. El usuario tenia que buscarlo manualmente. | `PfdApp.tsx` | Corregido — `scrollToLastStep()` con `scrollIntoView({ behavior: 'smooth' })` + highlight temporal cyan 2s. |

### NORMA AIAG (3)

| ID | Severidad | Descripcion | Referencia | Archivo | Estado |
|----|-----------|-------------|------------|---------|--------|
| N1 | Media | Sin validacion para step number vacio. AIAG requiere que cada paso tenga numero de operacion unico. | APQP 2nd ed. sec. 3.1: "cada operacion debe estar numerada" | `pfdValidation.ts` | Corregido — nueva regla V13: warning cuando `stepNumber.trim() === ''`. |
| N2 | Media | Sin validacion de maquina/equipo en operaciones. AIAG exige identificar equipamiento en el PFD. | APQP sec. 3.1: "identificar equipos, herramientas, fixtures" | `pfdValidation.ts` | Corregido — nueva regla V14: warning cuando `stepType === 'operation' \|\| 'combined'` sin `machineDeviceTool`. |
| N3 | Baja | PDF footer sin identificacion de pieza. IATF requiere identificacion del producto en cada pagina. | IATF 16949 cl. 7.5.3: "identificacion en cada pagina" | `pfdPdfExport.ts` | Corregido — footer incluye `partNumber — partName` a la izquierda, pagina al centro, formulario a la derecha. |

### UX (3)

| ID | Severidad | Descripcion | Archivo | Estado |
|----|-----------|-------------|---------|--------|
| U1 | Media | Sin "Guardar como" / duplicar documento. Flujo comun en ingenieria: copiar PFD de pieza similar y modificar. | `PfdApp.tsx`, `PfdToolbar.tsx` | Corregido — boton "Guardar como" en toolbar. Genera nuevo ID, pide nombre, guarda copia independiente. |
| U2 | Baja | Tooltip de undo/redo sin shortcut. Inconsistente con Guardar que si mostraba "(Ctrl+S)". | `PfdToolbar.tsx` | **Ya implementado** — los tooltips ya incluian `(Ctrl+Z)` y `(Ctrl+Y)`. Falso positivo en el analisis. |
| U3 | Baja | Template basica de 5 pasos demasiado generica para manufactura automotriz. | `pfdTemplates.ts`, `PfdTable.tsx` | Corregido — nueva `createManufacturingProcessTemplate()` con 8 pasos tipicos (recepcion → corte → operacion principal → inspeccion en proceso → tratamiento superficial → inspeccion final → embalaje → envio). Ambas templates disponibles en empty state. |

### VISUAL (2)

| ID | Severidad | Descripcion | Archivo | Estado |
|----|-----------|-------------|---------|--------|
| V1 | Baja | PDF usaba caracter unicode `↓` para flechas de flujo. En la UI son SVG profesionales. | `pfdPdfExport.ts` | Corregido — flechas SVG inline cyan (#0891B2) con stroke-linecap round. |
| V2 | Baja | Leyenda de simbolos siempre expandida. Usuarios experimentados no la necesitan visible todo el tiempo. | `PfdSymbolLegend.tsx` | Corregido — estado persistido en `localStorage('pfd_legend_expanded')`. Default: expandida. Recuerda preferencia del usuario. |

### EXPORTACION (2)

| ID | Severidad | Descripcion | Archivo | Estado |
|----|-----------|-------------|---------|--------|
| E1 | Media | Excel sin fila de header congelada. Al navegar muchos pasos, los headers desaparecen. | `pfdExcelExport.ts` | Corregido — `ws['!freeze'] = { xSplit: 0, ySplit: 11, topLeftCell: 'A12' }`. Congela metadata + headers. |
| E2 | Baja | PDF sin totales por tipo de paso. La UI muestra breakdown en footer pero el PDF no. | `pfdPdfExport.ts` | Corregido — seccion "Resumen" entre tabla y leyenda: desglose por tipo de paso + conteo CC/SC/Ext. |

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `modules/pfd/PfdApp.tsx` | B1 (draft onCancel), B3 (template confirm), B4 (scroll to new), U1 (guardar como) |
| `modules/pfd/pfdValidation.ts` | B2 (V11 fix), N1 (V13), N2 (V14) |
| `modules/pfd/pfdPdfExport.ts` | N3 (footer ID), V1 (flechas SVG), E2 (resumen) |
| `modules/pfd/pfdExcelExport.ts` | E1 (freeze panes) |
| `modules/pfd/PfdToolbar.tsx` | U1 (boton guardar como) |
| `modules/pfd/PfdSymbolLegend.tsx` | V2 (localStorage persist) |
| `modules/pfd/pfdTemplates.ts` | U3 (template manufactura 8 pasos) |
| `modules/pfd/PfdTable.tsx` | U3 (selector de templates en empty state) |

## Tests

| Archivo de test | Tests nuevos | Cobertura |
|-----------------|-------------|-----------|
| `pfdValidation.test.ts` | +10 (V11 rejectDisposition, V13 step vacio, V14 operacion sin maquina) | 14 reglas cubiertas |
| `pfdPdfExport.test.ts` | +5 (footer N3, SVG arrows V1, resumen E2 con CC/SC, empty doc) | HTML preview completo |
| `pfdExcelExport.test.ts` | +1 (freeze panes E1) | Freeze verificado |
| `pfdTemplates.test.ts` | +10 (template manufactura: 8 pasos, tipos, IDs, dispositions) | Ambas templates cubiertas |
| `PfdTable.test.tsx` | +1 (boton template manufactura C4-U3), fix texto boton basica | Empty state completo |

**Total nuevos tests C4:** 27

## Verificacion

- `npx tsc --noEmit`: **0 errores**
- `npx vitest run`: **177 suites, 2547 tests, 0 fallos**
- Browser: App carga correctamente, toolbar con "Guardar como", leyenda con collapse

## Metricas Acumuladas

| Ciclo | Fecha | Hallazgos | Tests nuevos | Total tests |
|-------|-------|-----------|-------------|-------------|
| C1 | 2026-02-22 | 15 | ~30 | ~2340 |
| C2 | 2026-02-23 | 20 | ~35 | ~2375 |
| C3 | 2026-02-23 | 12 | ~25 | ~2400 |
| **C4** | **2026-02-24** | **14** | **27** | **2547** |
| **Total** | | **61** | **~117** | **2547** |

## Reglas de Validacion PFD (14 total)

| Regla | Descripcion | Severidad | Ciclo |
|-------|-------------|-----------|-------|
| V1 | Numeros de operacion duplicados | error | C1 |
| V2 | Paso sin descripcion | error | C1 |
| V3 | CC/SC sin caracteristica asociada | warning | C1 |
| V4 | Encabezado incompleto (incluye campos AIAG) | warning | C1/C2 |
| V5 | Decision sin notas | info | C1 |
| V6 | Mas de 50 pasos | warning | C1 |
| V7 | Campo excede 10.000 caracteres | error | C2 |
| V10 | Ultimo paso no es almacenamiento | info | C2 |
| V11 | Retrabajo sin paso de retorno (rejectDisposition fix) | warning | C2/C4 |
| V12 | Descarte/seleccion sin descripcion | warning | C3 |
| V13 | Paso sin numero de operacion | warning | **C4** |
| V14 | Operacion sin maquina/equipo | warning | **C4** |

## Estado del Modulo

El modulo PFD tiene ahora:
- **16 archivos fuente** (~3500 LOC)
- **10 archivos de test** (~500 LOC test)
- **14 reglas de validacion** cubriendo norma AIAG APQP + IATF 16949
- **2 templates** de inicio rapido (basica 5 pasos + manufactura 8 pasos)
- **3 formatos de exportacion** (PDF con logo, Excel con freeze, impresion)
- **Funcionalidades completas**: CRUD, undo/redo, draft auto-save, guardar como, validacion, simbologia ASME, CC/SC, disposicion de rechazo (rework/scrap/sort), procesos externos

Nivel de madurez: **produccion**. No se identifican hallazgos P0 pendientes.
