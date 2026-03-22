# Reporte Bundle Nocturno — 2026-03-22

## Build Output

- **Comando**: `npm run build` (vite build)
- **Tiempo de build**: 1m 56s
- **Modulos transformados**: 3,038
- **Errores de build**: 0

## Chunks mayores a 500KB

| Chunk | Tamano (minified) | Gzip | Causa |
|-------|-------------------|------|-------|
| exceljs.min.js | 939.50 KB | 270.99 KB | ExcelJS (export HO con imagenes) |
| xlsx.min.js | 869.82 KB | 322.78 KB | xlsx-js-style (export AMFE/CP) |
| App.js | 678.52 KB | 180.64 KB | Codigo principal de la app |
| html2pdf.js | 670.26 KB | 196.99 KB | html2pdf.js (export PDF) |
| index.js | 504.61 KB | 118.73 KB | Vendor index (framework core) |

## Chunks grandes (200-500KB)

| Chunk | Tamano | Gzip | Contenido |
|-------|--------|------|-----------|
| AmfeApp.js | 404.75 KB | 97.74 KB | Modulo AMFE completo |
| charts.js | 394.82 KB | 114.82 KB | Recharts (graficos) |
| html2canvas.esm.js | 202.36 KB | 48.04 KB | html2canvas (screenshots) |

## Chunks medianos (100-200KB)

| Chunk | Tamano | Gzip |
|-------|--------|------|
| supabase.js | 173.32 KB | 45.88 KB |
| index.es.js | 159.48 KB | 53.48 KB |
| ControlPlanApp.js | 105.97 KB | 28.45 KB |
| HojaOperacionesApp.js | 105.61 KB | 28.48 KB |
| PfdApp.js | 101.23 KB | 27.28 KB |

## Tamano Total Estimado

| Metrica | Valor |
|---------|-------|
| Total JS (minified) | ~6.2 MB |
| Total JS (gzip) | ~1.9 MB |
| Total CSS (minified) | 175.45 KB |
| Total CSS (gzip) | 27.00 KB |
| Imagenes (assets) | ~88 KB |

## Warnings de Build

1. **Circular dependency**: `pfdNormalize.ts` ↔ `pfdTypes.ts` (reexported through each other, may cause broken execution order)
2. **Mixed dynamic/static imports**: 6 modulos importados tanto dinamica como estaticamente (storageManager, amfePathManager, useAmfePersistence, supabaseClient, mediaManager, webFsHelpers)

## Dependencias mas pesadas

1. **ExcelJS** (939.50 KB) — Necesario para HO export con imagenes
2. **xlsx-js-style** (869.82 KB) — Necesario para AMFE/CP export
3. **html2pdf.js** (670.26 KB) — Export PDF
4. **Recharts** (394.82 KB) — Graficos dashboard
5. **html2canvas** (202.36 KB) — Dependencia de html2pdf
6. **Supabase** (173.32 KB) — Cliente de base de datos

## Analisis

### App.js (678.52 KB) — Que contiene?
El chunk principal `App.js` es grande porque incluye:
- Routing y layout principal
- AuthProvider y LoginPage
- Landing page con todos los componentes
- FamilyManager, DataManager
- Modales globales (StorageConfig, Confirm, Export)
- Database.ts y repositorios principales

### Recomendaciones (no aplicadas)
1. **Lazy load ExcelJS y xlsx-js-style**: Solo se necesitan al exportar, no al cargar la app. Se podrian cargar con `import()` dinamico al momento del export
2. **html2pdf.js**: Idem, solo al exportar PDF
3. **App.js split**: Separar Landing page de los modales globales para reducir el chunk inicial
4. **Recharts tree-shaking**: Verificar que solo se importan los componentes usados

### Nota sobre doble libreria Excel
ExcelJS (940KB) + xlsx-js-style (870KB) = 1.8MB de librerias Excel. Esto es una decision de diseño documentada: xlsx-js-style para AMFE/CP (no soporta imagenes), ExcelJS para HO (necesita imagenes de logo + PPE). Consolidar en una sola libreria no es viable sin perder funcionalidad.
