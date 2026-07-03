---
description: Reglas para exportacion Excel y PDF
paths:
  - "modules/**/*Export*.ts"
  - "modules/**/*export*.ts"
  - "components/modals/ExportModal*.tsx"
---

# Exportacion Excel/PDF

## Librerias por modulo — NUNCA mezclar
- AMFE y CP: SOLO `xlsx-js-style`.
- HO (legacy, solo lectura historica): SOLO `ExcelJS` (imagenes: logo + pictogramas PPE).
- Export AMFE oficial (formulario I-AC-005.3): via node, skill `amfe-export-oficial` (`scripts/_exportOficial.ts`), NO desde la app.

## Patrones de NaN (bugs frecuentes)
- `Math.max(...[])` = `-Infinity` → validar array no vacio; `Math.max(x, NaN)` = NaN → `Number.isFinite()` o `|| 0`.
- `.length` de non-string = undefined → NaN en calculos → castear `String()`.
- Sort comparators con NaN violan el contrato de Array.sort() → orden no deterministico.
- Step numbers / orders con data corrupta: `.filter(Number.isFinite)` antes de `Math.max(...spread)`.

## Excel (xlsx-js-style)
- Row heights: calcular por contenido, no hardcodear indices. Indices de fila con variables dinamicas (separatorIdx), no constantes.
- Merge spans: bounds check contra `rows.length`. Formula injection: `sanitizeCellValue()`.
- **Ordenamiento de operaciones**: SIEMPRE `parseInt(operationNumber)`, NUNCA string sort ("10","100","20").

## CP Export
- NO incluir columna IT/controlProcedure.
- Nombres de columnas IDENTICOS al formato referencia empresa (EXPORT_COLUMNS propio del export file; NO derivar de CP_COLUMNS de la UI).
- Columna Componente/Material: 2da del grupo Proceso, rotada 90°, merge vertical, ancho ~5 chars.

## PDF (html2pdf.js)
- Async con assets base64 embebidos. `table-header-group` en thead para repeticion en page breaks; `page-break-inside: auto` en tablas.
- Celdas sin datos: colspan con texto ("Sin causas definidas"), no celdas vacias.
