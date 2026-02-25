import React, { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { AmfeOperation, AmfeWorkElement, AmfeFunction, AmfeFailure, AmfeCause, ActionPriority, AMFE_STATUS_OPTIONS, WORK_ELEMENT_TYPES, WORK_ELEMENT_LABELS, WorkElementType, EFFECT_LABELS } from './amfeTypes';
import { clampSOD, getFailureWarnings, getCauseValidationState, CauseValidationState } from './amfeValidation';
import { AlertTriangle } from 'lucide-react';
import { useAmfe } from './useAmfe';
import { Trash2, Plus, Copy, Monitor, User, Box, Settings, Thermometer, Ruler, ChevronRight, ChevronDown } from 'lucide-react';
import AutoResizeTextarea from './AutoResizeTextarea';
import SuggestableTextarea from './SuggestableTextarea';
import { SuggestionIndex, SuggestionContext } from './amfeSuggestionEngine';
import { ColumnGroupVisibility, COLUMN_COUNTS } from './useAmfeColumnVisibility';
import { inferOperationCategory } from '../../utils/processCategory';

interface Props {
    operations: AmfeOperation[];
    amfe: ReturnType<typeof useAmfe>;
    requestConfirm: (options: { title: string; message: string; variant?: 'danger' | 'warning' | 'info'; confirmText?: string }) => Promise<boolean>;
    columnVisibility?: ColumnGroupVisibility;
    suggestionIndex?: SuggestionIndex | null;
    aiEnabled?: boolean;
    collapsedOps?: Set<string>;
    onToggleCollapse?: (opId: string) => void;
    readOnly?: boolean;
}

// inferOperationCategory re-exported from utils/processCategory
export { inferOperationCategory } from '../../utils/processCategory';

/** Icon map for each 6M work element type */
const WE_ICONS: Record<WorkElementType, React.ReactNode> = {
    Machine: <Monitor size={12} />,
    Man: <User size={12} />,
    Material: <Box size={12} />,
    Method: <Settings size={12} />,
    Environment: <Thermometer size={12} />,
    Measurement: <Ruler size={12} />,
};

/** Color badge for Action Priority (H/M/L) */
const getApColor = (ap: string) => {
    switch (ap) {
        case ActionPriority.HIGH: return 'bg-red-500 text-white font-bold';
        case ActionPriority.MEDIUM: return 'bg-yellow-400 text-black font-bold';
        case ActionPriority.LOW: return 'bg-green-500 text-white font-bold';
        default: return 'bg-gray-100 text-gray-400';
    }
};

/** Color coding for S/O/D values based on risk level */
const getSODColor = (value: number | string): string => {
    const num = Number(value);
    if (isNaN(num) || num === 0) return '';
    if (num >= 9) return 'bg-red-100 text-red-900 font-bold';
    if (num >= 7) return 'bg-orange-100 text-orange-900 font-semibold';
    if (num >= 4) return 'bg-yellow-50 text-yellow-900';
    return 'bg-green-50 text-green-800';
};

/** Left-border color based on AP level for cause rows */
const getCauseRowBorderClass = (ap: string): string => {
    switch (ap) {
        case 'H': return 'border-l-4 border-l-red-500 bg-red-50/20';
        case 'M': return 'border-l-4 border-l-yellow-400 bg-yellow-50/15';
        case 'L': return 'border-l-4 border-l-green-400 bg-green-50/10';
        default: return '';
    }
};

/** Whether a failure has any sub-severity values (makes main S read-only) */
const hasSubSeverities = (fail: AmfeFailure): boolean =>
    !!(fail.severityLocal || fail.severityNextLevel || fail.severityEndUser);

/** Validation icon for cause row (shows AlertTriangle with tooltip on errors/warnings) */
const CauseValidationIcon: React.FC<{ validation: CauseValidationState }> = ({ validation }) => {
    if (validation.level === 'ok') return null;
    const color = validation.level === 'error' ? 'text-red-500' : 'text-amber-500';
    return (
        <div className="relative group/validation inline-block ml-1">
            <AlertTriangle size={12} className={`${color} cursor-help`} />
            <div className="absolute z-50 hidden group-hover/validation:block bottom-full left-1/2 -translate-x-1/2 mb-1 bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap max-w-[220px]">
                {validation.messages.map((msg, i) => <div key={i}>• {msg}</div>)}
            </div>
        </div>
    );
};

const AmfeTableBody: React.FC<Props> = ({ operations, amfe, requestConfirm, columnVisibility, suggestionIndex, aiEnabled = false, collapsedOps, onToggleCollapse, readOnly = false }) => {
    const sIdx = suggestionIndex || null;
    const v = columnVisibility || { step2: true, step3: true, step4: true, step5: true, step6: true, obs: true };

    // Columns remaining after the 2 sticky Op cells (Op# + OpName are always rendered separately)
    const restColSpan = (v.step2 ? COLUMN_COUNTS.step2 - 2 : 0)
        + (v.step3 ? COLUMN_COUNTS.step3 : 0)
        + (v.step4 ? COLUMN_COUNTS.step4 : 0)
        + (v.step5 ? COLUMN_COUNTS.step5 : 0)
        + (v.step6 ? COLUMN_COUNTS.step6 : 0)
        + (v.obs ? COLUMN_COUNTS.obs : 0)
        || 1;

    // Memoize all class strings — only recompute when readOnly changes
    const cls = useMemo(() => {
        const cell = readOnly
            ? "px-2 py-2 border-r border-b border-gray-200 align-top text-xs min-h-[32px]"
            : "p-1 border-r border-b border-gray-200 align-top text-xs";
        return {
            cell,
            textArea: "w-full min-h-[40px] bg-transparent outline-none text-xs font-medium text-slate-700 placeholder-slate-300 focus:bg-white focus:ring-1 focus:ring-blue-200 rounded px-1 transition-colors",
            textSpan: "text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap break-words",
            opNum: `${cell} ${readOnly ? 'bg-slate-100' : 'bg-slate-50'} sticky left-0 z-[5] w-24 min-w-[96px]`,
            opName: `${cell} ${readOnly ? 'bg-slate-100' : 'bg-slate-50'} sticky left-[96px] z-[5] w-48 min-w-[192px]`,
            ghostCell: "p-0.5 border-r border-b border-dashed border-gray-200 bg-gray-50/30 align-middle",
            ghostEmpty: "border-r border-b border-dashed border-gray-200 bg-gray-50/20",
        };
    }, [readOnly]);
    // Aliases for backward compatibility in existing code
    const cellClass = cls.cell;
    const textAreaClass = cls.textArea;
    const textSpanClass = cls.textSpan;
    const opNumCellClass = cls.opNum;
    const opNameCellClass = cls.opName;
    const opNameShadow: React.CSSProperties = { boxShadow: readOnly ? '3px 0 6px rgba(0,0,0,0.1)' : '2px 0 4px rgba(0,0,0,0.06)' };
    const ghostCellClass = cls.ghostCell;
    const ghostEmptyCell = cls.ghostEmpty;
    // Ghost row offset: 0 in view mode (no ghost rows), 1 in edit mode
    const ghostRowOffset = readOnly ? 0 : 1;

    /** Render text value (view mode) or edit element (edit mode) */
    const renderText = useCallback((value: string | number, editElement: React.ReactNode) => {
        if (readOnly) {
            const text = String(value || '').trim();
            return text
                ? <span className={textSpanClass}>{text}</span>
                : <span className="text-xs text-gray-300 italic">—</span>;
        }
        return editElement;
    }, [readOnly, textSpanClass]);

    /** Render SOD badge (view mode) or input (edit mode) */
    const renderSODBadge = useCallback((value: number | string, editElement: React.ReactNode) => {
        if (readOnly) {
            const num = Number(value);
            return (
                <div className={`text-center text-xs font-semibold rounded py-0.5 ${num > 0 ? getSODColor(value) : 'text-gray-300'}`}>
                    {num > 0 ? num : '—'}
                </div>
            );
        }
        return editElement;
    }, [readOnly]);

    // --- Context Menu state ---
    type CtxTarget = { x: number; y: number; opId: string; weId?: string; funcId?: string; failId?: string; causeId?: string };
    const [ctxMenu, setCtxMenu] = useState<CtxTarget | null>(null);
    const ctxRef = useRef<HTMLDivElement>(null);

    // Close on outside click or Escape
    useEffect(() => {
        if (!ctxMenu) return;
        const close = () => setCtxMenu(null);
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        document.addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', onKey); };
    }, [ctxMenu]);

    // Effects tab state per failure (0=Local, 1=NextLevel, 2=EndUser)
    const [effectTab, setEffectTab] = useState<Record<string, number>>({});
    const getEffectTab = (failId: string) => effectTab[failId] ?? 0;

    // Step 6 is always visible per AIAG-VDA (no compact mode for AP=L)

    const openCtx = useCallback((e: React.MouseEvent, target: Omit<CtxTarget, 'x' | 'y'>) => {
        e.preventDefault();
        e.stopPropagation();
        const maxY = window.innerHeight - 350;
        const maxX = window.innerWidth - 200;
        setCtxMenu({ x: Math.min(e.clientX, maxX), y: Math.min(e.clientY, maxY), ...target });
    }, []);

    /** Confirm-wrapped delete handlers (guarded by readOnly) */
    const confirmDeleteOp = useCallback(async (opId: string) => {
        if (readOnly) return;
        const ok = await requestConfirm({ title: 'Eliminar Operación', message: '¿Eliminar esta operación y todo su contenido?', confirmText: 'Eliminar' });
        if (ok) amfe.deleteOp(opId);
    }, [readOnly, requestConfirm, amfe.deleteOp]);

    const confirmDeleteWE = useCallback(async (opId: string, weId: string) => {
        if (readOnly) return;
        const ok = await requestConfirm({ title: 'Eliminar Elemento', message: '¿Eliminar este elemento de trabajo y sus funciones?', confirmText: 'Eliminar' });
        if (ok) amfe.deleteWorkElement(opId, weId);
    }, [readOnly, requestConfirm, amfe.deleteWorkElement]);

    const confirmDeleteFunc = useCallback(async (opId: string, weId: string, funcId: string) => {
        if (readOnly) return;
        const ok = await requestConfirm({ title: 'Eliminar Función', message: '¿Eliminar esta función y sus fallas asociadas?', confirmText: 'Eliminar' });
        if (ok) amfe.deleteFunction(opId, weId, funcId);
    }, [readOnly, requestConfirm, amfe.deleteFunction]);

    const confirmDeleteFailure = useCallback(async (opId: string, weId: string, funcId: string, failId: string) => {
        if (readOnly) return;
        const ok = await requestConfirm({ title: 'Eliminar Falla', message: '¿Eliminar este modo de falla y todas sus causas?', confirmText: 'Eliminar' });
        if (ok) amfe.deleteFailure(opId, weId, funcId, failId);
    }, [readOnly, requestConfirm, amfe.deleteFailure]);

    const confirmDeleteCause = useCallback(async (opId: string, weId: string, funcId: string, failId: string, causeId: string) => {
        if (readOnly) return;
        const ok = await requestConfirm({ title: 'Eliminar Causa', message: '¿Eliminar esta causa?', confirmText: 'Eliminar' });
        if (ok) amfe.deleteCause(opId, weId, funcId, failId, causeId);
    }, [readOnly, requestConfirm, amfe.deleteCause]);

    // --- Row count calculations (with cause nesting + ghost rows) ---
    // ghostRowOffset = 0 in view mode (no ghost rows), 1 in edit mode
    const getFailureRowCount = (fail: AmfeFailure) => Math.max(fail.causes.length, 1) + ghostRowOffset; // +ghost "Agregar Causa"

    const getFuncRowCount = (func: AmfeFunction) => {
        if (func.failures.length === 0) return 1 + ghostRowOffset; // 1 data + ghost "Agregar Falla"
        return func.failures.reduce((acc, fail) => acc + getFailureRowCount(fail), 0) + ghostRowOffset; // +ghost "Agregar Falla"
    };

    const getWERowCount = (we: AmfeWorkElement) => {
        if (we.functions.length === 0) return 1 + ghostRowOffset; // 1 data + ghost "Agregar Función"
        return we.functions.reduce((acc, func) => acc + getFuncRowCount(func), 0) + ghostRowOffset; // +ghost "Agregar Función"
    };

    const getOpRowCount = (op: AmfeOperation) => {
        if (op.workElements.length === 0) return 1; // just the empty state row, no ghost needed
        return op.workElements.reduce((acc, we) => acc + getWERowCount(we), 0) + ghostRowOffset; // +ghost "Agregar 6M"
    };

    /** Handle S/O/D input for cause-level fields */
    const handleCauseSODChange = (
        opId: string, weId: string, funcId: string, failId: string, causeId: string,
        field: keyof AmfeCause, rawValue: string
    ) => {
        if (rawValue === '') {
            amfe.updateCause(opId, weId, funcId, failId, causeId, field, '');
            return;
        }
        const validated = clampSOD(rawValue);
        if (validated !== '') {
            amfe.updateCause(opId, weId, funcId, failId, causeId, field, validated);
        }
    };

    /** Handle S input for failure-level severity */
    const handleSeverityChange = (
        opId: string, weId: string, funcId: string, failId: string, rawValue: string
    ) => {
        if (rawValue === '') {
            amfe.updateFailure(opId, weId, funcId, failId, 'severity', '');
            return;
        }
        const validated = clampSOD(rawValue);
        if (validated !== '') {
            amfe.updateFailure(opId, weId, funcId, failId, 'severity', validated);
        }
    };

    /** Handle per-level severity input (auto-computes MAX → severity via useAmfe hook) */
    const handleSubSeverityChange = (
        opId: string, weId: string, funcId: string, failId: string,
        field: 'severityLocal' | 'severityNextLevel' | 'severityEndUser',
        rawValue: string
    ) => {
        if (rawValue === '') {
            amfe.updateFailure(opId, weId, funcId, failId, field, '');
            return;
        }
        const validated = clampSOD(rawValue);
        if (validated !== '') {
            amfe.updateFailure(opId, weId, funcId, failId, field, validated);
        }
    };

    /** Render an S/O/D number input with color coding (cause level) */
    const renderCauseSODInput = (
        opId: string, weId: string, funcId: string, failId: string, causeId: string,
        field: keyof AmfeCause, value: number | string, ariaLabel: string
    ) => (
        <input
            type="number" min={1} max={10} step={1}
            value={value}
            onChange={e => handleCauseSODChange(opId, weId, funcId, failId, causeId, field, e.target.value)}
            className={`w-full text-center outline-none text-xs p-0.5 rounded ${getSODColor(value)}`}
            aria-label={ariaLabel}
        />
    );

    /** Render AP badge */
    const renderAPBadge = (ap: string) => (
        <div className={`text-[10px] px-1.5 py-0.5 rounded text-center ${getApColor(ap)}`}>
            {ap || "-"}
        </div>
    );

    /** Render the 6M type selector buttons (for empty operation or ghost row) */
    const render6MSelector = (opId: string, existingTypes?: WorkElementType[]) => (
        <div className="flex flex-col gap-1 p-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Paso 2: Agregar Elemento de Trabajo (6M)
            </span>
            <div className="flex gap-1.5 flex-wrap">
                {WORK_ELEMENT_TYPES.map(type => {
                    const hasType = existingTypes?.includes(type);
                    return (
                        <button
                            key={type}
                            onClick={() => amfe.addWorkElement(opId, type)}
                            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded border transition font-medium ${
                                hasType
                                    ? 'text-blue-400 border-blue-100 bg-blue-50/40 hover:bg-blue-100/50'
                                    : 'text-blue-600 border-blue-200 bg-white hover:bg-blue-50'
                            }`}
                        >
                            {WE_ICONS[type]}
                            <span>{WORK_ELEMENT_LABELS[type]}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    /** Build suggestion context from the current position in the AMFE hierarchy */
    const buildSugCtx = (
        op: AmfeOperation,
        we: AmfeWorkElement,
        func: AmfeFunction,
        fail?: AmfeFailure,
        cause?: AmfeCause,
        existingValues?: string[],
    ): SuggestionContext => {
        const sev = fail ? Number(fail.severity) || 0 : 0;
        const effectsSummary = fail
            ? [fail.effectLocal, fail.effectNextLevel, fail.effectEndUser].filter(Boolean).join('; ')
            : undefined;
        return {
            operationName: op.name,
            workElementType: we.type,
            workElementName: we.name,
            failureDescription: fail?.description,
            existingValues: existingValues?.sort(),
            functionDescription: func.description,
            functionRequirements: func.requirements || undefined,
            severity: sev || undefined,
            occurrence: cause ? (Number(cause.occurrence) || undefined) : undefined,
            detection: cause ? (Number(cause.detection) || undefined) : undefined,
            causeText: cause?.cause || undefined,
            effectsContext: effectsSummary || undefined,
            operationCategory: inferOperationCategory(op.name),
        };
    };

    /** Render the effects cell with tab-based UI (Local/Cliente/Usuario) */
    const renderEffectsCell = (op: AmfeOperation, we: AmfeWorkElement, func: AmfeFunction, fail: AmfeFailure, rowSpan: number) => {
        const sL = Number(fail.severityLocal) || 0;
        const sN = Number(fail.severityNextLevel) || 0;
        const sE = Number(fail.severityEndUser) || 0;
        const maxS = Math.max(sL, sN, sE);
        const tab = getEffectTab(fail.id);

        // Static class maps (Tailwind can't use dynamic class names)
        const tabActiveClasses = ['border-blue-500 text-blue-700 bg-blue-50', 'border-orange-500 text-orange-700 bg-orange-50', 'border-red-500 text-red-700 bg-red-50'];
        const dotClasses = ['bg-blue-400', 'bg-orange-400', 'bg-red-400'];
        const borderClasses = ['border-l-blue-400', 'border-l-orange-400', 'border-l-red-400'];
        const labelClasses = ['text-blue-600', 'text-orange-600', 'text-red-600'];
        const sevHighClasses = ['border-blue-500 bg-blue-100 font-bold', 'border-orange-500 bg-orange-100 font-bold', 'border-red-500 bg-red-100 font-bold'];

        const tabs = [
            { label: 'Local', sev: sL, value: fail.effectLocal, sevField: 'severityLocal' as const, field: 'effectLocal' as const, sugField: 'effectLocal' as const, placeholder: 'Efecto en planta propia', existing: func.failures.map(f => f.effectLocal).filter(Boolean) },
            { label: 'Cliente', sev: sN, value: fail.effectNextLevel, sevField: 'severityNextLevel' as const, field: 'effectNextLevel' as const, sugField: 'effectNextLevel' as const, placeholder: 'Efecto en planta cliente', existing: func.failures.map(f => f.effectNextLevel).filter(Boolean) },
            { label: 'Usuario', sev: sE, value: fail.effectEndUser, sevField: 'severityEndUser' as const, field: 'effectEndUser' as const, sugField: 'effectEndUser' as const, placeholder: 'Efecto en usuario final', existing: func.failures.map(f => f.effectEndUser).filter(Boolean) },
        ];
        const active = tabs[tab];

        // VIEW MODE: stacked display instead of tabs
        if (readOnly) {
            return (
                <td className={cellClass} rowSpan={rowSpan}>
                    <div className="flex flex-col gap-1">
                        {tabs.map((t, i) => {
                            const text = String(t.value || '').trim();
                            if (!text && t.sev === 0) return null;
                            return (
                                <div key={i} className={`border-l-2 ${borderClasses[i]} pl-1.5`}>
                                    <div className="flex items-center gap-1 mb-0.5">
                                        <span className={`text-[9px] font-semibold ${labelClasses[i]}`}>{t.label}</span>
                                        {t.sev > 0 && (
                                            <span className={`text-[9px] font-bold px-1 rounded ${t.sev === maxS ? 'bg-red-100 text-red-700' : 'text-gray-500'}`}>
                                                S={t.sev}
                                            </span>
                                        )}
                                    </div>
                                    {text ? <span className="text-[11px] text-slate-700 leading-snug">{text}</span> : <span className="text-[10px] text-gray-300 italic">—</span>}
                                </div>
                            );
                        })}
                    </div>
                    {maxS > 0 && (
                        <div className="mt-1 pt-1 border-t border-gray-100 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${maxS >= 9 ? 'bg-red-100 text-red-700' : maxS >= 7 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                                S = {maxS}
                            </span>
                        </div>
                    )}
                </td>
            );
        }

        return (
            <td className={cellClass} rowSpan={rowSpan}>
                {/* Tab buttons */}
                <div className="flex gap-0.5 mb-1" role="tablist">
                    {tabs.map((t, i) => {
                        const isActive = i === tab;
                        const hasFill = !!t.value;
                        return (
                            <button
                                key={i}
                                role="tab"
                                aria-selected={isActive}
                                tabIndex={isActive ? 0 : -1}
                                onClick={() => setEffectTab(prev => ({ ...prev, [fail.id]: i }))}
                                onKeyDown={e => {
                                    if (e.key === 'ArrowRight') { e.preventDefault(); setEffectTab(prev => ({ ...prev, [fail.id]: ((prev[fail.id] ?? 0) + 1) % 3 })); }
                                    if (e.key === 'ArrowLeft') { e.preventDefault(); setEffectTab(prev => ({ ...prev, [fail.id]: ((prev[fail.id] ?? 0) + 2) % 3 })); }
                                }}
                                className={`text-[9px] px-1.5 py-0.5 rounded-t border-b-2 transition font-medium flex items-center gap-0.5 ${
                                    isActive ? tabActiveClasses[i] : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                {hasFill && <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClasses[i]}`} />}
                                {t.label}
                                {t.sev > 0 && <span className="text-[8px] ml-0.5 opacity-60">{t.sev}</span>}
                            </button>
                        );
                    })}
                </div>
                {/* Active tab content */}
                <div className={`border-l-2 ${borderClasses[tab]} pl-1.5`}>
                    <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[10px] font-semibold ${labelClasses[tab]} leading-tight`}>{EFFECT_LABELS[active.field]}</span>
                        <input
                            type="number" min={1} max={10} step={1}
                            value={fail[active.sevField] ?? ''}
                            onChange={e => handleSubSeverityChange(op.id, we.id, func.id, fail.id, active.sevField, e.target.value)}
                            className={`w-8 text-center outline-none text-[10px] p-0.5 rounded border ${active.sev > 0 && active.sev === maxS ? sevHighClasses[tab] : 'border-gray-200 bg-gray-50'}`}
                            aria-label={`Severidad ${active.label} (S) 1-10`}
                            placeholder="S"
                        />
                    </div>
                    <SuggestableTextarea value={active.value} onChange={e => amfe.updateFailure(op.id, we.id, func.id, fail.id, active.field, e.target.value)} onValueChange={v => amfe.updateFailure(op.id, we.id, func.id, fail.id, active.field, v)} suggestionIndex={sIdx} aiEnabled={aiEnabled} suggestionField={active.sugField} suggestionContext={buildSugCtx(op, we, func, fail, undefined, active.existing)} className={textAreaClass} placeholder={active.placeholder} />
                </div>
                {/* S summary */}
                {maxS > 0 && (
                    <div className="mt-1 text-center">
                        <span className="text-[9px] text-gray-400">S = MAX({sL || '-'}, {sN || '-'}, {sE || '-'}) = </span>
                        <span className={`text-[10px] font-bold ${maxS >= 9 ? 'text-red-600' : maxS >= 7 ? 'text-orange-600' : 'text-gray-700'}`}>{maxS}</span>
                    </div>
                )}
            </td>
        );
    };

    /** Render cause-level columns (FC through observations) */
    const renderCauseCells = (op: AmfeOperation, we: AmfeWorkElement, func: AmfeFunction, fail: AmfeFailure, cause: AmfeCause, validation?: CauseValidationState | null) => (
        <>
            {/* Step 5: FC, PC, O, DC, D, AP, No.Car, Car., Filtro */}
            {v.step5 && <>
                <td className={`${cellClass} bg-yellow-50/10`}>
                    <div className="flex justify-between group/cause">
                        {renderText(cause.cause, <SuggestableTextarea value={cause.cause} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'cause', e.target.value)} onValueChange={v => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'cause', v)} suggestionIndex={sIdx} aiEnabled={aiEnabled} suggestionField="cause" suggestionContext={buildSugCtx(op, we, func, fail, undefined, fail.causes.map(c => c.cause).filter(Boolean))} className={`${textAreaClass} text-orange-900 bg-orange-50/30`} placeholder="Por que fallo? (ej: Sensor descalibrado)" />)}
                        {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/cause:opacity-100">
                            <button onClick={() => amfe.duplicateCause(op.id, we.id, func.id, fail.id, cause.id)} className="text-gray-300 hover:text-blue-500"><Copy size={10} /></button>
                            <button onClick={() => confirmDeleteCause(op.id, we.id, func.id, fail.id, cause.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={10} /></button>
                        </div>}
                    </div>
                </td>
                <td className={`${cellClass} bg-yellow-50/10`}>
                    {renderText(cause.preventionControl, <SuggestableTextarea value={cause.preventionControl} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'preventionControl', e.target.value)} onValueChange={v => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'preventionControl', v)} suggestionIndex={sIdx} aiEnabled={aiEnabled} suggestionField="preventionControl" suggestionContext={buildSugCtx(op, we, func, fail, cause, fail.causes.map(c => c.preventionControl).filter(Boolean))} className={textAreaClass} placeholder="Control preventivo (ej: Calibración semanal)" />)}
                </td>
                <td className={`${cellClass} bg-yellow-50/10`}>{renderSODBadge(cause.occurrence, renderCauseSODInput(op.id, we.id, func.id, fail.id, cause.id, 'occurrence', cause.occurrence, 'Ocurrencia (O) 1-10'))}</td>
                <td className={`${cellClass} bg-yellow-50/10`}>
                    {renderText(cause.detectionControl, <SuggestableTextarea value={cause.detectionControl} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'detectionControl', e.target.value)} onValueChange={v => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'detectionControl', v)} suggestionIndex={sIdx} aiEnabled={aiEnabled} suggestionField="detectionControl" suggestionContext={buildSugCtx(op, we, func, fail, cause, fail.causes.map(c => c.detectionControl).filter(Boolean))} className={textAreaClass} placeholder="Control detección (ej: Inspección visual 100%)" />)}
                </td>
                <td className={`${cellClass} bg-yellow-50/10`}>{renderSODBadge(cause.detection, renderCauseSODInput(op.id, we.id, func.id, fail.id, cause.id, 'detection', cause.detection, 'Detección (D) 1-10'))}</td>
                <td className={`${cellClass} text-center align-middle`}>
                    <div className="flex items-center justify-center gap-0.5">
                        {renderAPBadge(cause.ap as string)}
                        {validation && <CauseValidationIcon validation={validation} />}
                    </div>
                </td>
                <td className={`${cellClass} bg-yellow-50/10`}>
                    {readOnly
                        ? <span className="text-[10px] text-center block">{cause.characteristicNumber || '—'}</span>
                        : <input value={cause.characteristicNumber} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'characteristicNumber', e.target.value)} className="w-full text-center outline-none bg-transparent text-[10px]" placeholder="-" title="No. Característica" aria-label="Número de característica" />
                    }
                </td>
                <td className={`${cellClass} bg-yellow-50/10`}>
                    {readOnly
                        ? <span className={`text-[10px] text-center block font-bold ${cause.specialChar === 'CC' ? 'text-red-600' : cause.specialChar === 'SC' ? 'text-orange-600' : ''}`}>{cause.specialChar || '—'}</span>
                        : <>
                            <input value={cause.specialChar} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'specialChar', e.target.value)} className="w-full text-center outline-none bg-transparent text-[10px]" placeholder="-" aria-label="Clasificación característica especial" />
                            {!cause.specialChar && Number(fail.severity) >= 7 && (
                                <button
                                    onClick={() => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'specialChar', Number(fail.severity) >= 9 ? 'CC' : 'SC')}
                                    className={`text-[8px] px-1 py-0.5 rounded mt-0.5 block mx-auto font-bold transition-colors ${
                                        Number(fail.severity) >= 9
                                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                            : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                    }`}
                                    title={`Sugerencia: S=${fail.severity} → ${Number(fail.severity) >= 9 ? 'CC (Crítica)' : 'SC (Significativa)'}`}
                                >
                                    {Number(fail.severity) >= 9 ? '→ CC' : '→ SC'}
                                </button>
                            )}
                        </>
                    }
                </td>
                <td className={`${cellClass} bg-yellow-50/10`}>
                    {readOnly
                        ? <span className="text-[10px] text-center block">{cause.filterCode || '—'}</span>
                        : <input value={cause.filterCode} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'filterCode', e.target.value)} className="w-full text-center outline-none bg-transparent text-[10px]" placeholder="-" aria-label="Código de filtro" />
                    }
                </td>
            </>}
            {/* Step 6: Optimization */}
            {v.step6 && (() => {
                return <>
                    <td className={`${cellClass} bg-blue-50/10`}>{renderText(cause.preventionAction, <AutoResizeTextarea value={cause.preventionAction} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'preventionAction', e.target.value)} className={textAreaClass} placeholder="Acción Preventiva" />)}</td>
                    <td className={`${cellClass} bg-blue-50/10`}>{renderText(cause.detectionAction, <AutoResizeTextarea value={cause.detectionAction} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'detectionAction', e.target.value)} className={textAreaClass} placeholder="Acción Detectiva" />)}</td>
                    <td className={`${cellClass} bg-blue-50/10`}>{renderText(cause.responsible, <AutoResizeTextarea value={cause.responsible} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'responsible', e.target.value)} className={textAreaClass} placeholder="Responsable" />)}</td>
                    <td className={`${cellClass} bg-blue-50/10`}>{readOnly ? <span className="text-[10px] text-center block">{cause.targetDate || '—'}</span> : <input type="date" value={cause.targetDate} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'targetDate', e.target.value)} className="w-full text-center outline-none bg-transparent text-[10px]" aria-label="Fecha objetivo" />}</td>
                    <td className={`${cellClass} bg-blue-50/10`}>
                        {readOnly
                            ? <span className="text-[10px] text-center block">{cause.status || '—'}</span>
                            : <select value={cause.status} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'status', e.target.value)} className="w-full text-center outline-none bg-transparent text-[10px] cursor-pointer" aria-label="Estado de la acción">
                                <option value="">-</option>
                                {AMFE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        }
                    </td>
                    <td className={`${cellClass} bg-blue-50/10`}>{renderText(cause.actionTaken, <AutoResizeTextarea value={cause.actionTaken} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'actionTaken', e.target.value)} className={textAreaClass} placeholder="Acción tomada y evidencia" />)}</td>
                    <td className={`${cellClass} bg-blue-50/10`}>{readOnly ? <span className="text-[10px] text-center block">{cause.completionDate || '—'}</span> : <input type="date" value={cause.completionDate} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'completionDate', e.target.value)} className="w-full text-center outline-none bg-transparent text-[10px]" aria-label="Fecha de completado" />}</td>
                    <td className={`${cellClass} bg-blue-50/10`}>{renderSODBadge(cause.severityNew, renderCauseSODInput(op.id, we.id, func.id, fail.id, cause.id, 'severityNew', cause.severityNew, 'Severidad nueva (S) 1-10'))}</td>
                    <td className={`${cellClass} bg-blue-50/10`}>{renderSODBadge(cause.occurrenceNew, renderCauseSODInput(op.id, we.id, func.id, fail.id, cause.id, 'occurrenceNew', cause.occurrenceNew, 'Ocurrencia nueva (O) 1-10'))}</td>
                    <td className={`${cellClass} bg-blue-50/10`}>{renderSODBadge(cause.detectionNew, renderCauseSODInput(op.id, we.id, func.id, fail.id, cause.id, 'detectionNew', cause.detectionNew, 'Detección nueva (D) 1-10'))}</td>
                    <td className={`${cellClass} bg-blue-50/10 text-center align-middle`}>{renderAPBadge(cause.apNew as string)}</td>
                </>;
            })()}
            {/* Observations */}
            {v.obs && <td className={`${cellClass} bg-gray-50/30`}>{renderText(cause.observations, <AutoResizeTextarea value={cause.observations} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'observations', e.target.value)} className={textAreaClass} placeholder={(cause.ap === 'L' || !cause.ap) ? "Si no se requiere acción: 'Análisis concluido, controles actuales aceptables'" : "Observaciones"} />)}</td>}
        </>
    );

    /** Render empty cause-level columns (when failure has 0 causes) */
    const renderEmptyCauseCells = (opId: string, weId: string, funcId: string, failId: string) => (
        <>
            {v.step5 && <td className={`${cellClass} bg-yellow-50/10`} colSpan={9}>
                {readOnly
                    ? <span className="text-[10px] text-gray-300 italic">Sin causas definidas</span>
                    : <button onClick={() => amfe.addCause(opId, weId, funcId, failId)} className="text-[10px] text-orange-600 hover:underline font-bold">+ Agregar Causa</button>
                }
            </td>}
            {v.step6 && <td className={`${cellClass} bg-blue-50/10`} colSpan={11}></td>}
            {v.obs && <td className={`${cellClass} bg-gray-50/30`}></td>}
        </>
    );

    return (
        <tbody>
            {operations.map((op, opIndex) => {
                const opRows = getOpRowCount(op);
                const opSeparator = opIndex > 0 ? ' border-t-2 border-t-slate-300' : '';

                const isCollapsed = collapsedOps?.has(op.id);

                // Collapsed summary row
                if (isCollapsed && op.workElements.length > 0) {
                    const totalWE = op.workElements.length;
                    const totalFails = op.workElements.reduce((a, w) => a + w.functions.reduce((b, f) => b + f.failures.length, 0), 0);
                    const totalCauses = op.workElements.reduce((a, w) => a + w.functions.reduce((b, f) => b + f.failures.reduce((c, fl) => c + fl.causes.length, 0), 0), 0);
                    const highAP = op.workElements.reduce((a, w) => a + w.functions.reduce((b, f) => b + f.failures.reduce((c, fl) => c + fl.causes.filter(ca => ca.ap === 'H').length, 0), 0), 0);

                    return (
                        <tr key={op.id} className={`hover:bg-gray-50 bg-slate-50/80 cursor-pointer${opSeparator}`} onClick={() => onToggleCollapse?.(op.id)} onContextMenu={readOnly ? undefined : e => openCtx(e, { opId: op.id })}>
                            <td className={opNumCellClass}>
                                <div className="flex items-center gap-1">
                                    <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                                    <span className="text-xs font-bold text-slate-700">{op.opNumber || '?'}</span>
                                </div>
                            </td>
                            <td className={opNameCellClass} style={opNameShadow}>
                                <span className="text-xs font-semibold text-slate-700">{op.name || '(sin nombre)'}</span>
                            </td>
                            <td className={cellClass} colSpan={restColSpan}>
                                <div className="flex items-center gap-3 text-[10px] text-gray-500 py-0.5">
                                    <span>{totalWE} elem.</span>
                                    <span>{totalFails} fallas</span>
                                    <span>{totalCauses} causas</span>
                                    {highAP > 0 && <span className="bg-red-100 text-red-700 px-1.5 rounded font-bold">{highAP} AP=H</span>}
                                </div>
                            </td>
                        </tr>
                    );
                }

                // If Op has no children, render a blank row with 6M selector
                if (op.workElements.length === 0) {
                    return (
                        <tr key={op.id} className={`hover:bg-gray-50${opSeparator}`} onContextMenu={readOnly ? undefined : e => openCtx(e, { opId: op.id })}>
                            <td className={opNumCellClass}>
                                <div className="flex justify-between items-start group/op">
                                    {renderText(op.opNumber, <AutoResizeTextarea value={op.opNumber} onChange={e => amfe.updateOp(op.id, 'opNumber', e.target.value)} className={textAreaClass} placeholder="Op #" />)}
                                    {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/op:opacity-100">
                                        <button onClick={() => amfe.duplicateOperation(op.id)} className="text-gray-300 hover:text-blue-500" title="Duplicar Operación"><Copy size={12} /></button>
                                        <button onClick={() => confirmDeleteOp(op.id)} className="text-gray-300 hover:text-red-500" title="Eliminar"><Trash2 size={12} /></button>
                                    </div>}
                                </div>
                            </td>
                            <td className={opNameCellClass} style={opNameShadow}>
                                {renderText(op.name, <AutoResizeTextarea value={op.name} onChange={e => amfe.updateOp(op.id, 'name', e.target.value)} className={textAreaClass} placeholder="Nombre Operación" />)}
                            </td>
                            <td className={cellClass} colSpan={restColSpan}>
                                {readOnly
                                    ? <span className="text-[10px] text-gray-300 italic">Sin elementos de trabajo</span>
                                    : render6MSelector(op.id)
                                }
                            </td>
                        </tr>
                    );
                }

                // Build all rows for this operation using imperative approach
                const opResult: React.ReactNode[] = [];
                let isFirstOpRow = true; // Track first data row to apply opSeparator
                let causeCounter = 0; // For zebra striping

                op.workElements.forEach((we, weIndex) => {
                    const weRows = getWERowCount(we);
                    const isFirstWE = weIndex === 0;

                    if (we.functions.length === 0) {
                        const rowSep = isFirstOpRow ? opSeparator : '';
                        isFirstOpRow = false;
                        opResult.push(
                            <tr key={we.id} className={`hover:bg-gray-50${rowSep}`} onContextMenu={readOnly ? undefined : e => openCtx(e, { opId: op.id, weId: we.id })}>
                                {isFirstWE && (
                                    <>
                                        <td rowSpan={opRows} className={opNumCellClass}>
                                            {onToggleCollapse && <button onClick={() => onToggleCollapse(op.id)} className="text-gray-400 hover:text-gray-600 mb-0.5 block" title="Colapsar operación"><ChevronDown size={12} /></button>}
                                            <div className="flex justify-between items-start group/op">
                                                {renderText(op.opNumber, <AutoResizeTextarea value={op.opNumber} onChange={e => amfe.updateOp(op.id, 'opNumber', e.target.value)} className={textAreaClass} placeholder="Op #" />)}
                                                {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/op:opacity-100">
                                                    <button onClick={() => amfe.duplicateOperation(op.id)} className="text-gray-300 hover:text-blue-500" title="Duplicar Operación"><Copy size={12} /></button>
                                                    <button onClick={() => confirmDeleteOp(op.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                                                </div>}
                                            </div>
                                        </td>
                                        <td rowSpan={opRows} className={opNameCellClass} style={opNameShadow}>
                                            {renderText(op.name, <AutoResizeTextarea value={op.name} onChange={e => amfe.updateOp(op.id, 'name', e.target.value)} className={textAreaClass} placeholder="Nombre Operación" />)}
                                        </td>
                                    </>
                                )}
                                <td className={cellClass}>
                                    <div className="flex gap-1 justify-between group/we">
                                        <div className="flex gap-1 flex-1">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase p-0.5">{we.type.substring(0, 3)}</span>
                                            {renderText(we.name, <AutoResizeTextarea value={we.name} onChange={e => amfe.updateWorkElement(op.id, we.id, 'name', e.target.value)} className={textAreaClass} placeholder="Nombre Elemento" />)}
                                        </div>
                                        {!readOnly && <button onClick={() => confirmDeleteWE(op.id, we.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover/we:opacity-100"><Trash2 size={12} /></button>}
                                    </div>
                                </td>
                                {v.step3 && <td className={cellClass}></td>}
                                {v.step4 && <td colSpan={3} className={cellClass}></td>}
                                {v.step5 && <td colSpan={9} className={cellClass}></td>}
                                {v.step6 && <td colSpan={11} className={cellClass}></td>}
                                {v.obs && <td className={cellClass}></td>}
                            </tr>
                        );
                        // Ghost row: "Agregar Función" even when WE has no functions yet
                        if (!readOnly) {
                            opResult.push(
                                <tr key={`${we.id}-ghost-func`}>
                                    {v.step3 && <td className={ghostCellClass}>
                                        <button
                                            onClick={() => amfe.addFunction(op.id, we.id)}
                                            className="w-full text-left text-xs text-gray-400 hover:text-green-600 hover:bg-green-50/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                                        >
                                            <Plus size={12} className="text-green-400" />
                                            <span>Agregar Función</span>
                                        </button>
                                    </td>}
                                    {v.step4 && <td colSpan={3} className={ghostEmptyCell} />}
                                    {v.step5 && <td colSpan={9} className={ghostEmptyCell} />}
                                    {v.step6 && <td colSpan={11} className={ghostEmptyCell} />}
                                    {v.obs && <td className={ghostEmptyCell} />}
                                </tr>
                            );
                        }
                        return;
                    }

                    we.functions.forEach((func, funcIndex) => {
                        const funcRows = getFuncRowCount(func);
                        const isFirstFunc = funcIndex === 0;

                        if (func.failures.length === 0) {
                            const rowSep = isFirstOpRow ? opSeparator : '';
                            isFirstOpRow = false;
                            opResult.push(
                                <tr key={func.id} className={`hover:bg-gray-50${rowSep}`} onContextMenu={readOnly ? undefined : e => openCtx(e, { opId: op.id, weId: we.id, funcId: func.id })}>
                                    {isFirstWE && isFirstFunc && (
                                        <>
                                            <td rowSpan={opRows} className={opNumCellClass}>
                                                {onToggleCollapse && <button onClick={() => onToggleCollapse(op.id)} className="text-gray-400 hover:text-gray-600 mb-0.5 block" title="Colapsar operación"><ChevronDown size={12} /></button>}
                                                <div className="flex justify-between items-start group/op">
                                                    {renderText(op.opNumber, <AutoResizeTextarea value={op.opNumber} onChange={e => amfe.updateOp(op.id, 'opNumber', e.target.value)} className={textAreaClass} placeholder="Op #" />)}
                                                    {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/op:opacity-100">
                                                        <button onClick={() => amfe.duplicateOperation(op.id)} className="text-gray-300 hover:text-blue-500" title="Duplicar Operación"><Copy size={12} /></button>
                                                        <button onClick={() => confirmDeleteOp(op.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                                                    </div>}
                                                </div>
                                            </td>
                                            <td rowSpan={opRows} className={opNameCellClass} style={opNameShadow}>
                                                {renderText(op.name, <AutoResizeTextarea value={op.name} onChange={e => amfe.updateOp(op.id, 'name', e.target.value)} className={textAreaClass} placeholder="Nombre Operación" />)}
                                            </td>
                                        </>
                                    )}
                                    {isFirstFunc && (
                                        <td rowSpan={weRows} className={cellClass}>
                                            <div className="flex gap-1 justify-between group/we">
                                                <div className="flex gap-1 flex-1">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase p-0.5">{we.type.substring(0, 3)}</span>
                                                    {renderText(we.name, <AutoResizeTextarea value={we.name} onChange={e => amfe.updateWorkElement(op.id, we.id, 'name', e.target.value)} className={textAreaClass} placeholder="Nombre Elemento" />)}
                                                </div>
                                                {!readOnly && <button onClick={() => confirmDeleteWE(op.id, we.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover/we:opacity-100"><Trash2 size={12} /></button>}
                                            </div>
                                        </td>
                                    )}
                                    {v.step3 && <td rowSpan={funcRows} className={cellClass}>
                                        <div className="flex justify-between group/func">
                                            {renderText(func.description, <AutoResizeTextarea value={func.description} onChange={e => amfe.updateFunction(op.id, we.id, func.id, 'description', e.target.value)} className={textAreaClass} placeholder="Verbo + Sustantivo (ej: Mantener temperatura)" />)}
                                            {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/func:opacity-100">
                                                <button onClick={() => amfe.duplicateFunction(op.id, we.id, func.id)} className="text-gray-300 hover:text-blue-500"><Copy size={12} /></button>
                                                <button onClick={() => confirmDeleteFunc(op.id, we.id, func.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                                            </div>}
                                        </div>
                                    </td>}
                                    {v.step4 && <td colSpan={3} className={cellClass}></td>}
                                    {v.step5 && <td colSpan={9} className={cellClass}></td>}
                                    {v.step6 && <td colSpan={11} className={cellClass}></td>}
                                    {v.obs && <td className={cellClass}></td>}
                                </tr>
                            );
                            // Ghost row: "Agregar Modo de Falla" when function has no failures
                            if (!readOnly) {
                                opResult.push(
                                    <tr key={`${func.id}-ghost-fail`}>
                                        {v.step4 && <td className={ghostCellClass}>
                                            <button
                                                onClick={() => amfe.addFailure(op.id, we.id, func.id)}
                                                className="w-full text-left text-xs text-gray-400 hover:text-red-600 hover:bg-red-50/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                                            >
                                                <Plus size={12} className="text-red-400" />
                                                <span>Agregar Modo de Falla</span>
                                            </button>
                                        </td>}
                                        {v.step4 && <td colSpan={2} className={ghostEmptyCell} />}
                                        {v.step5 && <td colSpan={9} className={ghostEmptyCell} />}
                                        {v.step6 && <td colSpan={11} className={ghostEmptyCell} />}
                                        {v.obs && <td className={ghostEmptyCell} />}
                                    </tr>
                                );
                            }
                            return;
                        }

                        // --- Render failures with nested causes ---
                        let isFirstFailInFunc = true;

                        for (const fail of func.failures) {
                            const failRows = getFailureRowCount(fail);
                            const warnings = getFailureWarnings(fail);
                            const causesToRender = fail.causes.length > 0 ? fail.causes : [null]; // null = empty placeholder

                            causesToRender.forEach((cause, causeIndex) => {
                                const isFirstCause = causeIndex === 0;
                                const isFirstFailRow = isFirstFailInFunc && isFirstCause;
                                const causeValidation = cause ? getCauseValidationState(fail, cause) : null;
                                const causeRowBorder = cause ? getCauseRowBorderClass(cause.ap as string) : '';

                                const rowSep = isFirstOpRow ? opSeparator : '';
                                isFirstOpRow = false;
                                const zebraClass = causeCounter % 2 === 1 ? ' bg-gray-50/40' : '';
                                causeCounter++;

                                opResult.push(
                                    <tr key={cause ? cause.id : `${fail.id}-empty`} className={`hover:bg-gray-50 group ${causeRowBorder}${rowSep}${zebraClass}`} onContextMenu={readOnly ? undefined : e => openCtx(e, { opId: op.id, weId: we.id, funcId: func.id, failId: fail.id, causeId: cause?.id })}>
                                        {/* OPERATION COLUMNS */}
                                        {isFirstWE && isFirstFunc && isFirstFailRow && (
                                            <>
                                                <td rowSpan={opRows} className={opNumCellClass}>
                                                    {onToggleCollapse && <button onClick={() => onToggleCollapse(op.id)} className="text-gray-400 hover:text-gray-600 mb-0.5 block" title="Colapsar operación"><ChevronDown size={12} /></button>}
                                                    <div className="flex justify-between items-start group/op">
                                                        {renderText(op.opNumber, <AutoResizeTextarea value={op.opNumber} onChange={e => amfe.updateOp(op.id, 'opNumber', e.target.value)} className={textAreaClass} placeholder="Op #" />)}
                                                        {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/op:opacity-100">
                                                            <button onClick={() => amfe.duplicateOperation(op.id)} className="text-gray-300 hover:text-blue-500" title="Duplicar Operación"><Copy size={12} /></button>
                                                            <button onClick={() => confirmDeleteOp(op.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                                                        </div>}
                                                    </div>
                                                </td>
                                                <td rowSpan={opRows} className={opNameCellClass} style={opNameShadow}>
                                                    {renderText(op.name, <AutoResizeTextarea value={op.name} onChange={e => amfe.updateOp(op.id, 'name', e.target.value)} className={textAreaClass} placeholder="Nombre Operación" />)}
                                                </td>
                                            </>
                                        )}

                                        {/* WORK ELEMENT COLUMN */}
                                        {isFirstFunc && isFirstFailRow && (
                                            <td rowSpan={weRows} className={`${cellClass} ${readOnly ? 'bg-slate-50/60 min-w-[140px] border-l border-l-slate-200' : ''}`}>
                                                <div className="flex gap-1 justify-between group/we">
                                                    <div className="flex gap-1 flex-1 items-start">
                                                        <span className={`text-[9px] font-bold uppercase shrink-0 ${readOnly ? 'bg-slate-200 text-slate-600 px-1 py-0.5 rounded' : 'text-gray-400 p-0.5'}`}>{we.type.substring(0, 3)}</span>
                                                        {renderText(we.name, <AutoResizeTextarea value={we.name} onChange={e => amfe.updateWorkElement(op.id, we.id, 'name', e.target.value)} className={textAreaClass} placeholder="Nombre Elemento" />)}
                                                    </div>
                                                    {!readOnly && <button onClick={() => confirmDeleteWE(op.id, we.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover/we:opacity-100"><Trash2 size={12} /></button>}
                                                </div>
                                            </td>
                                        )}

                                        {/* FUNCTION COLUMN */}
                                        {isFirstFailRow && (
                                            <td rowSpan={funcRows} className={cellClass}>
                                                <div className="flex justify-between group/func">
                                                    {renderText(func.description, <AutoResizeTextarea value={func.description} onChange={e => amfe.updateFunction(op.id, we.id, func.id, 'description', e.target.value)} className={textAreaClass} placeholder="Verbo + Sustantivo (ej: Mantener temperatura)" />)}
                                                    {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/func:opacity-100">
                                                        <button onClick={() => amfe.duplicateFunction(op.id, we.id, func.id)} className="text-gray-300 hover:text-blue-500"><Copy size={12} /></button>
                                                        <button onClick={() => confirmDeleteFunc(op.id, we.id, func.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                                                    </div>}
                                                </div>
                                            </td>
                                        )}

                                        {/* FAILURE-LEVEL COLUMNS (FE, S, FM) — only on first cause row */}
                                        {isFirstCause && (
                                            <>
                                                {/* EFFECTS (merged single column with 3 labeled textareas) */}
                                                {renderEffectsCell(op, we, func, fail, failRows)}

                                                {/* SEVERITY */}
                                                <td className={`${cellClass} bg-orange-50/10`} rowSpan={failRows}>
                                                    {renderSODBadge(fail.severity, <>
                                                        <input
                                                            type="number" min={1} max={10} step={1}
                                                            value={fail.severity}
                                                            onChange={e => handleSeverityChange(op.id, we.id, func.id, fail.id, e.target.value)}
                                                            readOnly={hasSubSeverities(fail)}
                                                            className={`w-full text-center outline-none text-xs p-0.5 rounded ${getSODColor(fail.severity)} ${hasSubSeverities(fail) ? 'bg-blue-50/50 cursor-not-allowed' : ''}`}
                                                            aria-label="Severidad (S) 1-10"
                                                            title={hasSubSeverities(fail) ? `S = MAX(${fail.severityLocal || '-'}, ${fail.severityNextLevel || '-'}, ${fail.severityEndUser || '-'})` : 'Severidad 1-10'}
                                                        />
                                                        {warnings.length > 0 && (
                                                            <div className="mt-0.5" title={warnings.join('\n')}>
                                                                <AlertTriangle size={10} className="text-amber-500 mx-auto" />
                                                            </div>
                                                        )}
                                                    </>)}
                                                </td>

                                                {/* FAILURE MODE (FM) */}
                                                <td className={cellClass} rowSpan={failRows}>
                                                    <div className="flex justify-between group/fail">
                                                        {renderText(fail.description, <SuggestableTextarea value={fail.description} onChange={e => amfe.updateFailure(op.id, we.id, func.id, fail.id, 'description', e.target.value)} onValueChange={v => amfe.updateFailure(op.id, we.id, func.id, fail.id, 'description', v)} suggestionIndex={sIdx} aiEnabled={aiEnabled} suggestionField="failureDescription" suggestionContext={buildSugCtx(op, we, func, undefined, undefined, func.failures.map(f => f.description).filter(Boolean))} className={`${textAreaClass} font-bold text-red-900 bg-red-50/30`} placeholder="Negativo de la función (ej: No mantiene temp)" />)}
                                                        {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/fail:opacity-100">
                                                            <button onClick={() => amfe.duplicateFailure(op.id, we.id, func.id, fail.id)} className="text-gray-300 hover:text-blue-500"><Copy size={12} /></button>
                                                            <button onClick={() => confirmDeleteFailure(op.id, we.id, func.id, fail.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                                                        </div>}
                                                    </div>
                                                </td>
                                            </>
                                        )}

                                        {/* CAUSE-LEVEL COLUMNS */}
                                        {cause ? renderCauseCells(op, we, func, fail, cause, causeValidation) : renderEmptyCauseCells(op.id, we.id, func.id, fail.id)}
                                    </tr>
                                );
                            });

                            // 2A. Ghost row: "Agregar Causa" after each failure's causes
                            if (!readOnly) {
                                opResult.push(
                                    <tr key={`${fail.id}-ghost-cause`}>
                                        {v.step4 && <td colSpan={3} className={ghostEmptyCell} />}
                                        {v.step5 && (
                                            <td colSpan={9} className={ghostCellClass}>
                                                <button
                                                    onClick={() => amfe.addCause(op.id, we.id, func.id, fail.id)}
                                                    className="w-full text-left text-xs text-gray-400 hover:text-orange-600 hover:bg-orange-50/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                                                >
                                                    <Plus size={12} className="text-orange-400" />
                                                    <span>Agregar Causa</span>
                                                </button>
                                            </td>
                                        )}
                                        {v.step6 && <td colSpan={11} className={ghostEmptyCell} />}
                                        {v.obs && <td className={ghostEmptyCell} />}
                                    </tr>
                                );
                            }

                            isFirstFailInFunc = false;
                        }

                        // 2B. Ghost row: "Agregar Modo de Falla" after each function's failures
                        if (!readOnly) {
                            opResult.push(
                                <tr key={`${func.id}-ghost-fail`}>
                                    {v.step4 && <td colSpan={3} className={ghostCellClass}>
                                        <button
                                            onClick={() => amfe.addFailure(op.id, we.id, func.id)}
                                            className="w-full text-left text-xs text-gray-400 hover:text-red-600 hover:bg-red-50/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                                        >
                                            <Plus size={12} className="text-red-400" />
                                            <span>Agregar Modo de Falla</span>
                                        </button>
                                    </td>}
                                    {v.step5 && <td colSpan={9} className={ghostEmptyCell} />}
                                    {v.step6 && <td colSpan={11} className={ghostEmptyCell} />}
                                    {v.obs && <td className={ghostEmptyCell} />}
                                </tr>
                            );
                        }
                    });

                    // 2C. Ghost row: "Agregar Función" after each WE's functions
                    if (!readOnly && we.functions.length > 0) {
                        opResult.push(
                            <tr key={`${we.id}-ghost-func`}>
                                {v.step3 && <td className={ghostCellClass}>
                                    <button
                                        onClick={() => amfe.addFunction(op.id, we.id)}
                                        className="w-full text-left text-xs text-gray-400 hover:text-green-600 hover:bg-green-50/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                                    >
                                        <Plus size={12} className="text-green-400" />
                                        <span>Agregar Función</span>
                                    </button>
                                </td>}
                                {v.step4 && <td colSpan={3} className={ghostEmptyCell} />}
                                {v.step5 && <td colSpan={9} className={ghostEmptyCell} />}
                                {v.step6 && <td colSpan={11} className={ghostEmptyCell} />}
                                {v.obs && <td className={ghostEmptyCell} />}
                            </tr>
                        );
                    }
                });

                // 2D. Ghost row: "Agregar 6M" after all WEs of this operation
                if (!readOnly) {
                    const ghostWeCols = 1 + (v.step3 ? 1 : 0) + (v.step4 ? 3 : 0) + (v.step5 ? 9 : 0) + (v.step6 ? 11 : 0) + (v.obs ? 1 : 0);
                    opResult.push(
                        <tr key={`${op.id}-ghost-we`}>
                            <td colSpan={ghostWeCols} className={ghostCellClass}>
                                {render6MSelector(op.id, op.workElements.map(w => w.type))}
                            </td>
                        </tr>
                    );
                }

                return opResult;
            })}

            {/* 2E. Ghost row: "Agregar Nueva Operación" at the bottom of the table */}
            {!readOnly && (
                <tr key="ghost-add-operation">
                    <td colSpan={2} className={`${ghostCellClass} sticky left-0 z-[5] bg-blue-50/30`}>
                        <button
                            onClick={amfe.addOperation}
                            className="w-full text-left text-sm text-blue-500 hover:text-blue-700 hover:bg-blue-100/50 px-3 py-2 rounded transition-colors flex items-center gap-2 font-semibold"
                        >
                            <Plus size={16} className="text-blue-400" />
                            <span>Agregar Nueva Operación</span>
                        </button>
                    </td>
                    <td colSpan={restColSpan} className="border-b border-dashed border-gray-200 bg-blue-50/10" />
                </tr>
            )}

            {/* Right-click context menu (disabled in view mode) */}
            {!readOnly && ctxMenu && (() => {
                const items: { label: string; icon: React.ReactNode; action: () => void; color?: string }[] = [];
                const { opId, weId, funcId, failId, causeId } = ctxMenu;

                // Cause-level actions
                if (causeId && failId && funcId && weId) {
                    items.push(
                        { label: 'Duplicar Causa', icon: <Copy size={12} />, action: () => amfe.duplicateCause(opId, weId, funcId, failId, causeId) },
                        { label: 'Eliminar Causa', icon: <Trash2 size={12} />, action: () => confirmDeleteCause(opId, weId, funcId, failId, causeId), color: 'text-red-600' },
                        { label: '+ Causa', icon: <Plus size={12} />, action: () => amfe.addCause(opId, weId, funcId, failId), color: 'text-orange-600' },
                    );
                }
                // Failure-level actions
                if (failId && funcId && weId) {
                    items.push(
                        { label: 'Duplicar Falla', icon: <Copy size={12} />, action: () => amfe.duplicateFailure(opId, weId, funcId, failId) },
                        { label: 'Eliminar Falla', icon: <Trash2 size={12} />, action: () => confirmDeleteFailure(opId, weId, funcId, failId), color: 'text-red-600' },
                        { label: '+ Modo de Falla', icon: <Plus size={12} />, action: () => amfe.addFailure(opId, weId, funcId), color: 'text-red-500' },
                    );
                }
                // Function-level actions
                if (funcId && weId) {
                    items.push(
                        { label: 'Duplicar Función', icon: <Copy size={12} />, action: () => amfe.duplicateFunction(opId, weId, funcId) },
                        { label: 'Eliminar Función', icon: <Trash2 size={12} />, action: () => confirmDeleteFunc(opId, weId, funcId), color: 'text-red-600' },
                        { label: '+ Función', icon: <Plus size={12} />, action: () => amfe.addFunction(opId, weId), color: 'text-green-600' },
                    );
                }
                // WE-level actions
                if (weId) {
                    items.push(
                        { label: 'Eliminar Elem. Trabajo', icon: <Trash2 size={12} />, action: () => confirmDeleteWE(opId, weId), color: 'text-red-600' },
                    );
                }
                // Op-level actions (always available)
                items.push(
                    { label: 'Duplicar Operación', icon: <Copy size={12} />, action: () => amfe.duplicateOperation(opId) },
                    { label: 'Eliminar Operación', icon: <Trash2 size={12} />, action: () => confirmDeleteOp(opId), color: 'text-red-600' },
                    { label: '+ Operación', icon: <Plus size={12} />, action: () => amfe.addOperation(), color: 'text-blue-600' },
                );

                return (
                    <tr style={{ display: 'contents' }}>
                        <td colSpan={restColSpan} style={{ padding: 0, border: 'none' }}>
                            <div ref={ctxRef} className="fixed z-[100] bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[180px] text-xs" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
                                {items.map((item, i) => (
                                    <React.Fragment key={i}>
                                        {/* Separator between hierarchy levels */}
                                        {i > 0 && items[i - 1].label.startsWith('+') && <div className="border-t border-gray-100 my-0.5" />}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); item.action(); setCtxMenu(null); }}
                                            className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 transition ${item.color || 'text-gray-700'}`}
                                        >
                                            {item.icon}
                                            {item.label}
                                        </button>
                                    </React.Fragment>
                                ))}
                            </div>
                        </td>
                    </tr>
                );
            })()}
        </tbody>
    );
};

export default memo(AmfeTableBody);
