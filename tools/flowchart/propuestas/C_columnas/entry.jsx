/**
 * Entrada del render headless de la PROPUESTA C (columnas en una A3 apaisada).
 *
 * Etapas, todas en el navegador (el layout lo mide Chromium, no lo adivina el codigo):
 *   1. SONDA: cada secuencia (columna de rama, secuencia lateral de reproceso) y cada nodo del flujo
 *      principal se dibuja oculto con margenes enormes y se mide su TINTA (rectangulo union de todo lo
 *      que se pinta: figuras, textos, lineas) respecto de la columna vertebral. Eso da {L, R, h}.
 *   2. EMPAQUE: programacion dinamica exacta. Corta el flujo principal en columnas (cada una con el ancho
 *      de su tinta) y las acomoda lado a lado en hojas A3 apaisadas: minimo de hojas, despues minimo de
 *      columnas, despues la columna mas baja posible (para que no queden unas gigantes y otras vacias).
 *   3. RENDER FINAL con conectores de pagina en cada corte y chequeo de que nada se salga.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { C, Seq, branchSeq, Header, Legend, Document } from './Flowchart.jsx';

const datos = window.__FC__ || {};
if (datos.params) Object.assign(C, datos.params);   // pruebas de tamaño de letra / ancho de descripcion
const PROBE = 1500;               // margen generoso a cada lado de la espina en la sonda
const HDR_GAP = 8;                // aire entre cabecera / columnas / leyenda
const SAFETY = 6;                 // px de colchon vertical

// ---------- utilidades de sonda ----------
function mount(el, node) {
  const root = createRoot(el);
  flushSync(() => root.render(node));
  return root;
}

function probe(reactNode, width) {
  const host = document.createElement('div');
  host.className = 'fc-root';
  host.style.cssText = `position:absolute;left:0;top:0;width:${width}px;visibility:hidden;pointer-events:none;`;
  document.body.appendChild(host);
  const root = mount(host, reactNode);
  return { host, done() { root.unmount(); host.remove(); } };
}

// Rectangulo de tinta: union de lo que realmente se pinta (texto, bordes, fondos, svg, img).
function inkBox(rootEl) {
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
  const add = (rc) => {
    if (rc.width < 0.05 && rc.height < 0.05) return;
    l = Math.min(l, rc.left); r = Math.max(r, rc.right); t = Math.min(t, rc.top); b = Math.max(b, rc.bottom);
  };
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    if (n.nodeType === 3) {
      if (!n.nodeValue.trim()) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      for (const rc of rg.getClientRects()) add(rc);
    } else {
      const cs = getComputedStyle(n);
      const bg = cs.backgroundColor;
      const hasBg = bg && bg !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(bg);
      const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none');
      if (hasBg || hasBorder || n.tagName.toLowerCase() === 'svg' || n.tagName === 'IMG') add(n.getBoundingClientRect());
    }
  }
  return { left: l, right: r, top: t, bottom: b };
}

function measureSeq(seq, first = true, converges = true) {
  const p = probe(<Seq seq={seq} geom={{ L: PROBE, R: PROBE }} converges={converges} first={first} />, 2 * PROBE);
  const hr = p.host.getBoundingClientRect();
  const ink = inkBox(p.host);
  const spineX = hr.left + PROBE;
  const g = {
    L: Math.max(C.HALF + 8, Math.ceil(spineX - ink.left) + 2),
    R: Math.max(C.HALF + 8, Math.ceil(ink.right - spineX) + 2),
    h: Math.ceil(p.host.firstChild.getBoundingClientRect().height),
  };
  p.done();
  return g;
}

// Anota (post-orden) cada nodo con la geometria de sus ramas y de su secuencia lateral.
function annotateNode(n) {
  if (n.branches && n.branches.length) n._bg = n.branches.map((b) => annotateSeq(branchSeq(b)));
  if (n.branchSide && n.branchSide.sequence) n._sg = annotateSeq(n.branchSide.sequence);
}
function annotateSeq(seq) {
  seq.forEach(annotateNode);
  return measureSeq(seq, true, true);
}

// ---------- paginado ----------
function measureBox(node, width) {
  const p = probe(<div style={{ width }}>{node}</div>, width + 10);
  const h = Math.ceil(p.host.firstChild.getBoundingClientRect().height);
  p.done();
  return h;
}

function pack(items, gOut, gIn, hOut, hIn, Wc, Hfn, cap) {
  const n = items.length;
  const COLHEAD = 16;
  const pre = []; // pre[j][i] = {w,h} de la columna con los items j..i-1
  for (let j = 0; j < n; j++) {
    pre[j] = [];
    let L = 0, R = 0, h = 0;
    for (let i = j + 1; i <= n; i++) {
      const it = items[i - 1];
      L = Math.max(L, it.g.L); R = Math.max(R, it.g.R); h += it.g.h;
      let LL = L, RR = R, hh = h + COLHEAD;
      if (j > 0) { LL = Math.max(LL, gIn.L); RR = Math.max(RR, gIn.R); hh += hIn; }
      if (i < n) { LL = Math.max(LL, gOut.L); RR = Math.max(RR, gOut.R); hh += hOut; }
      pre[j][i] = { w: LL + RR + 2 * C.PADX, h: hh, L: LL, R: RR };
    }
  }
  // minimo de paginas, despues minimo de cortes malos (control separado de su rombo), despues minimo de columnas
  for (let P = 1; P <= 10; P++) {
    // states[p][i] = lista Pareto de {used, cols, prev}
    const states = Array.from({ length: P + 1 }, () => Array.from({ length: n + 1 }, () => []));
    states[1][0].push({ used: 0, cols: 0, bad: 0, prev: null });
    const add = (list, st) => {
      for (const s of list) if (s.used <= st.used && s.cols <= st.cols && s.bad <= st.bad) return;
      for (let k = list.length - 1; k >= 0; k--) if (st.used <= list[k].used && st.cols <= list[k].cols && st.bad <= list[k].bad) list.splice(k, 1);
      list.push(st);
    };
    for (let i = 1; i <= n; i++) {
      for (let p = 1; p <= P; p++) {
        const Hcap = Hfn(p, P) * cap;
        for (let j = 0; j < i; j++) {
          // un rombo de conformidad cuelga de su control: cortar entre los dos es un corte MALO (se evita si no cuesta una hoja)
          const malo = j > 0 && items[j].node.type === 'condition' ? 1 : 0;
          const c = pre[j][i];
          if (c.h > Hcap || c.w > Wc) continue;
          // misma pagina
          for (const s of states[p][j]) {
            if (j > 0 && s.used === 0) continue;
            const nu = s.used + c.w;
            if (nu <= Wc) add(states[p][i], { used: nu, cols: s.cols + 1, bad: s.bad + malo, prev: { p, i: j, s }, col: { j, i, L: c.L, R: c.R, page: p } });
          }
          // pagina nueva
          if (p > 1 && j > 0) {
            for (const s of states[p - 1][j]) {
              add(states[p][i], { used: c.w, cols: s.cols + 1, bad: s.bad + malo, prev: { p: p - 1, i: j, s }, col: { j, i, L: c.L, R: c.R, page: p } });
            }
          }
        }
      }
    }
    const fin = states[P][n];
    if (fin.length) {
      let best = fin[0];
      for (const s of fin) if (s.bad < best.bad || (s.bad === best.bad && s.cols < best.cols)) best = s;
      const cols = [];
      let cur = best;
      while (cur && cur.col) { cols.unshift(cur.col); cur = cur.prev ? cur.prev.s : null; }
      return { P, cols, nCols: best.cols, bad: best.bad };
    }
  }
  return null;
}

// ¿Hay texto encimado con otro texto o con una figura? (nada cortado, nada encimado)
function overlapReport(pageEl) {
  const texts = [];
  const w = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (!n.nodeValue.trim()) continue;
    const rg = document.createRange();
    rg.selectNodeContents(n);
    for (const rc of rg.getClientRects()) if (rc.width > 1 && rc.height > 1) texts.push({ rc, node: n });
  }
  const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const out = [];
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      if (texts[i].node === texts[j].node) continue;
      // se achican un poco los rectangulos para que dos renglones pegados no cuenten
      const a = texts[i].rc, b = texts[j].rc;
      const A = { left: a.left + 0.5, right: a.right - 0.5, top: a.top + 1.5, bottom: a.bottom - 1.5 };
      const B = { left: b.left + 0.5, right: b.right - 0.5, top: b.top + 1.5, bottom: b.bottom - 1.5 };
      if (inter(A, B) > 2) out.push(`texto "${texts[i].node.nodeValue.trim().slice(0, 28)}" encima de "${texts[j].node.nodeValue.trim().slice(0, 28)}"`);
    }
  }
  const shapes = [];
  pageEl.querySelectorAll('*').forEach((el) => {
    const cs = getComputedStyle(el);
    const full = ['Top', 'Right', 'Bottom', 'Left'].every((s) => parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none');
    const r = el.getBoundingClientRect();
    if (full && r.width > 8 && r.height > 8) shapes.push({ el, r });
  });
  for (const t of texts) {
    for (const sh of shapes) {
      if (sh.el.contains(t.node)) continue;
      const A = { left: t.rc.left + 0.5, right: t.rc.right - 0.5, top: t.rc.top + 1.5, bottom: t.rc.bottom - 1.5 };
      const B = { left: sh.r.left + 1, right: sh.r.right - 1, top: sh.r.top + 1, bottom: sh.r.bottom - 1 };
      if (inter(A, B) > 2) out.push(`texto "${t.node.nodeValue.trim().slice(0, 28)}" pisa una figura`);
    }
  }
  return out;
}

window.__overlapReport = overlapReport;   // para probar el detector (probar_detector.mjs)

async function main() {
  await document.fonts.ready;

  // dimensiones reales de la hoja en px CSS
  const pp = document.createElement('div');
  pp.style.cssText = 'position:absolute;width:420mm;height:297mm;visibility:hidden;left:0;top:0';
  document.body.appendChild(pp);
  const PW = pp.getBoundingClientRect().width, PH = pp.getBoundingClientRect().height;
  pp.remove();
  const MARGIN = (7 / 25.4) * 96;                       // 7 mm de margen
  const Wc = Math.floor(PW - 2 * MARGIN) - 1;
  const Hc = Math.floor(PH - 2 * MARGIN) - 1;

  const header = datos.header || {};
  const products = datos.products || [];
  const revisions = datos.revisions || [];
  const logoUrl = datos.logoUrl || null;

  const hdr1 = measureBox(<Header header={header} logoUrl={logoUrl} page={1} pages={9} full />, Wc);
  const hdr2 = measureBox(<Header header={header} logoUrl={logoUrl} page={2} pages={9} full={false} />, Wc);
  // la leyenda reparte su ancho entre simbolos / codigos / revisiones: se prueba un juego de repartos y se queda el mas bajo
  // (se descartan los repartos donde un bloque se desborda sobre el vecino: la tabla de codigos de 160 se pisaba con las revisiones)
  let legendSplit = null, legendH = Infinity;
  const legendOpts = [[19, 27], [17, 33], [17, 38], [15, 30], [15, 36], [14, 42], [20, 24], [22, 30], [18, 30], [18, 36], [16, 40], [24, 30], [26, 34], [20, 36], [20, 44]];
  for (const sp of legendOpts) {
    const p = probe(<div style={{ width: Wc }}><Legend header={header} products={products} revisions={revisions} width={Wc} split={sp} /></div>, Wc + 10);
    const lg = p.host.querySelector('.fc-legend');
    const desborda = [...lg.children].some((b) => b.scrollWidth > b.clientWidth + 1);
    const h = Math.ceil(lg.getBoundingClientRect().height);
    p.done();
    if (!desborda && h < legendH) { legendH = h; legendSplit = sp; }
  }
  if (!legendSplit) {
    legendSplit = legendOpts[0];
    legendH = measureBox(<Legend header={header} products={products} revisions={revisions} width={Wc} split={legendSplit} />, Wc);
  }

  // geometria de cada nodo del flujo principal
  const flow = JSON.parse(JSON.stringify(datos.flow || []));
  flow.forEach(annotateNode);
  const items = flow.map((node) => ({ node, g: measureSeq([node], false, true) }));

  // conectores de pagina
  const connOut = { type: 'offpage-out', pageText: 'COL. 12', description: 'SIGUE EN COLUMNA 12 · HOJA 2' };
  const connIn = { type: 'offpage-in', pageText: 'COL. 11', description: 'VIENE DE COLUMNA 11 · HOJA 2' };
  const gOut = measureSeq([connOut], false, false), gIn = measureSeq([connIn], true, false);
  const hOut = gOut.h, hIn = gIn.h;

  const Hfn = (p, P) => {
    let h = Hc - (p === 1 ? hdr1 : hdr2) - HDR_GAP - SAFETY;
    if (p === P) h -= legendH + HDR_GAP;
    return h;
  };

  // 1) minimo de hojas con tope 1
  let base = pack(items, gOut, gIn, hOut, hIn, Wc, Hfn, 1);
  if (!base) {
    const dbg2 = items.map((it, i) => (it.node._sg ? `#${i}.sg=${JSON.stringify(it.node._sg)}` : '') + (it.node._bg ? `#${i}.bg=${JSON.stringify(it.node._bg)}` : '')).filter(Boolean).join(' ; ');
    const dbg = dbg2 + ' // ' + items.map((it, i) => `#${i} ${it.node.stepId || it.node.type} L${it.g.L} R${it.g.R} w${it.g.L + it.g.R + 2 * C.PADX} h${it.g.h}`).join(' | ');
    throw new Error(`No hay empaque posible ni con 10 hojas (Wc ${Wc}, H1 ${Hfn(1, 2)}, Hmid ${Hfn(2, 3)}, gOut ${JSON.stringify(gOut)}, gIn ${JSON.stringify(gIn)}). Items: ${dbg}`);
  }
  // 2) columna mas baja posible manteniendo hojas y cantidad de columnas
  let best = base;
  let lo = 0.3, hi = 1.0;
  for (let it = 0; it < 14; it++) {
    const mid = (lo + hi) / 2;
    const r = pack(items, gOut, gIn, hOut, hIn, Wc, Hfn, mid);
    if (r && r.P === base.P && r.nCols === base.nCols && r.bad === base.bad) { best = r; hi = mid; } else { lo = mid; }
  }

  // armar paginas y columnas con sus conectores
  const colPage = best.cols.map((c) => c.page);
  const pages = Array.from({ length: best.P }, () => ({ columns: [] }));
  best.cols.forEach((c, idx) => {
    const k = idx + 1;
    const nodes = [];
    if (c.j > 0) {
      const same = colPage[idx - 1] === c.page;
      nodes.push({ type: 'offpage-in', pageText: `COL. ${k - 1}`, description: `VIENE DE COLUMNA ${k - 1}` + (same ? '' : ` · HOJA ${colPage[idx - 1]}`) });
    }
    for (let q = c.j; q < c.i; q++) nodes.push(flow[q]);
    if (c.i < flow.length) {
      const same = colPage[idx + 1] === c.page;
      nodes.push({ type: 'offpage-out', pageText: `COL. ${k + 1}`, description: `SIGUE EN COLUMNA ${k + 1}` + (same ? '' : ` · HOJA ${colPage[idx + 1]}`) });
    }
    pages[c.page - 1].columns.push({ number: k, nodes, geom: { L: c.L, R: c.R } });
  });
  const plan = { pages, legendWidth: Wc, legendSplit };

  const rootEl = document.getElementById('root');
  const root = createRoot(rootEl);
  flushSync(() => root.render(<Document plan={plan} header={header} products={products} revisions={revisions} logoUrl={logoUrl} />));

  // ---- chequeos geometricos ----
  const check = { legendSplit, pages: pages.length, cols: best.cols.length, problems: [], colInfo: [], Wc, Hc, legendH, hdr1, hdr2, PW, PH };
  document.querySelectorAll('.fc-page').forEach((pg, pi) => {
    const pr = pg.getBoundingClientRect();
    const cols = pg.querySelector('.fc-cols');
    const cr = cols.getBoundingClientRect();
    const legend = pg.querySelector('.fc-legend');
    const limitBottom = legend ? legend.getBoundingClientRect().top - 2 : pr.bottom - MARGIN + 1;
    let prevRight = -Infinity;
    pg.querySelectorAll('.fc-col').forEach((col) => {
      const ink = inkBox(col);
      const colR = col.getBoundingClientRect();
      const info = { page: pi + 1, col: +col.dataset.col, inkLeft: ink.left - colR.left, inkRight: colR.right - ink.right, inkBottomSlack: limitBottom - ink.bottom, inkTopSlack: ink.top - cr.top };
      check.colInfo.push(info);
      if (ink.left < colR.left - 0.5 || ink.right > colR.right + 0.5) check.problems.push(`pagina ${pi + 1} columna ${col.dataset.col}: tinta fuera de su columna (izq ${info.inkLeft.toFixed(1)} der ${info.inkRight.toFixed(1)})`);
      if (ink.bottom > limitBottom) check.problems.push(`pagina ${pi + 1} columna ${col.dataset.col}: baja ${(ink.bottom - limitBottom).toFixed(1)} px de mas`);
      if (colR.left < prevRight - 0.5) check.problems.push(`pagina ${pi + 1}: la columna ${col.dataset.col} se encima con la anterior`);
      prevRight = colR.right;
    });
    if (pr.right - MARGIN + 1 < prevRight) check.problems.push(`pagina ${pi + 1}: columnas se pasan del margen derecho`);
    if (legend) {
      const lr = legend.getBoundingClientRect();
      if (lr.bottom > pr.bottom - MARGIN + 1.5) check.problems.push(`pagina ${pi + 1}: la leyenda se pasa del margen inferior por ${(lr.bottom - (pr.bottom - MARGIN)).toFixed(1)} px`);
    }
    for (const o of overlapReport(pg)) check.problems.push(`pagina ${pi + 1}: ${o}`);
    // todo el contenido de la pagina dentro de la hoja
    const allInk = inkBox(pg);
    if (allInk.right > pr.right - MARGIN + 1 || allInk.bottom > pr.bottom - MARGIN + 1 || allInk.left < pr.left + MARGIN - 1 || allInk.top < pr.top + MARGIN - 1) {
      check.problems.push(`pagina ${pi + 1}: tinta fuera del area imprimible (l ${(allInk.left - pr.left).toFixed(1)} t ${(allInk.top - pr.top).toFixed(1)} r ${(pr.right - allInk.right).toFixed(1)} b ${(pr.bottom - allInk.bottom).toFixed(1)}; margen ${MARGIN.toFixed(1)})`);
    }
  });
  window.__FC_INFO__ = check;

  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => { window.__FC_LISTO__ = true; }, 150)));
}

main().catch((e) => { window.__FC_ERROR__ = String(e && e.stack || e); window.__FC_LISTO__ = true; });
