---
description: Reglas para exportacion Excel y PDF
globs:
  - "modules/**/*Export*.ts"
  - "modules/**/*export*.ts"
  - "modules/**/pfdSvgExport.ts"
  - "modules/**/pfdPdfExport.ts"
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

## Export PDF PFD (html2pdf.js + html2canvas + renderToStaticMarkup)

### Testear LOCALMENTE antes de push — OBLIGATORIO
Nunca pushear cambios a `modules/pfd/flow/*`, `modules/pfd/pfdHtmlExport.ts`, `modules/pfd/pfdToFlowData.ts`, `modules/pfd/pfdPdfExport.ts`, `modules/pfd/pfdSvgExport.ts` sin antes:
1. Generar un export HTML real con `buildPfdSvg()`.
2. Abrirlo en el browser.
3. Verificar visual — se ve IGUAL al estado anterior + solo mis cambios.
4. Si algo se ve distinto o roto, NO PUSHEAR.

**Incidente 2026-04-20:** cambios en FlowHeader.tsx y pfdToFlowData.ts con clases Tailwind arbitrary values (`leading-[13px]`, `pb-px`, `py-[2px]`) sin test local. Export en produccion colapso TODO el layout. Fak: "lo destruiste completamente". Hubo que revertir.

### NO usar Tailwind arbitrary values en componentes exportados
- `wrapInStandaloneHtml()` en `flowStyles.ts` tiene CSS **pre-compilado hardcoded**, NO Tailwind JIT.
- Clases arbitrary como `leading-[13px]` NO estan en ese CSS y pueden romper el parseo.
- Usar valores del tema Tailwind estandar (`leading-3`, `leading-4`, `py-1`) o `inline style={{}}`.
- Si realmente necesitas arbitrary: verificar primero que esten en `flowStyles.ts`, agregarlos si faltan, testear local.

### NO usar `class="truncate"` en componentes que se exportan
La clase Tailwind `truncate` (overflow:hidden + text-overflow:ellipsis + white-space:nowrap) **recorta descenders** (p, g, y, j, q) al rasterizar en html2canvas. Con fuentes <10px se nota mucho.

- Si necesitas nowrap en export: `inline style={{ whiteSpace: 'nowrap', overflow: 'visible' }}` en vez de `class="truncate"`.
- Si necesitas truncate con ellipsis: aceptar que va a recortar descenders, o aumentar line-height y padding-bottom para que el descender quepa en la zona "hidden" debajo del text-box visible.
- **Corregido 2026-04-20** en `modules/pfd/flow/FlowHeader.tsx` (HeaderCell). Commit e760335.

### Centrar texto en shapes — usar SVG puro, NO html/css
Para cualquier shape con texto centrado en el export PDF (OP ids, SC/CC labels, SCRAP terminals): usar SVG con `textAnchor="middle"` + `dominantBaseline="central"`. html/css (`flex`, `table-cell`, `transform translate`, paddings asimetricos) falla sistematicamente porque html2canvas calcula metrics propios de la fuente al rasterizar.

```tsx
<svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
  <ellipse cx={W/2} cy={H/2} rx={W/2-2} ry={H/2-2} fill="white" stroke="..." />
  <text x={W/2} y={H/2} textAnchor="middle" dominantBaseline="central">{id}</text>
</svg>
```

- Multi-linea: 2 `<text>` con y offsets (y={H/2 - 4.5}, y={H/2 + 4.5}) — mas robusto que `<tspan>`.
- Textos largos con wrap automatico: html/css sigue siendo mejor (SVG requiere medir ancho).
- UI interactiva (no export): html/css normal.

Skill asociado: `.claude/skills/pfd-export-troubleshooting/SKILL.md` (auto-load en `modules/pfd/flow/**`).
