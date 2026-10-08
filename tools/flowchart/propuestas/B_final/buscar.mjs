/**
 * buscar.mjs (B_final) — busca los parametros de ancho del motor compacto que dejan la letra impresa mas grande
 * en UNA A3 con 10,5 mm de margen. Descenso por coordenadas: prueba un parametro por vez y se queda con lo que mejora.
 * Descarta toda combinacion en la que dos textos se pisan, o en la que una linea de retorno (REVERIFICAR) toca un texto.
 * Al final, si sobra alto, reparte el aire entre filas (gap) sin achicar la letra.
 *
 *   node buscar.mjs <clave> [--F 10] [--rondas 3] [--guardar 0]
 *
 * Escribe SOLO cfgs.json de esta carpeta. Lee los JSON commiteados (git show HEAD:).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..', '..', '..');
const emitido = (clave) => execFileSync('git', ['show', `HEAD:tools/flowchart/data/${clave}.json`], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 26 });
const TMP = join(AQUI, '.build');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const clave = argv.find((a, i) => !a.startsWith('--') && !['--F', '--rondas', '--guardar'].includes(argv[i - 1]));
const F = Number(flag('--F', 10));
const rondas = Number(flag('--rondas', 3));
const M = Number(flag('--margen', 10.5));

await build({ entryPoints: [join(AQUI, 'entry.jsx')], bundle: true, format: 'iife', jsx: 'automatic', outfile: join(TMP, 'bundle_buscar.js'), logLevel: 'error' });
const bundleJs = readFileSync(join(TMP, 'bundle_buscar.js'), 'utf8');
const css = readFileSync(join(AQUI, 'tailwind.css'), 'utf8');
const logo = `data:image/png;base64,${readFileSync(join(AQUI, 'assets', 'barack_logo.png')).toString('base64')}`;
const datos0 = JSON.parse(emitido(clave));
datos0.logoUrl = logo;

const CFGS = join(AQUI, 'cfgs.json');
const cfgs = existsSync(CFGS) ? JSON.parse(readFileSync(CFGS, 'utf8')) : {};
let cfg = { F, ...(cfgs[clave] || {}) };
cfg.F = F;

const MM = 96 / 25.4;
const navegador = await chromium.launch();

async function evaluar(c) {
  const datos = { ...datos0, cfg: c };
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style><style>html,body{margin:0;background:#fff}#root{width:max-content}</style></head><body><div id="root"></div><script>window.__FC__=${JSON.stringify(datos).replace(/</g, '\\u003c')};</script><script>${bundleJs}</script></body></html>`;
  const pag = await navegador.newPage({ viewport: { width: 3000, height: 2400 } });
  const errs = [];
  pag.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  try {
    try {
      await pag.setContent(html, { waitUntil: 'load', timeout: 90000 });
      await pag.waitForFunction('window.__FC_LISTO__ === true', { timeout: 60000 });
    } catch (e) {
      console.log('   (config descartada: la pagina no termino de dibujar)', JSON.stringify(c), errs.join(' | '));
      return { W: 1e6, H: 1e6, pisa: 1e6, ej: [], hdr: 0, retEsp: 0, retOk: 0, choques: 1e6, problemas: 1e6, pt: 0, orient: '-', fW: 9, fH: 9 };
    }
    const r = await pag.evaluate(() => {
      const n = document.getElementById('pdf-content');
      const b = n.getBoundingClientRect();
      let x0 = b.left, y0 = b.top, x1 = b.right, y1 = b.bottom;
      for (const el of n.querySelectorAll('*')) {
        const q = el.getBoundingClientRect();
        if (q.width === 0 && q.height === 0) continue;
        x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom);
      }
      const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
      const rs = []; let t;
      while ((t = w.nextNode())) {
        if (!t.nodeValue.trim()) continue;
        const rg = document.createRange(); rg.selectNodeContents(t);
        for (const q of rg.getClientRects()) if (q.width > 1) rs.push({ l: q.left, r: q.right, t: q.top + q.height * 0.15, b: q.bottom - q.height * 0.15, s: t.nodeValue.trim().slice(0, 20) });
      }
      let pisa = 0; const ej = [];
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i], c2 = rs[j];
        if (a.l < c2.r - 1 && c2.l < a.r - 1 && a.t < c2.b && c2.t < a.b) { pisa++; if (ej.length < 3) ej.push(a.s + ' | ' + c2.s); }
      }
      const hd = n.firstElementChild.getBoundingClientRect();
      const ret = window.__FC_RETORNOS__ || { esperados: 0, rutas: [], problemas: [] };
      const choques = ret.rutas.reduce((a, x) => a + x.choques.length, 0);
      return { W: x1 - x0, H: y1 - y0, pisa, ej, hdr: hd.height, retEsp: ret.esperados, retOk: ret.rutas.length, choques, problemas: ret.problemas.length };
    });
    const k = (pw, ph) => Math.min(((pw - 2 * M) * MM) / r.W, ((ph - 2 * M) * MM) / r.H);
    const ch = k(420, 297), cv = k(297, 420);
    const horiz = ch >= cv;
    const cc = Math.min(horiz ? ch : cv, 2);
    const pw = horiz ? 420 : 297, ph = horiz ? 297 : 420;
    return { ...r, pt: F * 0.75 * cc, orient: horiz ? 'apaisada' : 'vertical', fW: (r.W / MM) * cc / (pw - 2 * M), fH: (r.H / MM) * cc / (ph - 2 * M) };
  } finally { await pag.close(); }
}

const espacio = {
  descMax: [18, 22, 26, 30, 34, 38, 44, 52, 60],
  descMax2: [12, 14, 16, 18, 20, 22, 26, 30, 36, 44],
  descMax3: [10, 11, 13, 15, 17, 19, 22, 26, 30, 36],
  nestF: [0.6, 0.7, 0.8, 0.9, 1],
  descMaxSide: [14, 16, 20, 24, 28, 34],
  termMaxL: [8, 10, 13, 16],
  termMaxR: [14, 18, 21, 26],
  labelMax: [6, 7, 8.4, 10, 12],
  prodCols: datos0.products.length >= 6 ? [1, 2, 3] : [1],
  minW: [0, 60, 70, 80, 90, 100],
  revMinW: [30, 40, 50, 60, 70],
  gap: [0.4, 0.5],
  sideClear: [1.0, 1.4, 1.8],
  colGap: [0.8, 1.2, 1.8],
  sideLine: [2.2, 2.7],
};

const okf = (r) => r.pisa === 0 && r.hdr / F <= 6.6 && r.choques === 0 && r.problemas === 0 && r.retOk === r.retEsp;
const linea = (r) => `${r.pt.toFixed(2)} pt (${r.orient}) W=${(r.W / F).toFixed(1)}em H=${(r.H / F).toFixed(1)}em ocupa ${(r.fW * 100).toFixed(0)}% x ${(r.fH * 100).toFixed(0)}% pisan=${r.pisa} choques=${r.choques}`;

let mejor = await evaluar(cfg);
console.log(`${clave} inicio: ${linea(mejor)}`);
if (!okf(mejor)) console.log('   (el inicio no es valido:', mejor.ej.join(' ; '), 'choques', mejor.choques, 'problemas', mejor.problemas, ')');
for (let ronda = 0; ronda < rondas; ronda++) {
  let cambio = false;
  for (const [k, vals] of Object.entries(espacio)) {
    for (const v of vals) {
      if (cfg[k] === v) continue;
      const c2 = { ...cfg, [k]: v };
      const r = await evaluar(c2);
      const mejora = okf(r) && (!okf(mejor) || r.pt > mejor.pt + 0.005);
      if (mejora) { cfg = c2; mejor = r; cambio = true; console.log(`  ${k}=${v} -> ${linea(r)}`); }
    }
  }
  if (!cambio) break;
}

// reparto del aire que sobra en alto: sube gap mientras la letra no baje
if (mejor.fH < 0.985 && mejor.fW >= mejor.fH) {
  for (let g = (cfg.gap ?? 0.5) + 0.05; g <= 1.4; g += 0.05) {
    const c2 = { ...cfg, gap: +g.toFixed(2) };
    const r = await evaluar(c2);
    if (okf(r) && r.pt >= mejor.pt - 0.005 && r.fH <= 1.0) { cfg = c2; mejor = r; } else break;
  }
  console.log(`  gap=${cfg.gap} (reparto del aire) -> ${linea(mejor)}`);
}
console.log(`${clave} MEJOR: ${linea(mejor)}; cfg=${JSON.stringify(cfg)}`);
if (flag('--guardar', '1') !== '0') {
  cfgs[clave] = cfg;
  writeFileSync(CFGS, JSON.stringify(cfgs, null, 1));
}
await navegador.close();
