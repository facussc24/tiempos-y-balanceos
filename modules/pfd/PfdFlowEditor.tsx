/**
 * PFD Flow Editor — Interactive visual process flow diagram editor
 *
 * Renders an interactive visual flowchart where users can click, insert, move,
 * duplicate, and manage steps visually. Replaces the read-only PfdFlowMap as the
 * primary visual editing interface for PFD steps.
 *
 * Features:
 * - Click to select steps (cyan highlight ring)
 * - Insert buttons between steps
 * - Right-click context menu (insert, duplicate, move, delete)
 * - Parallel branch layout (side-by-side lanes with fork/join indicators)
 * - Collapsible panel with toggle header
 * - CC/SC and EXT badges on step cards
 */

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
    Map,
    ArrowDown,
    GitBranch,
    GitMerge,
    Plus,
    Minus,
    ChevronUp,
    ChevronDown,
    Trash2,
    Copy,
    ArrowUp as ArrowUpIcon,
    ArrowDown as ArrowDownIcon,
    RotateCcw,
    Search,
    X,
} from 'lucide-react';
import type { PfdStep, PfdStepType, RejectDisposition } from './pfdTypes';
import { getBranchColor, PFD_STEP_TYPES } from './pfdTypes';
import { PfdSymbol } from './PfdSymbols';
import { InheritanceBadge } from '../../components/ui/InheritanceBadge';
import type { InheritanceStatus } from '../../components/ui/InheritanceBadge';
import type { InheritanceStatusMap } from '../../hooks/useInheritanceStatus';

/* ────────────────────────────────── Types ────────────────────────────────── */

interface PfdFlowEditorProps {
    steps: PfdStep[];
    selectedStepId: string | null;
    onSelectStep: (stepId: string | null) => void;
    onInsertAfter: (stepId: string) => void;
    onRemoveStep: (stepId: string) => void;
    onMoveStep: (stepId: string, direction: 'up' | 'down') => void;
    onUpdateStep: (stepId: string, field: keyof PfdStep, value: string | boolean) => void;
    onDuplicateStep?: (stepId: string) => void;
    readOnly?: boolean;
    isOpen?: boolean;
    onToggle?: () => void;
    /** Search query — steps that don't match are dimmed */
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
    /** Step IDs with broken AMFE links */
    brokenLinkStepIds?: Set<string>;
    /** Inheritance status map for variant documents (null = not a variant) */
    inheritanceStatusMap?: InheritanceStatusMap | null;
}

interface ContextMenuState {
    isOpen: boolean;
    position: { x: number; y: number };
    stepId: string;
    stepIndex: number;
}

/** Group consecutive steps by branch for layout */
interface FlowGroup {
    type: 'main' | 'parallel';
    steps: PfdStep[];
    branches?: { branchId: string; label: string; steps: PfdStep[] }[];
}

/* ──────────────────────────── groupStepsByFlow ───────────────────────────── */

function groupStepsByFlow(steps: PfdStep[]): FlowGroup[] {
    const groups: FlowGroup[] = [];
    let i = 0;

    while (i < steps.length) {
        const step = steps[i];

        if (!step.branchId) {
            // Main flow step — collect consecutive main-flow steps
            const mainSteps: PfdStep[] = [];
            while (i < steps.length && !steps[i].branchId) {
                mainSteps.push(steps[i]);
                i++;
            }
            groups.push({ type: 'main', steps: mainSteps });
        } else {
            // Parallel branch — collect ALL consecutive branch steps, grouped by branchId
            const branchMap: Record<string, PfdStep[]> = {};
            const branchOrder: string[] = [];
            while (i < steps.length && steps[i].branchId) {
                const bid = steps[i].branchId;
                if (!branchMap[bid]) {
                    branchMap[bid] = [];
                    branchOrder.push(bid);
                }
                branchMap[bid].push(steps[i]);
                i++;
            }
            const branches = branchOrder.map(bid => ({
                branchId: bid,
                label: branchMap[bid][0].branchLabel || `Linea ${bid}`,
                steps: branchMap[bid],
            }));
            groups.push({ type: 'parallel', steps: [], branches });
        }
    }

    return groups;
}

/* ────────────────────────── Context Menu Component ───────────────────────── */

interface ContextMenuProps {
    state: ContextMenuState;
    totalSteps: number;
    onInsertAfter: (stepId: string) => void;
    onDuplicateStep?: (stepId: string) => void;
    onMoveStep: (stepId: string, direction: 'up' | 'down') => void;
    onRemoveStep: (stepId: string) => void;
    onClose: () => void;
}

function FlowContextMenu({
    state,
    totalSteps,
    onInsertAfter,
    onDuplicateStep,
    onMoveStep,
    onRemoveStep,
    onClose,
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    if (!state.isOpen) return null;

    const items: { label: string; icon: React.ReactNode; action: () => void; disabled?: boolean; danger?: boolean }[] = [
        {
            label: 'Insertar paso abajo',
            icon: <Plus size={14} />,
            action: () => { onInsertAfter(state.stepId); onClose(); },
        },
    ];

    if (onDuplicateStep) {
        items.push({
            label: 'Duplicar',
            icon: <Copy size={14} />,
            action: () => { onDuplicateStep(state.stepId); onClose(); },
        });
    }

    items.push(
        {
            label: 'Mover arriba',
            icon: <ArrowUpIcon size={14} />,
            action: () => { onMoveStep(state.stepId, 'up'); onClose(); },
            disabled: state.stepIndex === 0,
        },
        {
            label: 'Mover abajo',
            icon: <ArrowDownIcon size={14} />,
            action: () => { onMoveStep(state.stepId, 'down'); onClose(); },
            disabled: state.stepIndex >= totalSteps - 1,
        },
        {
            label: 'Eliminar',
            icon: <Trash2 size={14} />,
            action: () => { onRemoveStep(state.stepId); onClose(); },
            danger: true,
        },
    );

    return (
        <div
            ref={menuRef}
            data-testid="flow-context-menu"
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]"
            style={{ left: state.position.x, top: state.position.y }}
        >
            {items.map((item) => (
                <button
                    key={item.label}
                    onClick={item.action}
                    disabled={item.disabled}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors
                        ${item.disabled ? 'text-gray-300 cursor-not-allowed' : ''}
                        ${item.danger && !item.disabled ? 'text-red-600 hover:bg-red-50' : ''}
                        ${!item.danger && !item.disabled ? 'text-gray-700 hover:bg-cyan-50' : ''}
                    `}
                >
                    {item.icon}
                    {item.label}
                </button>
            ))}
        </div>
    );
}

/* ─────────────────────────── Flow Arrow Component ────────────────────────── */

function FlowArrowDown({ color }: { color?: string }) {
    return (
        <div className="flex flex-col items-center py-0.5">
            <ArrowDown size={14} className={color || 'text-cyan-400'} strokeWidth={2.5} />
        </div>
    );
}

/* ─────────────────────────── Insert Button ───────────────────────────────── */

function InsertButton({ stepId, onInsertAfter }: { stepId: string; onInsertAfter: (id: string) => void }) {
    return (
        <div className="flex flex-col items-center py-0.5">
            <ArrowDown size={12} className="text-cyan-300" strokeWidth={2} />
            <button
                onClick={() => onInsertAfter(stepId)}
                className="w-6 h-6 flex items-center justify-center rounded-full border-2 border-dashed border-cyan-300 text-cyan-400 hover:bg-cyan-50 hover:border-cyan-500 hover:text-cyan-600 transition-all"
                title="Insertar paso aqui"
                data-testid={`insert-after-${stepId}`}
            >
                <Plus size={12} />
            </button>
            <ArrowDown size={12} className="text-cyan-300" strokeWidth={2} />
        </div>
    );
}

/* ──────────────────────────── Step Card Component ────────────────────────── */

interface StepCardProps {
    step: PfdStep;
    stepIndex: number;
    totalSteps: number;
    isSelected: boolean;
    onSelect: (stepId: string) => void;
    onContextMenu: (stepId: string, stepIndex: number, e: React.MouseEvent) => void;
    onMoveStep: (stepId: string, direction: 'up' | 'down') => void;
    readOnly?: boolean;
    compact?: boolean;
    branchColor?: string;
    dimmed?: boolean;
    hasBrokenLink?: boolean;
    inheritanceStatus?: InheritanceStatus | null;
}

function StepCard({ step, stepIndex, totalSteps, isSelected, onSelect, onContextMenu, onMoveStep, readOnly, compact, branchColor, dimmed, hasBrokenLink, inheritanceStatus }: StepCardProps) {
    const hasCC = step.productSpecialChar === 'CC' || step.processSpecialChar === 'CC';
    const hasSC = !hasCC && (step.productSpecialChar === 'SC' || step.processSpecialChar === 'SC');
    const hasDisp = step.rejectDisposition !== 'none' && (step.stepType === 'inspection' || step.stepType === 'combined');

    const selectedClass = isSelected
        ? 'ring-2 ring-cyan-500 bg-cyan-50 shadow-md'
        : 'hover:bg-cyan-50/50 hover:border-cyan-300 hover:shadow';

    const ccBorder = hasCC ? 'ring-2 ring-red-400' : hasSC ? 'ring-2 ring-amber-400' : '';

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(step.id);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(step.id, stepIndex, e);
    };

    return (
        <div className="relative group flex flex-col items-center w-full max-w-md">
            <button
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                data-testid={`flow-step-${step.id}`}
                data-selected={isSelected ? 'true' : undefined}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white transition-all duration-200 cursor-pointer text-left group w-full
                    ${selectedClass} ${!isSelected ? ccBorder : ''} ${compact ? 'py-1' : ''}
                    ${branchColor ? branchColor : ''} ${dimmed ? 'opacity-30' : ''}
                `}
                title={`${step.stepNumber} — ${step.description}\nClic para seleccionar · Clic derecho para opciones`}
            >
                <PfdSymbol type={step.stepType} size={compact ? 16 : 20} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                        <span className={`font-mono font-bold text-gray-700 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                            {step.stepNumber}
                        </span>
                        <span className={`text-gray-600 whitespace-normal break-words block ${compact ? 'text-[10px] max-w-[200px]' : 'text-xs max-w-xs'}`}>
                            {step.description}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    {hasCC && (
                        <span className="text-[8px] font-bold text-red-600 bg-red-50 border border-red-200 px-1 rounded" data-testid="badge-cc">
                            CC
                        </span>
                    )}
                    {hasSC && (
                        <span className="text-[8px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded" data-testid="badge-sc">
                            SC
                        </span>
                    )}
                    {step.isExternalProcess && (
                        <span className="text-[8px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1 rounded" data-testid="badge-ext">
                            EXT
                        </span>
                    )}
                    {step.cycleTimeMinutes != null && step.cycleTimeMinutes > 0 && (
                        <span className="text-[8px] font-bold text-cyan-600 bg-cyan-50 border border-cyan-200 px-1 rounded" data-testid="badge-cycle">
                            {step.cycleTimeMinutes}min
                        </span>
                    )}
                    {step.linkedCpItemIds && step.linkedCpItemIds.length > 0 ? (
                        <span className="text-[8px] font-bold text-green-600 bg-green-50 border border-green-200 px-1 rounded"
                              title={`${step.linkedCpItemIds.length} item(s) en Plan de Control`}>
                            CP&thinsp;{step.linkedCpItemIds.length}
                        </span>
                    ) : step.stepType !== 'transport' && step.stepType !== 'storage' ? (
                        <span className="text-[8px] font-medium text-gray-400 bg-gray-50 border border-gray-200 px-1 rounded"
                              title="Sin items vinculados en Plan de Control">
                            CP&thinsp;0
                        </span>
                    ) : null}
                    {hasBrokenLink && (
                        <span className="text-[8px] font-bold text-orange-600 bg-orange-50 border border-orange-300 px-1 rounded"
                              title="Vínculo AMFE roto: la operación vinculada no existe" data-testid="badge-broken-amfe">
                            ⚠ AMFE
                        </span>
                    )}
                    {inheritanceStatus && (
                        <InheritanceBadge status={inheritanceStatus} compact />
                    )}
                </div>
            </button>
            {!readOnly && (
                <div className="absolute -right-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                     data-testid={`step-actions-${step.id}`}>
                    <button
                        data-testid={`move-up-${step.id}`}
                        aria-label={`Mover ${step.stepNumber} arriba`}
                        onClick={e => { e.stopPropagation(); onMoveStep(step.id, 'up'); }}
                        disabled={stepIndex === 0}
                        className="p-0.5 rounded bg-white border border-gray-200 shadow-sm hover:bg-gray-100 disabled:opacity-30 text-gray-500"
                    >
                        <ChevronUp size={10} />
                    </button>
                    <button
                        data-testid={`move-down-${step.id}`}
                        aria-label={`Mover ${step.stepNumber} abajo`}
                        onClick={e => { e.stopPropagation(); onMoveStep(step.id, 'down'); }}
                        disabled={stepIndex === totalSteps - 1}
                        className="p-0.5 rounded bg-white border border-gray-200 shadow-sm hover:bg-gray-100 disabled:opacity-30 text-gray-500"
                    >
                        <ChevronDown size={10} />
                    </button>
                </div>
            )}
            {/* NG Disposition badge below card */}
            {hasDisp && !compact && (
                <div className="flex items-center gap-1 mt-0.5">
                    {step.rejectDisposition === 'rework' && (
                        <span className="text-[8px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                              title={`Retrabajo → ${step.reworkReturnStep || '?'}`}>
                            <RotateCcw size={8} />
                            Retrabajo → {step.reworkReturnStep || '?'}
                        </span>
                    )}
                    {step.rejectDisposition === 'scrap' && (
                        <span className="text-[8px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                              title="Descarte">
                            <X size={8} />
                            Descarte
                        </span>
                    )}
                    {step.rejectDisposition === 'sort' && (
                        <span className="text-[8px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                              title="Selección / Re-inspección">
                            ⊘ Selección
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

/* ────────────────────────────── Main Component ───────────────────────────── */

const PfdFlowEditor: React.FC<PfdFlowEditorProps> = ({
    steps,
    selectedStepId,
    onSelectStep,
    onInsertAfter,
    onRemoveStep,
    onMoveStep,
    onUpdateStep,
    onDuplicateStep,
    readOnly = false,
    isOpen = true,
    onToggle,
    searchQuery = '',
    onSearchChange,
    brokenLinkStepIds,
    inheritanceStatusMap,
}) => {
    const groups = useMemo(() => groupStepsByFlow(steps), [steps]);

    // Zoom & Pan state
    const [zoom, setZoom] = useState(100);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -10 : 10;
            setZoom(z => Math.min(200, Math.max(50, z + delta)));
        }
    }, []);

    const handlePanStart = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest('[data-testid^="flow-step-"]')) return;
        if ((e.target as HTMLElement).closest('button')) return;
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }, [pan]);

    const handlePanMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    }, [isPanning]);

    const handlePanEnd = useCallback(() => {
        setIsPanning(false);
    }, []);

    const handleResetZoom = useCallback(() => {
        setZoom(100);
        setPan({ x: 0, y: 0 });
    }, []);

    // Search — determine which steps match
    const matchingStepIds = useMemo(() => {
        if (!searchQuery.trim()) return null; // null means all match
        const q = searchQuery.toLowerCase();
        const ids = new Set<string>();
        for (const step of steps) {
            if (
                step.description.toLowerCase().includes(q) ||
                step.machineDeviceTool.toLowerCase().includes(q) ||
                step.department.toLowerCase().includes(q) ||
                step.notes.toLowerCase().includes(q)
            ) {
                ids.add(step.id);
            }
        }
        return ids;
    }, [steps, searchQuery]);

    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        isOpen: false,
        position: { x: 0, y: 0 },
        stepId: '',
        stepIndex: 0,
    });

    const handleContextMenu = useCallback((stepId: string, stepIndex: number, e: React.MouseEvent) => {
        if (readOnly) return;
        setContextMenu({
            isOpen: true,
            position: { x: e.clientX, y: e.clientY },
            stepId,
            stepIndex,
        });
    }, [readOnly]);

    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, isOpen: false }));
    }, []);

    /** Get global index of a step by its id */
    const getStepIndex = useCallback((stepId: string): number => {
        return steps.findIndex(s => s.id === stepId);
    }, [steps]);

    /** Render a list of main-flow steps with arrows and insert buttons between them */
    const renderMainSteps = (mainSteps: PfdStep[]) => (
        <div className="flex flex-col items-center gap-0">
            {mainSteps.map((step, si) => {
                const globalIndex = getStepIndex(step.id);
                return (
                    <React.Fragment key={step.id}>
                        {si > 0 && !readOnly && (
                            <InsertButton stepId={mainSteps[si - 1].id} onInsertAfter={onInsertAfter} />
                        )}
                        {si > 0 && readOnly && <FlowArrowDown />}
                        <StepCard
                            step={step}
                            stepIndex={globalIndex}
                            totalSteps={steps.length}
                            isSelected={selectedStepId === step.id}
                            onSelect={onSelectStep}
                            onContextMenu={handleContextMenu}
                            onMoveStep={onMoveStep}
                            readOnly={readOnly}
                            dimmed={matchingStepIds !== null && !matchingStepIds.has(step.id)}
                            hasBrokenLink={brokenLinkStepIds?.has(step.id)}
                            inheritanceStatus={inheritanceStatusMap?.items.get(step.id) ?? null}
                        />
                    </React.Fragment>
                );
            })}
        </div>
    );

    /** Render a parallel flow group with fork/join indicators and side-by-side lanes */
    const renderParallelGroup = (group: FlowGroup) => (
        <div className="flex flex-col items-center gap-0 w-full" data-testid="parallel-group">
            {/* Fork indicator with connecting lines */}
            <div className="flex flex-col items-center" data-testid="fork-header">
                <div className="flex items-center gap-2 py-1">
                    <GitBranch size={14} className="text-cyan-600" />
                    <span className="text-[10px] font-bold text-cyan-700">FLUJO PARALELO</span>
                    {group.branches!.map(b => {
                        const color = getBranchColor(b.branchId);
                        return (
                            <span
                                key={b.branchId}
                                className={`${color.badge} border text-[9px] font-bold px-1.5 py-0.5 rounded`}
                            >
                                {b.label}
                            </span>
                        );
                    })}
                </div>
                {/* Horizontal connecting line between branches */}
                <div className="relative w-full flex justify-center">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 h-0.5 bg-cyan-300" style={{ width: `${Math.max(60, (group.branches!.length - 1) * 40)}%` }} />
                    <div className="flex gap-3 justify-center w-full relative">
                        {group.branches!.map(b => {
                            const color = getBranchColor(b.branchId);
                            return (
                                <div key={b.branchId} className="flex flex-col items-center min-w-[180px] flex-1 max-w-[320px]">
                                    <div className={`w-0.5 h-3 ${color.border.replace('border-', 'bg-')}`} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Parallel lanes */}
            <div className="flex gap-3 justify-center w-full">
                {group.branches!.map(branch => {
                    const color = getBranchColor(branch.branchId);
                    return (
                        <div
                            key={branch.branchId}
                            className={`flex flex-col items-center gap-0 px-3 py-2 rounded-lg border-l-4 border ${color.bg} min-w-[180px] flex-1 max-w-[320px]`}
                            style={{ borderLeftColor: color.border.replace('border-', '').includes('violet') ? '#a78bfa' : color.border.replace('border-', '').includes('sky') ? '#38bdf8' : color.border.replace('border-', '').includes('rose') ? '#fb7185' : '#a3e635' }}
                            data-testid={`branch-lane-${branch.branchId}`}
                        >
                            {/* Branch header with label + step count */}
                            <div className={`flex items-center justify-between w-full mb-2 pb-1 border-b ${color.border}`}>
                                <span className={`text-[10px] font-bold ${color.text}`}>
                                    {branch.label}
                                </span>
                                <span className={`text-[9px] font-medium ${color.text} opacity-70`}>
                                    {branch.steps.length} {branch.steps.length === 1 ? 'paso' : 'pasos'}
                                </span>
                            </div>
                            {branch.steps.map((step, si) => {
                                const globalIndex = getStepIndex(step.id);
                                return (
                                    <React.Fragment key={step.id}>
                                        {si > 0 && !readOnly && (
                                            <InsertButton stepId={branch.steps[si - 1].id} onInsertAfter={onInsertAfter} />
                                        )}
                                        {si > 0 && readOnly && (
                                            <ArrowDown size={12} className={color.text} strokeWidth={2} />
                                        )}
                                        <StepCard
                                            step={step}
                                            stepIndex={globalIndex}
                                            totalSteps={steps.length}
                                            isSelected={selectedStepId === step.id}
                                            onSelect={onSelectStep}
                                            onContextMenu={handleContextMenu}
                                            onMoveStep={onMoveStep}
                                            readOnly={readOnly}
                                            compact
                                            dimmed={matchingStepIds !== null && !matchingStepIds.has(step.id)}
                                            hasBrokenLink={brokenLinkStepIds?.has(step.id)}
                                            inheritanceStatus={inheritanceStatusMap?.items.get(step.id) ?? null}
                                        />
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* Join indicator with connecting lines */}
            <div className="flex flex-col items-center" data-testid="join-footer">
                <div className="relative w-full flex justify-center">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 h-0.5 bg-teal-300" style={{ width: `${Math.max(60, (group.branches!.length - 1) * 40)}%` }} />
                    <div className="flex gap-3 justify-center w-full relative">
                        {group.branches!.map(b => {
                            const color = getBranchColor(b.branchId);
                            return (
                                <div key={b.branchId} className="flex flex-col items-center min-w-[180px] flex-1 max-w-[320px]">
                                    <div className={`w-0.5 h-3 ${color.border.replace('border-', 'bg-')}`} />
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="flex items-center gap-2 py-1">
                    <GitMerge size={14} className="text-teal-600" />
                    <span className="text-[10px] font-bold text-teal-700">CONVERGENCIA</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 no-print" data-testid="pfd-flow-editor">
            {/* Toggle header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors rounded-t-lg"
                data-testid="flow-editor-toggle"
            >
                <div className="flex items-center gap-2">
                    <Map size={16} className="text-cyan-600" />
                    <span className="text-sm font-semibold text-gray-700">EDITOR DE FLUJO</span>
                    <span className="text-[10px] text-gray-400 font-normal">
                        {steps.length} pasos
                        {groups.some(g => g.type === 'parallel') && ' \u00B7 con flujo paralelo'}
                    </span>
                    {(() => {
                        const total = steps.reduce((sum, s) => sum + (s.cycleTimeMinutes || 0), 0);
                        return total > 0 ? (
                            <span className="text-[10px] text-cyan-600 font-medium bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded">
                                Total: {total % 1 === 0 ? total : total.toFixed(1)} min
                            </span>
                        ) : null;
                    })()}
                </div>
                {isOpen
                    ? <ChevronUp size={16} className="text-gray-400" />
                    : <ChevronDown size={16} className="text-gray-400" />
                }
            </button>

            {/* Zoom controls + Search bar */}
            {isOpen && (
                <div className="flex items-center gap-2 px-4 py-1.5 border-b border-gray-100">
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setZoom(z => Math.max(50, z - 10))}
                            className="p-1 rounded text-gray-500 hover:bg-gray-100 transition"
                            title="Reducir zoom"
                        >
                            <Minus size={14} />
                        </button>
                        <span className="text-[10px] font-mono w-10 text-center text-gray-500">{zoom}%</span>
                        <button
                            onClick={() => setZoom(z => Math.min(200, z + 10))}
                            className="p-1 rounded text-gray-500 hover:bg-gray-100 transition"
                            title="Aumentar zoom"
                        >
                            <Plus size={14} />
                        </button>
                        {(zoom !== 100 || pan.x !== 0 || pan.y !== 0) && (
                            <button
                                onClick={handleResetZoom}
                                className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                                title="Restablecer"
                            >
                                <RotateCcw size={12} />
                            </button>
                        )}
                    </div>
                    {/* Search */}
                    {onSearchChange && (
                        <div className="relative flex-1 max-w-xs ml-auto">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => onSearchChange(e.target.value)}
                                placeholder="Buscar paso (Ctrl+F)..."
                                className="w-full pl-6 pr-7 py-1 text-xs border border-gray-200 rounded focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => onSearchChange('')}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    )}
                    {searchQuery.trim() && matchingStepIds !== null && (
                        <span className="text-[10px] text-gray-400">
                            {matchingStepIds.size}/{steps.length}
                        </span>
                    )}
                </div>
            )}

            {/* Flow editor content */}
            {isOpen && (
                <div
                    className={`px-4 pb-4 pt-1 max-h-[75vh] overflow-auto bg-gradient-to-b from-gray-50/50 to-white ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onWheel={handleWheel}
                    onMouseDown={handlePanStart}
                    onMouseMove={handlePanMove}
                    onMouseUp={handlePanEnd}
                    onMouseLeave={handlePanEnd}
                >
                    {steps.length === 0 ? (
                        /* Empty state */
                        <div className="flex flex-col items-center justify-center py-8 text-gray-400" data-testid="empty-state">
                            <Map size={32} className="text-gray-300 mb-2" />
                            <p className="text-sm text-center">
                                No hay pasos. Agregá uno con el botón + o usá una plantilla.
                            </p>
                        </div>
                    ) : (
                        /* Flow groups — wrapped with zoom/pan transform */
                        <div
                            style={{
                                transform: `scale(${zoom / 100}) translate(${pan.x / (zoom / 100)}px, ${pan.y / (zoom / 100)}px)`,
                                transformOrigin: 'top center',
                                transition: isPanning ? 'none' : 'transform 0.15s ease',
                            }}
                        >
                        <div className="flex flex-col items-center gap-0">
                            {groups.map((group, gi) => (
                                <React.Fragment key={gi}>
                                    {/* Arrow / insert between groups */}
                                    {gi > 0 && (
                                        <>
                                            {!readOnly && groups[gi - 1].type === 'main' && groups[gi - 1].steps.length > 0 ? (
                                                <InsertButton
                                                    stepId={groups[gi - 1].steps[groups[gi - 1].steps.length - 1].id}
                                                    onInsertAfter={onInsertAfter}
                                                />
                                            ) : (
                                                <FlowArrowDown />
                                            )}
                                        </>
                                    )}

                                    {group.type === 'main'
                                        ? renderMainSteps(group.steps)
                                        : renderParallelGroup(group)
                                    }
                                </React.Fragment>
                            ))}
                        </div>
                        </div>
                    )}
                </div>
            )}

            {/* Context menu */}
            {!readOnly && (
                <FlowContextMenu
                    state={contextMenu}
                    totalSteps={steps.length}
                    onInsertAfter={onInsertAfter}
                    onDuplicateStep={onDuplicateStep}
                    onMoveStep={onMoveStep}
                    onRemoveStep={onRemoveStep}
                    onClose={closeContextMenu}
                />
            )}
        </div>
    );
};

export default React.memo(PfdFlowEditor);
