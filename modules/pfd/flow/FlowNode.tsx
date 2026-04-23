/**
 * FlowNode — Single node in the vertical PFD flow.
 * Renders the shape, description, CC/SC label, and optional lateral branch.
 * Uses Tailwind CSS classes. For standalone HTML export, the CSS is embedded via flowStyles.ts.
 */

import React from 'react';
import type { FlowNodeData } from '../flowTypes';
import {
  ShapeOperation,
  ShapeOpIns,
  ShapeTransfer,
  ShapeStorage,
  ShapeInspection,
  ShapeCondition,
  ShapeTerminalSide,
} from './Shapes';
import { FlowSequence } from './FlowSequence';

export interface FlowNodeProps {
  node: FlowNodeData;
  isLast: boolean;
  hasBranches: boolean;
}

/** Resolve the correct shape component for a node type */
function renderShape(node: FlowNodeData): React.ReactElement {
  switch (node.type) {
    case 'operation':
      return <ShapeOperation id={node.stepId} />;
    case 'op-ins':
      return <ShapeOpIns id={node.stepId} />;
    case 'transfer':
      return <ShapeTransfer />;
    case 'storage':
      return <ShapeStorage />;
    case 'inspection':
      return <ShapeInspection id={node.stepId} />;
    case 'condition':
      return <ShapeCondition />;
    case 'terminal':
      return <ShapeTerminalSide text={node.text} />;
    default:
      return <ShapeOperation id={node.stepId} />;
  }
}

/** Render the lateral branch (rama NO de una decision).
 *
 * Patron canonico portado del generator de Google (2026-04-23):
 * https://.../industrial-flowchart-generator src/App.tsx líneas 137-170.
 *
 * 2 modos:
 *   (a) Simple: branchSide.type terminal/operation/connector/inspection ->
 *       dibuja 1 shape al final del brazo horizontal (320px).
 *   (b) Sequence (rework_or_scrap): branchSide.sequence tiene array de FlowNodeData
 *       -> brazo horizontal extendido (500px) + sub-FlowSequence anidado
 *       recursivamente, posicionado top-0 items-center -translate-x-1/2
 *       con -mt-5 compensando el inicio del primer nodo.
 *
 * La linea horizontal nace desde el centro del rombo (left-[50%] ml-10) y
 * se extiende hacia afuera. Flechita triangular al final. Label "NO" sobre
 * la linea con bg-white para no superponerse con ella.
 */
function renderBranchSide(branch: FlowNodeData['branchSide']) {
  if (!branch) return null;

  const hasSequence = Array.isArray(branch.sequence) && branch.sequence.length > 0;
  // Fak 2026-04-23: brazo y sub-flow reducidos para evitar overflow en A3 landscape.
  const armWidth = hasSequence ? 280 : 200;

  // hasSequence requiere mas separacion del main flow para que el arco rework
  // del sub-flow anidado no pise las ops del main (Fak 2026-04-23).
  const marginLeftClass = hasSequence ? 'ml-20' : 'ml-10';
  return (
    <div
      className={`absolute left-[50%] ${marginLeftClass} top-1/2 h-[2px] bg-[#93C5FD] -translate-y-1/2 -z-10 flex items-center`}
      style={{ width: armWidth }}
    >
      {/* Flechita triangular al final del brazo (solo en caso simple, no sequence) */}
      {!hasSequence && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t-[1.5px] border-r-[1.5px] border-[#60A5FA] transform rotate-45 translate-x-[1px]" />
      )}

      {/* Destino de la rama lateral */}
      <div
        className={`absolute left-full flex flex-col ${
          hasSequence
            ? 'top-0 items-center -translate-x-1/2'
            : 'top-1/2 -translate-y-1/2 items-start ml-2'
        }`}
      >
        {hasSequence ? (
          <div className="relative -mt-5 w-[420px]">
            <FlowSequence sequence={branch.sequence!} />
          </div>
        ) : (
          <>
            {branch.type === 'terminal' && <ShapeTerminalSide text={branch.text} />}
            {branch.type === 'operation' && <ShapeOperation id={branch.stepId} />}
            {branch.type === 'inspection' && <ShapeInspection id={branch.stepId} />}
            {branch.type !== 'terminal' && branch.type !== 'operation' && branch.type !== 'inspection' && (
              <ShapeTerminalSide text={branch.text || branch.description} />
            )}
            {branch.description && (
              <div className="absolute top-full mt-2 w-32 text-left text-[8px] font-bold text-[#4b5563] uppercase leading-snug bg-white/90 p-1 rounded z-10">
                {branch.description}
              </div>
            )}
          </>
        )}
      </div>

      {/* Etiqueta "NO" sobre la linea */}
      {branch.labelNode && (
        <span className="absolute left-6 -top-3.5 text-[9px] font-bold text-[#60A5FA] bg-white px-1 rounded">
          {branch.labelNode}
        </span>
      )}
    </div>
  );
}

/** Render rework arc: arco CSS (sin SVG) que va del lado izquierdo del nodo
 * hacia arriba, simulando flecha curva de retorno a OP anterior.
 * Copiado del generator Google (App.tsx:84-91).
 */
function renderReworkArc(rework: { targetId: string }) {
  return (
    <div className="absolute right-1/2 mr-8 top-1/2 -translate-y-1/2 w-[70px] h-[140px] -mt-[70px] -z-10 border-l-[2px] border-b-[2px] border-[#93C5FD] rounded-bl-xl">
      <div className="absolute top-0 left-[-5px] w-2 h-2 border-t-[2px] border-r-[2px] border-[#60A5FA] transform -rotate-45" />
      <div className="absolute -top-3 left-1 text-[8.5px] font-bold text-[#60A5FA] whitespace-nowrap bg-white/90 px-1 border border-[#93C5FD] rounded-md shadow-sm z-10">
        RETRABAJO (A OP. {rework.targetId})
      </div>
    </div>
  );
}

export const FlowNode: React.FC<FlowNodeProps> = ({ node, isLast, hasBranches }) => {
  const isCondition = node.type === 'condition';

  return (
    <div className="relative flex flex-col items-center w-full mb-10 z-10">
      {/* Spine line below the node (to next node).
          Patron Google: "absolute top-1/2 -bottom-10 left-1/2" — arranca desde
          el centro vertical del nodo y baja 40px (mb-10 del contenedor).
          z-0 asegura que quede detras del shape (z-10). */}
      {!isLast && !hasBranches && (
        <div className="absolute top-1/2 -bottom-10 left-1/2 w-[1.5px] bg-[#93C5FD] -translate-x-1/2 z-0">
          {/* labelDown "SI" sobre la spine con bg-white para no superponerse con la linea */}
          {isCondition && node.labelDown && (
            <div className="absolute top-[60%] -translate-y-1/2 left-2 text-[9px] font-bold text-[#60A5FA] bg-white px-1 z-10 rounded">
              {node.labelDown}
            </div>
          )}
        </div>
      )}

      {/* Main row */}
      <div
        className="flex items-center w-full max-w-4xl relative z-10"
        style={{ minHeight: '48px' }}
      >
        {/* Left column: CC/SC label + condition label */}
        <div className="flex-1 flex justify-end items-center pr-6 space-x-2 relative z-10">
          {node.critical && node.criticalType && (
            <svg width="22" height="15" viewBox="0 0 22 15" style={{ overflow: 'visible' }}>
              <rect x="0.5" y="0.5" width="21" height="14" fill="#FEF2F2" stroke="#FECACA" strokeWidth="1" rx="2" />
              <text x="11" y="7.5" textAnchor="middle" dominantBaseline="central" fill="#DC2626" fontSize="9" fontWeight="bold" fontFamily="Inter, Arial, sans-serif">{node.criticalType}</text>
            </svg>
          )}
          {isCondition && node.labelCondition && (
            <span className="text-[9px] font-bold text-[#60A5FA] italic uppercase text-right leading-tight max-w-[140px] bg-white/80 px-1 rounded">
              {node.labelCondition}
            </span>
          )}
        </div>

        {/* Center column: Shape + branchSide + rework arc */}
        <div className="flex flex-col items-center justify-center relative w-20 shrink-0">
          {renderShape(node)}

          {/* Lateral branch (rama NO para condition, o branchSide en cualquier step) */}
          {node.branchSide && renderBranchSide(node.branchSide)}

          {/* Rework arc (flecha curva de retorno a OP anterior) */}
          {node.rework && renderReworkArc(node.rework)}
        </div>

        {/* Right column: Description + equipment */}
        <div className="flex-1 pl-6 flex flex-col justify-center min-w-0 relative z-10">
          {node.description && !isCondition && (
            <span className="text-[11px] font-bold text-gray-900 uppercase leading-snug">
              {node.description}
            </span>
          )}
          {(node.equipment || node.department) && (
            <span className="text-[9px] text-gray-500 leading-snug mt-px">
              {[node.equipment, node.department].filter(Boolean).join(' — ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
