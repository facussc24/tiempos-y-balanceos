/**
 * FlowHeader — Grid header matching the industrial AIAG PFD format.
 * 3-column grid: Logo | Title | Metadata rows (compact).
 * Uses Tailwind CSS classes. For standalone HTML export, the CSS is embedded via flowStyles.ts.
 */

import React from 'react';
import type { PfdHeader } from '../pfdTypes';

export interface FlowHeaderProps {
  header: PfdHeader;
  logoBase64: string;
}

// Inline styles para line-height / padding-bottom: flowStyles.ts no contiene
// clases Tailwind arbitrary como leading-[13px], por eso inline styles (siempre
// funcionan en renderToStaticMarkup → html2pdf). Mantenemos las clases que SI
// existen en flowStyles.ts (text-[6px], text-[9px], truncate, font-bold, etc.).
const HeaderCell = ({ label, value }: { label: string; value: string }) => (
  <div
    className="border border-[#60A5FA] px-1.5 py-[3px] flex flex-col justify-center"
    style={{ minHeight: '22px' }}
  >
    <span
      className="text-[6px] text-[#1E40AF] font-bold uppercase"
      style={{ lineHeight: '8px' }}
    >
      {label}
    </span>
    <span
      className="text-[9px] text-gray-900 font-bold uppercase truncate"
      style={{ lineHeight: '13px', paddingBottom: '1px', marginTop: '1px' }}
    >
      {value}
    </span>
  </div>
);

export const FlowHeader: React.FC<FlowHeaderProps> = ({ header, logoBase64 }) => {
  return (
    <div className="w-full max-w-[1400px] mx-auto bg-white border-[1.5px] border-[#60A5FA] mb-4 shadow-sm">
      <div className="grid grid-cols-[1fr_2fr_1fr]">
        {/* Left: Logo area */}
        <div className="border-r-[1.5px] border-[#60A5FA] p-2 flex flex-col items-center justify-center">
          {logoBase64 ? (
            <img
              src={logoBase64}
              alt="Logo"
              className="max-w-[120px] max-h-[60px] object-contain"
            />
          ) : (
            <>
              <div className="text-[#1E3A8A] font-serif font-black text-xl tracking-tighter">BARACK</div>
              <div className="text-gray-400 text-[9px] tracking-widest font-light">MERCOSUL</div>
            </>
          )}
        </div>

        {/* Center: Title */}
        <div className="border-r-[1.5px] border-[#60A5FA] flex items-center justify-center p-2 text-center">
          <div className="flex flex-col items-center gap-0.5">
            <h1 className="text-lg font-black text-[#1E3A8A] uppercase italic leading-tight">
              DIAGRAMA DE FLUJO DE PROCESO
            </h1>
            {header.partName && (
              <span className="text-xs font-bold text-[#1E40AF] italic">
                {header.partName}
              </span>
            )}
            {header.partNumber && (
              <span className="text-[8px] text-gray-500">
                P/N: {header.partNumber}
              </span>
            )}
          </div>
        </div>

        {/* Right: Metadata grid — compact stacked rows */}
        <div className="flex flex-col">
          <HeaderCell label="Código del Documento" value={header.documentNumber} />
          <div className="grid grid-cols-2">
            <HeaderCell label="Revisión" value={header.revisionLevel} />
            <HeaderCell label="Fecha Emisión" value={header.preparedDate} />
          </div>
          <div className="grid grid-cols-2">
            <HeaderCell label="Elaborado por" value={header.preparedBy} />
            {/* TODO: PfdHeader no tiene campo `reviewedBy`. Se necesita agregar a PfdHeader en pfdTypes.ts.
                Actualmente usa `approvedBy` para ambos campos, lo cual es INCORRECTO —
                Revisado por y Aprobado por son roles distintos en APQP y NUNCA deben ser la misma persona. */}
            <HeaderCell label="Revisado por" value={(header as any).reviewedBy ?? header.approvedBy} />
          </div>
          <HeaderCell label="Aprobado por" value={header.approvedBy} />
          <HeaderCell label="Organización" value={header.companyName} />
          <HeaderCell label="Responsable de Área" value={header.keyContact} />
          <div className="grid grid-cols-2">
            <HeaderCell label="Proyecto" value={header.modelYear} />
            <HeaderCell label="Cliente" value={header.customerName} />
          </div>
        </div>
      </div>
    </div>
  );
};
