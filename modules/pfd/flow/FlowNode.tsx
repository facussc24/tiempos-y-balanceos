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

/** Render the lateral branch (e.g., NO path -> SCRAP) */
function renderBranchSide(branch: FlowNodeData['branchSide']) {
  if (!branch) return null;

  return (
    <div className="flex items-center absolute left-full top-1/2 -translate-y-1/2">
      {/* Horizontal connector line */}
      <div className="relative flex items-center">
        {/* "NO" label above the line */}
        {branch.labelNode && (
          <span className="absolute -top-4 left-1 text-[9px] font-bold text-[#1E40AF]">
            {branch.labelNode}
          </span>
        )}
        <div className="w-[60px] h-[1.5px] bg-[#60A5FA]" />
      </div>

      {/* Branch target shape */}
      <div className="flex flex-col items-center gap-0.5">
        {branch.type === 'terminal' ? (
          <ShapeTerminalSide text={branch.text} />
        ) : branch.type === 'operation' ? (
          <ShapeOperation id={branch.stepId} />
        ) : (
          <ShapeTerminalSide text={branch.text || branch.description} />
        )}
        {branch.description && branch.type !== 'terminal' && (
          <span className="text-[8px] text-gray-500 max-w-[100px] text-center">
            {branch.description}
          </span>
        )}
      </div>
    </div>
  );
}

export const FlowNode: React.FC<FlowNodeProps> = ({ node, isLast, hasBranches }) => {
  const isCondition = node.type === 'condition';

  return (
    <div className="relative flex flex-col items-center w-full mb-10 z-10">
      {/* Spine line below the node (to next node) */}
      {!isLast && !hasBranches && (
        <div className="absolute top-1/2 -bottom-10 left-1/2 w-[1.5px] bg-[#93C5FD] -translate-x-1/2 z-0" />
      )}

      {/* Main row: CC/SC label | Shape | Description
          minHeight explicito = 48px (altura del shape mas alto: ShapeOpIns h-12).
          Sin minHeight, html2canvas calcula alto del row segun contenido de cada
          columna y items-center puede rendererear desfasado. */}
      <div
        className="flex items-center w-full max-w-4xl relative z-10"
        style={{ minHeight: '48px' }}
      >
        {/* Left column: CC/SC label.
            v5: SVG con centrado matematico exacto en lugar de html/css (html2canvas
            no respetaba verticalAlign:middle ni transforms ni paddings asimetricos). */}
        <div className="flex-1 flex justify-end items-center pr-6 space-x-2 relative z-10">
          {node.critical && node.criticalType && (
            <svg width="22" height="15" viewBox="0 0 22 15" style={{ overflow: 'visible' }}>
              <rect x="0.5" y="0.5" width="21" height="14" fill="#FEF2F2" stroke="#FECACA" strokeWidth="1" rx="2" />
              <text x="11" y="7.5" textAnchor="middle" dominantBaseline="central" fill="#DC2626" fontSize="9" fontWeight="bold" fontFamily="Inter, Arial, sans-serif">{node.criticalType}</text>
            </svg>
          )}
        </div>

        {/* Center column: Shape + condition labels */}
        <div className="flex flex-col items-center justify-center relative w-20 shrink-0">
          {/* Condition label to the LEFT of the diamond */}
          {isCondition && node.labelCondition && (
            <span className="absolute right-full mr-2 text-[9px] italic text-[#1E40AF] whitespace-nowrap max-w-[180px]">
              {node.labelCondition}
            </span>
          )}

          {renderShape(node)}

          {/* "SI" label below on the downward path for conditions */}
          {isCondition && node.labelDown && (
            <span className="absolute top-full mt-0.5 text-[9px] font-bold text-[#1E40AF]">
              {node.labelDown}
            </span>
          )}

          {/* Lateral branch if present */}
          {node.branchSide && renderBranchSide(node.branchSide)}
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
