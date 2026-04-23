/**
 * FlowSequence — Recursive iterator that walks an array of FlowNodeData.
 * Renders each node and, if it has branches, inserts a BranchSplit.
 * Uses Tailwind CSS classes. For standalone HTML export, the CSS is embedded via flowStyles.ts.
 */

import React from 'react';
import type { FlowNodeData } from '../flowTypes';
import { FlowNode } from './FlowNode';
import { BranchSplit } from './BranchSplit';

export interface FlowSequenceProps {
  sequence: FlowNodeData[];
}

export const FlowSequence: React.FC<FlowSequenceProps> = ({ sequence }) => {
  return (
    <div className="flex flex-col items-center w-full">
      {sequence.map((node, idx) => {
        const isLast = idx === sequence.length - 1;
        const hasBranches = !!(node.branches && node.branches.length > 0);

        // Pure branch-split node (virtual, no content — just parallel lanes)
        const isPureSplit = hasBranches && !node.description && !node.stepId;

        return (
          <React.Fragment key={node.stepId || `node-${idx}`}>
            {/* Only render FlowNode if this is NOT a pure branch-split wrapper */}
            {!isPureSplit && (
              <FlowNode node={node} isLast={isLast && !hasBranches} hasBranches={hasBranches} />
            )}

            {/* Branch split if node has parallel branches */}
            {hasBranches && node.branches && (
              <>
                <BranchSplit branches={node.branches} />
                {/* Connector from join to next node */}
                {!isLast && (
                  <div className="w-[2px] h-4 bg-[#60A5FA]" />
                )}
              </>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
