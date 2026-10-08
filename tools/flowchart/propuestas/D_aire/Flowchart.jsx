import React, { Fragment, useLayoutEffect, useRef, useState } from 'react';

/**
 * PROPUESTA D — AIRE. Deriva del motor compacto B (tools/flowchart/propuestas/B_final/Flowchart.jsx).
 *
 * Mismo contrato de datos y mismas convenciones de dibujo que el original; cambia como se reparte el espacio:
 *  - TODO se dimensiona en `em` (1em = `cfg.F` px CSS de diseno), igual que B, pero con el AIRE como parametro de primera:
 *    `gap` (linea visible entre dos figuras consecutivas), `colGap` (separacion entre ramas), `drop` (tramo entre la barra de la
 *    rama y su primera figura), `sideLine` / `sidePad` (rama lateral y su texto), `sideClear` (canal del reproceso), `descPad`.
 *    Quien arma la hoja (render.mjs) resuelve `gap` y `colGap` para que el dibujo LLENE la hoja A3 con la letra elegida.
 *  - Una o dos hojas A3 por flujograma. Si son dos, el corte va en un lugar natural del proceso con un conector de hoja
 *    (pentagono: "CONTINUA EN HOJA 2" / "VIENE DE HOJA 1"), cabecera completa en la hoja 1 y reducida en la 2, y la leyenda con
 *    los codigos y el historial de revisiones en la ultima hoja.
 *  - El dibujo esta centrado en su marco.
 * Del motor sale el DIBUJO, no el contenido: cada nodo del JSON se dibuja (y lleva data-nid para cotejarlo uno por uno contra el DOM).
 */

const CFG = (typeof window !== 'undefined' && window.__FC__ && window.__FC__.cfg) || {};
const F = CFG.F || 14;
const n = (k, d) => (CFG[k] !== undefined ? CFG[k] : d);

// ---------- tokens (em) ----------
const T = {
  lh: n('lh', 1.2),
  gap: n('gap', 2.4),            // aire vertical entre filas: es la linea del flujo que se ve entre dos figuras
  figW: n('figW', 4.8),
  descPad: n('descPad', 1.0),    // aire entre la figura y su descripcion
  sidePad: n('sidePad', 1.0),    // aire entre la descripcion y la linea de su rama lateral
  descMax: n('descMax', 30),     // ancho maximo de una descripcion en la secuencia principal
  descMax2: n('descMax2', 22),   // ... dentro de una division de 2 columnas
  descMax3: n('descMax3', 17),   // ... de 3 o mas
  descMaxSide: n('descMaxSide', 24), // ... en un reproceso lateral
  nestF: n('nestF', 0.85),       // factor extra para divisiones anidadas
  labelMax: n('labelMax', 8.4),  // ancho maximo del texto de un rombo
  sideLine: n('sideLine', 3.6),  // largo de la linea de una rama lateral
  termMaxR: n('termMaxR', 21),
  termMaxL: n('termMaxL', 10),
  sideDescMax: n('sideDescMax', 14),
  colGap: n('colGap', 5),
  drop: n('drop', 1.7),
  reworkW: n('reworkW', 2.6),
  reworkH: n('reworkH', 1.15),
  reworkLabelW: n('reworkLabelW', 7.2),
  sideClear: n('sideClear', 3),   // aire entre lo mas ancho de la columna principal y el reproceso (canal del REVERIFICAR)
  // grosor de linea (px CSS). Chromium redondea los bordes y las lineas a px ENTEROS, asi que se elige un entero:
  // con F=10 un px queda en ~0,8-1,1 pt impresos (antes 0,63 pt). bwThick = marco de cabecera y pie.
  bw: n('bw', 1),
  bwThick: n('bwThick', 2),
  retGap: n('retGap', 1.0),      // aire extra arriba de la operacion a la que vuelve un REVERIFICAR
  margin: n('margin', 11),       // margen de la hoja, en mm (el piso es 10)
};
const SH = {
  operation: { w: n('opW', 3.5), h: n('opH', 2.1) },
  'op-ins': { w: n('opW', 3.5) + 0.9, h: n('opH', 2.1) + 0.7 },
  transfer: { w: 1.5, h: 1.5 },
  storage: { w: 3.5, h: 2.9 },
  inspection: { w: n('opW', 3.5), h: n('opH', 2.1) },
  condition: { w: 2.1, h: 2.1 },
  terminal: { w: 5, h: 2 },
  pageconn: { w: 3.4, h: 3.6 },
};

// Colores oscurecidos para que se lean en blanco y negro (antes L=#60A5FA, LL=#93C5FD, rojo #f87171, naranja #fb923c).
const L = '#1E40AF', LL = '#2B50C7', NAVY = '#1E40AF', TXT = '#1f2937', LBL = n('lblColor', '#1E40AF'), RED = '#991b1b';
const ORG = '#c2410c', GRN = '#15803d';
const u = (x) => `${x}em`;

// ---------- medicion de texto (canvas, misma pila de fuentes que la pagina) ----------
let _ctx = null;
const mw = (s, bold = true) => {
  if (!_ctx) {
    _ctx = document.createElement('canvas').getContext('2d');
  }
  const fam = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  _ctx.font = `${bold ? 'bold ' : ''}100px ${fam}`;
  return _ctx.measureText(String(s).toUpperCase()).width / 100;
};
// ancho real de un texto ya partido en renglones (un div con max-width ocupa SIEMPRE el max-width cuando se parte,
// y con fondo blanco taparia la linea de mas)
const wrapW = (s, max) => {
  const sp = mw(' ');
  let line = 0, widest = 0;
  for (const w of String(s).split(/\s+/).filter(Boolean)) {
    const ww = mw(w);
    if (line === 0) line = ww;
    else if (line + sp + ww <= max) line += sp + ww;
    else { widest = Math.max(widest, line); line = ww; }
  }
  return Math.max(widest, line);
};
const wrapMin = (s, max) => Math.min(max, wrapW(s, max)) + 0.35;
const termW = (s, max) => Math.min(max, wrapW(s, max - 1.3) + 1.3 + 0.35);

// ---------- calculos de ancho ----------
const sideRightW = (bs) => {
  if (!bs || bs.sequence) return 0;
  const g = 0.3;
  let w = T.sideLine;
  if (bs.type === 'terminal') w += termW(bs.text, T.termMaxR) + g;
  else if (bs.type === 'connector') w += 2.1 + (bs.description || bs.pageNote ? 0.6 + Math.min(T.sideDescMax, Math.max(bs.description ? mw(bs.description) : 0, bs.pageNote ? mw(bs.pageNote) : 0) + 0.2) : 0);
  else w += SH.operation.w + (bs.description ? 0.6 + Math.min(T.sideDescMax, mw(bs.description)) : 0);
  return w + g;
};
const sideLeftW = (bs) => {
  if (!bs || bs.sequence) return 0;
  let w = T.sideLine + 0.2;
  if (bs.type === 'terminal') w += termW(bs.text, T.termMaxL);
  else if (bs.type === 'connector') w += 2.1;
  else w += SH.operation.w;
  return w + 0.5;
};
const reworkText = (nd) => nd.rework.label || `VUELVE A OP. ${nd.rework.targetId}`;
const reworkLabelW = (nd) => Math.max(...reworkText(nd).split(/\s+/).map((w) => mw(w))) + 0.6;
const critW = (nd) => mw(nd.criticalType || '') + 1.0;
const inW = () => mw('VIENE DE') + 0.3 + 2.1 + 1.1;

const leftNeedNode = (nd) => {
  let w = 0;
  const bs = nd.branchSide;
  if (nd.type === 'condition' && nd.labelCondition && !(bs && bs.direction === 'left')) w = Math.max(w, wrapMin(nd.labelCondition, T.labelMax) + 0.7);
  if (bs && bs.direction === 'left' && !bs.sequence) w = Math.max(w, sideLeftW(bs));
  let a = 0;
  if (nd.critical) a += critW(nd) + 0.5;
  if (nd.incomingConnector) a += inW() + 0.3;
  w = Math.max(w, a);
  if (nd.rework) w = Math.max(w, reworkLabelW(nd) - 1.0);
  return w;
};
const seqOf = (b) => (Array.isArray(b) ? b : b.sequence);
const seqLeft = (seq) => {
  let w = 0;
  for (const nd of seq) {
    w = Math.max(w, leftNeedNode(nd));
    if (nd.branches && nd.branches.length) w = Math.max(w, seqLeft(seqOf(nd.branches[0])));
  }
  return Math.ceil(w * 10) / 10;
};
const countRows = (seq) => {
  let c = 0;
  for (const nd of seq) {
    c += 1;
    if (nd.branches) c += Math.max(...nd.branches.map((b) => countRows(seqOf(b))));
    if (nd.branchSide && nd.branchSide.sequence) c = Math.max(c, countRows(nd.branchSide.sequence));
  }
  return c;
};
const descW = (nd, descMax) => (nd.description ? Math.min(descMax, mw(nd.description) + 0.5) : 0);
// ancho (em, desde el borde izquierdo de la fila) que ocupa la fila de un nodo hacia la derecha
const rowExtent = (nd, Ls, descMax) => {
  let x = Ls + T.figW;
  if (nd.description) x += T.descPad + descW(nd, descMax);
  if (nd.branchSide && !nd.branchSide.sequence && nd.branchSide.direction !== 'left') {
    x += sideRightW(nd.branchSide) - (nd.description ? 0 : (T.figW - SH[nd.type].w) / 2);
  }
  return x;
};

// ---------- figuras ----------
const baseShape = (w, h, extra) => ({
  width: u(w), height: u(h), boxSizing: 'border-box', background: '#fff', position: 'relative', zIndex: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: NAVY, fontWeight: 700, lineHeight: 1, ...extra,
});
const Border = `${T.bw}px solid ${L}`;

const ShapeOperation = ({ id }) => (
  <div style={baseShape(SH.operation.w, SH.operation.h, { borderRadius: '50%', border: Border })}>{id}</div>
);
const ShapeOpIns = ({ id }) => (
  <div style={baseShape(SH['op-ins'].w, SH['op-ins'].h, { border: Border })}>
    <div style={{ width: u(SH.operation.w), height: u(SH.operation.h), borderRadius: '50%', border: Border, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>{id}</div>
  </div>
);
const ShapeTransfer = () => <div style={baseShape(SH.transfer.w, SH.transfer.h, { borderRadius: '50%', border: Border })} />;
const ShapeStorage = ({ id }) => (
  <div style={baseShape(SH.storage.w, SH.storage.h, {})}>
    <svg viewBox="0 0 48 40" style={{ width: u(SH.storage.w), height: u(SH.storage.h), display: 'block' }} fill="none" preserveAspectRatio="none">
      <path d="M2 3L46 3L24 37L2 3Z" fill="white" stroke={L} strokeWidth={T.bw} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
    {id && <span style={{ position: 'absolute', left: 0, right: 0, top: u(0.42), textAlign: 'center', lineHeight: 1, color: NAVY, fontWeight: 700 }}>{id}</span>}
  </div>
);
const ShapeInspection = ({ id }) => <div style={baseShape(SH.inspection.w, SH.inspection.h, { border: Border })}>{id}</div>;
const ShapeCondition = () => (
  <div style={baseShape(SH.condition.w, SH.condition.h, {})}>
    <div style={{ width: u(SH.condition.w / 1.4142), height: u(SH.condition.h / 1.4142), border: Border, background: '#fff', transform: 'rotate(45deg)', boxSizing: 'border-box' }} />
  </div>
);
const Terminal = ({ text, maxW }) => (
  <div style={{ position: 'relative', zIndex: 10, border: `${T.bw}px solid ${RED}`, background: '#fff', color: RED, fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', lineHeight: T.lh, padding: '0.28em 0.6em', borderRadius: '0.2em', width: u(termW(text, maxW)), boxSizing: 'border-box', flex: 'none' }}>{text}</div>
);
const Connector = ({ id, out = true }) => (
  <div style={{ position: 'relative', zIndex: 10, width: u(2.1), height: u(2.1), borderRadius: '50%', boxSizing: 'border-box', border: `${T.bwThick}px solid ${out ? ORG : GRN}`, background: out ? '#fff7ed' : '#f0fdf4', color: out ? ORG : GRN, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flex: 'none' }}>{id}</div>
);
// Conector de HOJA (fuera de pagina): pentagono con la punta hacia abajo; naranja = "continua en", verde = "viene de".
// Adentro va el numero de la hoja a la que va / de la que viene. Mismos colores que los conectores circulo-letra de la casa.
const ShapePageConn = ({ dir, label }) => {
  const out = dir === 'out';
  const col = out ? ORG : GRN;
  return (
    <div style={{ position: 'relative', zIndex: 10, width: u(SH.pageconn.w), height: u(SH.pageconn.h), flex: 'none' }}>
      <svg viewBox="0 0 40 44" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
        <polygon points="2,2 38,2 38,28 20,42 2,28" fill={out ? '#fff7ed' : '#f0fdf4'} stroke={col} strokeWidth={T.bwThick} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <span style={{ position: 'absolute', left: 0, right: 0, top: u(0.55), textAlign: 'center', lineHeight: 1, color: col, fontWeight: 900 }}>{label}</span>
    </div>
  );
};
const Arrow = ({ dir }) => (
  <div style={{ position: 'absolute', top: '50%', [dir === 'left' ? 'left' : 'right']: 0, width: u(0.55), height: u(0.55), marginTop: u(-0.275), boxSizing: 'border-box',
    ...(dir === 'left' ? { borderBottom: `${T.bw}px solid ${L}`, borderLeft: `${T.bw}px solid ${L}`, transform: 'translateX(-1px) rotate(45deg)' } : { borderTop: `${T.bw}px solid ${L}`, borderRight: `${T.bw}px solid ${L}`, transform: 'translateX(1px) rotate(45deg)' }) }} />
);

const shapeOf = (nd) => {
  switch (nd.type) {
    case 'operation': return <ShapeOperation id={nd.stepId} />;
    case 'op-ins': return <ShapeOpIns id={nd.stepId} />;
    case 'transfer': return <ShapeTransfer />;
    case 'storage': return <ShapeStorage id={nd.stepId} />;
    case 'inspection': return <ShapeInspection id={nd.stepId} />;
    case 'condition': return <ShapeCondition />;
    case 'terminal': return <Terminal text={nd.text} maxW={9} />;
    case 'pageconn': return <ShapePageConn dir={nd.dir} label={nd.pageNo} />;
    default: return null;
  }
};

const lblStyle = { color: LBL, fontWeight: 700, lineHeight: 1 };

// rama lateral sin secuencia (SCRAP, conector, etc.), en linea
const SideGroup = ({ bs, dir }) => {
  const line = (
    <div style={{ position: 'relative', width: u(T.sideLine), height: T.bw, background: LL, flex: 'none', zIndex: 5 }}>
      {bs.labelNode && <span style={{ ...lblStyle, position: 'absolute', bottom: u(0.22), left: 0, right: 0, textAlign: 'center', zIndex: 11 }}>{bs.labelNode}</span>}
      <Arrow dir={dir} />
    </div>
  );
  let obj = null;
  if (bs.type === 'terminal') obj = <Terminal text={bs.text} maxW={dir === 'left' ? T.termMaxL : T.termMaxR} />;
  else if (bs.type === 'connector') obj = <Connector id={bs.text} out />;
  else if (bs.type === 'operation') obj = <ShapeOperation id={bs.stepId} />;
  else if (bs.type === 'inspection') obj = <ShapeInspection id={bs.stepId} />;
  // nota de hoja (el conector sale en una hoja y entra en la otra): va debajo de la descripcion, en el color del conector
  const desc = (bs.description || bs.pageNote) ? (
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: dir === 'left' ? 'flex-end' : 'flex-start', maxWidth: u(T.sideDescMax), [dir === 'left' ? 'marginRight' : 'marginLeft']: u(0.6), textAlign: dir === 'left' ? 'right' : 'left', lineHeight: T.lh }}>
      {bs.description && <span style={{ fontWeight: 700, color: TXT, textTransform: 'uppercase' }}>{bs.description}</span>}
      {bs.pageNote && <span data-pagenote style={{ fontWeight: 700, color: ORG, textTransform: 'uppercase', fontStyle: 'italic' }}>{bs.pageNote}</span>}
    </span>
  ) : null;
  return dir === 'left'
    ? <div style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>{desc}{obj}{line}</div>
    : <div style={{ display: 'flex', alignItems: 'center', flex: 'none' }}>{line}{obj}{desc}</div>;
};

// ---------- nodo (una fila) ----------
const FlowNode = ({ node, Ls, descMax, upper, lower, alignW, sideX, firstSideShape }) => {
  const bs = node.branchSide;
  const spine = Ls + T.figW / 2;
  const hasSeq = bs && bs.sequence;
  const left = bs && bs.direction === 'left' && !hasSeq;
  const rightSide = bs && !hasSeq && !left;
  const shapeH = (SH[node.type] || SH.operation).h;
  const shapeW = (SH[node.type] || SH.operation).w;

  const critical = node.critical && (
    <span style={{ position: 'relative', zIndex: 10, color: node.criticalColor === 'black' ? '#000' : RED, border: `${T.bw}px solid ${node.criticalColor === 'black' ? '#000' : RED}`, fontWeight: 900, padding: '0 0.3em', borderRadius: '0.2em', background: '#fff', lineHeight: T.lh, flex: 'none' }}>{node.criticalType}</span>
  );
  const condLabel = node.type === 'condition' && node.labelCondition && (
    <span style={{ ...lblStyle, lineHeight: T.lh, fontStyle: 'italic', textTransform: 'uppercase', textAlign: 'right', width: u(wrapMin(node.labelCondition, T.labelMax)), background: '#fff', boxSizing: 'border-box', padding: '0 0.15em' }}>{node.labelCondition}</span>
  );
  const incoming = node.incomingConnector && (
    <div style={{ display: 'flex', alignItems: 'center', flex: 'none', position: 'relative', zIndex: 10 }}>
      <span style={{ marginRight: u(0.3), fontWeight: 700, color: GRN, lineHeight: 1.15, textAlign: 'right' }}>VIENE DE{node.incomingNote && <><br />{node.incomingNote}</>}</span>
      <Connector id={node.incomingConnector} out={false} />
      <div style={{ position: 'relative', width: u(1.1), height: T.bw, background: GRN }}><Arrow dir="right" /></div>
    </div>
  );

  return (
    <div data-nid={node.__nid} data-step={node.stepId || ''} data-type={node.type}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: `${T.gap / 2 + (node.__retTarget ? T.retGap : 0)}em 0 ${T.gap / 2}em`, width: '100%', boxSizing: 'border-box' }}>
      {/* linea del flujo: de borde a borde de la fila, asi las filas quedan unidas */}
      {(upper || lower) && (
        <div style={{ position: 'absolute', left: u(spine), width: T.bw, marginLeft: -T.bw / 2, top: upper ? 0 : '50%', bottom: lower ? 0 : '50%', background: LL, zIndex: 0 }} />
      )}
      {node.labelDown && !node.branches && (
        <span style={{ ...lblStyle, position: 'absolute', left: u(spine + 0.85), top: `calc(50% + ${u(0.4)})`, zIndex: 11 }}>{node.labelDown}</span>
      )}
      {/* retrabajo: el rotulo va debajo de la linea de vuelta; la linea (hasta la operacion a la que vuelve) la dibuja FlowArea */}
      {node.rework && (
        <span data-rework-label style={{ ...lblStyle, lineHeight: T.lh, position: 'absolute', left: u(Ls + (T.figW - shapeW) / 2 - 0.3 - reworkLabelW(node)), top: `calc(50% + ${u(0.3)})`, width: u(reworkLabelW(node)), textAlign: 'right', zIndex: 11 }}>{reworkText(node)}</span>
      )}

      {/* zona izquierda: solo lo que hace falta */}
      <div style={{ flex: `0 0 ${u(Ls)}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: u(0.4), position: 'relative', zIndex: 10, boxSizing: 'border-box', paddingRight: u(0.35) }}>
        {critical}
        {condLabel && !left && condLabel}
        {incoming && <div style={{ marginRight: u(-((T.figW - shapeW) / 2 + 0.35)) }}>{incoming}</div>}
        {left && <div style={{ marginRight: u(-((T.figW - shapeW) / 2 + 0.35)) }}><SideGroup bs={bs} dir="left" /></div>}
      </div>

      {/* figura */}
      <div data-fig style={{ flex: `0 0 ${u(T.figW)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
        {shapeOf(node)}
      </div>

      {/* zona derecha: descripcion y rama lateral en linea */}
      <div style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto', position: 'relative', zIndex: 10 }}>
        {node.description && (
          <div style={{ marginLeft: u(T.descPad), maxWidth: u(descMax), minWidth: rightSide && alignW ? u(alignW) : undefined, fontWeight: 700, color: TXT, textTransform: 'uppercase', lineHeight: T.lh, boxSizing: 'border-box' }}>{node.description}</div>
        )}
        {node.type === 'condition' && left && node.labelCondition && (
          <span style={{ ...lblStyle, lineHeight: T.lh, fontStyle: 'italic', textTransform: 'uppercase', marginLeft: u(0.5), width: u(wrapMin(node.labelCondition, T.labelMax)) }}>{node.labelCondition}</span>
        )}
        {rightSide && (
          <div style={{ marginLeft: node.description ? u(T.sidePad) : u(-(T.figW - shapeW) / 2) }}>
            <SideGroup bs={bs} dir="right" />
          </div>
        )}
      </div>

      {/* reproceso lateral: columna que cuelga al costado de la columna principal */}
      {hasSeq && (() => {
        const Lside = seqLeft(bs.sequence);
        const sideSpine = sideX + Lside + T.figW / 2;
        const fh = SH[bs.sequence[0].type]?.h ?? 2;
        const lineStart = spine + shapeW / 2;
        const lineEnd = sideSpine - (SH[bs.sequence[0].type]?.w ?? 2) / 2 - 0.15;
        return (
          <>
            <div data-sideline style={{ position: 'absolute', left: u(lineStart), width: u(lineEnd - lineStart), top: '50%', height: T.bw, background: LL, zIndex: 0 }}>
              {bs.labelNode && <span style={{ ...lblStyle, position: 'absolute', bottom: u(0.22), left: u(0.6), zIndex: 11, background: '#fff', padding: '0 0.15em' }}>{bs.labelNode}</span>}
              <Arrow dir="right" />
            </div>
            <div data-sidecol style={{ position: 'absolute', left: u(sideX), top: u((shapeH - fh) / 2), zIndex: 1 }}>
              <FlowSequence seq={bs.sequence} converges={false} Ls={Lside} descMax={T.descMaxSide} sideRoot />
            </div>
          </>
        );
      })()}
    </div>
  );
};

// ---------- division en ramas ----------
const BranchSplit = ({ branches, labelDown, converges, Ls0, descMax, depth }) => {
  const k = branches.length;
  const seqs = branches.map(seqOf);
  const Lss = seqs.map((s, i) => (i === 0 ? Ls0 : seqLeft(s)));
  const dm = k >= 3 ? T.descMax3 : T.descMax2;
  const colDesc = Math.min(descMax, dm) * (depth > 0 ? T.nestF : 1);
  const bar = (key, pos, i) => {
    const sx = Lss[i] + T.figW / 2;
    const last = i === k - 1;
    const st = { position: 'absolute', height: T.bw, background: LL, [pos]: 0 };
    if (i === 0) { st.left = u(sx); st.right = 0; }
    else if (last) { st.left = 0; st.width = u(sx); }
    else { st.left = 0; st.right = 0; }
    return <div key={key} style={st} />;
  };
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'stretch', position: 'relative', width: 'max-content' }}>
        {labelDown && <span style={{ ...lblStyle, position: 'absolute', left: u(Lss[0] + T.figW / 2 + 1.1), top: u(-1.25) }}>{labelDown}</span>}
        {seqs.map((seq, i) => {
          const sx = Lss[i] + T.figW / 2;
          const last = i === k - 1;
          return (
            <div key={i} style={{ position: 'relative', display: 'flex', flexDirection: 'column', paddingTop: u(T.drop), paddingRight: last ? 0 : u(T.colGap) }}>
              {k > 1 && bar('t', 'top', i)}
              <div style={{ position: 'absolute', top: 0, height: u(T.drop), left: u(sx), width: T.bw, marginLeft: -T.bw / 2, background: LL }} />
              <FlowSequence seq={seq} converges={converges} Ls={Lss[i]} descMax={colDesc} depth={depth + 1} />
              {converges && <div style={{ flex: '1 1 auto', width: T.bw, marginLeft: `calc(${u(sx)} - ${T.bw / 2}px)`, background: LL }} />}
              {converges && k > 1 && bar('b', 'bottom', i)}
            </div>
          );
        })}
      </div>
      {converges && <div style={{ height: u(T.drop), width: T.bw, marginLeft: `calc(${u(Ls0 + T.figW / 2)} - ${T.bw / 2}px)`, background: LL }} />}
    </>
  );
};

// ---------- secuencia ----------
const FlowSequence = ({ seq, converges = false, Ls, descMax, docRoot = false, sideRoot = false, depth = 0 }) => {
  // las filas con rama lateral de conector/terminal derecha alinean sus conectores
  const withSide = seq.filter((x) => x.description && x.branchSide && !x.branchSide.sequence && x.branchSide.direction !== 'left');
  const alignW = withSide.length > 1 ? Math.max(...withSide.map((x) => descW(x, descMax))) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 'max-content', alignItems: 'stretch' }}>
      {seq.map((node, i) => {
        const has = node.branches && node.branches.length > 0;
        const isLast = i === seq.length - 1;
        const nodeConverges = isLast ? converges : true;
        const lower = nodeConverges || !isLast || has || !!node.mergeDown;
        const upper = !(i === 0 && (docRoot || sideRoot));
        let sideX = 0;
        if (node.branchSide && node.branchSide.sequence) {
          const K = countRows(node.branchSide.sequence) + 2;
          let ext = 0;
          // con retorno (REVERIFICAR), el canal sube hasta la operacion a la que vuelve: se cuenta desde esa fila
          const rwN = node.branchSide.sequence.find((x) => x.rework);
          let j0 = i;
          if (rwN) { const t = seq.findIndex((x) => String(x.stepId) === String(rwN.rework.targetId)); if (t >= 0 && t < i) j0 = t; }
          for (let j = j0; j < Math.min(seq.length, i + K); j++) ext = Math.max(ext, rowExtent(seq[j], Ls, descMax));
          sideX = ext + T.sideClear;
        }
        return (
          <Fragment key={i}>
            <FlowNode node={node} Ls={Ls} descMax={descMax} upper={upper} lower={lower} alignW={alignW} sideX={sideX} />
            {has && <BranchSplit branches={node.branches} labelDown={node.labelDown} converges={nodeConverges} Ls0={Ls} descMax={descMax} depth={depth} />}
          </Fragment>
        );
      })}
    </div>
  );
};

// ---------- cabecera ----------
const HCell = ({ label, value }) => (
  <div style={{ border: `${T.bw}px solid ${L}`, padding: '0.2em 0.45em', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
    <span style={{ color: NAVY, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.05 }}>{label}</span>
    <span style={{ color: '#111827', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{value}</span>
  </div>
);

const HojaTxt = ({ pg }) => (pg && pg.total > 1
  ? <div style={{ marginTop: u(0.3), fontWeight: 900, color: '#1E3A8A', letterSpacing: '0.04em', lineHeight: 1.1 }}>{`HOJA ${pg.no} DE ${pg.total}`}</div>
  : null);

// cabecera REDUCIDA (hoja 2 en adelante): logo, titulo, codigo del formulario, revision y "HOJA n DE N"
const HeaderSmall = ({ header, logoUrl, pg }) => (
  <div style={{ display: 'flex', alignItems: 'stretch', border: `${T.bwThick}px solid ${L}`, background: '#fff', width: 0, minWidth: '100%', boxSizing: 'border-box' }}>
    <div style={{ flex: '0 0 auto', borderRight: `${T.bwThick}px solid ${L}`, padding: '0.3em 0.7em', display: 'flex', alignItems: 'center', background: '#f9fafb' }}>
      {logoUrl ? <img src={logoUrl} alt="Logo" style={{ height: u(2.8), display: 'block' }} /> : <b style={{ color: '#1E3A8A' }}>BARACK</b>}
    </div>
    <div style={{ flex: '1 1 0', minWidth: 0, borderRight: `${T.bwThick}px solid ${L}`, padding: '0.3em 0.8em', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <h1 style={{ margin: 0, fontSize: u(n('titleEm', 1.7) * 0.9), fontWeight: 900, color: '#1E3A8A', textTransform: 'uppercase', fontStyle: 'italic', lineHeight: 1.1 }}>{header.title}</h1>
    </div>
    <div style={{ flex: '0 0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gridAutoRows: '1fr' }}>
      <HCell label="Código del Documento" value={header.documentCode} />
      <HCell label="Revisión" value={header.revision} />
      <div style={{ border: `${T.bw}px solid ${L}`, padding: '0.2em 0.7em', display: 'flex', alignItems: 'center', fontWeight: 900, color: '#1E3A8A', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>{`HOJA ${pg.no} DE ${pg.total}`}</div>
    </div>
  </div>
);

const Header = ({ header, logoUrl, pg }) => (
  <div style={{ display: 'flex', alignItems: 'stretch', border: `${T.bwThick}px solid ${L}`, background: '#fff', width: 0, minWidth: '100%', boxSizing: 'border-box' }}>
    <div style={{ flex: '0 0 auto', borderRight: `${T.bwThick}px solid ${L}`, padding: '0.3em 0.7em', display: 'flex', alignItems: 'center', background: '#f9fafb' }}>
      {logoUrl ? <img src={logoUrl} alt="Logo" style={{ height: u(3.6), display: 'block' }} /> : <b style={{ color: '#1E3A8A' }}>BARACK</b>}
    </div>
    <div style={{ flex: '1 1 0', minWidth: 0, borderRight: `${T.bwThick}px solid ${L}`, padding: '0.3em 0.8em', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <h1 style={{ margin: 0, fontSize: u(n('titleEm', 1.7)), fontWeight: 900, color: '#1E3A8A', textTransform: 'uppercase', fontStyle: 'italic', lineHeight: 1.1 }}>{header.title}</h1>
      <HojaTxt pg={pg} />
    </div>
    <div style={{ flex: '0 0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gridAutoRows: '1fr' }}>
      <HCell label="Código del Documento" value={header.documentCode} />
      <HCell label="Revisión" value={header.revision} />
      <HCell label="Fecha Emisión" value={header.date} />
      <HCell label="Fecha Revisión" value={header.revisionDate || '—'} />
      <HCell label="Elaborado por" value={header.preparedBy} />
      <HCell label="Revisado por" value={header.reviewedBy} />
      <HCell label="Proyecto" value={header.project} />
      <HCell label="Cliente" value={header.client} />
    </div>
  </div>
);

// ---------- leyenda y tablas ----------
const Sym = ({ children, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: u(0.4), fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>
    <div style={{ width: u(2.6), display: 'flex', justifyContent: 'center', flex: 'none' }}>{children}</div>
    <span>{label}</span>
  </div>
);
const mini = (w, h, extra) => ({ width: u(w), height: u(h), border: `${T.bw}px solid ${L}`, background: '#fff', boxSizing: 'border-box', ...extra });

const Legend = ({ header, products, revisions, pg }) => {
  const conOps = products.some((p) => p.operations);
  const enc = header.productsColumns || {};
  const th = { textAlign: 'left', color: '#374151', fontWeight: 900, padding: '0.1em 0.35em 0.15em 0', borderBottom: '1px solid #6b7280', verticalAlign: 'bottom', lineHeight: 1.1 };
  const td = { padding: '0.12em 0.35em 0.12em 0', lineHeight: 1.12, verticalAlign: 'top', borderBottom: '1px solid #d1d5db' };
  const hasSC = Array.isArray(header.specialChars) && header.specialChars.length > 0;
  const h4 = { margin: 0, fontWeight: 900, color: '#1E3A8A', lineHeight: 1.1, whiteSpace: 'nowrap' };
  const libres = Math.max(0, n('minRevRows', 3) - revisions.length);
  const prodCols = n('prodCols', 1);
  const chunks = [];
  const per = Math.ceil(products.length / prodCols);
  for (let i = 0; i < products.length; i += per) chunks.push(products.slice(i, i + per));
  const prodTable = (rows, key) => (
    <table key={key} style={{ borderCollapse: 'collapse', fontWeight: 700, color: '#374151', width: prodCols > 1 ? 'auto' : '100%' }}>
      <thead>
        <tr>
          <th style={{ ...th, whiteSpace: 'nowrap' }}>{enc.code || 'Part Number VW'}</th>
          <th style={{ ...th, whiteSpace: 'nowrap' }}>{enc.level || 'Nivel'}</th>
          <th style={th}>{enc.description || 'Descripción / Componente'}</th>
          {conOps && <th style={{ ...th, whiteSpace: 'nowrap' }}>{enc.operations || 'Operaciones'}</th>}
          <th style={{ ...th, whiteSpace: 'nowrap' }}>{enc.version || 'Color/Versión'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((it, i) => (
          <tr key={i}>
            <td style={{ ...td, color: LBL, whiteSpace: 'nowrap' }}>{it.code}</td>
            <td style={{ ...td, whiteSpace: 'nowrap' }}>{it.level}</td>
            <td style={td}>{it.description}</td>
            {conOps && <td style={td}>{it.operations}</td>}
            <td style={td}>{it.version}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div style={{ border: `${T.bwThick}px solid ${L}`, background: '#fff', borderRadius: u(0.3), width: 0, minWidth: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      {/* franja de simbolos */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: u(1.1), rowGap: u(0.3), padding: '0.35em 0.7em', background: '#f9fafb', borderBottom: `${T.bw}px solid ${L}` }}>
        <h4 style={h4}>SÍMBOLOS Y REFERENCIAS</h4>
        <Sym label="OPERACIÓN"><div style={mini(2.2, 1.3, { borderRadius: '50%' })} /></Sym>
        <Sym label="OP. + INSPECCIÓN"><div style={{ ...mini(2.4, 1.7, {}), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={mini(1.7, 1, { borderRadius: '50%' })} /></div></Sym>
        <Sym label="TRASLADO"><div style={mini(1.1, 1.1, { borderRadius: '50%' })} /></Sym>
        <Sym label="ALMACENADO">
          <svg viewBox="0 0 48 40" style={{ width: u(1.5), height: u(1.25), display: 'block' }} fill="none"><path d="M2 3L46 3L24 37L2 3Z" fill="white" stroke={L} strokeWidth="3" strokeLinejoin="round" /></svg>
        </Sym>
        <Sym label="INSPECCIÓN"><div style={mini(2.0, 1.3, {})} /></Sym>
        <Sym label="CONDICIÓN"><div style={mini(1.1, 1.1, { transform: 'rotate(45deg)' })} /></Sym>
        <Sym label="CONECTOR">
          <div style={{ width: u(1.7), height: u(1.7), borderRadius: '50%', border: `${T.bwThick}px solid ${ORG}`, background: '#fff7ed', color: ORG, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxSizing: 'border-box' }}>X</div>
        </Sym>
        {pg && pg.total > 1 && (
          <Sym label="CONECTOR DE HOJA (CONTINÚA EN / VIENE DE)">
            <svg viewBox="0 0 40 44" style={{ width: u(1.5), height: u(1.65), display: 'block' }} fill="none"><polygon points="2,2 38,2 38,28 20,42 2,28" fill="#fff7ed" stroke={ORG} strokeWidth="3.5" strokeLinejoin="round" /></svg>
          </Sym>
        )}
        {hasSC && <h4 style={{ ...h4, marginLeft: u(0.6) }}>CARACTERÍSTICAS ESPECIALES</h4>}
        {hasSC && header.specialChars.map((sc, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: u(0.5), fontWeight: 700, color: '#374151' }}>
            <span style={{ color: RED, fontWeight: 900 }}>{sc.mark}</span><span>{sc.meaning}</span>
          </div>
        ))}
        {header.footerNote && (
          <div style={{ flexBasis: '100%', fontWeight: 600, color: '#374151', lineHeight: 1.15 }}>{header.footerNote}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap' }}>
        {/* codigos de producto */}
        <div style={{ flex: '0 1 auto', padding: '0.4em 0.7em', borderRight: `${T.bw}px solid ${L}`, minWidth: 0, boxSizing: 'border-box' }}>
          <h4 style={{ ...h4, marginBottom: u(0.3) }}>CÓDIGOS PROD. TERMINADO</h4>
          <div style={{ display: 'flex', gap: u(1) }}>{chunks.map((c, i) => prodTable(c, i))}</div>
        </div>
        {/* historial de revisiones */}
        <div style={{ flex: `1 1 ${u(n('revMinW', 40))}`, minWidth: u(n('revMinW', 40)), padding: '0.4em 0.7em', boxSizing: 'border-box', borderTop: 'none' }}>
          <h4 style={{ ...h4, marginBottom: u(0.3) }}>HISTORIAL DE REVISIONES</h4>
          <table style={{ borderCollapse: 'collapse', fontWeight: 700, color: '#374151', width: '100%' }}>
            <thead>
              <tr>
                <th style={th}>Rev.</th><th style={th}>Fecha</th><th style={{ ...th, width: '14%' }}>Ítem cambiado</th><th style={{ ...th, width: '52%' }}>Detalles</th><th style={th}>Fecha PSW</th><th style={{ ...th, textAlign: 'right', paddingRight: 0 }}>Modificó</th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...td, ...(i === revisions.length - 1 ? { color: RED, fontWeight: 900 } : {}) }}>{r.rev}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.date}</td>
                  <td style={{ ...td, wordBreak: 'break-word' }}>{r.item}</td>
                  <td style={{ ...td, fontWeight: 600, paddingRight: u(0.6) }}>{r.details}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.pswDate}</td>
                  <td style={{ ...td, textAlign: 'right', paddingRight: 0 }}>{r.modifiedBy}</td>
                </tr>
              ))}
              {Array.from({ length: libres }).map((_, i) => (
                <tr key={`l${i}`}><td style={td}>&nbsp;</td><td style={td} /><td style={td} /><td style={td} /><td style={td} /><td style={td} /></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/// ---------- retornos (REVERIFICAR / RETRABAJO): una linea que llega a la operacion a la que vuelve ----------
const retornosDe = (flow) => {
  const out = [];
  const walk = (seq) => {
    for (const nd of seq) {
      if (nd.rework) out.push({ nid: nd.__nid, targetId: String(nd.rework.targetId) });
      if (nd.branches) nd.branches.forEach((b) => walk(seqOf(b)));
      if (nd.branchSide && nd.branchSide.sequence) walk(nd.branchSide.sequence);
    }
  };
  walk(flow);
  return out;
};

// Calcula, DESPUES del layout, el camino de cada retorno con las posiciones reales del DOM:
//   circulo de re-entrada -> hacia la izquierda hasta el canal -> sube por el canal -> hacia la izquierda por la
//   franja entre dos filas (justo arriba de la operacion a la que vuelve) -> flecha sobre la linea del flujo.
// El canal es el aire (sideClear) entre lo mas ancho de la columna principal y la columna del reproceso.
const calcularRetornos = (el, lista) => {
  const r0 = el.getBoundingClientRect();
  const rel = (r) => ({ l: r.left - r0.left, t: r.top - r0.top, r: r.right - r0.left, b: r.bottom - r0.top });
  // todos los textos (para comprobar que la linea no pasa por encima de ninguno)
  const textos = [];
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let tn;
  while ((tn = tw.nextNode())) {
    if (!tn.nodeValue.trim()) continue;
    const rg = document.createRange(); rg.selectNodeContents(tn);
    for (const q of rg.getClientRects()) if (q.width > 1) { const a = rel(q); textos.push({ ...a, s: tn.nodeValue.trim().slice(0, 30) }); }
  }
  const rutas = [], puentes = [], problemas = [];
  const px = F;
  for (const rw of lista) {
    const row = el.querySelector(`[data-nid="${rw.nid}"]`);
    const circEl = row && row.querySelector('[data-fig] > *');
    const colEl = row && row.closest('[data-sidecol]');
    const tgtRow = Array.from(el.querySelectorAll(`[data-step="${rw.targetId}"]`)).find((x) => !x.closest('[data-sidecol]'));
    const tgtFig = tgtRow && tgtRow.querySelector('[data-fig] > *');
    if (!circEl || !colEl || !tgtRow || !tgtFig) {
      problemas.push({ nid: rw.nid, target: rw.targetId, falta: 'no se ubico ' + [!circEl && 'circulo', !colEl && 'columna', !tgtRow && 'operacion destino'].filter(Boolean).join(',') });
      continue;
    }
    const c = rel(circEl.getBoundingClientRect());
    const col = rel(colEl.getBoundingClientRect());
    const tr = rel(tgtRow.getBoundingClientRect());
    const tf = rel(tgtFig.getBoundingClientRect());
    const sx = c.l, sy = (c.t + c.b) / 2;
    const cx = col.l - (T.sideClear / 2) * px;
    const spineX = (tf.l + tf.r) / 2;
    const yt = tr.t + (T.retGap / 2) * px; // en el medio del aire entre la fila de arriba y la operacion a la que vuelve
    const rr = 0.55 * px, ah = 0.8 * px, aw = 0.34 * px;
    const tip = spineX + T.bw / 2 + 0.5;
    const d = `M ${sx} ${sy} H ${cx + rr} Q ${cx} ${sy} ${cx} ${sy - rr} V ${yt + rr} Q ${cx} ${yt} ${cx - rr} ${yt} H ${tip + ah}`;
    const flecha = `${tip},${yt} ${tip + ah},${yt - aw} ${tip + ah},${yt + aw}`;
    // puentes: las lineas laterales (la del NO) que el canal cruza se cortan alrededor del cruce
    el.querySelectorAll('[data-sideline]').forEach((ln) => {
      const q = rel(ln.getBoundingClientRect());
      const qy = (q.t + q.b) / 2;
      if (q.l < cx - 0.7 * px && q.r > cx + 0.7 * px && qy > yt + 1 && qy < sy - 1) {
        // el puente llega hasta el primer texto que hay a la derecha en esa franja, sin tapar ninguna letra
        const yA = qy - (T.bw / 2 + 0.28 * px), yB = yA + T.bw + 0.56 * px;
        let fin = cx + 0.55 * px;
        const cerca = textos.filter((t) => t.l > cx + 0.5 * px && t.l < cx + 3 * px && t.t + (t.b - t.t) * 0.12 < yB && t.b - (t.b - t.t) * 0.12 > yA);
        if (cerca.length) fin = Math.max(fin, Math.min(...cerca.map((t) => t.l)) - 0.08 * px);
        puentes.push({ x: cx - 0.55 * px, y: yA, w: fin - (cx - 0.55 * px), h: yB - yA });
      }
    });
    // choques: que ningun texto toque los tres tramos
    const segs = [
      { n: 'horizontal de salida', l: cx, r: sx, t: sy - 1, b: sy + 1 },
      { n: 'canal', l: cx - 1, r: cx + 1, t: yt, b: sy },
      { n: 'horizontal de llegada', l: spineX, r: cx, t: yt - 1, b: yt + 1 },
    ];
    const choques = [];
    for (const sg of segs) for (const t of textos) {
      const hh = (t.b - t.t) * 0.12;
      if (t.l < sg.r && t.r > sg.l && t.t + hh < sg.b && t.b - hh > sg.t) choques.push({ tramo: sg.n, texto: t.s });
    }
    rutas.push({ nid: rw.nid, target: rw.targetId, d, flecha, choques, cx: +cx.toFixed(1), yt: +yt.toFixed(1), sy: +sy.toFixed(1), llegaA: +spineX.toFixed(1) });
  }
  return { rutas, puentes, problemas };
};

// ---------- area del flujo: mide lo que sobresale (ramas laterales) y se ajusta ----------
const FlowArea = ({ flow, pageNo = 1, fijo = false }) => {
  const ref = useRef(null);
  const [box, setBox] = useState(null);
  const [ret, setRet] = useState(null);
  const lista = React.useMemo(() => retornosDe(flow), [flow]);
  useLayoutEffect(() => {
    const el = ref.current;
    const r0 = el.getBoundingClientRect();
    let w = 0, h = 0;
    el.querySelectorAll('*').forEach((c) => {
      const b = c.getBoundingClientRect();
      if (b.width || b.height) { w = Math.max(w, b.right - r0.left); h = Math.max(h, b.bottom - r0.top); }
    });
    setBox({ w: Math.ceil(w) + 1, h: Math.ceil(h) + 1 });
  }, []);
  useLayoutEffect(() => {
    if (!box) return;
    const res = calcularRetornos(ref.current, lista);
    setRet(res);
    window.__FC_RETORNOS__ = window.__FC_RETORNOS__ || {};
    window.__FC_RETORNOS__[pageNo] = { esperados: lista.length, ...res };
  }, [box]);
  const Ls = seqLeft(flow);
  return (
    <div data-flowframe style={{ border: `${T.bwThick}px solid ${L}`, background: '#fff', borderRadius: u(0.4), padding: `${n('padFlowY', 1)}em ${n('padFlowX', 1.2)}em`, boxSizing: 'border-box', width: fijo ? '100%' : 'max-content', minWidth: '100%', display: 'flex', justifyContent: 'center' }}>
      <div ref={ref} data-flowbox style={{ position: 'relative', flex: 'none', width: box ? box.w : 'max-content', height: box ? box.h : undefined }}>
        <FlowSequence seq={flow} Ls={Ls} descMax={T.descMax} docRoot />
        {ret && box && (
          <svg data-retornos width={box.w} height={box.h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 6 }}>
            {ret.puentes.map((p, i) => <rect key={'p' + i} x={p.x} y={p.y} width={p.w} height={p.h} fill="#fff" />)}
            {ret.rutas.map((r, i) => (
              <g key={'r' + i}>
                <path d={r.d} fill="none" stroke={LL} strokeWidth={T.bw} />
                <polygon points={r.flecha} fill={LL} />
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
};

// numera cada nodo en orden DFS para poder cotejarlo uno por uno contra el JSON
const annotate = (flow, startNid = 0) => {
  let id = startNid;
  const walk = (seq) => seq.map((nd) => {
    const c = { ...nd, __nid: nd.type === 'pageconn' ? -1 : id++ };     // el conector de hoja no es un nodo del JSON
    if (c.branches) c.branches = c.branches.map((b) => (Array.isArray(b) ? walk(b) : { ...b, sequence: walk(b.sequence) }));
    if (c.branchSide && c.branchSide.sequence) c.branchSide = { ...c.branchSide, sequence: walk(c.branchSide.sequence) };
    return c;
  });
  const out = walk(flow);
  const destinos = new Set();
  const juntar = (seq) => { for (const nd of seq) { if (nd.rework) destinos.add(String(nd.rework.targetId)); if (nd.branches) nd.branches.forEach((b) => juntar(seqOf(b))); if (nd.branchSide && nd.branchSide.sequence) juntar(nd.branchSide.sequence); } };
  juntar(out);
  const marcar = (seq, lateral) => { for (const nd of seq) { if (!lateral && nd.stepId && destinos.has(String(nd.stepId))) nd.__retTarget = true; if (nd.branches) nd.branches.forEach((b) => marcar(seqOf(b), lateral)); if (nd.branchSide && nd.branchSide.sequence) marcar(nd.branchSide.sequence, true); } };
  marcar(out, false);
  return out;
};

// Una HOJA A3. `pg` = { no, total, first, last, startNid, w, h } (w, h en px CSS de diseno; sin ellos la hoja se mide "natural").
export default function Flowchart({ header, products, flow, revisions = [], showLegend = true, logoUrl = null, pg = { no: 1, total: 1, first: true, last: true, startNid: 0 } }) {
  const nodes = React.useMemo(() => annotate(flow, pg.startNid || 0), [flow]);
  const fijo = !!(pg.w && pg.h);
  const mpx = T.margin * (96 / 25.4) / (pg.c || 1);          // margen de la hoja en px CSS de diseno
  return (
    <div data-hoja={pg.no} className="hoja" style={{
      position: 'relative', display: 'flex', flexDirection: 'column', gap: u(n('pageGap', 0.8)), alignItems: 'stretch',
      width: fijo ? pg.w : 'max-content', height: fijo ? pg.h : undefined, padding: fijo ? mpx : 0, background: '#fff', fontSize: F, lineHeight: T.lh,
      boxSizing: 'border-box', overflow: fijo ? 'hidden' : 'visible', breakAfter: pg.last ? 'auto' : 'page',
    }}>
      {pg.first ? <Header header={header} logoUrl={logoUrl} pg={pg} /> : <HeaderSmall header={header} logoUrl={logoUrl} pg={pg} />}
      <main style={{ display: 'contents' }}><FlowArea flow={nodes} pageNo={pg.no} fijo={fijo} /></main>
      {pg.last && showLegend && <div style={{ flex: '1 1 auto' }} />}
      {pg.last && showLegend && <aside style={{ display: 'contents' }}><Legend header={header} products={products} revisions={revisions} pg={pg} /></aside>}
    </div>
  );
}
