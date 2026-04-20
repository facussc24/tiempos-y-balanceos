/**
 * ASME/AIAG symbol components for the PFD HTML flow renderer.
 * Uses Tailwind CSS classes. For standalone HTML export, the CSS is embedded via flowStyles.ts.
 */

import React from 'react';

/** Operation — Ellipse with step ID inside
 *  Diagnostico 2026-04-20 confirmado por Fak: textos quedaban pegados al
 *  borde INFERIOR del shape. html2canvas renderiza el baseline del texto
 *  cerca del bottom del line-box (no simetrico como en browser).
 *  Fix: table + table-cell con vertical-align:middle — approach CSS1 que
 *  html2canvas respeta literalmente sin metrics magicos. */
export const ShapeOperation = ({ id }: { id?: string }) => (
  <div
    className="w-16 h-10 rounded-[50%] border-[1.5px] border-[#60A5FA] bg-white text-[#1E40AF] text-[11px] font-bold z-10 shadow-sm shrink-0"
    style={{ display: 'table' }}
  >
    <span
      style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'center', lineHeight: 1, paddingBottom: '2px' }}
    >
      {id}
    </span>
  </div>
);

/** Op+Inspection — Rectangle with ellipse inside (combined operation + inspection) */
export const ShapeOpIns = ({ id }: { id?: string }) => (
  <div className="w-16 h-12 border-[1.5px] border-[#60A5FA] bg-white flex items-center justify-center z-10 relative shadow-sm shrink-0">
    <div
      className="w-12 h-8 rounded-[50%] border-[1.5px] border-[#60A5FA] text-[#1E40AF] text-[11px] font-bold"
      style={{ display: 'table' }}
    >
      <span
        style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'center', lineHeight: 1, paddingBottom: '2px' }}
      >
        {id}
      </span>
    </div>
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

/** Inspection — Rectangle with step ID */
export const ShapeInspection = ({ id }: { id?: string }) => (
  <div
    className="w-14 h-10 border-[1.5px] border-[#60A5FA] bg-white text-[#1E40AF] text-[11px] font-bold z-10 shadow-sm shrink-0"
    style={{ display: 'table' }}
  >
    <span
      style={{ display: 'table-cell', verticalAlign: 'middle', textAlign: 'center', lineHeight: 1, paddingBottom: '2px' }}
    >
      {id}
    </span>
  </div>
);

/** Condition — Diamond (rotated square) */
export const ShapeCondition = () => (
  <div className="w-10 h-10 z-10 relative flex items-center justify-center bg-white shadow-sm shrink-0">
    <div className="w-8 h-8 border-[1.5px] border-[#60A5FA] bg-white transform rotate-45" />
  </div>
);

/** Terminal side — Small rounded rectangle with text (SCRAP, reclamo, etc.)
 *  Paddings asimetricos: top mayor que bottom para empujar el texto HACIA ARRIBA
 *  (sin esto queda pegado al borde inferior en html2canvas). */
export const ShapeTerminalSide = ({ text }: { text?: string }) => (
  <div
    className="px-3 border-[1.5px] border-red-400 bg-white flex items-center justify-center text-red-600 text-[8.5px] font-bold z-10 relative uppercase shadow-sm rounded-sm max-w-[120px] text-center shrink-0"
    style={{ lineHeight: 1.2, paddingTop: '6px', paddingBottom: '2px', minHeight: '20px' }}
  >
    {text}
  </div>
);
