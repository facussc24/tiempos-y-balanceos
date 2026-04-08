/**
 * FlowReferencePanel — Reference box (part list + legend) and standalone Legend box for the PFD flow.
 * Uses Tailwind CSS classes. For standalone HTML export, the CSS is embedded via flowStyles.ts.
 */

import React from 'react';
import {
  ShapeOperation,
  ShapeTransfer,
  ShapeStorage,
  ShapeInspection,
  ShapeCondition,
} from './Shapes';

/* ─── Shared legend items ─── */

interface LegendItem {
  label: string;
  shape: React.ReactElement;
}

const LEGEND_ITEMS: LegendItem[] = [
  { label: 'OPERACION', shape: <ShapeOperation /> },
  { label: 'TRASLADO', shape: <ShapeTransfer /> },
  { label: 'ALMACENADO', shape: <ShapeStorage /> },
  { label: 'INSPECCION', shape: <ShapeInspection /> },
  { label: 'CONDICION', shape: <ShapeCondition /> },
];

/* ─── Mini-legend icons (uniform 24×16 viewBox for perfect alignment) ─── */

const MINI_LEGEND: { label: string; icon: React.ReactElement }[] = [
  { label: 'OPERACION', icon: <svg width="24" height="16" viewBox="0 0 24 16"><ellipse cx="12" cy="8" rx="11" ry="7" fill="none" stroke="#60A5FA" strokeWidth="1.2"/></svg> },
  { label: 'TRASLADO', icon: <svg width="24" height="16" viewBox="0 0 24 16"><circle cx="12" cy="8" r="5" fill="none" stroke="#60A5FA" strokeWidth="1.2"/></svg> },
  { label: 'ALMACENADO', icon: <svg width="24" height="16" viewBox="0 0 24 16"><path d="M4 3L20 3L12 14Z" fill="none" stroke="#60A5FA" strokeWidth="1.2" strokeLinejoin="round"/></svg> },
  { label: 'INSPECCION', icon: <svg width="24" height="16" viewBox="0 0 24 16"><rect x="3" y="2" width="18" height="12" fill="none" stroke="#60A5FA" strokeWidth="1.2"/></svg> },
  { label: 'CONDICION', icon: <svg width="24" height="16" viewBox="0 0 24 16"><path d="M12 1L22 8L12 15L2 8Z" fill="none" stroke="#60A5FA" strokeWidth="1.2" strokeLinejoin="round"/></svg> },
];

/* ─── Reference box: part list + integrated legend ─── */

export interface FlowReferenceBoxProps {
  lines: string[];
}

export const FlowReferenceBox: React.FC<FlowReferenceBoxProps> = ({ lines }) => {
  if (lines.length === 0) return null;

  return (
    <div className="border-[1.5px] border-[#60A5FA] rounded-sm bg-white p-2.5 max-w-[280px] min-w-[180px]">
      {/* Part list */}
      <div className="text-[9px] font-bold text-[#1E40AF] text-center uppercase border-b border-[#60A5FA] pb-1 mb-1">
        LISTADO DE REFERENCIAS A PIEZAS / PRODUCTOS
      </div>
      <div className="flex flex-col gap-0.5">
        {lines.map((line, idx) => (
          <span key={idx} className="text-[9px] text-gray-900 leading-relaxed">
            {line}
          </span>
        ))}
      </div>

      {/* Separator */}
      <div className="border-b border-[#60A5FA] my-1.5" />

      {/* Integrated legend — mini SVG icons, all same size, perfectly aligned */}
      <div className="text-[9px] font-bold text-[#1E40AF] text-center uppercase pb-1">
        REFERENCIAS
      </div>
      <div className="flex justify-center">
        <div className="inline-grid gap-y-0.5 gap-x-1.5" style={{ gridTemplateColumns: '30px auto' }}>
          {MINI_LEGEND.map((item, idx) => (
            <React.Fragment key={idx}>
              <div className="flex justify-center items-center">{item.icon}</div>
              <span className="text-[8px] text-gray-900 font-semibold flex items-center">{item.label}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Standalone Legend box (kept for backward compatibility) ─── */

export const FlowLegend: React.FC = () => {
  return (
    <div className="border-[1.5px] border-[#60A5FA] rounded-sm bg-white p-2.5 inline-flex flex-col gap-1.5 min-w-[140px]">
      <div className="text-[10px] font-bold text-[#1E40AF] text-center uppercase border-b border-[#60A5FA] pb-1">
        REFERENCIAS
      </div>
      {LEGEND_ITEMS.map((item, idx) => (
        <div key={idx} className="flex flex-row items-center gap-2">
          <div className="w-[50px] flex justify-center shrink-0">
            {item.shape}
          </div>
          <span className="text-[9px] text-gray-900 font-semibold">{item.label}</span>
        </div>
      ))}
    </div>
  );
};
