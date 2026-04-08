/**
 * FlowCcScNote — Mandatory note box when any step has CC/SC classification.
 * Uses Tailwind CSS classes. For standalone HTML export, the CSS is embedded via flowStyles.ts.
 */

import React from 'react';

export const FlowCcScNote: React.FC = () => (
  <div className="border-[1.5px] border-[#60A5FA] rounded-sm bg-white py-2 px-4 mx-5 my-3 text-center">
    <span className="text-[10px] text-[#1E40AF] leading-relaxed">
      {'Para todas las operaciones marcadas con '}
      <strong>{'\u25BD'}</strong>
      {' (Caracter\u00edstica Cr\u00edtica) o '}
      <strong>SC</strong>
      {' (Caracter\u00edstica Significativa), es obligatorio consultar el Plan de Control '}
      {'N\u00b0 correspondiente y el PFMEA asociado a cada operaci\u00f3n.'}
    </span>
  </div>
);
