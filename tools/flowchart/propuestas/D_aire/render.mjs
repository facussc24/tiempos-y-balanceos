/**
 * render.mjs — PROPUESTA D (AIRE). Un PDF A3 de 1 o 2 hojas por flujograma, vectorial, con la letra elegida y el aire resuelto
 * para llenar la hoja. NO toca los JSON ni el motor original: lee los datos como estan COMMITEADOS (git show HEAD:), igual que B.
 *
 *   node render.mjs <clave> [--out <carpeta>] [--sufijo _x] [--LP 9] [--orient v|h] [--corte N|-1] [--png] [--sin-resolver]
 *
 * Que hace, en orden:
 *   1. Arma las hojas: 1 sola, o 2 cortando el flujo despues del nodo de nivel superior `corte` (cfgs.json). En el corte pone el
 *      conector de hoja ("CONTINUA EN HOJA 2" / "VIENE DE HOJA 1") y, si una letra de conector (A, B...) sale en una hoja y entra
 *      en la otra, le agrega la nota de hoja.
 *   2. Fija la escala de impresion c = LP / (0,75 * F): 1 px CSS de diseno = 0,75 * c pt. Con F = 10 y LP = 9 pt, c = 1,2.
 *   3. Resuelve el AIRE: primero `colGap` (separacion entre ramas) hasta donde entre a lo ancho, despues `gap` (linea entre figuras)
 *      hasta donde entre a lo alto, con topes (gapMax / colGapMax). Si no entra ni con el aire minimo, avisa por que.
 *   4. Mide (letra impresa por zona, retornos, cotejo nodo por nodo contra el JSON) y escribe el PDF y un JSON de medidas.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execFileSync } from 'child_process';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..', '..', '..');
const emitido = (clave) => execFileSync('git', ['show', `HEAD:tools/flowchart/data/${clave}.json`], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 26 });
const TMP = join(AQUI, '.build');

const argv = process.argv.slice(2);
const VALORES = ['--out', '--sufijo', '--LP', '--orient', '--corte', '--cfg'];
const flag = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const tiene = (n) => argv.includes(n);
const claves = argv.filter((a, i) => !a.startsWith('--') && !VALORES.includes(argv[i - 1]));
if (!claves.length) { console.error('Falta la clave del flujograma.'); process.exit(1); }
const salida = resolve(flag('--out', join(RAIZ, 'exports', 'flujogramas_a3_propuestas', 'D_aire_trabajo')));
const sufijo = flag('--sufijo', '');
const extra = flag('--cfg') ? JSON.parse(flag('--cfg')) : {};
mkdirSync(TMP, { recursive: true });
mkdirSync(salida, { recursive: true });

const MM = 96 / 25.4;                        // px CSS por mm
const A3 = { w: 297, h: 420 };               // vertical; la apaisada se da vuelta
const seqOf = (b) => (Array.isArray(b) ? b : b.sequence);

// ---------- hojas ----------
const clonar = (x) => JSON.parse(JSON.stringify(x));
function contarNodos(seq) { let c = 0; const w = (s) => { for (const nd of s) { c++; if (nd.branches) nd.branches.forEach((b) => w(seqOf(b))); if (nd.branchSide && nd.branchSide.sequence) w(nd.branchSide.sequence); } }; w(seq); return c; }
function conectores(seq) {
  const out = new Set(), inn = new Set();
  const w = (s) => { for (const nd of s) { if (nd.incomingConnector) inn.add(nd.incomingConnector); if (nd.branchSide && nd.branchSide.type === 'connector') out.add(nd.branchSide.text); if (nd.branches) nd.branches.forEach((b) => w(seqOf(b))); if (nd.branchSide && nd.branchSide.sequence) w(nd.branchSide.sequence); } };
  w(seq);
  return { out, inn };
}
function marcarNotas(seq, letrasOut, letrasIn, hojaOut, hojaIn) {
  const w = (s) => { for (const nd of s) {
    if (nd.incomingConnector && letrasIn.has(nd.incomingConnector)) nd.incomingNote = `HOJA ${hojaIn}`;
    if (nd.branchSide && nd.branchSide.type === 'connector' && letrasOut.has(nd.branchSide.text)) nd.branchSide.pageNote = `SIGUE EN HOJA ${hojaOut}`;
    if (nd.branches) nd.branches.forEach((b) => w(seqOf(b)));
    if (nd.branchSide && nd.branchSide.sequence) w(nd.branchSide.sequence);
  } };
  w(seq);
}
function armarHojas(datos, corte) {
  const flow = datos.flow;
  if (corte === null || corte === undefined || corte < 0) return [{ no: 1, total: 1, first: true, last: true, startNid: 0, flow: clonar(flow) }];
  const p1 = clonar(flow.slice(0, corte + 1)), p2 = clonar(flow.slice(corte + 1));
  const c1 = conectores(p1), c2 = conectores(p2);
  const cruzan12 = new Set([...c1.out].filter((l) => c2.inn.has(l)));      // sale en la hoja 1, entra en la 2
  const cruzan21 = new Set([...c2.out].filter((l) => c1.inn.has(l)));
  marcarNotas(p1, cruzan12, cruzan21, 2, 2);
  marcarNotas(p2, cruzan21, cruzan12, 1, 1);
  p1.push({ type: 'pageconn', dir: 'out', pageNo: 2, description: 'CONTINÚA EN HOJA 2' });
  p2.unshift({ type: 'pageconn', dir: 'in', pageNo: 1, description: 'VIENE DE HOJA 1' });
  return [
    { no: 1, total: 2, first: true, last: false, startNid: 0, flow: p1, cruzan: [...cruzan12, ...cruzan21] },
    { no: 2, total: 2, first: false, last: true, startNid: contarNodos(flow.slice(0, corte + 1)), flow: p2 },
  ];
}

// contenido esperado por nodo, en el MISMO orden DFS que annotate() del motor
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
      if (nd.branches) for (const b of nd.branches) walk(seqOf(b));
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

// ---------- bundle ----------
const BUNDLE = join(TMP, 'bundle.js');
await build({ entryPoints: [join(AQUI, 'entry.jsx')], bundle: true, format: 'iife', jsx: 'automatic', outfile: BUNDLE, logLevel: 'error', minify: false });
const bundleJs = readFileSync(BUNDLE, 'utf8');
const css = readFileSync(join(AQUI, 'tailwind.css'), 'utf8');
const logo = `data:image/png;base64,${readFileSync(join(AQUI, 'assets', 'barack_logo.png')).toString('base64')}`;
const cfgsDoc = existsSync(join(AQUI, 'cfgs.json')) ? JSON.parse(readFileSync(join(AQUI, 'cfgs.json'), 'utf8')) : {};

const navegador = await chromium.launch();
const resumen = [];

// una pasada de render: arma el HTML con `cfg` y devuelve la pagina lista
async function montar(pagina, datos, hojas, geo, cfg) {
  const d2 = { ...datos, logoUrl: logo, cfg, pages: hojas.map((h) => ({ ...h, w: geo.Wp, h: geo.Hp, c: geo.c })) };
  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${css}</style>
<style>html,body{margin:0;background:#fff}#root{width:auto}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>
</head><body><div id="root"></div>
<script>window.__FC__=${JSON.stringify(d2).replace(/</g, '\\u003c')};</script>
<script>${bundleJs}</script></body></html>`;
  const errores = [];
  const onErr = (e) => errores.push(String(e));
  pagina.removeAllListeners('pageerror');
  pagina.on('pageerror', onErr);
  await pagina.setContent(html, { waitUntil: 'load' });
  await pagina.waitForFunction('window.__FC_LISTO__ === true', { timeout: 30000 });
  if (errores.length) throw new Error(errores.join(' | '));
}

// cuanto entra: por hoja, lo que falta o sobra de alto y de ancho (px CSS de diseno)
const MEDIR = () => {
  const out = [];
  document.querySelectorAll('.hoja').forEach((h) => {
    const r = h.getBoundingClientRect();
    const cs = getComputedStyle(h);
    const pad = parseFloat(cs.paddingTop);
    const frame = h.querySelector('[data-flowframe]');
    const fr = frame.getBoundingClientRect();
    const box = h.querySelector('[data-flowbox]').getBoundingClientRect();
    const fcs = getComputedStyle(frame);
    const dispAncho = fr.width - 2 * parseFloat(fcs.borderLeftWidth) - parseFloat(fcs.paddingLeft) - parseFloat(fcs.paddingRight);
    const aside = h.querySelector('aside');
    const leg = aside && aside.firstElementChild ? aside.firstElementChild.getBoundingClientRect() : null;
    const fondo = r.bottom - pad;
    // altura que sobra: entre el marco del flujo y lo que sigue (la leyenda, o el borde util de la hoja)
    const limite = leg ? leg.top : fondo;
    const libreAlto = limite - fr.bottom;
    const desborde = Math.max(0, (leg ? leg.bottom : fr.bottom) - fondo);
    out.push({ libreAlto, libreAncho: dispAncho - box.width, desborde, anchoCaja: box.width, altoMarco: fr.height, hojaW: r.width, hojaH: r.height, scrollW: h.scrollWidth, scrollH: h.scrollHeight });
  });
  return out;
};

try {
  for (const clave of claves) {
    const datos = JSON.parse(emitido(clave));
    const base = { ...(cfgsDoc[clave] || {}), ...extra };
    const orient = flag('--orient') || base.orient || 'v';
    const LP = Number(flag('--LP') || base.LP || 9);
    const F = base.F || 10;
    const corte = flag('--corte') !== null ? Number(flag('--corte')) : (base.corte ?? null);
    const c = LP / (0.75 * F);
    const pw = orient === 'h' ? A3.h : A3.w, ph = orient === 'h' ? A3.w : A3.h;
    const geo = { orient, pw, ph, c, Wp: Math.floor(pw * MM / c) - 1, Hp: Math.floor(ph * MM / c) - 1 };
    const hojas = armarHojas(datos, corte);
    const pagina = await navegador.newPage({ viewport: { width: 3000, height: 2000 }, deviceScaleFactor: 1 });

    const gapMin = base.gapMin ?? 1.6, gapMax = base.gapMax ?? 4.5;
    const cgMin = base.colGapMin ?? 3, cgMax = base.colGapMax ?? 9;
    const cfgBase = { ...base, F, margin: base.margin ?? 11 };
    delete cfgBase.orient; delete cfgBase.corte; delete cfgBase.LP;
    const ensayar = async (gap, colGap) => {
      const cfg = { ...cfgBase, gap, colGap };
      await montar(pagina, datos, hojas, geo, cfg);
      const m = await pagina.evaluate(MEDIR);
      return { cfg, m, cabe: m.every((x) => x.desborde <= 0.5 && x.libreAncho >= 0 && x.libreAlto >= 0) };
    };

    let cfgFinal, notas = [];
    if (tiene('--sin-resolver') || base.fijar) {
      cfgFinal = { ...cfgBase, gap: base.gap ?? gapMin, colGap: base.colGap ?? cgMin };
    } else {
      // 1) ancho: el colGap mas grande que deja entrar la hoja (con gap minimo)
      let lo = cgMin, hi = cgMax;
      let t = await ensayar(gapMin, cgMin);
      if (t.m.some((x) => x.libreAncho < 0)) {
        notas.push(`NO ENTRA A LO ANCHO ni con colGap ${cgMin}: sobran ${Math.round(-Math.min(...t.m.map((x) => x.libreAncho)))} px CSS de diseno (achicar descMax / usar apaisada)`);
      } else {
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) / 2;
          const r = await ensayar(gapMin, mid);
          if (r.m.every((x) => x.libreAncho >= 0)) lo = mid; else hi = mid;
        }
      }
      const colGap = Math.round(lo * 100) / 100;
      // 2) alto: el gap mas grande que deja entrar la hoja
      let glo = gapMin, ghi = gapMax;
      t = await ensayar(gapMin, colGap);
      if (t.m.some((x) => x.desborde > 0.5 || x.libreAlto < 0)) {
        notas.push(`NO ENTRA A LO ALTO ni con gap ${gapMin}: sobran ${Math.round(Math.max(...t.m.map((x) => Math.max(x.desborde, -x.libreAlto))))} px CSS de diseno`);
        ghi = gapMin;
      } else {
        // si entra con el tope, listo
        const top = await ensayar(gapMax, colGap);
        if (top.cabe) glo = gapMax; else {
          for (let i = 0; i < 8; i++) {
            const mid = (glo + ghi) / 2;
            const r = await ensayar(mid, colGap);
            if (r.cabe) glo = mid; else ghi = mid;
          }
        }
      }
      cfgFinal = { ...cfgBase, gap: Math.floor(glo * 100) / 100, colGap };
    }

    // render final
    const fin = await ensayar(cfgFinal.gap, cfgFinal.colGap);
    const ptPorPx = 0.75 * c;

    const textos = await pagina.evaluate(() => {
      const out = [];
      document.querySelectorAll('.hoja').forEach((h, hi) => {
        const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
        let t;
        while ((t = w.nextNode())) {
          const s = t.nodeValue.replace(/\s+/g, ' ').trim();
          if (!s) continue;
          const el = t.parentElement;
          const cs = getComputedStyle(el);
          const rng = document.createRange(); rng.selectNodeContents(t);
          const b = rng.getBoundingClientRect();
          if (b.width === 0) continue;
          const zona = el.closest('aside') ? 'leyenda' : (el.closest('main') ? 'flujo' : 'cabecera');
          out.push({ hoja: hi + 1, s: s.slice(0, 80), px: parseFloat(cs.fontSize), zona });
        }
      });
      return out;
    });
    const porZona = {};
    for (const t of textos) { const z = (porZona[t.zona] ||= { minPx: 1e9, minTxt: '', n: 0 }); z.n++; if (t.px < z.minPx) { z.minPx = t.px; z.minTxt = t.s; } }
    for (const z of Object.values(porZona)) z.minPt = +(z.minPx * ptPorPx).toFixed(2);
    const minGlobalPx = Math.min(...textos.map((t) => t.px));

    // cotejo nodo por nodo contra el JSON
    const esp = esperados(datos.flow);
    const dom = await pagina.evaluate(({ esp, cajetin }) => {
      const norm = (x) => String(x).replace(/\s+/g, ' ').trim().toUpperCase();
      const faltan = [];
      let filas = 0;
      const porNid = new Map();
      document.querySelectorAll('[data-nid]').forEach((el) => { const k = Number(el.getAttribute('data-nid')); if (k >= 0) porNid.set(k, el); });
      for (const e of esp) {
        const el = porNid.get(e.nid);
        if (!el) { faltan.push({ nid: e.nid, falta: '(fila no dibujada)' }); continue; }
        filas++;
        const cl = el.cloneNode(true);
        cl.querySelectorAll('[data-nid]').forEach((x) => x.remove());
        const txt = norm(cl.textContent);
        if (el.getAttribute('data-type') !== e.tipo) faltan.push({ nid: e.nid, falta: `tipo ${el.getAttribute('data-type')} != ${e.tipo}` });
        for (const t of e.textos) if (!txt.includes(norm(t))) faltan.push({ nid: e.nid, step: e.step, falta: t });
      }
      const raiz = norm(document.body.textContent);
      const faltanCajetin = cajetin.filter((t) => !raiz.includes(norm(t)));
      return { nodosJSON: esp.length, filasEncontradas: filas, faltan, faltanCajetin };
    }, { esp, cajetin: esperadosCajetin(datos) });

    const retornos = await pagina.evaluate(() => window.__FC_RETORNOS__ || null);
    let retTot = 0, retEsp = 0, retChoques = 0; const retProb = [];
    for (const r of Object.values(retornos || {})) { retEsp += r.esperados; retTot += r.rutas.length; retChoques += r.rutas.filter((x) => x.choques.length).length; retProb.push(...r.problemas); }

    const base_ = `FLUJOGRAMA_${clave}${sufijo}_A3`;
    const sal = join(salida, `${base_}.pdf`);
    if (existsSync(sal)) rmSync(sal);
    await pagina.pdf({ path: sal, width: `${pw}mm`, height: `${ph}mm`, printBackground: true, scale: c, margin: { top: '0', right: '0', bottom: '0', left: '0' }, preferCSSPageSize: false });
    if (tiene('--png')) await pagina.screenshot({ path: sal.replace(/\.pdf$/, '_pantalla.png'), fullPage: true });

    const medidas = {
      clave, orient, LP, F, c: +c.toFixed(4), ptPorPxCSS: +ptPorPx.toFixed(4), corte, hojas: hojas.length,
      aire: { gap_em: cfgFinal.gap, colGap_em: cfgFinal.colGap, gap_mm: +(cfgFinal.gap * F * ptPorPx * 0.3528).toFixed(2) },
      cfg: cfgFinal, notas, libre: fin.m.map((x) => ({ libreAltoMm: +(x.libreAlto * ptPorPx * 0.3528).toFixed(1), libreAnchoMm: +(x.libreAncho * ptPorPx * 0.3528).toFixed(1), desborde: +x.desborde.toFixed(1) })),
      minLetra: { px: minGlobalPx, pt: +(minGlobalPx * ptPorPx).toFixed(2) }, porZona, contenidoDOM: dom,
      retornos: { esperados: retEsp, dibujados: retTot, conChoques: retChoques, problemas: retProb },
      pdfKB: Math.round(statSync(sal).size / 1024), pdf: sal, cruzan: hojas[0].cruzan || [],
    };
    writeFileSync(sal.replace(/\.pdf$/, '_medidas.json'), JSON.stringify(medidas, null, 1));
    resumen.push(medidas);
    console.log(`${clave}${sufijo}: ${hojas.length} hoja(s) ${orient === 'h' ? 'apaisada' : 'vertical'}, letra ${LP} pt (min ${medidas.minLetra.pt}), gap ${cfgFinal.gap} em = ${medidas.aire.gap_mm} mm, colGap ${cfgFinal.colGap} em`);
    for (const [z, v] of Object.entries(porZona)) console.log(`    zona ${z.padEnd(9)} min ${v.minPx}px = ${v.minPt} pt  ("${v.minTxt}")`);
    for (const nota of notas) console.log('    AVISO ' + nota);
    console.log(`    hojas: ${medidas.libre.map((x, i) => `#${i + 1} libre alto ${x.libreAltoMm} mm, ancho ${x.libreAnchoMm} mm, desborde ${x.desborde}`).join(' | ')}`);
    console.log(`    contenido DOM: ${dom.nodosJSON} nodos del JSON, ${dom.filasEncontradas} dibujados, faltan ${dom.faltan.length} en filas y ${dom.faltanCajetin.length} en cabecera/pie   PDF ${medidas.pdfKB} KB`);
    for (const f of [...dom.faltan, ...dom.faltanCajetin.map((t) => ({ falta: t }))].slice(0, 10)) console.log('      FALTA', JSON.stringify(f));
    console.log(`    retornos: ${retTot} de ${retEsp} dibujados hasta su operacion; con choques de texto: ${retChoques}; sin ubicar: ${retProb.length}`);
    for (const pb of retProb) console.log('      PROBLEMA', JSON.stringify(pb));
    await pagina.close();
  }
} finally {
  await navegador.close();
}
writeFileSync(join(TMP, 'resumen.json'), JSON.stringify(resumen.map((r) => ({ clave: r.clave, hojas: r.hojas, orient: r.orient, LP: r.LP, minpt: r.minLetra.pt, gap_em: r.aire.gap_em, colGap_em: r.aire.colGap_em })), null, 1));
