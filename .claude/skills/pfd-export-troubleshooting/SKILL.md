---
name: pfd-export-troubleshooting
description: Diagnosticar y arreglar bugs del export PDF del flujograma PFD (html2pdf.js + html2canvas). Usar cuando Fak reporta textos cortados, desalineados, layout roto, o cualquier issue visual en el PDF exportado del PFD.
auto_load_globs:
  - modules/pfd/flow/**
  - modules/pfd/pfdHtmlExport.ts
  - modules/pfd/pfdPdfExport.ts
  - modules/pfd/pfdToFlowData.ts
  - modules/pfd/flowStyles.ts
---

# PFD Export Troubleshooting — Skill

Skill consolidando todos los fixes y lecciones del export PDF del modulo PFD en Barack Mercosul. Creada 2026-04-20 despues de 5 iteraciones para arreglar textos cortados y desalineados en el PDF.

## Stack del export PDF

```
PfdDocument
  → convertPfdToFlowData()    (pfdToFlowData.ts: traduce a FlowNodeData)
  → PfdFlowChart React         (flow/PfdFlowChart.tsx)
     ├── FlowHeader           (grid 3-col: logo, titulo, metadata)
     ├── FlowSequence         (vertical con FlowNode recursivos)
     └── FlowReferencePanel   (lista part numbers + leyenda)
  → renderToStaticMarkup()    (React → HTML estatico)
  → wrapInStandaloneHtml()    (flowStyles.ts: embebe CSS pre-compilado)
  → html2canvas (scale 3)     (rasteriza HTML → canvas)
  → html2pdf.js               (canvas → PDF mono-pagina)
```

## Reglas CRITICAS (no romper)

### 1. flowStyles.ts NO es Tailwind JIT
Es un string CSS **pre-compilado, hardcoded**. Contiene SOLO las clases que ya
estaban en uso cuando se escribio. Si usas una clase Tailwind que NO existe ahi,
**no aplica estilo** y puede romper el layout entero.

Clases que SI existen (muestra, ver archivo completo):
- `text-[6px]`, `text-[7px]`, `text-[8px]`, `text-[8.5px]`, `text-[9px]`, `text-[10px]`, `text-[11px]`
- `leading-none`, `leading-snug`, `leading-tight`, `leading-relaxed` (valores relativos, NO px)
- `py-[3px]`, `px-1.5`, `p-1.5`, `p-2`, `px-3`, `py-0.5`, `py-1.5`
- `truncate` (pero OJO, ver problema abajo)
- `whitespace-nowrap`, `overflow-x-auto`
- `flex`, `flex-col`, `items-center`, `justify-center`, `justify-end`, `shrink-0`

Clases que NO existen (rompen si las usas):
- Arbitrary line-height: `leading-[8px]`, `leading-[13px]`, etc. → NO usar
- Arbitrary padding: `py-[2px]`, `pb-px`, `pb-[1px]` → NO usar
- `overflow-visible`, `overflow-hidden` como clase Tailwind → NO usar
- `text-ellipsis`, `mt-px` (puede faltar alguno)

**Regla de oro**: si necesitas un valor que no esta en flowStyles.ts, usalo
como **inline `style={{}}`**. Los inline styles se renderizan literalmente en el
HTML y html2canvas los respeta 100%.

### 2. `truncate` recorta descenders
La clase `truncate` incluye `overflow: hidden` que recorta las letras con
descender (p, g, y, j, q) al rasterizar en canvas. En fuentes <10px se nota.

**Fix**: reemplazar `truncate` por inline:
```tsx
style={{ whiteSpace: 'nowrap', overflow: 'visible' }}
```

### 3. Textos dentro de shapes quedan descentrados
`flex items-center` centra la line-box del texto (font-size + ascender +
descender), NO el glyph optico. En la fuente Inter el cap-height esta
desplazado ~1px arriba del centro visual de la line-box. html2canvas respeta
eso literalmente → texto queda ligeramente arriba o abajo segun el cap-height.

**Fix A (ideal para texto 1-linea en shapes fijos)**: position absolute +
translate(-50%, -50%). Centra el bounding-box real del span, NO depende de
metrics de fuente. Usado en ShapeOperation, ShapeInspection, ShapeOpIns.
```tsx
<div style={{ position: 'relative' }}>
  <span style={{
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  }}>{id}</span>
</div>
```

**Fix B (para texto multi-linea o containers flexibles)**: paddingTop asimetrico.
Empuja el texto hacia abajo para compensar el cap-height de Inter arriba.
```tsx
<span style={{
  lineHeight: 1.15,
  paddingTop: '3px',
  paddingBottom: '2px',
  display: 'inline-block',
}}>{text}</span>
```

**ANTI-PATTERN** (NO usar):
- `transform: translateY(-0.5px)` — empuja arriba sin razon, empeora el bug
- Solo `lineHeight: 1` sin paddingTop — en Inter queda ligeramente arriba
- `flex items-center` para textos chicos con precision critica

## Workflow de fix de bugs del export PDF

### Paso 1: Identificar causa root ANTES de editar
Patrones comunes y causa:

| Sintoma | Causa probable |
|---|---|
| Texto cortado en parte inferior (descenders) | `truncate` / `overflow: hidden` |
| Texto cortado en mitad | html2canvas metrics fallback font → usar `fonts.ready` |
| Layout entero colapsa (texto sin CSS) | Clase Tailwind arbitrary no existe en flowStyles.ts |
| Texto desalineado hacia abajo del shape | `lineHeight > 1` centra caja, no glyph |
| Header se va a 2 paginas | Celdas demasiado altas (padding o min-height excesivo) |
| SCRAP en ingles cuando Fak quiere RECLAMO | Terminal rotulado segun `step.description` en pfdToFlowData.ts |

### Paso 2: Test LOCAL antes de pushear a produccion
SIEMPRE antes de commitear cambios en `modules/pfd/flow/*` o
`modules/pfd/pfdHtmlExport.ts`:

```javascript
// En preview_eval del dev server:
const { buildPfdSvg } = await import('/modules/pfd/pfdHtmlExport.ts?t=' + Date.now());
const { getLogoBase64 } = await import('/src/assets/ppe/ppeBase64.ts?t=' + Date.now());
const logoBase64 = await getLogoBase64();

const testDoc = { /* doc mock con header + steps variados */ };
const html = buildPfdSvg(testDoc, logoBase64);
const blob = new Blob([html], { type: 'text/html' });
window.open(URL.createObjectURL(blob), '_blank');

// Inspeccionar el HTML parsed
const parser = new DOMParser();
const doc = parser.parseFromString(html, 'text/html');
// verificar inline styles, clases, terminal texts, etc.
```

### Paso 3: Commit + push + esperar CI
Fak testea en **GitHub Pages (produccion)**, NO dev server local:
- https://facussc24.github.io/tiempos-y-balanceos/
- CI tarda ~1 min
- Fak hace Ctrl+F5 para invalidar cache del bundle

```bash
cd /c/Users/FacundoS-PC/dev/BarackMercosul
npm run build
git add modules/pfd/flow/... modules/pfd/pfd*.ts
git commit -m "fix(pfd): ..."
git push origin main
gh run list --limit 1  # esperar "completed success"
```

### Paso 4: Fak confirma visualmente
NO asumir que funciono sin confirmacion visual de Fak en el PDF exportado desde
produccion. Si Fak reporta que persiste: no iterar sobre sintomas, diagnosticar
causa root de nuevo.

## Historial de bugs y fixes (2026-04-20)

| Commit | Fix | Lecciones |
|---|---|---|
| aa2a853 | Intento arbitrary Tailwind `leading-[13px]` | ROMPIO TODO el layout. Esas clases no existen en flowStyles.ts |
| be1fe3d | Revert de aa2a853 | Siempre tener backup / revert a mano |
| ef57df7 | Header con inline styles + SCRAP→RECLAMO PROVEEDOR | Funciono parcial, seguian cortadas letras |
| d31225c | scale:3 + fonts.ready en html2canvas | No resolvio (no era metrics) |
| e760335 | Quitar `truncate` de HeaderCell | RESOLVIO corte descenders |
| f51286f | Intento lineHeight:1 + translateY(-0.5px) | EMPUJO textos arriba del centro, Fak confirmo mal |
| 8164cf1 | Fix v2: position:absolute+translate(-50%,-50%) | Approach robusto independiente de metrics fuente |

## Config html2canvas recomendada

En `pfdPdfExport.ts`:
```typescript
html2canvas: {
  scale: 3,             // triple resolucion subpixel, evita artefactos de baseline
  useCORS: true,
  letterRendering: true, // mejor espaciado texto
  backgroundColor: '#ffffff',
}
```

Y esperar fonts.ready antes de capturar:
```typescript
const iframeWin = iframe.contentWindow;
if (iframeWin && 'fonts' in iframeWin.document) {
  try { await (iframeWin.document as any).fonts.ready; } catch { /* noop */ }
}
```

## Checklist pre-push (pegar como comentario en PR)

- [ ] npm run build OK
- [ ] Test local via buildPfdSvg() en dev server + window.open blob
- [ ] Inspeccionar HTML output: clases usadas existen en flowStyles.ts
- [ ] Inline styles en spans con line-height/padding custom
- [ ] No usar `truncate` en textos con descenders
- [ ] Verificar que NO se va a 2 paginas (no aumentar altura de celdas)
- [ ] Commit + push + esperar CI
- [ ] Decir a Fak: "pusheado XXX, Ctrl+F5 en URL produccion y probar"

## Referencias

- `.claude/rules/pfd.md` — formato de nombres, convenciones PFD, colores
- `modules/pfd/flowStyles.ts` — CSS hardcoded del export
- `modules/pfd/flow/FlowHeader.tsx` — HeaderCell con inline styles
- `modules/pfd/flow/Shapes.tsx` — ShapeOperation, ShapeTerminalSide con lineHeight:1
- `modules/pfd/flow/FlowNode.tsx` — CC/SC label con lineHeight:1
- `modules/pfd/pfdToFlowData.ts` — MATERIAL CONFORME → RECLAMO PROVEEDOR
- `modules/pfd/pfdPdfExport.ts` — html2canvas config (scale:3, fonts.ready)

## Issue tracker relevante (html2pdf.js upstream)

- [#83 text is cut in the middle](https://github.com/eKoopmans/html2pdf.js/issues/83)
- [#13 text sliced at bottom](https://github.com/eKoopmans/html2pdf.js/issues/13)
- [#733 font quality](https://github.com/eKoopmans/html2pdf.js/issues/733)

## NotebookLM

Consultar `1-manejo-de-claude-code` para tips de html2pdf si aparece un bug raro:
```
mcp__notebooklm__ask_question notebook_id="1-manejo-de-claude-code" question="..."
```
