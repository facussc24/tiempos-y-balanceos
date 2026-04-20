/**
 * ASME/AIAG symbol components for the PFD HTML flow renderer.
 * Uses Tailwind CSS classes. For standalone HTML export, the CSS is embedded via flowStyles.ts.
 */

import React from 'react';

/** Operation — Ellipse with step ID inside.
 *  v5 (2026-04-20): ABANDONO html/css para shapes con texto centrado. Uso SVG
 *  directo con textAnchor="middle" + dominantBaseline="central" — centrado
 *  matematicamente exacto en coordenadas absolutas. html2canvas renderiza SVG
 *  native y respeta las coords literales, NO los calcula de metrics de fuente. */
export const ShapeOperation = ({ id }: { id?: string }) => (
  <div className="z-10 relative shrink-0" style={{ width: 64, height: 40 }}>
    <svg width="64" height="40" viewBox="0 0 64 40" style={{ display: 'block', overflow: 'visible' }}>
      <ellipse cx="32" cy="20" rx="31" ry="19" fill="white" stroke="#60A5FA" strokeWidth="1.5" />
      <text x="32" y="20" textAnchor="middle" dominantBaseline="central" fill="#1E40AF" fontSize="11" fontWeight="bold" fontFamily="Inter, Arial, sans-serif">{id}</text>
    </svg>
  </div>
);

/** Op+Inspection — Rectangle with ellipse inside (combined operation + inspection) */
export const ShapeOpIns = ({ id }: { id?: string }) => (
  <div className="z-10 relative shrink-0" style={{ width: 64, height: 48 }}>
    <svg width="64" height="48" viewBox="0 0 64 48" style={{ display: 'block', overflow: 'visible' }}>
      <rect x="1" y="1" width="62" height="46" fill="white" stroke="#60A5FA" strokeWidth="1.5" />
      <ellipse cx="32" cy="24" rx="23" ry="15" fill="white" stroke="#60A5FA" strokeWidth="1.5" />
      <text x="32" y="24" textAnchor="middle" dominantBaseline="central" fill="#1E40AF" fontSize="11" fontWeight="bold" fontFamily="Inter, Arial, sans-serif">{id}</text>
    </svg>
  </div>
);

/** Transfer — Small circle (no text, connector symbol) */
export const ShapeTransfer = () => (
  <div className="w-7 h-7 rounded-full border-[1.5px] border-[#60A5FA] bg-white z-10 relative shadow-sm shrink-0" />
);

/** Storage — Inverted triangle pointing down (SVG) */
export const ShapeStorage = () => (
  <div className="w-12 h-12 z-10 relative flex items-center justify-center bg-white shadow-sm shrink-0">
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
      <path d="M4 8L44 8L24 40L4 8Z" fill="white" stroke="#60A5FA" strokeWidth="1.8" strokeLinejoin="round"/>
    </svg>
  </div>
);

/** Inspection — Rectangle with step ID (SVG puro para centrado exacto) */
export const ShapeInspection = ({ id }: { id?: string }) => (
  <div className="z-10 relative shrink-0" style={{ width: 56, height: 40 }}>
    <svg width="56" height="40" viewBox="0 0 56 40" style={{ display: 'block', overflow: 'visible' }}>
      <rect x="1" y="1" width="54" height="38" fill="white" stroke="#60A5FA" strokeWidth="1.5" />
      <text x="28" y="20" textAnchor="middle" dominantBaseline="central" fill="#1E40AF" fontSize="11" fontWeight="bold" fontFamily="Inter, Arial, sans-serif">{id}</text>
    </svg>
  </div>
);

/** Condition — Diamond (rotated square) */
export const ShapeCondition = () => (
  <div className="w-10 h-10 z-10 relative flex items-center justify-center bg-white shadow-sm shrink-0">
    <div className="w-8 h-8 border-[1.5px] border-[#60A5FA] bg-white transform rotate-45" />
  </div>
);

/** Terminal side — Small rounded rectangle with text (SCRAP, RECLAMO PROVEEDOR, etc.)
 *  v5: SVG puro con textAnchor="middle" + dominantBaseline="central".
 *  Ancho dinamico segun longitud del texto (RECLAMO PROVEEDOR necesita mas espacio). */
export const ShapeTerminalSide = ({ text }: { text?: string }) => {
  const label = (text || '').toUpperCase();
  // Ancho estimado: 6px por char + 16px de padding horizontal. Max 120 px.
  const estimatedWidth = Math.min(120, Math.max(50, label.length * 6 + 16));
  const isMultiWord = label.split(' ').length > 1 && estimatedWidth >= 80;
  const height = isMultiWord ? 30 : 20;
  const w = estimatedWidth;
  const h = height;

  if (isMultiWord) {
    // Multi-linea: dividir en 2 lineas
    const words = label.split(' ');
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(' ');
    const line2 = words.slice(mid).join(' ');
    return (
      <div className="z-10 relative shrink-0" style={{ width: w, height: h }}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
          <rect x="1" y="1" width={w - 2} height={h - 2} fill="white" stroke="#F87171" strokeWidth="1.5" rx="2" />
          <text x={w / 2} y={h / 2 - 4.5} textAnchor="middle" dominantBaseline="central" fill="#DC2626" fontSize="8.5" fontWeight="bold" fontFamily="Inter, Arial, sans-serif">{line1}</text>
          <text x={w / 2} y={h / 2 + 4.5} textAnchor="middle" dominantBaseline="central" fill="#DC2626" fontSize="8.5" fontWeight="bold" fontFamily="Inter, Arial, sans-serif">{line2}</text>
        </svg>
      </div>
    );
  }

  return (
    <div className="z-10 relative shrink-0" style={{ width: w, height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
        <rect x="1" y="1" width={w - 2} height={h - 2} fill="white" stroke="#F87171" strokeWidth="1.5" rx="2" />
        <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="central" fill="#DC2626" fontSize="8.5" fontWeight="bold" fontFamily="Inter, Arial, sans-serif">{label}</text>
      </svg>
    </div>
  );
};
