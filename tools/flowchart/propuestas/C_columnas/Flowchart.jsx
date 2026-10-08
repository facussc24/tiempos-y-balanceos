import React from 'react';

/**
 * PROPUESTA C — COLUMNAS EN UNA A3 APAISADA.
 *
 * Mismo dibujo que el motor original (mismas figuras, colores, conectores, rombos, ramas, retrabajos),
 * pero con la geometria resuelta en PIXELES EXPLICITOS en vez de dejarsela a flexbox:
 *
 *  - Cada nodo es una fila con tres zonas de ancho fijo: izquierda (siglas, rombo, VIENE DE, retrabajo),
 *    figura (64 px) y derecha (descripcion + rama lateral). La columna vertebral (spine) cae en x = L.
 *  - L y R de cada secuencia no se adivinan: se MIDEN (entry.jsx renderiza una sonda oculta y toma el
 *    rectangulo de tinta de todo lo dibujado) y se vuelven a pasar como props. Asi una columna ocupa
 *    exactamente lo que dibuja, no el min-w-[900px] del motor original.
 *  - El flujo largo se corta en columnas ("como diario") que entran lado a lado en una hoja A3 apaisada;
 *    cada corte lleva un conector de pagina "SIGUE EN COLUMNA n" / "VIENE DE COLUMNA n".
 *
 * Tamaños de letra: nada por debajo de 10,7 px CSS. Con la hoja A3 a escala 1:1 (420 mm = 1587,4 px CSS)
 * eso son 8,0 pt impresos. Descripcion de operacion 11 px = 8,25 pt; numeros dentro de figuras 12,5 px = 9,4 pt.
 */

export const C = {
  FIG: 64,            // ancho de la caja central
  HALF: 32,
  GAP: 14,            // aire vertical entre nodos
  D: 200,             // ancho maximo de una descripcion (px)
  F_MIN: 10.7,        // letra minima del documento (px CSS)  = 8,0 pt a escala 1 (hoja A3 a 1587,4 px de ancho)
  F_DESC: 11,         // descripcion de operacion (px CSS)    = 8,25 pt
  F_ID: 12.5,         // numero dentro de la figura (px CSS)  = 9,4 pt
  PADB: 8,            // aire a cada lado de una columna de rama
  PADX: 10,           // aire a cada lado de una columna de pagina
  BLUE: '#60A5FA',
  BLUE_D: '#1E40AF',
  LINE: '#93C5FD',
};

const FIG_H = { operation: 34, 'op-ins': 42, transfer: 24, storage: 48, inspection: 34, condition: 38, terminal: 28, 'offpage-out': 36, 'offpage-in': 36 };
// medio ancho de la figura (para saber donde termina la flecha que llega)
const FIG_HW = { operation: 29, 'op-ins': 29, transfer: 12, storage: 22, inspection: 26, condition: 19, terminal: 40, 'offpage-out': 30, 'offpage-in': 30 };

const idStyleF = () => ({ fontSize: C.F_ID, fontWeight: 700, color: C.BLUE_D, lineHeight: 1 });

// ==========================================
// FIGURAS
// ==========================================
const ShapeOperation = ({ id }) => (
  <div style={{ width: 58, height: 34, borderRadius: '50%', border: `1.5px solid ${C.BLUE}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
    <span data-fc="id" style={idStyleF()}>{id}</span>
  </div>
);

const ShapeOpIns = ({ id }) => (
  <div style={{ width: 58, height: 42, border: `1.5px solid ${C.BLUE}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
    <div style={{ width: 44, height: 28, borderRadius: '50%', border: `1.5px solid ${C.BLUE}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span data-fc="id" style={idStyleF()}>{id}</span>
    </div>
  </div>
);

const ShapeTransfer = () => (
  <div style={{ width: 24, height: 24, borderRadius: '50%', border: `1.5px solid ${C.BLUE}`, background: '#fff', position: 'relative', zIndex: 2 }} />
);

// El numero va DENTRO del triangulo (geometria heredada del motor original: svg 40 en caja de 48).
const ShapeStorage = ({ id }) => (
  <div style={{ width: 48, height: 48, position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
      <path d="M4 8L44 8L24 40L4 8Z" fill="white" stroke={C.BLUE} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
    {id && (
      <span data-fc="id" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 13, fontSize: C.F_MIN, fontWeight: 700, color: C.BLUE_D, lineHeight: 1 }}>{id}</span>
    )}
  </div>
);

const ShapeInspection = ({ id }) => (
  <div style={{ width: 52, height: 34, border: `1.5px solid ${C.BLUE}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
    <span data-fc="id" style={idStyleF()}>{id}</span>
  </div>
);

const ShapeCondition = () => (
  <div style={{ width: 38, height: 38, position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 27, height: 27, border: `1.5px solid ${C.BLUE}`, background: '#fff', transform: 'rotate(45deg)' }} />
  </div>
);

const ShapeTerminalSide = ({ text }) => (
  <div data-fc="terminal" style={{ padding: '3px 8px', border: '1.5px solid #f87171', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontSize: C.F_MIN, fontWeight: 700, textTransform: 'uppercase', borderRadius: 2, maxWidth: 112, textAlign: 'center', lineHeight: 1.15, position: 'relative', zIndex: 3 }}>
    {text}
  </div>
);

const ShapeConnector = ({ id, isOut = true, size = 26 }) => (
  <div data-fc="conn" style={{ width: size, height: size, borderRadius: '50%', border: '2px solid', borderColor: isOut ? '#fb923c' : '#22c55e', background: isOut ? '#fff7ed' : '#f0fdf4', color: isOut ? '#ea580c' : '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: C.F_MIN, fontWeight: 900, lineHeight: 1, position: 'relative', zIndex: 3, flex: 'none' }}>
    {id}
  </div>
);

// Conector de pagina (corte de columna): pentagono apuntando hacia abajo. Naranja = sale, verde = entra
// (mismos colores que el conector A/B/C del motor original).
const ShapeOffPage = ({ text, isOut }) => {
  const col = isOut ? '#fb923c' : '#22c55e';
  const fill = isOut ? '#fff7ed' : '#f0fdf4';
  const tx = isOut ? '#c2410c' : '#15803d';
  return (
    <div style={{ width: 60, height: 36, position: 'relative', zIndex: 2 }}>
      <svg width="60" height="36" viewBox="0 0 60 36" fill="none" style={{ position: 'absolute', left: 0, top: 0 }}>
        <path d="M2 2H58V22L30 34L2 22Z" fill={fill} stroke={col} strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <span data-fc="offpage" style={{ position: 'absolute', left: 0, right: 0, top: 6, textAlign: 'center', fontSize: C.F_MIN, fontWeight: 900, color: tx, lineHeight: 1.15 }}>{text}</span>
    </div>
  );
};

const figure = (node) => {
  switch (node.type) {
    case 'operation': return <ShapeOperation id={node.stepId} />;
    case 'op-ins': return <ShapeOpIns id={node.stepId} />;
    case 'transfer': return <ShapeTransfer />;
    case 'storage': return <ShapeStorage id={node.stepId} />;
    case 'inspection': return <ShapeInspection id={node.stepId} />;
    case 'condition': return <ShapeCondition />;
    case 'terminal': return <ShapeTerminalSide text={node.text} />;
    case 'offpage-out': return <ShapeOffPage text={node.pageText} isOut />;
    case 'offpage-in': return <ShapeOffPage text={node.pageText} isOut={false} />;
    default: return null;
  }
};

// ==========================================
// PIEZAS SUELTAS
// ==========================================
const condLabelStyle = (align) => ({
  fontSize: C.F_MIN, fontWeight: 700, color: C.BLUE, fontStyle: 'italic', textTransform: 'uppercase', lineHeight: 1.15,
  maxWidth: 84, textAlign: align, background: '#fff', padding: '0 2px', position: 'relative', zIndex: 3,
});

const Arrow = ({ dir }) => (
  // punta de flecha (hacia la derecha o la izquierda) pegada al extremo de una linea
  <div style={{ position: 'absolute', top: '50%', [dir === 'left' ? 'left' : 'right']: 0, width: 6, height: 6, marginTop: -3.5, transform: `rotate(${dir === 'left' ? 225 : 45}deg)`, borderTop: `1.5px solid ${C.BLUE}`, borderRight: `1.5px solid ${C.BLUE}`, marginLeft: dir === 'left' ? 0 : undefined }} />
);

const HLine = ({ left, width, top, color = C.LINE, arrow }) => (
  <div style={{ position: 'absolute', left, top, width, height: 1.5, background: color, zIndex: 0, transform: 'translateY(-0.75px)' }}>
    {arrow === 'right' && <Arrow dir="right" />}
    {arrow === 'left' && <Arrow dir="left" />}
  </div>
);

// ==========================================
// FILA DE UN NODO
// ==========================================
function FlowNode({ node, isFirst, isLast, hasBranches, converges, L, R }) {
  const t = node.type;
  const figH = FIG_H[t] || 34;
  const lat = node.branchSide || null;
  const seqLat = lat && lat.sequence ? lat : null;
  const sg = node._sg || null;
  const dirLeft = lat && lat.direction === 'left';
  const hasDesc = !!node.description;
  const spineOn = converges || !isLast || hasBranches || node.mergeDown;
  const rowMin = seqLat && sg ? Math.max(figH, sg.h - C.GAP) : undefined;
  const centerY = seqLat ? figH / 2 : '50%';
  const rowW = L + R;

  // rama lateral simple (terminal / conector / operacion): linea + figura
  const latStart = (FIG_HW[t] || 29) - 2;
  const latEnd = hasDesc && !dirLeft ? C.HALF + 6 + 3 + C.D + 16 : (FIG_HW[t] || 29) + 52;

  return (
    <div className="fc-row" data-type={t} style={{ position: 'relative', width: rowW, display: 'flex', alignItems: seqLat ? 'flex-start' : 'center', marginBottom: C.GAP, minHeight: rowMin, flex: 'none' }}>
      {/* LA LINEA CONTINUA (spine) */}
      {spineOn && (
        <div style={{ position: 'absolute', left: L - 0.75, width: 1.5, top: isFirst ? centerY : 0, bottom: -C.GAP, background: C.LINE, zIndex: 0 }} />
      )}
      {node.labelDown && !hasBranches && spineOn && (
        <div data-fc="labelDown" style={{ position: 'absolute', left: L + 5, bottom: -C.GAP, height: C.GAP - 1, fontSize: C.F_MIN, fontWeight: 700, color: C.BLUE, background: '#fff', padding: '0 3px', lineHeight: `${C.GAP - 1}px`, zIndex: 3 }}>{node.labelDown}</div>
      )}

      {/* ZONA IZQUIERDA */}
      <div style={{ width: L - C.HALF, flex: 'none', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, paddingRight: 6, position: 'relative', zIndex: 3 }}>
        {node.critical && (
          <span data-fc="critical" style={{ fontSize: 11, fontWeight: 900, background: '#fff', padding: '0 3px', borderRadius: 3, border: '1px solid', color: node.criticalColor === 'black' ? '#000' : '#DC2626', borderColor: node.criticalColor === 'black' ? '#000' : '#DC2626', lineHeight: 1.3 }}>{node.criticalType}</span>
        )}
        {node.incomingConnector && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span data-fc="vienede" style={{ fontSize: C.F_MIN, fontWeight: 700, color: '#15803d', background: '#fff', padding: '0 2px', lineHeight: 1.1 }}>VIENE DE</span>
            <ShapeConnector id={node.incomingConnector} isOut={false} size={24} />
            <div style={{ width: 14, height: 1.5, background: '#22c55e', position: 'relative' }}>
              <div style={{ position: 'absolute', right: 0, top: '50%', width: 6, height: 6, marginTop: -3.5, transform: 'rotate(45deg)', borderTop: '1.5px solid #22c55e', borderRight: '1.5px solid #22c55e', translate: '1px 0' }} />
            </div>
          </div>
        )}
        {t === 'condition' && !dirLeft && node.labelCondition && (
          <span data-fc="cond" style={condLabelStyle('right')}>{node.labelCondition}</span>
        )}
      </div>

      {/* FIGURA */}
      <div style={{ width: C.FIG, height: figH, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
        {figure(node)}
      </div>

      {/* ZONA DERECHA */}
      <div style={{ width: R - C.HALF, flex: 'none', display: 'flex', alignItems: 'center', paddingLeft: 6, position: 'relative', zIndex: 3 }}>
        {hasDesc && (
          <div data-fc="desc" data-sid={node.stepId || ''} style={{ maxWidth: C.D, fontSize: t === 'offpage-out' || t === 'offpage-in' ? C.F_MIN + 0.4 : C.F_DESC, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.25, color: node.descColor || '#1f2937', background: '#fff', padding: '1px 3px' }}>
            {node.description}
          </div>
        )}
        {t === 'condition' && dirLeft && node.labelCondition && (
          <span data-fc="cond" style={condLabelStyle('left')}>{node.labelCondition}</span>
        )}
      </div>

      {/* RETRABAJO: flecha curva a la izquierda */}
      {node.rework && (
        <div style={{ position: 'absolute', left: L - C.HALF - 8 - 78, top: `calc(${typeof centerY === 'number' ? centerY + 'px' : centerY} - 18px)`, width: 78, height: 18, borderLeft: `1.5px solid ${C.LINE}`, borderBottom: `1.5px solid ${C.LINE}`, borderBottomLeftRadius: 10, zIndex: 1 }}>
          <div style={{ position: 'absolute', top: 0, left: -4.5, width: 8, height: 8, borderTop: `1.5px solid ${C.BLUE}`, borderRight: `1.5px solid ${C.BLUE}`, transform: 'rotate(-45deg)' }} />
          <div data-fc="rework" style={{ position: 'absolute', top: 19, left: 0, width: 78, textAlign: 'center', fontSize: C.F_MIN, fontWeight: 700, color: C.BLUE, lineHeight: 1.15, background: '#fff', zIndex: 3 }}>
            {node.rework.label || `RETRABAJO (A OP. ${node.rework.targetId})`}
          </div>
        </div>
      )}

      {/* RAMA LATERAL SIMPLE */}
      {lat && !seqLat && !dirLeft && (
        <>
          <HLine left={L + latStart} width={latEnd - latStart} top="50%" arrow="right" />
          <div style={{ position: 'absolute', left: L + latEnd + 6, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 6, zIndex: 3 }}>
            <LatShape lat={lat} />
            {lat.description && <LatCaption text={lat.description} align="left" />}
          </div>
          {lat.labelNode && <LatLabel text={lat.labelNode} style={{ left: L + latStart + 8, top: 'calc(50% - 15px)' }} />}
        </>
      )}
      {lat && !seqLat && dirLeft && (
        <>
          <HLine left={L - latEnd} width={latEnd - latStart} top="50%" arrow="left" />
          <div style={{ position: 'absolute', right: R + latEnd + 6, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 6, zIndex: 3, flexDirection: 'row-reverse' }}>
            <LatShape lat={lat} />
            {lat.description && <LatCaption text={lat.description} align="right" />}
          </div>
          {lat.labelNode && <LatLabel text={lat.labelNode} style={{ left: L - latStart - 8 - 20, top: 'calc(50% - 15px)' }} />}
        </>
      )}

      {/* RAMA LATERAL CON SECUENCIA PROPIA (reprocesos): columna en el costado derecho */}
      {seqLat && sg && (() => {
        const X0 = 30;                                  // aire entre la figura y el borde de la columna lateral
        const nestedLeft = L + C.HALF + X0;
        const spineX = nestedLeft + sg.L;
        const firstT = seqLat.sequence[0] ? seqLat.sequence[0].type : 'condition';
        const lineStart = (FIG_HW[t] || 19) - 2;
        const lineEnd = spineX - L - (FIG_HW[firstT] || 19) - 1;   // relativo a la espina principal
        return (
          <>
            <HLine left={L + lineStart} width={lineEnd - lineStart} top={figH / 2} arrow="right" />
            {seqLat.labelNode && <LatLabel text={seqLat.labelNode} style={{ left: L + lineStart + 6, top: figH / 2 - 15 }} />}
            <div style={{ position: 'absolute', left: nestedLeft, top: 0, width: sg.L + sg.R, zIndex: 2 }}>
              <Seq seq={seqLat.sequence} geom={sg} converges={false} first />
            </div>
          </>
        );
      })()}
    </div>
  );
}

const LatShape = ({ lat }) => (
  <>
    {lat.type === 'terminal' && <ShapeTerminalSide text={lat.text} />}
    {lat.type === 'operation' && <ShapeOperation id={lat.stepId} />}
    {lat.type === 'connector' && <ShapeConnector id={lat.text} isOut />}
    {lat.type === 'inspection' && <ShapeInspection id={lat.stepId} />}
  </>
);

const LatCaption = ({ text, align }) => (
  <div data-fc="latdesc" style={{ maxWidth: 100, textAlign: align, fontSize: C.F_MIN, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', lineHeight: 1.15, background: '#fff', padding: '0 2px' }}>{text}</div>
);

const LatLabel = ({ text, style }) => (
  <span data-fc="labelNode" style={{ position: 'absolute', fontSize: C.F_MIN, fontWeight: 700, color: C.BLUE, background: '#fff', padding: '0 3px', lineHeight: '13px', zIndex: 3, ...style }}>{text}</span>
);

// ==========================================
// DIVISION EN RAMAS (columnas lado a lado)
// ==========================================
export const branchSeq = (b) => (Array.isArray(b) ? b : b.sequence);

const branchWidth = (g) => g.L + g.R + 2 * C.PADB;

function BranchSplit({ node, labelDown, converges, L }) {
  const gs = node._bg;
  const widths = gs.map(branchWidth);
  const total = widths.reduce((a, b) => a + b, 0);
  const xs = []; // x de cada spine dentro del bloque
  let acc = 0;
  gs.forEach((g, i) => { xs.push(acc + C.PADB + g.L); acc += widths[i]; });
  const n = gs.length;
  return (
    <>
      <div className="fc-split" style={{ position: 'relative', display: 'flex', width: total, marginLeft: L - total / 2, flex: 'none' }}>
        {labelDown && (
          <div data-fc="labelDown" style={{ position: 'absolute', left: total / 2 + 5, top: -C.GAP, height: C.GAP - 1, fontSize: C.F_MIN, fontWeight: 700, color: C.BLUE, background: '#fff', padding: '0 3px', lineHeight: `${C.GAP - 1}px`, zIndex: 3 }}>{labelDown}</div>
        )}
        {n > 1 && <div style={{ position: 'absolute', top: 0, left: xs[0] - 0.75, width: xs[n - 1] - xs[0] + 1.5, height: 1.5, background: C.LINE }} />}
        {n > 1 && converges && <div style={{ position: 'absolute', bottom: 0, left: xs[0] - 0.75, width: xs[n - 1] - xs[0] + 1.5, height: 1.5, background: C.LINE }} />}
        {node.branches.map((b, i) => (
          <div key={i} style={{ width: widths[i], flex: 'none', display: 'flex', flexDirection: 'column', padding: `0 ${C.PADB}px`, position: 'relative' }}>
            <div style={{ width: 1.5, height: 14, background: C.LINE, marginLeft: gs[i].L - 0.75, flex: 'none' }} />
            <Seq seq={branchSeq(b)} geom={gs[i]} converges={converges} first={false} />
            {converges && <div style={{ width: 1.5, flex: 1, minHeight: 0, background: C.LINE, marginLeft: gs[i].L - 0.75 }} />}
          </div>
        ))}
      </div>
      {converges && <div style={{ width: 1.5, height: C.GAP, background: C.LINE, marginLeft: L - 0.75, flex: 'none' }} />}
    </>
  );
}

// ==========================================
// SECUENCIA
// ==========================================
export function Seq({ seq, geom, converges = false, first = true }) {
  return (
    <div className="fc-seq" style={{ display: 'flex', flexDirection: 'column', width: geom.L + geom.R, position: 'relative' }}>
      {seq.map((node, index) => {
        const hasBranches = !!(node.branches && node.branches.length > 0);
        const isLast = index === seq.length - 1;
        const nodeConverges = isLast ? converges : true;
        return (
          <React.Fragment key={index}>
            <FlowNode node={node} isFirst={first && index === 0} isLast={isLast} hasBranches={hasBranches} converges={nodeConverges} L={geom.L} R={geom.R} />
            {hasBranches && <BranchSplit node={node} labelDown={node.labelDown} converges={nodeConverges} L={geom.L} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ==========================================
// CABECERA Y LEYENDA
// ==========================================
const HCell = ({ label, value, style }) => (
  <div style={{ border: `1px solid ${C.BLUE}`, padding: '2px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 32, ...style }}>
    <span style={{ fontSize: C.F_MIN, color: C.BLUE_D, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.1, marginBottom: 1 }}>{label}</span>
    <span data-fc="hdr" style={{ fontSize: C.F_DESC, color: '#111827', fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.15 }}>{value}</span>
  </div>
);

export function Header({ header, logoUrl, page, pages, full }) {
  if (full) {
    return (
      <div className="fc-header" style={{ border: `1.5px solid ${C.BLUE}`, display: 'grid', gridTemplateColumns: '150px 1fr 640px', background: '#fff', flex: 'none' }}>
        <div style={{ borderRight: `1.5px solid ${C.BLUE}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: '#f9fafb', padding: 4 }}>
          {logoUrl ? <img src={logoUrl} alt="Logo" style={{ maxHeight: 40, objectFit: 'contain' }} /> : <span style={{ color: '#1E3A8A', fontWeight: 900, fontSize: 20 }}>BARACK</span>}
          <span data-fc="hoja" style={{ fontSize: C.F_DESC, fontWeight: 900, color: '#1E3A8A' }}>HOJA {page} DE {pages}</span>
        </div>
        <div style={{ borderRight: `1.5px solid ${C.BLUE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 14px', textAlign: 'center' }}>
          <h1 data-fc="title" style={{ fontSize: 18, fontWeight: 900, color: '#1E3A8A', textTransform: 'uppercase', fontStyle: 'italic', lineHeight: 1.15, margin: 0 }}>{header.title}</h1>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.95fr 1fr 1fr', gridTemplateRows: 'auto auto' }}>
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
  }
  return (
    <div className="fc-header" style={{ border: `1.5px solid ${C.BLUE}`, display: 'flex', alignItems: 'center', background: '#fff', gap: 14, padding: '3px 10px', flex: 'none', height: 36 }}>
      {logoUrl && <img src={logoUrl} alt="Logo" style={{ height: 24, objectFit: 'contain' }} />}
      <span data-fc="title" style={{ flex: 1, fontSize: 12.5, fontWeight: 900, color: '#1E3A8A', textTransform: 'uppercase', fontStyle: 'italic' }}>{header.title}</span>
      <span style={{ fontSize: C.F_MIN + 0.4, fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>{header.documentCode} · Rev. {header.revision}</span>
      <span style={{ fontSize: 11, fontWeight: 900, color: '#1E3A8A' }}>HOJA {page} DE {pages}</span>
    </div>
  );
}

const legendRow = { display: 'flex', alignItems: 'center', gap: 8, fontSize: C.F_MIN, fontWeight: 700, color: '#374151', minHeight: 20 };
const legendIcon = { width: 32, display: 'flex', justifyContent: 'center', flex: 'none' };
const lh4 = { fontSize: C.F_MIN, fontWeight: 900, color: '#1E3A8A', borderBottom: '1px solid #e5e7eb', paddingBottom: 2, marginBottom: 5, marginTop: 0 };

export function Legend({ header, products, revisions, width, split = [19, 27] }) {
  const conOps = products.some((p) => p.operations);
  const enc = header.productsColumns || {};
  const th = { paddingBottom: 2, fontWeight: 900, whiteSpace: 'nowrap', color: '#6b7280', textAlign: 'left', borderBottom: '1px solid #e5e7eb' };
  return (
    <div className="fc-legend" style={{ width, border: `1.5px solid ${C.BLUE}`, background: '#fff', display: 'flex', flexDirection: 'row', flex: 'none' }}>
      {/* SIMBOLOS */}
      <div style={{ width: `${split[0]}%`, flex: 'none', minWidth: 0, padding: '8px 12px', background: '#f9fafb', borderRight: `1.5px solid ${C.BLUE}` }}>
        <h4 style={lh4}>SÍMBOLOS Y REFERENCIAS</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 10, rowGap: 2 }}>
          <div style={legendRow}><div style={legendIcon}><div style={{ width: 26, height: 15, borderRadius: '50%', border: `1.5px solid ${C.BLUE}`, background: '#fff' }} /></div><span>OPERACIÓN</span></div>
          <div style={legendRow}><div style={legendIcon}><div style={{ width: 26, height: 19, border: `1.5px solid ${C.BLUE}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 18, height: 11, borderRadius: '50%', border: `1.5px solid ${C.BLUE}` }} /></div></div><span>OP. + INSPECCIÓN</span></div>
          <div style={legendRow}><div style={legendIcon}><div style={{ width: 15, height: 15, borderRadius: '50%', border: `1.5px solid ${C.BLUE}`, background: '#fff' }} /></div><span>TRASLADO</span></div>
          <div style={legendRow}><div style={legendIcon}><svg width="18" height="18" viewBox="0 0 48 48" fill="none"><path d="M4 8L44 8L24 40L4 8Z" fill="white" stroke={C.BLUE} strokeWidth="3" strokeLinejoin="round" /></svg></div><span>ALMACENADO</span></div>
          <div style={legendRow}><div style={legendIcon}><div style={{ width: 24, height: 15, border: `1.5px solid ${C.BLUE}`, background: '#fff' }} /></div><span>INSPECCIÓN</span></div>
          <div style={legendRow}><div style={legendIcon}><div style={{ width: 14, height: 14, border: `1.5px solid ${C.BLUE}`, background: '#fff', transform: 'rotate(45deg)' }} /></div><span>CONDICIÓN</span></div>
          <div style={legendRow}><div style={legendIcon}><div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #fb923c', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c', fontSize: C.F_MIN, fontWeight: 900 }}>X</div></div><span>CONECTOR</span></div>
          <div style={legendRow}><div style={legendIcon}><svg width="30" height="18" viewBox="0 0 60 36" fill="none"><path d="M2 2H58V22L30 34L2 22Z" fill="#fff7ed" stroke="#fb923c" strokeWidth="3" strokeLinejoin="round" /></svg></div><span>SIGUE / VIENE DE COLUMNA</span></div>
        </div>
        {Array.isArray(header.specialChars) && header.specialChars.length > 0 && (
          <div style={{ marginTop: 5, paddingTop: 5, borderTop: '1px solid #e5e7eb' }}>
            <h4 style={{ ...lh4, borderBottom: 'none', marginBottom: 3 }}>CARACTERÍSTICAS ESPECIALES</h4>
            {header.specialChars.map((sc, i) => (
              <div key={i} style={{ ...legendRow, alignItems: 'flex-start', minHeight: 0, marginBottom: 2 }}>
                <div style={{ ...legendIcon, color: '#DC2626', fontWeight: 900 }} data-fc="leg">{sc.mark}</div>
                <span style={{ lineHeight: 1.2 }} data-fc="leg">{sc.meaning}</span>
              </div>
            ))}
          </div>
        )}
        {header.footerNote && (
          <div data-fc="leg" style={{ marginTop: 5, paddingTop: 5, borderTop: '1px solid #e5e7eb', fontSize: C.F_MIN, fontWeight: 600, color: '#4b5563', lineHeight: 1.2 }}>{header.footerNote}</div>
        )}
      </div>
      {/* CODIGOS */}
      <div style={{ width: `${split[1]}%`, flex: 'none', minWidth: 0, padding: '8px 12px', borderRight: `1.5px solid ${C.BLUE}` }}>
        <h4 style={lh4}>CÓDIGOS PROD. TERMINADO</h4>
        <table style={{ width: '100%', fontSize: C.F_MIN, fontWeight: 700, color: '#374151', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>{enc.code || 'Part Number VW'}</th>
              <th style={{ ...th, paddingLeft: 6 }}>{enc.level || 'Nivel'}</th>
              <th style={{ ...th, paddingLeft: 6 }}>{enc.description || 'Descripción / Componente'}</th>
              {conOps && <th style={{ ...th, paddingLeft: 6 }}>{enc.operations || 'Operaciones'}</th>}
              <th style={{ ...th, textAlign: 'right', paddingLeft: 6 }}>{enc.version || 'Color/Versión'}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td data-fc="leg" style={{ padding: '2px 0', color: C.BLUE, whiteSpace: 'nowrap' }}>{p.code}</td>
                <td data-fc="leg" style={{ padding: '2px 0 2px 6px', lineHeight: 1.15 }}>{p.level}</td>
                <td data-fc="leg" style={{ padding: '2px 0 2px 6px', lineHeight: 1.15 }}>{p.description}</td>
                {conOps && <td data-fc="leg" style={{ padding: '2px 0 2px 6px', lineHeight: 1.15 }}>{p.operations}</td>}
                <td data-fc="leg" style={{ padding: '2px 0 2px 6px', textAlign: 'right', lineHeight: 1.15 }}>{p.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* REVISIONES */}
      <div style={{ flex: 1, minWidth: 0, padding: '8px 12px' }}>
        <h4 style={lh4}>HISTORIAL DE REVISIONES</h4>
        <table style={{ width: '100%', tableLayout: 'fixed', fontSize: C.F_MIN, fontWeight: 700, color: '#374151', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 32 }}>Rev.</th>
              <th style={{ ...th, width: 80 }}>Fecha</th>
              <th style={{ ...th, width: '15%' }}>Ítem cambiado</th>
              <th style={th}>Detalles</th>
              <th style={{ ...th, width: 82 }}>Fecha PSW</th>
              <th style={{ ...th, width: 66, textAlign: 'right' }}>Modificó</th>
            </tr>
          </thead>
          <tbody>
            {revisions.map((r, i) => {
              const vigente = i === revisions.length - 1;
              return (
                <tr key={i} style={{ verticalAlign: 'top', borderBottom: '1px solid #f3f4f6' }}>
                  <td data-fc="leg" style={{ padding: '2px 0', color: vigente ? '#DC2626' : undefined, fontWeight: vigente ? 900 : 700 }}>{r.rev}</td>
                  <td data-fc="leg" style={{ padding: '2px 0', whiteSpace: 'nowrap' }}>{r.date}</td>
                  <td data-fc="leg" style={{ padding: '2px 10px 2px 0', wordBreak: 'break-word', lineHeight: 1.15 }}>{r.item}</td>
                  <td data-fc="leg" style={{ padding: '2px 10px 2px 0', fontWeight: 600, lineHeight: 1.18, wordBreak: 'break-word' }}>{r.details}</td>
                  <td data-fc="leg" style={{ padding: '2px 0', whiteSpace: 'nowrap' }}>{r.pswDate}</td>
                  <td data-fc="leg" style={{ padding: '2px 0', textAlign: 'right' }}>{r.modifiedBy}</td>
                </tr>
              );
            })}
            {Array.from({ length: Math.max(0, 3 - revisions.length) }).map((_, i) => (
              <tr key={`libre-${i}`}><td style={{ padding: '2px 0' }}>&nbsp;</td><td /><td /><td /><td /><td /></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==========================================
// COLUMNA DE PAGINA Y PAGINA
// ==========================================
export function PageColumn({ col, geom, index }) {
  return (
    <div className="fc-col" data-col={col.number} style={{ width: geom.L + geom.R + 2 * C.PADX, flex: 'none', borderLeft: index > 0 ? '1px dashed #cbd5e1' : 'none', paddingLeft: C.PADX, paddingRight: C.PADX, display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 16, flex: 'none', fontSize: C.F_MIN, fontWeight: 900, color: '#94a3b8', letterSpacing: 0.5 }}>COLUMNA {col.number}</div>
      <Seq seq={col.nodes} geom={geom} converges={false} first />
    </div>
  );
}

export function Page({ page, header, products, revisions, logoUrl, pageNo, pageCount, showLegend, legendWidth, legendSplit }) {
  return (
    <div className="fc-page" data-page={pageNo}>
      <Header header={header} logoUrl={logoUrl} page={pageNo} pages={pageCount} full={pageNo === 1} />
      <div className="fc-cols" style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', justifyContent: 'space-evenly', marginTop: 8 }}>
        {page.columns.map((c, i) => <PageColumn key={i} col={c} geom={c.geom} index={i} />)}
      </div>
      {showLegend && <div style={{ marginTop: 8, flex: 'none' }}><Legend header={header} products={products} revisions={revisions} width={legendWidth} split={legendSplit} /></div>}
    </div>
  );
}

export function Document({ plan, header, products, revisions, logoUrl }) {
  return (
    <div className="fc-root" id="pdf-content">
      {plan.pages.map((p, i) => (
        <Page key={i} page={p} header={header} products={products} revisions={revisions} logoUrl={logoUrl}
          pageNo={i + 1} pageCount={plan.pages.length} showLegend={i === plan.pages.length - 1} legendWidth={plan.legendWidth} legendSplit={plan.legendSplit} />
      ))}
    </div>
  );
}
