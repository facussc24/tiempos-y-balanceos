---
description: Reglas para exportacion Excel y PDF
globs:
  - "modules/**/amfeExcelExport.ts"
  - "modules/**/amfePdfExport.ts"
  - "modules/**/hoExcelExport.ts"
  - "modules/**/hojaOperacionesPdfExport.ts"
  - "modules/**/controlPlanExcelExport.ts"
  - "modules/**/controlPlanPdfExport.ts"
---

# Exportacion Excel/PDF

## Patrones de NaN (bugs frecuentes)
- `Math.max(...[])` retorna `-Infinity` — siempre validar array no vacio
- `Math.max(x, NaN)` retorna `NaN` — usar `Number.isFinite()` o `|| 0`
- `.length` de un valor non-string es `undefined` → NaN en calculos — usar `String()`
- Sort comparators con NaN violan contrato de Array.sort() → orden no-deterministico

## Excel (xlsx-js-style)
- Row heights: calcular basado en contenido, no hardcodear indices
- Merge spans: bounds check contra `rows.length` (doc puede cambiar mid-export)
- Formula injection: `sanitizeCellValue()` previene inyeccion de formulas
- Indices de fila: usar variables dinamicas (separatorIdx), no constantes hardcodeadas

## PDF (html2pdf.js)
- Async con base64-embedded logo y PPE images
- `table-header-group` en thead para repeticion en page breaks
- `page-break-inside: auto` en table
- Causas vacias: colspan con "Sin causas definidas" (no celdas vacias)
- PdfAssets interface: `{ logoBase64: string; ppeBase64Map: Record<string, string> }`

## Reglas de Contenido

### Ordenamiento de operaciones
- SIEMPRE ordenar con `parseInt(operationNumber)`, NUNCA string sort.
- String sort produce: "10", "100", "20" en vez de 10, 20, 100.

### CP Export
- NO incluir columna IT/controlProcedure en el export de CP.
- Nombres de columnas deben ser IDENTICOS al formato referencia empresa. NO usar nombres abreviados distintos al formato oficial.
- Columna Componente/Material: 2da columna del grupo Proceso, texto rotado 90° vertical, merge vertical por material, ancho angosto (~5 chars).
- EXPORT_COLUMNS definido en el export file con labels propios (NO derivar de CP_COLUMNS que tiene labels cortos para la UI).

### Librerias por modulo
- AMFE y CP: SOLO `xlsx-js-style`.
- HO: SOLO `ExcelJS` (necesita imagenes: logo + pictogramas PPE).
- NUNCA mezclar librerias de Excel en el mismo export.
