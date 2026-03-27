# Auditoría General — Barack Mercosul

**Fecha:** 2026-03-27
**Versión auditada:** Desarrollo (localhost:3002)
**Auditor:** Claude Opus 4.6

---

## RESUMEN EJECUTIVO

| Severidad | Cantidad | Detalle |
|-----------|----------|---------|
| BLOCKER   | 1        | AMFE de 3 headrests crashea al abrir (we.type.substring sin null-check) |
| MAJOR     | 0        | — |
| MINOR     | 2        | 2 tests fallan por acentos en assertions |
| COSMETIC  | 16       | 14 catch silenciosos + 1 dead code + 1 demo data residual |

### Exports
- **8/8 APQP paquetes**: generan sin error (Portada + Flujograma + AMFE + CP)
- **AMFE Excel**: verificado Armrest — genera sin error
- **HO individual**: no testeado en export directo (requiere navegación manual)

### Estado general
**DEPLOYABLE con 1 fix obligatorio**: corregir `we.type?.substring(0, 3)` en AmfeTableBody.tsx (3 líneas). Los 3 headrests quedan bloqueados hasta ese fix. El resto de la app funciona correctamente.

---

## FASE 1 — Exports

### Inventario de documentos en Supabase

| Producto | AMFE (ops) | CP (items) | HO (sheets) | PFD (steps) |
|----------|-----------|------------|-------------|-------------|
| Armrest Door Panel | 22 ops, 109 causas, AP-H:45 | 178 items | 22 sheets | 43 steps |
| Headrest Front | 10 ops, 67 causas, AP-H:4 | 69 items | 10 sheets | 23 steps |
| Headrest Rear Center | 9 ops, 62 causas, AP-H:2 | 67 items | 9 sheets | 23 steps |
| Headrest Rear Outer | 9 ops, 62 causas, AP-H:2 | 69 items | 9 sheets | 23 steps |
| Insert Patagonia | 22 ops, 110 causas, AP-H:60 | 253 items | 22 sheets | 46 steps |
| Telas Planas PWA | 12 ops, 39 causas, AP-H:8 | 44 items | 12 sheets | 17 steps |
| Telas Termoformadas PWA | 9 ops, 21 causas, AP-H:0 | 27 items | 9 sheets | 21 steps |
| Top Roll Patagonia | 11 ops, 50 causas, AP-H:2 | 96 items | 11 sheets | 25 steps |

**Total: 32 documentos (8 familias × 4 tipos)**

### Paquete APQP (8 productos)

| Producto | Exportó | Error consola | Hojas |
|----------|---------|---------------|-------|
| Armrest Door Panel | ✅ | 0 | Portada + Flujograma + AMFE + CP |
| Headrest Front | ✅ | 0 | Portada + Flujograma + AMFE + CP |
| Headrest Rear Center | ✅ | 0 | Portada + Flujograma + AMFE + CP |
| Headrest Rear Outer | ✅ | 0 | Portada + Flujograma + AMFE + CP |
| Insert Patagonia | ✅ | 0 | Portada + Flujograma + AMFE + CP |
| Telas Planas PWA | ✅ | 0 | Portada + Flujograma + AMFE + CP |
| Telas Termoformadas PWA | ✅ | 0 | Portada + Flujograma + AMFE + CP |
| Top Roll Patagonia | ✅ | 0 | Portada + Flujograma + AMFE + CP |

Nota: HO se exporta individualmente (requiere ExcelJS para imágenes).

### AMFE Excel (muestra: Armrest)
- Exportó sin error desde menú "Más → Excel: AMFE Completo"
- 0 errores de consola

---

## FASE 2 — UI: Navegación y Carga de Datos

### Landing Page
- ✅ 8 productos visibles con nombre y part number correcto
- ✅ Todos marcados como "Completo" (verde)
- ✅ Fases correctas: 5 Pre-lanzamiento, 3 Producción
- ✅ Todos tipo "Maestro"
- ✅ Todos con checkmark AP-H
- ✅ 32 documentos totales
- ✅ Sidebar funcional (14 módulos)
- ✅ 0 errores de consola

### AMFE VDA por producto

| Producto | Carga | Operaciones | Badges | Error |
|----------|-------|-------------|--------|-------|
| Armrest Door Panel | ✅ | 22 ops visibles | R:5 M:49 L:56 | — |
| Headrest Front | ❌ CRASH | — | — | `we.type.substring` undefined |
| Headrest Rear Center | ❌ CRASH | — | — | `we.type.substring` undefined |
| Headrest Rear Outer | ❌ CRASH | — | — | `we.type.substring` undefined |
| Insert Patagonia | ✅ | Carga OK | Visible | — |
| Telas Planas PWA | ✅ | Carga OK | Visible | — |
| Telas Termoformadas PWA | ✅ | Carga OK | Visible | — |
| Top Roll Patagonia | ✅ | Carga OK | Visible | — |

### Plan de Control (muestra: Armrest)
- ✅ 178 items, 100% completo
- ✅ Sin columna IT (correcto)
- ✅ Columna Máquina/Disp./Herram. presente
- ✅ Clasificación CC/SC con filtros
- ✅ Equipo incluye Producción (Mariana Vera)
- ✅ AMFE Vinculado mostrado
- ⚠️ Banner "192 cambios detectados en el AMFE" (informativo, no error)

### Hojas de Operaciones (muestra: Armrest)
- ✅ 22 sheets en sidebar
- ✅ HO-10 abierta con header Barack, datos de operación
- ✅ Logo visible, formato correcto
- ✅ Descripción con pasos numerados

### PFD (muestra: Armrest)
- ✅ Editor de flujo visible
- ✅ Operaciones OP 10, 15, 18 visibles
- ✅ Header con datos de producto completos
- ✅ Botones SVG, PDF funcionales

### Errores de consola globales
- **0 errores** en navegación normal (landing, AMFE, CP, HO, PFD)
- **1 error reproducible**: `TypeError: Cannot read properties of undefined (reading 'substring')` en `<AmfeTableBody>` al abrir cualquiera de los 3 headrests

---

## FASE 3 — Validaciones Cruzadas

### Código de validación verificado

| Validación | Archivo | Estado |
|-----------|---------|--------|
| PFD↔AMFE | `utils/pfdAmfeLinkValidation.ts` | ✅ Implementado, con tests |
| HO↔CP | `utils/hoCpLinkValidation.ts` | ✅ Implementado, con tests |
| CP interna (V1-V5) | `modules/controlPlan/cpCrossValidation.ts` | ✅ V1-V5 implementados |
| Cascada PFD→AMFE→CP→HO | `utils/crossDocumentAlerts.ts` | ✅ Implementado, con tests |

### Tests de validación
- `pfdAmfeLinkValidation.test.ts`: PASS
- `hoCpLinkValidation.test.ts`: PASS
- `cpCrossValidation.test.ts`: PASS
- `crossDocumentAlerts.test.ts`: PASS

### Observación
- El CP de Armrest muestra "192 cambios detectados en el AMFE que afectan este Plan de Control" — esto indica que hay cambios pendientes de sincronización entre AMFE y CP para este producto.

---

## FASE 4 — Bugs de Código

### BUG-001: BLOCKER — AmfeTableBody crash en headrests

**Archivo:** `modules/amfe/AmfeTableBody.tsx`
**Líneas:** 661, 742, 848
**Error:** `we.type.substring(0, 3)` — `we.type` puede ser `undefined`
**Impacto:** 3 de 8 productos (Headrest Front, Rear Center, Rear Outer) no pueden abrir su AMFE
**Stack trace:**
```
TypeError: Cannot read properties of undefined (reading 'substring')
    at AmfeTableBody.tsx:1629:216 (Vite-transformed)
    at Array.forEach (<anonymous>) (causes loop)
    at AmfeTableBody.tsx:1541:28 (failures loop)
    at AmfeTableBody.tsx:1258:22 (functions loop)
    at AmfeTableBody.tsx:1015:23 (workElements loop)
    at AmfeTableBody (AmfeTableBody.tsx:842:16) (operations map)
```
**Fix sugerido:**
```tsx
// Cambiar en las 3 líneas:
{we.type.substring(0, 3)}
// Por:
{(we.type || '').substring(0, 3)}
```

**Nota:** Los datos en Supabase muestran que todos los work elements tienen `type` definido. El crash puede originarse en un draft local (SQLite) con datos incompletos, o en un estado transitorio durante la carga del documento.

### Catch blocks silenciosos (14 instancias)

| Archivo | Línea | Contexto | Riesgo |
|---------|-------|----------|--------|
| FamilyManager.tsx | 183 | Conteo de productos huérfanos | Bajo |
| CpToolbar.tsx | 597 | Contexto desconocido | Medio |
| HoHeaderForm.tsx | 39 | Búsqueda de pieza | Bajo |
| AmfeHeaderForm.tsx | 52 | Enriquecimiento opcional | Bajo |
| PfdHeader.tsx | 43 | Enriquecimiento opcional | Bajo |
| useNetworkHealth.ts | 99 | Auto-sync backup | Bajo |
| useDocumentLock.ts | 71, 96 | Lock refresh/release | Bajo |
| useRevisionControl.ts | 171, 183 | Guardado de revisión | Bajo |
| useProjectPersistence.ts | 251 | Auto-export | Bajo |
| useProductSearch.ts | 76 | Enriquecimiento opcional | Bajo |

**Veredicto:** La mayoría son fire-and-forget intencionales. Solo `CpToolbar.tsx:597` debería investigarse.

### Sort calls — TODOS CORRECTOS
- 19 `.sort()` verificados en modules/
- Todos los ordenamientos de operationNumber/processStepNumber usan `parseInt()`
- No se encontraron sorts string vs numérico en campos numéricos

### dangerouslySetInnerHTML — 2 instancias seguras
- `PrintView.tsx:25` — Contenido pre-generado
- `ManualesApp.tsx:312` — Contenido de manual

### console.log en producción — 0 instancias
- Todo el código usa `logger.ts` correctamente

### Dead code
- `utils/formatting.ts:109` — función `safeFormatDate` nunca usada. Puede eliminarse.

### Demo data residual
- `modules/registry/demoRegistryData.ts` — datos fake (clientes/part numbers ficticios) que se muestran si la DB está vacía. No afecta uso normal pero debería limpiarse.

### Imports y TypeScript
- TypeScript compila sin errores (verificado con `npx tsc --noEmit`)
- No se encontraron imports rotos obvios

---

## FASE 5 — Tests

### Resultados globales
```
Test Files:  256 passed | 2 failed | 1 skipped (259 total)
Tests:       4080 passed | 2 failed | 8 skipped (4090 total)
Duration:    195.98s
```

### Tests fallidos

**1. CpHelpPanel.test.tsx — línea 40**
```
Expected: screen.getByText('Produccion')
Actual:   El componente renderiza 'Producción' (con acento)
```
**Causa:** El test busca 'Produccion' sin acento, pero el componente usa 'Producción' con acento.
**Fix:** Cambiar `'Produccion'` → `'Producción'` en el test.
**Severidad:** MINOR

**2. SolicitudServerStatus.test.tsx — línea 86**
```
Expected: title contiene '1 operacion pendiente'
Actual:   title es '1 operación pendiente — clic para reintentar'
```
**Causa:** Doble error — falta acento en 'operación' + el title cambió a incluir "— clic para reintentar".
**Fix:** Cambiar `'1 operacion pendiente'` → `'1 operación pendiente'` en el test.
**Severidad:** MINOR

### Tests con datos potencialmente obsoletos
- Los tests usan datos inline (no fixtures globales), por lo que no hay riesgo de datos viejos hardcodeados.

---

## FASE 6 — Conclusiones

### Deployable: SÍ, con 1 fix obligatorio

El fix es trivial (3 líneas, agregar optional chaining) y no tiene efectos secundarios. Una vez aplicado, la app está en condición deployable.

### Fortalezas encontradas
1. **0 errores de consola** en navegación normal (5 de 8 productos)
2. **8/8 exports APQP** generan sin errores
3. **4080/4090 tests** pasan (99.8%)
4. **Todos los sorts** usan parseInt correctamente
5. **0 console.log** en producción — todo va por logger.ts
6. **Validaciones cruzadas** implementadas y testeadas (PFD↔AMFE, HO↔CP, CP V1-V5, Cascada)
7. **32 documentos** completos con datos reales
8. **Error boundaries** funcionan correctamente (atrapan el crash de headrests sin romper toda la app)

### Acciones pendientes
1. **OBLIGATORIO:** Fix `we.type?.substring(0, 3)` en AmfeTableBody.tsx (3 líneas)
2. **Recomendado:** Fix 2 tests con acentos (CpHelpPanel, SolicitudServerStatus)
3. **Opcional:** Revisar catch silencioso en CpToolbar.tsx:597
4. **Opcional:** Eliminar dead code `safeFormatDate` en `utils/formatting.ts:109`
5. **Opcional:** Limpiar `demoRegistryData.ts` (datos fake residuales)
6. **Informativo:** El CP de Armrest tiene 192 cambios pendientes de sincronización con AMFE
7. **Informativo:** `useDocumentLock.ts:71` silencia fallo de heartbeat de lock — podría permitir que otro usuario robe la sesión de edición
