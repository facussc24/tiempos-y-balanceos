/**
 * ZipShapes — Shapes visuales clonados del motor zip de Fak (Documents/industrial-flowchart-generator).
 * Tailwind puro + bordes celestes #60A5FA. NO usar SVG salvo Storage (el triángulo invertido).
 * Estos shapes son los que el editor zip-style renderea.
 *
 * El user (Fak) diseñó este look — no cambiar paleta ni tamaños sin pedirle.
 */
import React from 'react';

interface IdProp { id?: string; }
interface TextProp { text?: string; }
interface ConnectorProp { id?: string; isOut?: boolean; }

export const ShapeOperation: React.FC<IdProp> = ({ id }) => (
    <div className="w-16 h-10 rounded-[50%] border-[1.5px] border-[#60A5FA] bg-white flex items-center justify-center text-[#1E40AF] text-[11px] font-bold z-10 relative shadow-sm">
        {id}
    </div>
);

export const ShapeOpIns: React.FC<IdProp> = ({ id }) => (
    <div className="w-16 h-12 border-[1.5px] border-[#60A5FA] bg-white flex items-center justify-center z-10 relative shadow-sm">
        <div className="w-12 h-8 rounded-[50%] border-[1.5px] border-[#60A5FA] flex items-center justify-center text-[#1E40AF] text-[11px] font-bold">
            {id}
        </div>
    </div>
);

export const ShapeTransfer: React.FC = () => (
    <div className="w-7 h-7 rounded-full border-[1.5px] border-[#60A5FA] bg-white z-10 relative shadow-sm" />
);

export const ShapeStorage: React.FC = () => (
    <div className="w-12 h-12 z-10 relative flex items-center justify-center bg-white shadow-sm">
        <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
            <path d="M4 8L44 8L24 40L4 8Z" fill="white" stroke="#60A5FA" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
    </div>
);

export const ShapeInspection: React.FC<IdProp> = ({ id }) => (
    <div className="w-14 h-10 border-[1.5px] border-[#60A5FA] bg-white flex items-center justify-center text-[#1E40AF] text-[11px] font-bold z-10 relative shadow-sm">
        {id}
    </div>
);

export const ShapeCondition: React.FC = () => (
    <div className="w-10 h-10 z-10 relative flex items-center justify-center bg-white shadow-sm">
        <div className="w-8 h-8 border-[1.5px] border-[#60A5FA] bg-white transform rotate-45" />
    </div>
);

export const ShapeTerminalSide: React.FC<TextProp> = ({ text }) => (
    <div className="px-3 py-1.5 border-[1.5px] border-[#f87171] bg-white flex items-center justify-center text-[#dc2626] text-[8.5px] font-bold z-10 relative uppercase shadow-sm rounded-sm max-w-[120px] text-center leading-tight">
        {text}
    </div>
);

export const ShapeConnector: React.FC<ConnectorProp> = ({ id, isOut = true }) => (
    <div className={`w-7 h-7 rounded-full border-[2px] flex items-center justify-center text-[10px] font-black z-10 relative shadow-sm ${isOut ? 'border-[#fb923c] bg-[#fff7ed] text-[#ea580c]' : 'border-[#22c55e] bg-[#f0fdf4] text-[#15803d]'}`}>
        {id}
    </div>
);
