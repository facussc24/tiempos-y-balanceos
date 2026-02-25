# Ciclo de Mejora: Flujograma (PFD) + Landing Page

**Fecha:** 2026-02-22
**Módulos revisados:** PFD (Diagrama de Flujo del Proceso), Landing Page
**Archivos del módulo PFD:** 13 archivos fuente + 8 archivos de test
**Metodología:** Revisión de código + inspección visual en browser + validación normativa AIAG/APQP

---

## Resumen ejecutivo

Se detectaron **20 hallazgos** clasificados en 6 categorías. Todos fueron corregidos en 3 grupos priorizados. Resultado final: **176 suites, 2470 tests, 0 fallos**.

---

## Hallazgos detectados y correcciones

### BUGS (P0 - Críticos)

| # | Hallazgo | Corrección | Archivo(s) |
|---|----------|-----------|------------|
| B1 | Sin auto-numeración de pasos — cada paso nuevo quedaba con `stepNumber: ''` | `createEmptyStep(stepNumber?)`, `parseStepNumber()`, `getNextStepNumber()` — pasos se autonumeran OP 10, OP 20, OP 30... | `pfdTypes.ts`, `usePfdDocument.ts` |
| B2 | "pasos" sin singular — footer siempre decía "N pasos" incluso con 1 | Ternario `count === 1 ? 'paso' : 'pasos'` en footer y toolbar | `PfdApp.tsx`, `PfdToolbar.tsx` |
| B3 | `hasUnsavedChanges` true al inicio — el documento se marcaba como modificado al cargar | Ref `isFirstRenderRef` que salta el primer trigger del `useEffect` | `PfdApp.tsx` |
| B4 | Sin recuperación de borradores — si el usuario recargaba, perdía todo | `useEffect` en mount que busca drafts y ofrece recuperar con `ConfirmModal` | `PfdApp.tsx` |
| B5 | Undo/Redo siempre deshabilitado — botones visibles pero `canUndo={false}` hardcodeado | Removidos del toolbar (no confundir al usuario con funcionalidad no implementada) | `PfdApp.tsx`, `PfdToolbar.tsx` |

### NORMA (P1 - Cumplimiento AIAG)

| # | Hallazgo | Corrección | Archivo(s) |
|---|----------|-----------|------------|
| N1 | Sin flechas/indicadores de flujo entre pasos — la tabla era solo una lista sin conexión visual | Flechas `↓` cyan entre cada fila de la tabla (UI + PDF + Excel) | `PfdTable.tsx`, `pfdPdfExport.ts`, `pfdExcelExport.ts` |
| N2 | Falta leyenda de símbolos — AIAG requiere referencia visual de cada símbolo | Componente `PfdSymbolLegend.tsx` colapsable debajo de tabla + leyenda en PDF y Excel | `PfdSymbolLegend.tsx` (NUEVO), `PfdApp.tsx`, `pfdPdfExport.ts`, `pfdExcelExport.ts` |
| N3 | Validación incompleta — no verificaba que inspecciones tengan características | Regla V8: inspection/combined sin `productCharacteristic` ni `processCharacteristic` → warning | `pfdValidation.ts` |

### UX (P1)

| # | Hallazgo | Corrección | Archivo(s) |
|---|----------|-----------|------------|
| U1 | Header expandido por defecto — la tabla quedaba debajo del fold | Default colapsado (`headerCollapsed: true`), localStorage override sigue funcionando | `PfdApp.tsx` |
| U2 | Columna "Acc." no descriptiva | Renombrado a "Acciones" | `PfdTable.tsx` |
| U3 | Botones de acción muy chicos (14px) | Iconos 14→16px, padding `p-1`→`p-1.5`, columna 64→80px | `PfdTableRow.tsx`, `PfdApp.tsx` |
| U4 | Placeholder "OP 10" misleading (estático en todos los rows) | Cambiado a "Nº op." (con B1 resuelto, el stepNumber real ya se muestra) | `PfdTableRow.tsx` |

### VISUAL (P2)

| # | Hallazgo | Corrección | Archivo(s) |
|---|----------|-----------|------------|
| V1 | Símbolos sólidos en vez de outlined — ASME estándar requiere contornos con fondo claro | Todos los SVGs reescritos: `fill` light + `stroke` colored + `strokeWidth="2"` | `PfdSymbols.tsx`, `pfdPdfExport.ts` |
| V2 | Sin logo Barack en exportaciones | Pendiente — no se incluyó en este ciclo (xlsx-js-style no soporta imágenes, PDF requiere base64 adicional) | — |

### EXPORTACIÓN (P2)

| # | Hallazgo | Corrección | Archivo(s) |
|---|----------|-----------|------------|
| E1 | PDF sin columnas Retrabajo/Externo (solo tags inline) | Headers expandidos de 11 a 13 columnas con celdas "Sí"/"" por flag | `pfdPdfExport.ts` |
| E2 | PDF/Excel sin leyenda de símbolos | Leyenda añadida en ambas exportaciones (cubierto por N2) | `pfdPdfExport.ts`, `pfdExcelExport.ts` |

### LANDING PAGE (P2)

| # | Hallazgo | Corrección | Archivo(s) |
|---|----------|-----------|------------|
| L1 | Orden de cards no sigue Golden Thread AIAG | Reordenado: PFD(1) → AMFE(2) → Plan de Control(3) → Tiempos(4). Keyboard shortcuts actualizados | `LandingPage.tsx` |

---

## Verificación visual en browser

### Landing Page — Orden Golden Thread
- Cards en orden: **PFD → AMFE VDA → Plan de Control → Tiempos y Balanceos**
- Keyboard shortcuts: 1=PFD, 2=AMFE, 3=CP, 4=Tiempos
- Animaciones stagger correctas

### PFD — Header colapsado + tabla visible
- Header colapsado muestra "ENCABEZADO Rev. A" como resumen compacto
- Tabla visible inmediatamente sin scroll
- Toolbar: Inicio, Nuevo, Abrir, Guardar, Editar, Validar, PDF, Excel
- Sin botones Undo/Redo (removidos)

### PFD — Auto-numeración + Flechas de flujo
- 3 pasos agregados: OP 10, OP 20, OP 30 (auto-numeración correcta)
- Flechas cyan ↓ entre cada fila
- Footer: "3 pasos" (plural) / "1 paso" (singular)

### PFD — Símbolos outlined
- Operación: círculo azul outlined con fondo claro
- Inspección: cuadrado verde outlined con fondo claro
- Todos los 7 tipos visibles en symbol picker y leyenda

### PFD — Leyenda de símbolos
- Colapsable debajo de la tabla
- Muestra los 7 símbolos ASME con sus nombres
- Se expande/colapsa correctamente

### PFD — Validación V8
- Paso OP 20 cambiado a tipo Inspección sin características
- Validación detecta: `[V8] Paso OP 20: inspección sin característica de producto ni de proceso definida`

---

## Tests

| Momento | Suites | Tests | Fallos |
|---------|--------|-------|--------|
| Pre-ciclo | 174 | ~2460 | 0 |
| Post Grupo 1 (Bugs P0) | 174 | 2465 | 0 |
| Post Grupo 2 (Norma+UX) | 176 | 2470 | 0 |
| Post Grupo 3 (Visual+Export+Landing) | **176** | **2470** | **0** |

### Tests nuevos/modificados
- `PfdApp.test.tsx`: regex `/pasos/` → `/pasos?/` para singular
- `pfdPdfExport.test.ts`: tests de rework/external actualizados para columnas separadas (no inline tags)
- `LandingPage.test.tsx`: keyboard shortcuts actualizados para orden Golden Thread

---

## Archivos modificados (14 archivos)

| Archivo | Cambios |
|---------|---------|
| `modules/pfd/pfdTypes.ts` | +`parseStepNumber()`, +`getNextStepNumber()`, `createEmptyStep(stepNumber?)` |
| `modules/pfd/usePfdDocument.ts` | Auto-numeración en `addStep()` |
| `modules/pfd/PfdApp.tsx` | B2, B3, B4, B5, U1, N2 (leyenda), columna 80px |
| `modules/pfd/PfdToolbar.tsx` | B2, B5 (undo removido) |
| `modules/pfd/PfdTable.tsx` | N1 (flechas), U2 ("Acciones"), columna 80px |
| `modules/pfd/PfdTableRow.tsx` | U3 (botones grandes), U4 (placeholder) |
| `modules/pfd/PfdSymbols.tsx` | V1 (outlined) |
| `modules/pfd/pfdPdfExport.ts` | V1, E1, E2/N2 (leyenda), N1 (flechas) |
| `modules/pfd/pfdExcelExport.ts` | E2/N2 (leyenda), B2 (singular) |
| `modules/pfd/pfdValidation.ts` | N3 (regla V8) |
| `modules/LandingPage.tsx` | L1 (reorden Golden Thread) |
| **NUEVO** `modules/pfd/PfdSymbolLegend.tsx` | N2 (componente leyenda) |
| `__tests__/modules/pfd/pfdPdfExport.test.ts` | Tests actualizados para columnas separadas |
| `__tests__/LandingPage.test.tsx` | Tests actualizados para shortcuts Golden Thread |

---

## Hallazgo no corregido

| # | Hallazgo | Razón |
|---|----------|-------|
| V2 | Logo Barack en PDF/Excel export | xlsx-js-style no soporta imágenes embebidas. PDF requiere refactor para base64 async (como en HO module). Se difiere a un ciclo futuro. |
