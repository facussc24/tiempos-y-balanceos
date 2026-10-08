/**
 * render.mjs — PROPUESTA B (compacto en una sola A3). Derivado de scripts/_flujograma.mjs.
 *
 * Diferencias con el original:
 *  - usa SU copia del motor (esta carpeta), no la de tools/flowchart/;
 *  - lee los datos de tools/flowchart/data/ tal como estan commiteados (git show HEAD:) y NO los modifica;
 *  - en vez de un PNG gigante, saca UN PDF vectorial de UNA pagina A3 (420 x 297 mm), apaisada o
 *    vertical (la que deje la letra mas grande), con la escala calculada para que entre;
 *  - mide: tamano de letra impreso en pt por DOM (px CSS x escala real) y deja un JSON de medidas.
 *
 * Uso:
 *   node render.mjs <clave> [--F 9] [--base] [--orient auto|h|v] [--out <carpeta>] [--png]
 *   --base : usa el motor ORIGINAL (copia literal) para tener la linea de base
 *   --F    : piso de letra en px CSS de diseno (parametro del motor compacto)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execFileSync } from 'child_process';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..', '..', '..');
// los JSON se leen como estan COMMITEADOS (git show HEAD:), no del archivo de trabajo: un cambio sin
// emitir no sale impreso (skill flujogramas §5 bis)
const emitido = (clave) => execFileSync('git', ['show', `HEAD:tools/flowchart/data/${clave}.json`], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 26 });
const TMP = join(AQUI, '.build');

const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const tiene = (n) => argv.includes(n);
const claves = argv.filter((a, i) => !a.startsWith('--') && !['--F', '--out', '--orient', '--sufijo', '--cfg'].includes(argv[i - 1]));
if (!claves.length) { console.error('Falta la clave del flujograma.'); process.exit(1); }

const BASE = tiene('--base');
const salida = resolve(flag('--out', join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'B_final_trabajo')));
const orient = flag('--orient', 'auto');
const sufijo = flag('--sufijo', '');
const cfgExtra = flag('--cfg') ? JSON.parse(flag('--cfg')) : {};
const F = flag('--F') ? Number(flag('--F')) : undefined;
const SOLO_MEDIR = tiene('--solo-medir');   // no escribe el PDF: devuelve las medidas

mkdirSync(TMP, { recursive: true });
mkdirSync(salida, { recursive: true });

const entry = join(AQUI, BASE ? 'entry_base.jsx' : 'entry.jsx');
const BUNDLE = join(TMP, BASE ? 'bundle_base.js' : 'bundle.js');
await build({ entryPoints: [entry], bundle: true, format: 'iife', jsx: 'automatic', outfile: BUNDLE, logLevel: 'error', minify: false });
const bundleJs = readFileSync(BUNDLE, 'utf8');
const css = readFileSync(join(AQUI, 'tailwind.css'), 'utf8');
const logo = `data:image/png;base64,${readFileSync(join(AQUI, 'assets', 'barack_logo.png')).toString('base64')}`;

// A3
const MM = 96 / 25.4;                 // px CSS por mm
const PAG = { w: 420, h: 297 };
const MARGEN_MM = Number(flag('--margen', 10.5));

// contenido esperado por nodo, en el MISMO orden DFS que annotate() del motor (nodo, ramas, rama lateral)
function esperados(flow) {
  const out = [];
  const walk = (seq) => {
    for (const nd of seq) {
      const e = { nid: out.length, step: nd.stepId || '', tipo: nd.type, textos: [] };
      out.push(e);
      for (const k of ['stepId', 'description', 'text', 'labelCondition', 'labelDown']) if (nd[k]) e.textos.push(String(nd[k]));
      if (nd.critical && nd.criticalType) e.textos.push(String(nd.criticalType));
      if (nd.incomingConnector) { e.textos.push('VIENE DE'); e.textos.push(String(nd.incomingConnector)); }
      if (nd.rework) e.textos.push(nd.rework.label || `RETRABAJO (A OP. ${nd.rework.targetId})`);
      const bs = nd.branchSide;
      if (bs) for (const k of ['stepId', 'text', 'description', 'labelNode']) if (bs[k]) e.textos.push(String(bs[k]));
      if (nd.branches) for (const b of nd.branches) walk(Array.isArray(b) ? b : b.sequence);
      if (bs && bs.sequence) walk(bs.sequence);
    }
  };
  walk(flow);
  return out;
}
function esperadosCajetin(d) {
  const t = [];
  const h = d.header || {};
  for (const k of ['title', 'documentCode', 'revision', 'date', 'preparedBy', 'reviewedBy', 'project', 'client']) if (h[k]) t.push(String(h[k]));
  t.push(h.revisionDate || '—');
  for (const sc of h.specialChars || []) { t.push(sc.mark); t.push(sc.meaning); }
  if (h.footerNote) t.push(h.footerNote);
  for (const p of d.products || []) for (const k of ['code', 'level', 'description', 'operations', 'version']) if (p[k]) t.push(String(p[k]));
  for (const r of d.revisions || []) for (const k of ['rev', 'date', 'item', 'details', 'pswDate', 'modifiedBy']) if (r[k]) t.push(String(r[k]));
  return t;
}

const navegador = await chromium.launch();
const resumen = [];
try {
  for (const clave of claves) {
    const datos = JSON.parse(emitido(clave));
    datos.logoUrl = logo;
    const cfgsFile = join(AQUI, 'cfgs.json');
    const cfgsDoc = existsSync(cfgsFile) ? JSON.parse(readFileSync(cfgsFile, 'utf8')) : {};
    datos.cfg = { ...(BASE ? {} : (cfgsDoc[clave] || {})), ...(F ? { F } : {}), ...cfgExtra };
    const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${css}</style>
<style>html,body{margin:0;background:#fff}#root{width:max-content}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>
</head><body><div id="root"></div>
<script>window.__FC__=${JSON.stringify(datos).replace(/</g, '\\u003c')};</script>
<script>${bundleJs}</script></body></html>`;
    const htmlPath = join(TMP, `${clave}${BASE ? '.base' : ''}${sufijo}.html`);
    writeFileSync(htmlPath, html, 'utf8');

    const pagina = await navegador.newPage({ viewport: { width: 3000, height: 2000 }, deviceScaleFactor: 1 });
    const errores = [];
    pagina.on('pageerror', e => errores.push(String(e)));
    pagina.on('console', m => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
    await pagina.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    await pagina.waitForFunction('window.__FC_LISTO__ === true', { timeout: 30000 });
    if (errores.length) throw new Error(`${clave}: ${errores.join(' | ')}`);

    // medidas del layout (px CSS)
    const caja = await pagina.evaluate(() => {
      const n = document.getElementById('pdf-content');
      const r = n.getBoundingClientRect();
      // union de TODO lo que se dibuja, por si algo sobresale (ramas absolute)
      let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
      for (const el of n.querySelectorAll('*')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;
        x0 = Math.min(x0, b.left); y0 = Math.min(y0, b.top); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom);
      }
      return { w: r.width, h: r.height, x0: x0 - r.left, y0: y0 - r.top, x1: x1 - r.left, y1: y1 - r.top };
    });

    // elegir orientacion y escala
    const W = caja.x1 - caja.x0, H = caja.y1 - caja.y0;
    const cabe = (pw, ph) => Math.min(((pw - 2 * MARGEN_MM) * MM) / W, ((ph - 2 * MARGEN_MM) * MM) / H);
    const sH = cabe(PAG.w, PAG.h), sV = cabe(PAG.h, PAG.w);
    let horizontal = orient === 'h' ? true : orient === 'v' ? false : sH >= sV;
    let c = horizontal ? sH : sV;           // c = escala de impresion de Chromium (1 px CSS = 0.75*c pt)
    const cTope = 2;
    const pw = horizontal ? PAG.w : PAG.h, ph = horizontal ? PAG.h : PAG.w;
    const cReal = Math.min(c, cTope);

    // centrar el contenido en la pagina: envoltorio del tamano de la pagina en px CSS / c
    const geom = await pagina.evaluate(({ pwpx, phpx, cReal, cajaU }) => {
      const n = document.getElementById('pdf-content');
      const root = document.getElementById('root');
      const wrap = document.createElement('div');
      wrap.id = 'hoja';
      const Wp = pwpx / cReal, Hp = phpx / cReal;
      wrap.style.cssText = `position:relative;width:${Wp}px;height:${Hp}px;overflow:hidden;background:#fff;`;
      n.style.position = 'absolute';
      const w = n.getBoundingClientRect().width, h = n.getBoundingClientRect().height;
      n.style.left = ((Wp - (cajaU.x1 - cajaU.x0)) / 2 - cajaU.x0) + 'px';
      n.style.top = ((Hp - (cajaU.y1 - cajaU.y0)) / 2 - cajaU.y0) + 'px';
      root.style.width = 'auto';
      root.appendChild(wrap);
      wrap.appendChild(n);
      document.body.style.margin = '0';
      return { Wp, Hp, w, h };
    }, { pwpx: pw * MM, phpx: ph * MM, cReal, cajaU: caja });

    // medir el texto (DOM): cada nodo de texto con su font-size computado
    const textos = await pagina.evaluate(() => {
      const out = [];
      const w = document.createTreeWalker(document.getElementById('pdf-content'), NodeFilter.SHOW_TEXT);
      let t;
      while ((t = w.nextNode())) {
        const s = t.nodeValue.replace(/\s+/g, ' ').trim();
        if (!s) continue;
        const el = t.parentElement;
        const cs = getComputedStyle(el);
        const rng = document.createRange(); rng.selectNodeContents(t);
        const b = rng.getBoundingClientRect();
        if (b.width === 0) continue;
        // zona: cabecera / flujo / leyenda
        const raiz = document.getElementById('pdf-content');
        let zona = 'flujo';
        if (el.closest('aside')) zona = 'leyenda';
        else if (el.closest('main')) zona = 'flujo';
        else zona = 'cabecera';
        out.push({ s: s.slice(0, 80), px: parseFloat(cs.fontSize), zona, x: b.left, y: b.top, w: b.width, h: b.height });
      }
      return out;
    });

    // cotejo uno por uno: cada nodo del JSON contra su fila renderizada
    const esp = esperados(datos.flow);
    const dom = await pagina.evaluate(({ esp, cajetin }) => {
      const norm = (x) => String(x).replace(/\s+/g, ' ').trim().toUpperCase();
      const faltan = [];
      let filas = 0;
      const todos = document.querySelectorAll('[data-nid]');
      const porNid = new Map();
      todos.forEach((el) => porNid.set(Number(el.getAttribute('data-nid')), el));
      for (const e of esp) {
        const el = porNid.get(e.nid);
        if (!el) { faltan.push({ nid: e.nid, falta: '(fila no dibujada)' }); continue; }
        filas++;
        const c = el.cloneNode(true);
        c.querySelectorAll('[data-nid]').forEach((x) => x.remove());
        const txt = norm(c.textContent);
        if (el.getAttribute('data-type') !== e.tipo) faltan.push({ nid: e.nid, falta: `tipo ${el.getAttribute('data-type')} != ${e.tipo}` });
        for (const t of e.textos) if (!txt.includes(norm(t))) faltan.push({ nid: e.nid, step: e.step, falta: t });
      }
      const raiz = norm(document.getElementById('pdf-content').textContent);
      const faltanCajetin = cajetin.filter((t) => !raiz.includes(norm(t)));
      return { nodosJSON: esp.length, filasDOM: todos.length, filasEncontradas: filas, faltan, faltanCajetin };
    }, { esp, cajetin: esperadosCajetin(datos) });

    const retornos = await pagina.evaluate(() => window.__FC_RETORNOS__ || null);
    const ptPorPx = 0.75 * cReal;
    const porZona = {};
    for (const t of textos) {
      const z = (porZona[t.zona] ||= { minPx: 1e9, minTxt: '', n: 0 });
      z.n++;
      if (t.px < z.minPx) { z.minPx = t.px; z.minTxt = t.s; }
    }
    for (const z of Object.values(porZona)) z.minPt = +(z.minPx * ptPorPx).toFixed(2);
    const minGlobalPx = Math.min(...textos.map(t => t.px));

    const sal = join(salida, `FLUJOGRAMA_${clave}${BASE ? '_BASE' : ''}${sufijo}_A3.pdf`);
    if (existsSync(sal)) rmSync(sal);
    await pagina.pdf({
      path: sal, width: `${pw}mm`, height: `${ph}mm`, printBackground: true, scale: cReal,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }, pageRanges: '1', preferCSSPageSize: false,
    });
    if (tiene('--png')) await pagina.screenshot({ path: sal.replace(/\.pdf$/, '_pantalla.png'), fullPage: false, clip: { x: 0, y: 0, width: Math.min(3000, geom.Wp), height: Math.min(2000, geom.Hp) } });

    const medidas = {
      clave, motor: BASE ? 'original (copia)' : 'compacto B', F: F ?? null,
      layoutPx: { w: Math.round(W), h: Math.round(H) }, unionPx: { x0: +caja.x0.toFixed(1), y0: +caja.y0.toFixed(1), x1: Math.round(caja.x1), y1: Math.round(caja.y1) },
      orientacion: horizontal ? 'apaisada 420x297' : 'vertical 297x420', escalaChromium: +cReal.toFixed(4), cSinTope: +c.toFixed(4),
      ptPorPxCSS: +ptPorPx.toFixed(4), mmPorPxCSS: +(ptPorPx * 0.3528).toFixed(4),
      aprovechamiento: { ancho: +((geom.w / geom.Wp) * 100).toFixed(1), alto: +((geom.h / geom.Hp) * 100).toFixed(1) },
      minLetra: { px: minGlobalPx, pt: +(minGlobalPx * ptPorPx).toFixed(2) },
      porZona, nTextos: textos.length, pdfKB: Math.round(statSync(sal).size / 1024), pdf: sal, contenidoDOM: dom, retornos,
    };
    writeFileSync(sal.replace(/\.pdf$/, '_medidas.json'), JSON.stringify({ medidas, textos }, null, 1));
    resumen.push(medidas);
    console.log(`${clave}${BASE ? ' [BASE]' : ''}: layout ${Math.round(W)}x${Math.round(H)} px CSS -> ${medidas.orientacion}, 1 px CSS = ${medidas.ptPorPxCSS} pt; letra minima ${medidas.minLetra.px} px = ${medidas.minLetra.pt} pt`);
    for (const [z, v] of Object.entries(porZona)) console.log(`    zona ${z.padEnd(9)} min ${v.minPx}px = ${v.minPt} pt  ("${v.minTxt}")`);
    console.log(`    ocupa ${medidas.aprovechamiento.ancho}% ancho x ${medidas.aprovechamiento.alto}% alto   PDF ${medidas.pdfKB} KB   ${sal}`);
    console.log(`    contenido DOM: ${dom.nodosJSON} nodos del JSON, ${dom.filasDOM} filas dibujadas, faltan ${dom.faltan.length} en filas y ${dom.faltanCajetin.length} en cabecera/pie`);
    for (const f of [...dom.faltan, ...dom.faltanCajetin.map((t) => ({ falta: t }))].slice(0, 10)) console.log('      FALTA', JSON.stringify(f));
    if (retornos) {
      const malos = retornos.rutas.filter((r) => r.choques.length);
      console.log(`    retornos: ${retornos.rutas.length} de ${retornos.esperados} dibujados hasta su operacion; con choques de texto: ${malos.length}; sin ubicar: ${retornos.problemas.length}`);
      for (const r of retornos.rutas) console.log(`      -> OP ${r.target} (nid ${r.nid}) choques=${JSON.stringify(r.choques)}`);
      for (const pb of retornos.problemas) console.log('      PROBLEMA', JSON.stringify(pb));
    }
    await pagina.close();
  }
} finally {
  await navegador.close();
}
