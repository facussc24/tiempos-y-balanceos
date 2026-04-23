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

## DEBUG FLOW (obligatorio antes de tocar el renderer)

Cuando Fak reporta un bug visual en el PDF, el flujo correcto es:

1. **Navegar a `/?module=pfd-debug&id=<docId>`** en preview_start o GitHub Pages. Esta ruta renderiza el PFD sin UI de chrome, ancho completo, igual al export PDF pero visible en browser.
2. **preview_screenshot** de la seccion relevante (tramo adhesivado, header, merge, etc).
3. **Comparar contra el PDF exportado** (si Fak lo mando como screenshot).
4. **Diferenciar**: si el bug aparece en preview_debug Y en PDF -> bug del renderer (JSX / flowStyles). Si solo en PDF -> bug de html2canvas/html2pdf (ver seccion html2canvas issues).
5. **NUNCA** pushear sin haber confirmado el fix en preview_debug.

## Issues conocidos de html2pdf.js / html2canvas (GitHub validados 2026-04-23)

Referencia: multiples iteraciones de Fak con PDF del IP PAD que cortaban contenido, tenian colisiones, o perdian lineas finas.

### Issue #1 — `position: absolute` cortado a la derecha
- **Fingerprint**: un nodo tiene `branchSide` con brazo horizontal (`absolute left-full` o `left-[50%]`) + sub-flow anidado (`w-[600px]`). En el PDF se corta a la derecha del area imprimible.
- **GitHub ref**: [eKoopmans/html2pdf.js#277](https://github.com/eKoopmans/html2pdf.js/issues/277), [#409](https://github.com/eKoopmans/html2pdf.js/issues/409)
- **Workaround validado** (html2canvas config en pfdPdfExport.ts):
  ```js
  html2canvas: {
    scale: 3,
    width: realWidth,          // scrollWidth real del body
    windowWidth: realWidth,    // fuerza viewport interno
    scrollX: 0, scrollY: 0,
    onclone: (doc) => {
      doc.body.style.width = realWidth + 'px';
      doc.body.style.overflow = 'visible';
    }
  }
  ```
- **Fix estructural preferido**: achicar el sub-flow (`w-[600px]` -> `w-[480px]`) o usar **CSS Grid 3-col** en PfdFlowChart separando main-flow / side-branches / reference-panel.

### Issue #2 — Absolute colisiona con sibling estatico
- **Fingerprint**: un `branchSide` terminal (RECLAMO PROVEEDOR, SEGREGAR) se superpone con un panel lateral estatico (FlowReferenceBox con part numbers). `z-index` NO resuelve porque son colisiones FISICAS (ambos ocupan pixeles), no de stacking.
- **Fix estructural**: reservar espacio para absolutes con **CSS Grid explicita**:
  ```tsx
  <div className="grid grid-cols-[1fr_320px_280px] gap-6">
    <div>{/* main flow vertical */}</div>
    <div>{/* side branches terminals */}</div>
    <div>{/* part numbers panel */}</div>
  </div>
  ```
  O alternativamente `padding-right: <armWidth + terminalWidth>` en el wrapper del main flow.

### Issue #3 — Lineas finas (1-1.5px) desaparecen con scale alto
- **Fingerprint**: lineas horizontales de merge en ramas paralelas, spines verticales, brazos de branchSide se ven cortados o pixelados en el PDF. Preview web OK, PDF roto.
- **GitHub ref**: [niklasvh/html2canvas#1524](https://github.com/niklasvh/html2canvas/issues/1524), [Firefox bug 1490361](https://bugzilla.mozilla.org/show_bug.cgi?id=1490361)
- **Causa**: html2canvas a `scale: 3` rasteriza subpixel positions con rounding; bordes de 1-1.5px caen en el hueco entre pixels.
- **Fix CSS minimo**:
  - Borders y lineas: `2px` minimo (no `1.5px` ni `1px`)
  - Alternativa fallback: `box-shadow: 0 0 0 2px <color>` en lugar de `border`
  - Agregar `shape-rendering: crispEdges` a elementos SVG
  - Declarar en flowStyles.ts: `.h-\[2px\] { height: 2px; }`, `.w-\[2px\] { width: 2px; }`
- **Fix SVG (mas robusto)**: reemplazar `<div className="border-t-2">` por SVG overlay con `<line strokeWidth="3" shapeRendering="crispEdges">`.

### Issue #4 — Text cut at edges (ya resuelto historicamente con padding-bottom + escala)
Ver seccion abajo "Text glyph cut" (descenders de p/g/y/j/q).

## Migracion a html2canvas-pro (opcion low-risk 1-2h)

Si los workarounds CSS no alcanzan, `html2canvas-pro` es drop-in replacement:
- Mantiene mismo API que `html2canvas`
- Fixes de `color()`, `transform scale`, `fractional pixels`
- Mejor handling de `position:absolute` fuera del viewport
- Repo: https://github.com/yorickshan/html2canvas-pro

Migracion: `npm uninstall html2canvas && npm install html2canvas-pro`; cambiar imports en `pfdPdfExport.ts`. Testear con preview_debug y PDF real.

## Mitigacion estructural (mayor esfuerzo, mayor fidelidad)

Si html2canvas-pro + workarounds no resuelve, migrar a **modern-screenshot** (DOM -> SVG, no raster intermedio) o **Puppeteer-core + Chromium wasm** (fidelidad total, pero requiere backend).

Repos:
- https://github.com/qq15725/modern-screenshot (client-side, esfuerzo medio)
- Puppeteer-core + @sparticuz/chromium (server-side, esfuerzo alto pero gold standard)

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

### 3. Textos dentro de shapes quedan descentrados — SOLUCION DEFINITIVA: SVG

**LA UNICA SOLUCION QUE FUNCIONA: SVG puro con `textAnchor="middle"` +
`dominantBaseline="central"`.**

2026-04-20: probamos 4 approaches de html/css en orden, TODOS fallaron:
1. `transform: translateY(-0.5px)` compensatorio → empujo arriba, empeoro
2. `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%)` → se aplico pero html2canvas lo ignoro visualmente
3. `display: table; display: table-cell; vertical-align: middle` → CSS1 supuestamente soportado, pero html2canvas no movio nada
4. Paddings asimetricos (`paddingTop: 4px; paddingBottom: 1px`) → se aplicaron pero el glyph no se movio

**Causa raiz**: html2canvas calcula el baseline del texto en funcion de las
metrics de la fuente (Inter) y las ignora al escalar con `scale: 3`. El texto
siempre termina pegado al borde inferior del container, sin importar
verticalAlign, transforms ni paddings.

**Solucion final (commit dd0a475)**: reemplazar html/css con SVG para cualquier
shape que contenga texto centrado:
```tsx
// ShapeOperation: circulo con "10" adentro
<div style={{ width: 64, height: 40 }}>
  <svg width="64" height="40" viewBox="0 0 64 40" style={{ overflow: 'visible' }}>
    <ellipse cx="32" cy="20" rx="31" ry="19" fill="white" stroke="#60A5FA" strokeWidth="1.5" />
    <text x="32" y="20"
      textAnchor="middle"
      dominantBaseline="central"
      fill="#1E40AF" fontSize="11" fontWeight="bold"
      fontFamily="Inter, Arial, sans-serif">
      {id}
    </text>
  </svg>
</div>
```

**Por que SVG funciona donde html no**:
- Las coordenadas `x="32" y="20"` son absolutas, no dependen de metrics.
- `textAnchor="middle"` centra horizontalmente el texto en el punto x.
- `dominantBaseline="central"` centra verticalmente el CENTRO OPTICO del glyph
  en el punto y (no el baseline).
- html2canvas rendera SVG native sin calcular metrics propios.

**Pattern para cualquier shape con texto centrado en PFD export**:
```tsx
<div style={{ width: W, height: H }}>
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
    {/* Shape: ellipse, rect, circle, etc. */}
    <text
      x={W / 2}
      y={H / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily="Inter, Arial, sans-serif"
    >
      {text}
    </text>
  </svg>
</div>
```

**Para texto multi-linea** (ej. "RECLAMO PROVEEDOR" en 2 lineas): usar 2
elementos `<text>` con `y` offset desde el centro (`y={H/2 - 4.5}` primera
linea, `y={H/2 + 4.5}` segunda).

**ANTI-PATTERN** (NO usar en export PDF):
- `flex items-center` con texto chico
- `transform: translateY(...)` compensatorio
- `display: table-cell; verticalAlign: middle`
- Paddings asimetricos para "empujar" el texto
- Cualquier html/css con expectativa de centrado vertical preciso de glyph

## Workflow de fix de bugs del export PDF

### Paso 1: Identificar causa root ANTES de editar
Patrones comunes y causa:

| Sintoma | Causa probable | Fix |
|---|---|---|
| Texto cortado en parte inferior (descenders) | `truncate` / `overflow: hidden` | Quitar `truncate`, inline `overflow: visible` |
| Texto cortado en mitad | html2canvas metrics fallback font | `document.fonts.ready` antes del capture |
| Layout entero colapsa (texto sin CSS) | Clase Tailwind arbitrary no en flowStyles.ts | Inline `style={{}}` en lugar de arbitrary |
| **Texto desalineado dentro de shape (arriba/abajo)** | **html2canvas ignora verticalAlign** | **SVG puro con textAnchor+dominantBaseline (OBLIGATORIO)** |
| Cuadrito CC/SC descentrado del shape | Row sin altura explicita, `items-center` inconsistente | `minHeight: '48px'` inline en el row |
| Header se va a 2 paginas | Celdas demasiado altas | No usar `min-height` excesivo; line-height con padding moderado |
| SCRAP cuando Fak quiere RECLAMO | Terminal rotulado segun `step.description` | Regex match en `pfdToFlowData.ts` |

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
| 8164cf1 | Fix v2: position:absolute+translate(-50%,-50%) | Se aplico pero html2canvas lo ignoro visualmente |
| 6baefa6 | Fix v3: minHeight:48px explicito en row | Alineo cuadritos CC/SC con shapes OK (eso SI funciono) |
| 5cabab1 | Fix v4: table-cell + verticalAlign + paddings asimetricos | Se aplico pero html2canvas NO movio textos |
| dd0a475 | Fix v5 FINAL: SVG puro con textAnchor+dominantBaseline | FUNCIONO — Fak confirmo "al fin" |

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
