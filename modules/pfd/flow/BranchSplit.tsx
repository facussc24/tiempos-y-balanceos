/**
 * BranchSplit — Multi-column parallel branch layout for the PFD flow.
 * Renders a horizontal fork line, N parallel columns, and a horizontal join line.
 * Uses Tailwind CSS classes. For standalone HTML export, the CSS is embedded via flowStyles.ts.
 *
 * Fak 2026-04-23: lineas horizontales top/bottom se cortan cuando split tiene
 * 3+ ramas. Causa: cada rama dibujaba su propio trozo de linea con left/right
 * 1/2 calculados respecto a su columna (flex-1, ancho variable). Si las anchos
 * no matchean exactos, quedaban gaps.
 *
 * Fix: una sola linea horizontal ABSOLUTE a nivel del padre global, que va
 * desde el centro de la primera columna al centro de la ultima. Dibujo con
 * left/right exactos en porcentaje (50/N, 100-50/N).
 */

import React from 'react';
import type { FlowNodeData } from '../flowTypes';
import { FlowSequence } from './FlowSequence';

export interface BranchSplitProps {
  branches: FlowNodeData[][];
}

export const BranchSplit: React.FC<BranchSplitProps> = ({ branches }) => {
  if (branches.length === 0) return null;
  const N = branches.length;
  // 50/N % desde la izquierda = centro de la primera columna
  // 50/N % desde la derecha = centro de la ultima columna
  const sideOffsetPct = N > 0 ? 50 / N : 0;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full relative z-0 flex mt-[-2px] items-stretch justify-center">
        {/* Linea horizontal TOP (fork): una sola linea continua desde el centro
            de la primera columna al centro de la ultima. */}
        {N > 1 && (
          <div
            className="absolute top-0 h-[2px] bg-[#93C5FD] z-0"
            style={{ left: `${sideOffsetPct}%`, right: `${sideOffsetPct}%` }}
          />
        )}
        {/* Linea horizontal BOTTOM (join): idem. */}
        {N > 1 && (
          <div
            className="absolute bottom-0 h-[2px] bg-[#93C5FD] z-0"
            style={{ left: `${sideOffsetPct}%`, right: `${sideOffsetPct}%` }}
          />
        )}

        {branches.map((branch, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center relative min-w-[400px] px-4">
            {/* Vertical connector down into lane */}
            <div className="w-[2px] h-12 bg-[#93C5FD] relative z-0 -mb-6 shrink-0" />

            {/* Inner sequence */}
            <FlowSequence sequence={branch} />

            {/* Vertical connector up from lane */}
            <div className="w-[2px] h-12 bg-[#93C5FD] relative z-0 -mt-6 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
};
