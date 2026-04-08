/**
 * PfdFlowChart — Root component composing the full PFD flow diagram.
 * Designed for both live React rendering and static HTML export
 * via ReactDOMServer.renderToStaticMarkup().
 * Uses Tailwind CSS classes. For standalone HTML export, the CSS is embedded via flowStyles.ts.
 */

import React from 'react';
import type { FlowDocument } from '../flowTypes';
import { FlowHeader } from './FlowHeader';
import { FlowSequence } from './FlowSequence';
import { FlowReferenceBox } from './FlowReferencePanel';
import { FlowCcScNote } from './FlowCcScNote';

export interface PfdFlowChartProps {
  data: FlowDocument;
}

export const PfdFlowChart: React.FC<PfdFlowChartProps> = ({ data }) => {
  return (
    <div className="min-h-screen bg-[#F3F4F6] p-4 md:p-8 font-sans">
      {/* Header grid */}
      <FlowHeader header={data.header} logoBase64={data.logoBase64} />

      <div className="max-w-[1400px] mx-auto">
        {/* Main flow area — everything inside one white container */}
        <main className="w-full bg-white border-[1.5px] border-gray-200 shadow-sm pt-8 pb-8 rounded-lg overflow-x-auto relative">
          {/* Reference panel positioned top-right */}
          {data.referenceLines.length > 0 && (
            <div className="absolute top-4 right-4 z-20">
              <FlowReferenceBox lines={data.referenceLines} />
            </div>
          )}

          {/* Flow sequence */}
          <div className="min-w-fit px-12 mx-auto">
            <FlowSequence sequence={data.flowData} />
          </div>

          {/* CC/SC mandatory note — inside the white container */}
          {data.hasAnyCcSc && !data.skipNotes && (
            <div className="mt-8 px-8">
              <FlowCcScNote />
            </div>
          )}

        </main>
      </div>
    </div>
  );
};
