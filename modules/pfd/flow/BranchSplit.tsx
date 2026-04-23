/**
 * BranchSplit — Multi-column parallel branch layout for the PFD flow.
 * Renders a horizontal fork line, N parallel columns, and a horizontal join line.
 * Uses Tailwind CSS classes. For standalone HTML export, the CSS is embedded via flowStyles.ts.
 */

import React from 'react';
import type { FlowNodeData } from '../flowTypes';
import { FlowSequence } from './FlowSequence';

export interface BranchSplitProps {
  branches: FlowNodeData[][];
}

export const BranchSplit: React.FC<BranchSplitProps> = ({ branches }) => {
  if (branches.length === 0) return null;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Parallel columns with horizontal connecting lines */}
      <div className="w-full relative z-0 flex mt-[-2px] items-stretch justify-center">
        {branches.map((branch, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center relative min-w-[400px] px-4">
            {/* Horizontal connecting lines at top */}
            {idx === 0 && branches.length > 1 && (
              <div className="absolute top-0 left-1/2 right-0 h-[2px] bg-[#93C5FD] z-0" />
            )}
            {idx === branches.length - 1 && branches.length > 1 && (
              <div className="absolute top-0 left-0 right-1/2 h-[2px] bg-[#93C5FD] z-0" />
            )}
            {idx > 0 && idx < branches.length - 1 && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#93C5FD] z-0" />
            )}

            {/* Vertical connector down into lane */}
            <div className="w-[2px] h-12 bg-[#93C5FD] relative z-0 -mb-6 shrink-0" />

            {/* Inner sequence */}
            <FlowSequence sequence={branch} />

            {/* Vertical connector up from lane */}
            <div className="w-[2px] h-12 bg-[#93C5FD] relative z-0 -mt-6 shrink-0" />

            {/* Horizontal connecting lines at bottom */}
            {idx === 0 && branches.length > 1 && (
              <div className="absolute bottom-0 left-1/2 right-0 h-[2px] bg-[#93C5FD] z-0" />
            )}
            {idx === branches.length - 1 && branches.length > 1 && (
              <div className="absolute bottom-0 left-0 right-1/2 h-[2px] bg-[#93C5FD] z-0" />
            )}
            {idx > 0 && idx < branches.length - 1 && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#93C5FD] z-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
