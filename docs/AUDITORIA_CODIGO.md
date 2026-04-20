# Auditoria de Codigo — 2026-03-29

## Resumen Ejecutivo

Sesion completa de auditoria y mejoras del codebase Barack Mercosul.
Se trabajo en 3 fases: auditoria de limpieza, mejoras de infraestructura, y preparacion para modificaciones IA.

| Metrica | Antes | Despues |
|---------|-------|---------|
| TypeScript errores | 0 | 0 |
| Tests pasando | 258/258 (4086 tests) | 258/258 (4086 tests) |
| Imports/vars no usados | ~480 | 0 accionables |
| Dead exports | ~160 | 0 |
| `as any` en produccion | 8 | 2 (xlsx library, irremovibles) |
| ESLint errores accionables | ~200 | 0 |
| Hooks rules-of-hooks | 31 | 0 |
| Dependencias circulares | 1 | 0 |
| strictNullChecks | deshabilitado | habilitado (69 errores resueltos) |
| npm vulnerabilidades | 8 | 2 (html2pdf/jspdf, requiere breaking change) |

---

## FASE 1: Auditoria y Limpieza de Codigo (pasadas 1-13)

### Imports y variables no usados (~480 removidos, ~130 archivos)
- Imports de lucide-react, tipos, funciones, hooks no referenciados
- Variables declaradas pero nunca usadas
- Fix casing `solicitudIndexExcel` → `SolicitudIndexExcel` (TS1261)

### Dead exports (~160 funciones/constantes)
- Funciones exportadas que ningun otro archivo importaba
- Convertidas a file-private (sin borrar codigo)
- Areas principales: unified_fs (18 stubs Tauri), core/balancing (9), mix/logistics (23), utils (59), UI components (7), AMFE (5), CP/family (8), kanban (4), hooks (2)

### `as any` eliminados (5 de 7)
- `controlPlanTypes.ts`: delete + as any → destructuring rest
- `apqpPackageExport.ts`: {} as any → Object.fromEntries()
- `overrideTracker.ts`: delete + as any → destructuring rest
- Restantes 2: xlsx-js-style types incompletas (irremovibles)

### Bugs corregidos (10)
1. **AuthProvider**: `getSession()` sin catch → app colgada si Supabase falla
2. **useDocumentLock**: intervals creados despues de cleanup (race condition)
3. **pfdAmfeLinkValidation**: crash si `.operations` es null
4. **hoCpLinkValidation**: crash si `.items`/`.sheets` es null + sheetName undefined
5. **cpCrossValidation**: non-null assertion (`!`) insegura despues de `.find()`
6. **hoExcelExport/pdfExport**: sort NaN con visual aid order corrupto
7. **ConflictModal**: callback tipo `void` pero se await-ea (tipo incorrecto)
8. **Logger**: over-redaction de 'client', 'engineer', 'key' (terminos de dominio)
9. **dataExportImport**: SQL injection via table name en import (whitelist agregada)
10. **LoginPage**: boton dev login visible en produccion (gated a DEV mode)

### Seguridad
- Dev login gated con `import.meta.env.DEV`
- Import table whitelist contra SQL injection
- Clipboard API error handling
- FileReader onerror handler agregado

### Lint fixes
- JSX unescaped entities (comillas) — ~30 archivos
- prefer-const — variables nunca reasignadas
- React.memo displayName — 4 componentes
- Regex useless escapes — 6 archivos
- Empty catch blocks — comments agregados
- Ternary as expression statement → if-else

---

## FASE 2: Mejoras de Infraestructura

### ESLint config
- Disabled `react/prop-types` (redundante con TypeScript, eliminaba ~100 falsos positivos)

### npm audit fix
- 14 dependencias actualizadas (non-breaking)
- Quedan 2 criticas: html2pdf.js/jspdf (requiere --force, breaking change)

### .gitignore
- `exports/test-*`, `*.bak`, `/*.mjs` (excepto eslint.config.mjs)

### App.tsx hooks refactor
- Split en `App` (wrapper sin hooks) + `AppMain` (todos los hooks incondicionales)
- Elimina 30+ violaciones de react-hooks/rules-of-hooks
- Cero cambio de logica — solo reorganizacion estructural

### EducationalTooltip hooks fix
- useLayoutEffect movido antes del early return
- Elimina la ultima violacion de rules-of-hooks

### Dependencia circular PFD rota
- `pfdTypes.ts` re-exportaba `normalizePfdStep` de `pfdNormalize.ts`
- `pfdNormalize.ts` importaba de `pfdTypes.ts` → ciclo
- Fix: consumers ahora importan directo de `pfdNormalize.ts`
- Confirmado con madge: 0 dependencias circulares

### strictNullChecks habilitado
- 69 errores resueltos (17 en produccion, 8 en tests, 1 en scripts)
- Produccion: nullish coalescing (`?? 0`, `?? ''`), null guards
- Tests: `as unknown as Task` para objetos parciales, `?? 0` para opcionales
- TypeScript ahora atrapa bugs de null/undefined en tiempo de compilacion

### Documentation rules updated
- `.claude/rules/database.md`: SCHEMA_VERSION 3→14, 8→16 repositorios
- `.claude/rules/exports.md`: globs expandidos a 15 archivos de export
- `.claude/rules/control-plan.md`: 10 funciones de validacion listadas

---

## FASE 3: Preparacion para Modificaciones IA

### Investigacion (3 agentes lideres)
Se desplegaron 3 agentes especializados para evaluar si el software esta listo para que la IA modifique AMFEs y CPs de forma autonoma:

**Lider 1 — Conocimiento AMFE:** Las reglas tenian gaps criticos en O/D, specialChar, campos deprecados.
**Lider 2 — Conocimiento CP:** Faltaban fases del generador, funciones de inferencia, procedimientos SGC.
**Lider 3 — Readiness del codigo:** Score 6/10, faltaban transacciones, validacion pre-save, tracking IA.

### 4 cambios implementados

#### 1. Reglas de conocimiento completadas
- `amfe.md`: escalas O/D con ejemplos, specialChar ("CC"|"SC"|""), characteristicNumber, filterCode, campos deprecados
- `control-plan.md`: 4 fases del generador, 4 funciones de inferencia documentadas, procedimientos SGC, autoFilledFields

#### 2. Transaction wrapper (`utils/transactionWrapper.ts`)
- `withTransaction(async (db) => { ... })` para saves atomicos multi-documento
- Pattern: BEGIN TRANSACTION / COMMIT / ROLLBACK
- Archivo nuevo, cero impacto en codigo existente

#### 3. Validacion pre-guardado
- `validateAmfeBeforeSave()`: chequea AP=H compliance + efectos 3-niveles
- `validateAndSaveAmfeDocument()`: wrapper que valida y luego guarda
- `validateAndSaveCpDocument()`: cross-valida vs AMFE y luego guarda
- Funciones existentes de guardado NO modificadas

#### 4. AI tracking en guardados
- Migracion 14→15: columna `modified_by_type` ('user'|'ai') en las 4 tablas de documentos
- `saveAmfeDocument`: nuevo parametro opcional `modifiedBy: { email, type }`
- `saveCpDocument`: mismo patron
- Activa campos `created_by`/`updated_by` que ya existian pero nunca se llenaban

---

## Observaciones NO corregidas (requieren decision del usuario)

### Logica de negocio (REGLA 3: no tocar)
- `cpCrossValidation.ts`: regla SC implementa S>=5 AND O>=4 (CLAUDE.md dice PROHIBIDO)
- `documentInheritance.ts`: idMap de regenerateUuids() no se propaga a cross-refs
- `changePropagation.ts`: variable `status` computada pero no pasada a createProposal()

### Otros
- Tauri references — ELIMINADAS 2026-04-20. Todos los `isTauri()` checks fueron removidos (57 ocurrencias en 23 archivos). La app es 100% web/Supabase.
- `as any` restantes (2 en xlsx-js-style) — types de libreria incompletas
- JSON.parse(JSON.stringify()) deep clone (12 usos) — riesgo de cambio sutil con structuredClone
- Credenciales de dev en git history — rotar password de Supabase
- html2pdf.js/jspdf vulnerabilidades — requiere --force (breaking change)

---

## Estadisticas Finales

| Metrica | Valor |
|---------|-------|
| Total archivos auditados | ~493 produccion |
| Total archivos corregidos | ~150+ |
| Dead code removido | ~800+ lineas, ~160 exports, ~480 imports |
| Bugs corregidos | 10 |
| Features agregadas | 4 (transaction wrapper, pre-save validation, AI tracking, enriched rules) |
| Total commits de auditoria | ~55 |
| Tests rotos introducidos | 0 |
| Errores TypeScript introducidos | 0 |
| Estado final | 0 errores TS, 4086/4086 tests, strictNullChecks ON, deployed |
