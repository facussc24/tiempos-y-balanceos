/**
 * render.mjs — PROPUESTA C (columnas en A3 apaisada). Derivado de scripts/_flujograma.mjs, pero apunta a la
 * copia del motor de esta carpeta y, en vez de un PNG gigante, saca un PDF vectorial con hojas A3 reales
 * (420 x 297 mm) y una vista previa PNG por hoja.
 *
 * NO toca el motor original ni los JSON de datos: los lee de tools/flowchart/data/ y nada mas.
 *
 * Uso:  node tools/flowchart/propuestas/C_columnas/render.mjs <clave> [<clave>...] [--out <carpeta>] [--png <carpeta>]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync, readdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { build } from 'esbuild';
import { spawnSync } from 'child_process';
import { chromium } from 'playwright';

const AQUI = dirname(fileURLToPath(import.meta.url));
const TOOLS = resolve(AQUI, '..', '..');
const RAIZ = resolve(TOOLS, '..', '..');
const DATA = join(TOOLS, 'data');
const TMP = join(AQUI, '.build');

const argv = process.argv.slice(2);
const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const claves = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out' && argv[i - 1] !== '--png' && argv[i - 1] !== '--p');
const params = {};
argv.forEach((a, i) => { if (a === '--p' && argv[i + 1]) { const [k, v] = argv[i + 1].split('='); params[k] = Number(v); } });
const salida = resolve(flag('--out') || join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'C_columnas'));
const salidaPng = resolve(flag('--png') || join(salida, 'previews'));
if (!claves.length) { console.error('Indica la clave del flujograma.'); process.exit(1); }

mkdirSync(TMP, { recursive: true });
mkdirSync(salida, { recursive: true });
mkdirSync(salidaPng, { recursive: true });

const BUNDLE = join(TMP, 'flowchart_c.bundle.js');
await build({ entryPoints: [join(AQUI, 'entry.jsx')], bundle: true, format: 'iife', jsx: 'automatic', outfile: BUNDLE, logLevel: 'error', minify: false });
const bundleJs = readFileSync(BUNDLE, 'utf8');
const css = readFileSync(join(AQUI, 'tailwind.css'), 'utf8');
const logo = `data:image/png;base64,${readFileSync(join(AQUI, 'assets', 'barack_logo.png')).toString('base64')}`;

const EXTRA_CSS = `
@page { size: 420mm 297mm; margin: 0 }
html, body { margin: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.fc-root { font-family: ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif; color: #1f2937 }
.fc-page { width: 420mm; height: 297mm; box-sizing: border-box; padding: 7mm; position: relative; overflow: hidden; background: #fff;
           display: flex; flex-direction: column; page-break-after: always; break-after: page }
.fc-page:last-child { page-break-after: auto; break-after: auto }
@media screen { .fc-page { margin: 0 0 12px 0 } }
`;

const navegador = await chromium.launch();
let ok = 0;
try {
  for (const clave of claves) {
    const archivo = join(DATA, `${clave}.json`);
    if (!existsSync(archivo)) { console.error(`  x ${clave}: no existe ${archivo}`); continue; }
    const datos = JSON.parse(readFileSync(archivo, 'utf8'));
    datos.logoUrl = logo;
    if (Object.keys(params).length) datos.params = params;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style><style>${EXTRA_CSS}</style></head><body><div id="root"></div>
<script>window.__FC__=${JSON.stringify(datos).replace(/</g, '\\u003c')};</script><script>${bundleJs}</script></body></html>`;
    const htmlPath = join(TMP, `${clave}.html`);
    writeFileSync(htmlPath, html, 'utf8');

    const pagina = await navegador.newPage({ viewport: { width: 1700, height: 1200 }, deviceScaleFactor: 2 });
    const errores = [];
    pagina.on('pageerror', (e) => errores.push(String(e)));
    pagina.on('console', (m) => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
    await pagina.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    await pagina.waitForFunction('window.__FC_LISTO__ === true', { timeout: 60000 });
    const err = await pagina.evaluate('window.__FC_ERROR__ || null');
    if (err) throw new Error(`${clave}: ${err}`);
    if (errores.length) throw new Error(`${clave}: el render tiro errores:\n  ${errores.join('\n  ')}`);
    const info = await pagina.evaluate('window.__FC_INFO__');

    // datos del DOM para la verificacion (texto por rol + tamaño de letra de todo texto visible)
    const dom = await pagina.evaluate(() => {
      const out = { items: [], fonts: [] };
      document.querySelectorAll('[data-fc]').forEach((el) => {
        const cs = getComputedStyle(el);
        out.items.push({ role: el.dataset.fc, sid: el.dataset.sid || null, text: el.textContent.trim(), fontPx: parseFloat(cs.fontSize), page: +(el.closest('.fc-page') || { dataset: {} }).dataset.page || 0, inLegend: !!el.closest('.fc-legend') });
      });
      const w = document.createTreeWalker(document.getElementById('root'), NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const t = n.nodeValue.trim();
        if (!t) continue;
        const el = n.parentElement;
        const cs = getComputedStyle(el);
        out.fonts.push({ text: t.slice(0, 60), fontPx: parseFloat(cs.fontSize), role: (el.closest('[data-fc]') || { dataset: {} }).dataset.fc || null, inLegend: !!el.closest('.fc-legend'), inHeader: !!el.closest('.fc-header'), inCol: !!el.closest('.fc-col') });
      }
      return out;
    });

    const pdfPath = join(salida, `FLUJOGRAMA_${clave}_C_columnas_A3.pdf`);
    if (existsSync(pdfPath)) rmSync(pdfPath);
    await pagina.pdf({ path: pdfPath, width: '420mm', height: '297mm', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });

    const fj = spawnSync('python', [join(AQUI, 'fijar_a3.py'), pdfPath], { encoding: 'utf8' });
    if (fj.status !== 0) throw new Error(`fijar_a3.py fallo: ${fj.stderr}`);

    // previews PNG por hoja (se borran las de corridas anteriores: si cambia la cantidad de hojas no queda ninguna vieja)
    for (const f of readdirSync(salidaPng)) if (f.startsWith(`${clave}_hoja`)) rmSync(join(salidaPng, f));
    const pgs = await pagina.$$('.fc-page');
    for (let i = 0; i < pgs.length; i++) {
      const png = join(salidaPng, `${clave}_hoja${i + 1}.png`);
      await pgs[i].screenshot({ path: png });
    }
    writeFileSync(join(salida, `${clave}_info.json`), JSON.stringify({ info, dom }, null, 1), 'utf8');
    await pagina.close();

    const kb = (statSync(pdfPath).size / 1024).toFixed(0);
    console.log(`  ok ${clave.padEnd(26)} ${info.pages} hoja(s) A3, ${info.cols} columna(s), PDF ${kb} KB`);
    for (const p of info.problems) console.log(`     !! ${p}`);
    ok++;
  }
} finally {
  await navegador.close();
}
process.exit(ok === claves.length ? 0 : 1);
