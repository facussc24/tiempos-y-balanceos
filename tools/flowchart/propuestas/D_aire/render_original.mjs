/**
 * render_original.mjs <clave>... [--out <carpeta>] — el dibujo ORIGINAL (motor de tools/flowchart/, sin tocarlo) escalado para entrar
 * en UNA hoja A3 (la orientacion que deje la escala mas grande, margen 10 mm), en PDF vectorial. Es la linea de base de la medicion
 * de aire: "como queda hoy el dibujo de siempre si se lo manda a una A3". Datos: git show HEAD:, igual que B y D.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execFileSync } from 'child_process';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..', '..', '..');
const ORIG = join(RAIZ, 'tools', 'flowchart');
const emitido = (clave) => execFileSync('git', ['show', `HEAD:tools/flowchart/data/${clave}.json`], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 26 });
const TMP = join(AQUI, '.build');
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const claves = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
const salida = resolve(flag('--out', join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'D_aire_trabajo', 'original')));
mkdirSync(TMP, { recursive: true });
mkdirSync(salida, { recursive: true });

const MM = 96 / 25.4, MARGEN = 10;
const BUNDLE = join(TMP, 'bundle_original.js');
await build({ entryPoints: [join(ORIG, 'entry.jsx')], bundle: true, format: 'iife', jsx: 'automatic', outfile: BUNDLE, logLevel: 'error', minify: false });
const bundleJs = readFileSync(BUNDLE, 'utf8');
const css = readFileSync(join(ORIG, 'tailwind.css'), 'utf8');
const logo = `data:image/png;base64,${readFileSync(join(ORIG, 'assets', 'barack_logo.png')).toString('base64')}`;

const navegador = await chromium.launch();
try {
  for (const clave of claves) {
    const datos = JSON.parse(emitido(clave));
    datos.logoUrl = logo;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
<style>html,body{margin:0;background:#fff}#root{width:max-content}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body><div id="root"></div>
<script>window.__FC__=${JSON.stringify(datos).replace(/</g, '\\u003c')};</script><script>${bundleJs}</script></body></html>`;
    const pagina = await navegador.newPage({ viewport: { width: 3000, height: 2000 }, deviceScaleFactor: 1 });
    await pagina.setContent(html, { waitUntil: 'load' });
    await pagina.waitForFunction('window.__FC_LISTO__ === true', { timeout: 30000 });
    const caja = await pagina.evaluate(() => {
      const n = document.getElementById('pdf-content');
      const r = n.getBoundingClientRect();
      let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
      for (const el of n.querySelectorAll('*')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;
        x0 = Math.min(x0, b.left); y0 = Math.min(y0, b.top); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom);
      }
      return { x0: x0 - r.left, y0: y0 - r.top, x1: x1 - r.left, y1: y1 - r.top };
    });
    const W = caja.x1 - caja.x0, H = caja.y1 - caja.y0;
    const cabe = (pw, ph) => Math.min(((pw - 2 * MARGEN) * MM) / W, ((ph - 2 * MARGEN) * MM) / H);
    const sH = cabe(420, 297), sV = cabe(297, 420);
    const horizontal = sH >= sV;
    const c = Math.min(Math.max(horizontal ? sH : sV, 0.1), 2);
    const pw = horizontal ? 420 : 297, ph = horizontal ? 297 : 420;
    await pagina.evaluate(({ pwpx, phpx, c, cj }) => {
      const n = document.getElementById('pdf-content');
      const root = document.getElementById('root');
      const wrap = document.createElement('div');
      const Wp = pwpx / c, Hp = phpx / c;
      wrap.style.cssText = `position:relative;width:${Wp}px;height:${Hp - 1}px;overflow:hidden;background:#fff;`;
      n.style.position = 'absolute';
      n.style.left = ((Wp - (cj.x1 - cj.x0)) / 2 - cj.x0) + 'px';
      n.style.top = ((Hp - (cj.y1 - cj.y0)) / 2 - cj.y0) + 'px';
      root.style.width = 'auto';
      root.appendChild(wrap);
      wrap.appendChild(n);
    }, { pwpx: pw * MM, phpx: ph * MM, c, cj: caja });
    const sal = join(salida, `FLUJOGRAMA_${clave}_ORIGINAL_A3.pdf`);
    if (existsSync(sal)) rmSync(sal);
    await pagina.pdf({ path: sal, width: `${pw}mm`, height: `${ph}mm`, printBackground: true, scale: c, margin: { top: '0', right: '0', bottom: '0', left: '0' }, preferCSSPageSize: false, pageRanges: '1' });
    console.log(`${clave}: dibujo ${Math.round(W)}x${Math.round(H)} px -> ${horizontal ? 'apaisada' : 'vertical'}, escala ${c.toFixed(3)} (1 px = ${(c * 0.2646).toFixed(3)} mm, letra de 10 px = ${(10 * 0.75 * c).toFixed(2)} pt) -> ${sal}`);
    await pagina.close();
  }
} finally {
  await navegador.close();
}
