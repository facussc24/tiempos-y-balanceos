/**
 * ZipFlowRenderer — Interactive renderer cloned from Fak's standalone zip
 * (Documents/industrial-flowchart-generator). Pure CSS / Tailwind. Vertical
 * spine + lateral branches + parallel splits + rework loops + connectors.
 *
 * Interactivity layered on top of the original engine:
 *   - Click on any shape → onSelect(srcId)
 *   - Double-click on description → inline edit via onUpdateStep
 *   - Selected node gets a cyan ring
 *
 * The padding helpers are 1:1 from the zip so wide rework sequences and
 * parallel branches don't get clipped (the user explicitly complained that
 * the current Barack renderer cuts the lines — this one doesn't).
 */
import React, { useState } from 'react';
import type { ZipNodeRendered } from './pfdStepsToZipFlow';
import {
    ShapeOperation,
    ShapeOpIns,
    ShapeTransfer,
    ShapeStorage,
    ShapeInspection,
    ShapeCondition,
    ShapeTerminalSide,
    ShapeConnector,
} from './ZipShapes';

interface RenderCtx {
    selectedSrcId: string | null;
    onSelect: (srcId: string) => void;
    onUpdateDescription?: (srcId: string, value: string) => void;
    readOnly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Padding calculations (verbatim port from the zip)
// ─────────────────────────────────────────────────────────────────────────────

export function getRightPadding(sequence: ZipNodeRendered[] | undefined): number {
    let maxPadding = 48;
    const visit = (seq?: ZipNodeRendered[]) => {
        if (!seq) return;
        for (const node of seq) {
            if (node.branchSide) {
                if (node.branchSide.sequence) {
                    maxPadding = Math.max(maxPadding, 600);
                } else {
                    maxPadding = Math.max(maxPadding, 300);
                }
            }
            if (node.branches) {
                for (const branchSeq of node.branches) visit(branchSeq);
            }
        }
    };
    visit(sequence);
    return maxPadding;
}

export function getBottomPadding(sequence: ZipNodeRendered[] | undefined): number {
    const depthOf = (seq?: ZipNodeRendered[]): number => {
        if (!seq || seq.length === 0) return 0;
        let max = seq.length;
        for (let i = 0; i < seq.length; i++) {
            const node = seq[i];
            if (node.branchSide?.sequence) {
                max = Math.max(max, i + depthOf(node.branchSide.sequence));
            }
            if (node.branches) {
                let bd = 0;
                for (const b of node.branches) bd = Math.max(bd, depthOf(b));
                max = Math.max(max, i + 1 + bd);
            }
        }
        return max;
    };
    const depth = depthOf(sequence);
    const baseLen = sequence?.length || 0;
    const extra = depth - baseLen;
    return Math.max(0, extra * 120 + 40);
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline-edit helper for the description text (double-click to edit)
// ─────────────────────────────────────────────────────────────────────────────

const InlineEditableText: React.FC<{
    value: string;
    srcId: string;
    onCommit?: (srcId: string, next: string) => void;
    readOnly?: boolean;
    className?: string;
    'data-testid'?: string;
}> = ({ value, srcId, onCommit, readOnly, className, ...rest }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const canEdit = !readOnly && !!onCommit;
    const begin = (e: React.MouseEvent) => {
        if (!canEdit) return;
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
    };
    const commit = () => {
        const trimmed = draft.trim();
        if (trimmed === '' && value.trim() !== '') { setEditing(false); return; }
        if (draft !== value) onCommit?.(srcId, draft);
        setEditing(false);
    };
    if (editing) {
        return (
            <input
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onBlur={commit}
                onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter') { e.preventDefault(); commit(); }
                    else if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
                }}
                data-testid={`zip-edit-${srcId}`}
                className="border border-cyan-400 rounded px-1 bg-white text-[10px] text-[#1f2937] outline-none focus:ring-2 focus:ring-cyan-300 max-w-[280px]"
            />
        );
    }
    return (
        <span
            onDoubleClick={begin}
            title={canEdit ? 'Doble-clic para editar' : undefined}
            className={className}
            data-testid={rest['data-testid']}
        >
            {value}
        </span>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Selectable wrapper around any shape
// ─────────────────────────────────────────────────────────────────────────────

const SelectableShape: React.FC<{
    srcId: string;
    ctx: RenderCtx;
    children: React.ReactNode;
}> = ({ srcId, ctx, children }) => {
    const isSelected = ctx.selectedSrcId === srcId;
    return (
        <div
            data-testid={`zip-shape-${srcId}`}
            data-selected={isSelected ? 'true' : undefined}
            onClick={(e) => {
                if (ctx.readOnly) return;
                e.stopPropagation();
                ctx.onSelect(srcId);
            }}
            className={`relative flex items-center justify-center cursor-pointer transition-shadow ${isSelected ? 'ring-2 ring-cyan-500 rounded' : ''}`}
        >
            {children}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// FlowNode — direct port from the zip with interactive overlays
// ─────────────────────────────────────────────────────────────────────────────

interface FlowNodeProps {
    node: ZipNodeRendered;
    isLast: boolean;
    hasBranches: boolean;
    converges: boolean;
    ctx: RenderCtx;
}

const FlowNode: React.FC<FlowNodeProps> = ({ node, isLast, hasBranches, converges, ctx }) => {
    return (
        <div className="relative flex flex-col items-center w-full mb-10 z-10">

            {/* SPINE — vertical continuous line that goes BEHIND the node */}
            {(converges || !isLast || hasBranches) && (
                <div className="absolute top-1/2 -bottom-10 left-1/2 w-[1.5px] bg-[#93C5FD] -translate-x-1/2 z-0">
                    {node.labelDown && !hasBranches && (
                        <div className="absolute top-[60%] -translate-y-1/2 left-2 text-[9px] font-bold text-[#60A5FA] bg-white px-1 z-10 rounded">
                            {node.labelDown}
                        </div>
                    )}
                </div>
            )}

            {/* Main row: critical/condition (left) | shape (center) | description (right) */}
            <div className="flex items-center w-full max-w-4xl relative z-10">

                {/* REWORK loop arrow (anchored mathematically to the left of the shape) */}
                {node.rework && (
                    <div className="absolute right-1/2 mr-10 top-1/2 -translate-y-1/2 w-[90px] h-[100px] -mt-[50px] -z-10 border-l-[1.5px] border-b-[1.5px] border-[#93C5FD] rounded-bl-xl">
                        <div className="absolute top-0 left-[-4.5px] w-2 h-2 border-t-[1.5px] border-r-[1.5px] border-[#60A5FA] transform -rotate-45" />
                        <div className="absolute bottom-[-10px] right-2 text-[8.5px] font-bold text-[#60A5FA] whitespace-nowrap bg-white/90 px-1 border border-[#93C5FD] rounded-md shadow-sm z-10">
                            {node.rework.label || `RETRABAJO (A OP. ${node.rework.targetId})`}
                        </div>
                    </div>
                )}

                {/* Incoming connector ("VIENE DE A") */}
                {node.incomingConnector && (
                    <div className="absolute right-1/2 mr-10 top-1/2 -translate-y-1/2 flex items-center z-10">
                        <span className="mr-1.5 text-[8px] font-bold text-[#15803d] bg-white/90 px-1 rounded shadow-sm border border-[#f3f4f6]">VIENE DE</span>
                        <ShapeConnector id={node.incomingConnector} isOut={false} />
                    </div>
                )}

                {/* LEFT: critical badge / condition label */}
                <div className="flex-1 flex justify-end items-center pr-6 space-x-2 relative z-10">
                    {node.critical && (
                        <span className="text-[10px] font-black text-black bg-white/80 px-1 rounded">{node.criticalType}</span>
                    )}
                    {node.type === 'condition' && node.labelCondition && (
                        <InlineEditableText
                            value={node.labelCondition}
                            srcId={node.srcId}
                            onCommit={ctx.onUpdateDescription}
                            readOnly={ctx.readOnly}
                            data-testid={`zip-cond-${node.srcId}`}
                            className="text-[9px] font-bold text-[#60A5FA] italic uppercase text-right leading-tight max-w-[100px] bg-white/80 px-1 rounded"
                        />
                    )}
                </div>

                {/* CENTER: the shape itself (fixed-width slot) */}
                <div className="flex flex-col items-center justify-center relative w-20 shrink-0">
                    <SelectableShape srcId={node.srcId} ctx={ctx}>
                        {node.type === 'operation' && <ShapeOperation id={node.stepId} />}
                        {node.type === 'op-ins' && <ShapeOpIns id={node.stepId} />}
                        {node.type === 'transfer' && <ShapeTransfer />}
                        {node.type === 'storage' && <ShapeStorage />}
                        {node.type === 'inspection' && <ShapeInspection id={node.stepId} />}
                        {node.type === 'condition' && <ShapeCondition />}
                        {node.type === 'terminal' && <ShapeTerminalSide text={node.text} />}
                    </SelectableShape>
                </div>

                {/* RIGHT: description (editable inline) */}
                <div className="flex-1 text-left pl-6 relative z-10">
                    {node.type !== 'condition' && node.description && (
                        <div className="text-[10px] font-bold text-[#1f2937] uppercase max-w-[280px] leading-snug bg-white/80 p-1 rounded inline-block">
                            <InlineEditableText
                                value={node.description}
                                srcId={node.srcId}
                                onCommit={ctx.onUpdateDescription}
                                readOnly={ctx.readOnly}
                                data-testid={`zip-desc-${node.srcId}`}
                            />
                        </div>
                    )}
                </div>

                {/* BRANCH SIDE — rejection / connector / nested rework sequence */}
                {node.branchSide && (
                    <div
                        className={`absolute top-1/2 h-[1.5px] bg-[#93C5FD] -translate-y-1/2 -z-10 flex items-center ${node.branchSide.direction === 'left' ? 'right-[50%] mr-10' : 'left-[50%] ml-10'}`}
                        style={{ width: node.branchSide.sequence ? '500px' : '320px' }}
                    >
                        {node.branchSide.direction === 'left' ? (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-b-[1.5px] border-l-[1.5px] border-[#60A5FA] transform rotate-45 translate-x-[-1px]" />
                        ) : (
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 border-t-[1.5px] border-r-[1.5px] border-[#60A5FA] transform rotate-45 translate-x-[1px]" />
                        )}

                        <div className={`absolute flex flex-col ${node.branchSide.direction === 'left' ? 'right-full' : 'left-full'} ${node.branchSide.sequence ? (node.branchSide.direction === 'left' ? 'top-0 items-center translate-x-1/2' : 'top-0 items-center -translate-x-1/2') : `top-1/2 -translate-y-1/2 ${node.branchSide.direction === 'left' ? 'items-end mr-2 text-right' : 'items-start ml-2 text-left'}`}`}>
                            {node.branchSide.sequence ? (
                                <div className="relative -mt-5 w-[600px]">
                                    <FlowSequence sequence={node.branchSide.sequence} converges={false} ctx={ctx} />
                                </div>
                            ) : (
                                <>
                                    {node.branchSide.type === 'terminal' && <ShapeTerminalSide text={node.branchSide.text} />}
                                    {node.branchSide.type === 'operation' && <ShapeOperation id={node.branchSide.stepId} />}
                                    {node.branchSide.type === 'connector' && <ShapeConnector id={node.branchSide.text} isOut={true} />}
                                    {node.branchSide.type === 'inspection' && <ShapeInspection id={node.branchSide.stepId} />}
                                    {node.branchSide.description && (
                                        <div className={`absolute top-full mt-2 w-32 ${node.branchSide.direction === 'left' ? 'text-right right-0' : 'text-left left-0'} text-[8px] font-bold text-[#4b5563] uppercase leading-snug bg-white/90 p-1 rounded z-10`}>
                                            {node.branchSide.description}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {node.branchSide.labelNode && (
                            <span className={`absolute ${node.branchSide.direction === 'left' ? 'right-6' : 'left-6'} -top-3.5 text-[9px] font-bold text-[#60A5FA] bg-white px-1 rounded`}>
                                {node.branchSide.labelNode}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// BranchSplit — parallel branches with horizontal continuous line top/bottom
// ─────────────────────────────────────────────────────────────────────────────

interface BranchSplitProps {
    branches: ZipNodeRendered[][];
    labelDown?: string;
    converges: boolean;
    ctx: RenderCtx;
}

const BranchSplit: React.FC<BranchSplitProps> = ({ branches, labelDown, converges, ctx }) => {
    return (
        <div className="w-full flex flex-col items-center" data-testid="zip-parallel-group">
            <div className="w-full relative z-0 flex mt-[-2px] items-stretch justify-center">
                {labelDown && (
                    <div className="absolute left-1/2 -top-6 -translate-x-1/2 text-[9px] font-bold text-[#60A5FA] bg-white px-1 z-10 rounded">
                        {labelDown}
                    </div>
                )}
                {branches.map((branch, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center relative min-w-[800px] px-4" data-testid={`zip-branch-${idx}`}>
                        {/* Horizontal top line */}
                        {branches.length > 1 && idx === 0 && <div className="absolute top-0 right-0 w-1/2 h-[1.5px] bg-[#93C5FD]" />}
                        {branches.length > 1 && idx === branches.length - 1 && <div className="absolute top-0 left-0 w-1/2 h-[1.5px] bg-[#93C5FD]" />}
                        {branches.length > 1 && idx > 0 && idx < branches.length - 1 && <div className="absolute top-0 left-0 w-full h-[1.5px] bg-[#93C5FD]" />}

                        <div className="w-[1.5px] h-12 bg-[#93C5FD] relative z-0 -mb-6 shrink-0" />

                        <div className="w-full relative z-10 flex flex-col flex-1">
                            <FlowSequence sequence={branch} converges={converges} ctx={ctx} />
                        </div>

                        {converges && <div className="w-[1.5px] flex-1 bg-[#93C5FD] relative z-0" />}

                        {converges && branches.length > 1 && idx === 0 && <div className="absolute bottom-0 right-0 w-1/2 h-[1.5px] bg-[#93C5FD]" />}
                        {converges && branches.length > 1 && idx === branches.length - 1 && <div className="absolute bottom-0 left-0 w-1/2 h-[1.5px] bg-[#93C5FD]" />}
                        {converges && branches.length > 1 && idx > 0 && idx < branches.length - 1 && <div className="absolute bottom-0 left-0 w-full h-[1.5px] bg-[#93C5FD]" />}
                    </div>
                ))}
            </div>
            {converges && <div className="w-[1.5px] h-12 bg-[#93C5FD] relative z-0" />}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// FlowSequence — recursive iterator
// ─────────────────────────────────────────────────────────────────────────────

interface FlowSequenceProps {
    sequence: ZipNodeRendered[];
    converges?: boolean;
    ctx: RenderCtx;
}

export const FlowSequence: React.FC<FlowSequenceProps> = ({ sequence, converges = false, ctx }) => {
    return (
        <div className="flex flex-col items-center w-full h-full">
            {sequence.map((node, index) => {
                const hasBranches = !!(node.branches && node.branches.length > 0);
                const isLast = index === sequence.length - 1;
                const nodeConverges = isLast ? converges : true;
                return (
                    <React.Fragment key={`${node.srcId}-${index}`}>
                        <FlowNode node={node} isLast={isLast} hasBranches={hasBranches} converges={nodeConverges} ctx={ctx} />
                        {hasBranches && (
                            <BranchSplit branches={node.branches!} labelDown={node.labelDown} converges={nodeConverges} ctx={ctx} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};
