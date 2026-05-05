/**
 * PfdZipFlowEditor — Editor de PFD con render visual estilo zip de Fak.
 *
 * Toma `PfdStep[]` (modelo Barack), convierte a estructura zip anidada y
 * renderea con el motor portado del zip standalone (espina vertical, ramas
 * laterales, rombos rotados, conectores A/B circulares, retrabajo con L
 * invertida, branches paralelos con línea horizontal — sin cortarse).
 *
 * Reusa la misma toolbox, action bar y reglas de selección que PfdFlowEditor
 * para que la UX se mantenga uniforme.
 */
import React, { useMemo, useEffect } from 'react';
import { Map, ChevronUp, ChevronDown } from 'lucide-react';
import type { PfdStep, PfdStepType } from '../pfdTypes';
import { PFD_STEP_TYPES } from '../pfdTypes';
import { PfdSymbol } from '../PfdSymbols';
import { pfdStepsToZipFlow } from './pfdStepsToZipFlow';
import { FlowSequence, getRightPadding, getBottomPadding } from './ZipFlowRenderer';

interface Props {
    steps: PfdStep[];
    selectedStepId: string | null;
    onSelectStep: (stepId: string | null) => void;
    onInsertAfter: (stepId: string) => void;
    onRemoveStep: (stepId: string) => void;
    onMoveStep: (stepId: string, direction: 'up' | 'down') => void;
    onUpdateStep: (stepId: string, field: keyof PfdStep, value: string | boolean) => void;
    onUpdateStepFields?: (stepId: string, updates: Partial<PfdStep>) => void;
    onInsertStepWithType?: (afterStepId: string | null, stepType: PfdStepType) => void;
    readOnly?: boolean;
    isOpen?: boolean;
    onToggle?: () => void;
}

const PfdZipFlowEditor: React.FC<Props> = ({
    steps,
    selectedStepId,
    onSelectStep,
    onInsertAfter,
    onUpdateStep,
    onUpdateStepFields,
    onInsertStepWithType,
    readOnly = false,
    isOpen = true,
    onToggle,
}) => {
    const zipFlow = useMemo(() => pfdStepsToZipFlow(steps), [steps]);
    const rightPaddingPx = useMemo(() => getRightPadding(zipFlow), [zipFlow]);
    const bottomPaddingPx = useMemo(() => getBottomPadding(zipFlow), [zipFlow]);

    const selectedStep = useMemo(
        () => steps.find(s => s.id === selectedStepId) || null,
        [steps, selectedStepId],
    );

    // Click on a zip node → select the underlying PfdStep (route via srcId).
    // Virtual nodes (synthesized for parallel forks / nested rework) have srcIds
    // that don't exist in `steps` — those clicks deselect (clean UX).
    const handleSelect = (srcId: string) => {
        const exists = steps.some(s => s.id === srcId);
        onSelectStep(exists ? srcId : null);
    };

    const handleUpdateDescription = (srcId: string, value: string) => {
        if (!steps.some(s => s.id === srcId)) return;
        onUpdateStep(srcId, 'description', value);
    };

    // Escape global deselects (ignored when an input has focus).
    useEffect(() => {
        if (readOnly || !selectedStepId) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            const ae = document.activeElement;
            if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || (ae as HTMLElement).isContentEditable)) return;
            onSelectStep(null);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [selectedStepId, readOnly, onSelectStep]);

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 no-print" data-testid="pfd-zip-editor">
            {/* Toggle header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors rounded-t-lg"
                data-testid="zip-editor-toggle"
            >
                <div className="flex items-center gap-2">
                    <Map size={16} className="text-cyan-600" />
                    <span className="text-sm font-semibold text-gray-700">VISTA MEJORADA — flujograma con espina y ramas laterales</span>
                    <span className="text-[10px] text-gray-400 font-normal">
                        {steps.length} pasos
                    </span>
                </div>
                {isOpen
                    ? <ChevronUp size={16} className="text-gray-400" />
                    : <ChevronDown size={16} className="text-gray-400" />
                }
            </button>

            {/* Type toolbox */}
            {isOpen && !readOnly && (
                <div className="flex items-center gap-2 px-4 py-1.5 border-b border-gray-100 bg-gray-50/40 flex-wrap" data-testid="zip-type-toolbox">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Insertar tipo:</span>
                    {PFD_STEP_TYPES.map(t => {
                        const handleInsert = () => {
                            if (onInsertStepWithType) {
                                onInsertStepWithType(selectedStepId, t.value);
                            } else if (selectedStepId) {
                                onInsertAfter(selectedStepId);
                            }
                        };
                        const tooltip = selectedStepId
                            ? `Agregar ${t.label} despues del paso seleccionado`
                            : `Agregar ${t.label} al final del flujo`;
                        return (
                            <button
                                key={t.value}
                                type="button"
                                onClick={handleInsert}
                                title={tooltip}
                                aria-label={`Agregar ${t.label}`}
                                data-testid={`zip-toolbox-${t.value}`}
                                className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 bg-white text-xs text-gray-700 hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-700 transition-colors"
                            >
                                <PfdSymbol type={t.value} size={16} />
                                <span className="hidden md:inline">{t.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Selection action bar — branch + disposition picker */}
            {isOpen && !readOnly && selectedStep && (
                <div className="flex items-center gap-3 px-4 py-1.5 border-b border-gray-100 bg-cyan-50/30 flex-wrap" data-testid="zip-selection-bar">
                    <span className="text-[10px] font-semibold text-cyan-700 uppercase tracking-wide">
                        {selectedStep.stepNumber || '(sin nº)'} · {PFD_STEP_TYPES.find(t => t.value === selectedStep.stepType)?.label || selectedStep.stepType}
                    </span>
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] font-medium text-gray-500">Línea:</span>
                        {[
                            { id: '', label: 'Principal', cls: 'border-gray-300 text-gray-700 hover:bg-gray-100' },
                            { id: 'A', label: 'A', cls: 'border-violet-300 text-violet-700 hover:bg-violet-50' },
                            { id: 'B', label: 'B', cls: 'border-sky-300 text-sky-700 hover:bg-sky-50' },
                            { id: 'C', label: 'C', cls: 'border-rose-300 text-rose-700 hover:bg-rose-50' },
                            { id: 'D', label: 'D', cls: 'border-lime-300 text-lime-700 hover:bg-lime-50' },
                        ].map(b => {
                            const active = (selectedStep.branchId || '') === b.id;
                            const handleSetBranch = () => {
                                if (active) return;
                                if (onUpdateStepFields) {
                                    onUpdateStepFields(selectedStep.id, {
                                        branchId: b.id,
                                        branchLabel: b.id ? `Línea ${b.id}` : '',
                                    });
                                } else {
                                    onUpdateStep(selectedStep.id, 'branchId', b.id);
                                    onUpdateStep(selectedStep.id, 'branchLabel', b.id ? `Línea ${b.id}` : '');
                                }
                            };
                            return (
                                <button
                                    key={b.id || 'main'}
                                    type="button"
                                    onClick={handleSetBranch}
                                    title={b.id ? `Marcar como Línea ${b.id} (paralela)` : 'Mover al flujo principal'}
                                    data-testid={`zip-branch-pick-${b.id || 'main'}`}
                                    aria-pressed={active}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${active ? 'bg-cyan-600 text-white border-cyan-600' : `bg-white ${b.cls}`}`}
                                >
                                    {b.label}
                                </button>
                            );
                        })}
                    </div>
                    {(selectedStep.stepType === 'decision' || selectedStep.stepType === 'inspection' || selectedStep.stepType === 'combined') && (
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] font-medium text-gray-500">Si NO:</span>
                            {[
                                { v: 'none' as const, label: 'Sin disp.', cls: 'border-gray-300 text-gray-600 hover:bg-gray-100' },
                                { v: 'scrap' as const, label: 'Scrap', cls: 'border-red-300 text-red-700 hover:bg-red-50' },
                                { v: 'rework' as const, label: 'Retrabajo', cls: 'border-orange-300 text-orange-700 hover:bg-orange-50' },
                                { v: 'rework_or_scrap' as const, label: 'Retrabajo o scrap', cls: 'border-amber-300 text-amber-700 hover:bg-amber-50' },
                                { v: 'sort' as const, label: 'Selección', cls: 'border-purple-300 text-purple-700 hover:bg-purple-50' },
                            ].map(d => {
                                const active = selectedStep.rejectDisposition === d.v;
                                return (
                                    <button
                                        key={d.v}
                                        type="button"
                                        onClick={() => onUpdateStep(selectedStep.id, 'rejectDisposition', d.v)}
                                        title={d.v === 'none' ? 'Quitar disposición' : `Marcar disposición: ${d.label}`}
                                        data-testid={`zip-disposition-pick-${d.v}`}
                                        aria-pressed={active}
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${active ? 'bg-cyan-600 text-white border-cyan-600' : `bg-white ${d.cls}`}`}
                                    >
                                        {d.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => onSelectStep(null)}
                        title="Deseleccionar (Escape)"
                        data-testid="zip-deselect-step"
                        className="ml-auto text-[10px] text-gray-500 hover:text-gray-800 hover:underline"
                    >
                        Deseleccionar
                    </button>
                </div>
            )}

            {/* Render canvas — bg gris claro + scroll horizontal cuando hay paralelos anchos */}
            {isOpen && (
                <div className="px-4 pb-8 pt-6 bg-[#F3F4F6] overflow-x-auto max-h-[80vh] overflow-y-auto" data-testid="zip-canvas">
                    {steps.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <Map size={32} className="text-gray-300 mb-2" />
                            <p className="text-sm">No hay pasos. Agregá uno desde el toolbox de arriba.</p>
                        </div>
                    ) : (
                        <div
                            className="min-w-fit pl-12 mx-auto bg-white rounded-lg shadow-sm border border-gray-200 pt-10 pb-16"
                            style={{ paddingRight: `${rightPaddingPx}px`, paddingBottom: `${bottomPaddingPx}px` }}
                        >
                            <FlowSequence
                                sequence={zipFlow}
                                ctx={{
                                    selectedSrcId: selectedStepId,
                                    onSelect: handleSelect,
                                    onUpdateDescription: handleUpdateDescription,
                                    readOnly,
                                }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default React.memo(PfdZipFlowEditor);
