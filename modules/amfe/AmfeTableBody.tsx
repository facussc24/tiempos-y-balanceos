import React, { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { AmfeOperation, AmfeWorkElement, AmfeFunction, AmfeFailure, AmfeCause, AMFE_STATUS_OPTIONS, WORK_ELEMENT_TYPES, WORK_ELEMENT_LABELS, WorkElementType, EFFECT_LABELS } from './amfeTypes';
import { clampSOD, getFailureWarnings, getCauseValidationState, CauseValidationState } from './amfeValidation';
import { AlertTriangle } from 'lucide-react';
import { useAmfe } from './useAmfe';
import { Trash2, Plus, Copy, ChevronRight, ChevronDown } from 'lucide-react';
import AutoResizeTextarea from './AutoResizeTextarea';
import SuggestableTextarea from './SuggestableTextarea';
import { SuggestionIndex, SuggestionContext } from './amfeSuggestionEngine';
import { ColumnGroupVisibility, COLUMN_COUNTS } from './useAmfeColumnVisibility';
import { inferOperationCategory } from '../../utils/processCategory';
import { WE_ICONS, getApColor, getApBarColor, getApLabel, getSODColor, getCauseRowBorderClass, computeOpSummary, hasSubSeverities, CauseValidationIcon, TAB_ACTIVE_CLASSES, TAB_DOT_CLASSES, TAB_BORDER_CLASSES, TAB_LABEL_CLASSES, TAB_SEV_HIGH_CLASSES } from './amfeTableHelpers';
import AmfeContextMenu, { CtxTarget } from './AmfeContextMenu';
import { InheritanceBadge } from '../../components/ui/InheritanceBadge';
import type { InheritanceStatusMap } from '../../hooks/useInheritanceStatus';

interface Props {
    operations: AmfeOperation[];
    amfe: ReturnType<typeof useAmfe>;
    requestConfirm: (options: { title: string; message: string; variant?: 'danger' | 'warning' | 'info'; confirmText?: string }) => Promise<boolean>;
    columnVisibility?: ColumnGroupVisibility;
    suggestionIndex?: SuggestionIndex | null;
    collapsedOps?: Set<string>;
    onToggleCollapse?: (opId: string) => void;
    readOnly?: boolean;
    /** Operation IDs with broken PFD links (for visual warning) */
    brokenLinkOpIds?: Set<string>;
    /** Inheritance status map for variant documents (null = not a variant) */
    inheritanceStatusMap?: InheritanceStatusMap | null;
}

// inferOperationCategory re-exported from utils/processCategory
export { inferOperationCategory } from '../../utils/processCategory';

const AmfeTableBody: React.FC<Props> = ({ operations, amfe, requestConfirm, columnVisibility, suggestionIndex, collapsedOps, onToggleCollapse, readOnly = false, brokenLinkOpIds, inheritanceStatusMap }) => {
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
    //
    // Rediseno UI 2026-04-26 (Etapa 3a):
    // - Tipografia base text-xs (12px) -> text-[13px] en celdas con texto largo.
    // - Metadata sigue 11px (responsable, plazo). Numeros S/O/D usan font mono.
    // - Modo lectura: padding mas generoso, font igual de grande.
    // - Modo edicion: padding compacto, font igual.
    const cls = useMemo(() => {
        const cell = readOnly
            ? "px-2 py-2 border-r border-b border-gray-200 align-top text-[13px] min-h-[32px]"
            : "p-1 border-r border-b border-gray-200 align-top text-[13px]";
        return {
            cell,
            textArea: "w-full min-h-[40px] bg-transparent outline-none text-[13px] font-medium text-slate-700 placeholder-slate-300 focus:bg-white focus:ring-1 focus:ring-blue-200 rounded px-1 transition-colors leading-relaxed",
            textSpan: "text-[13px] font-normal text-slate-800 leading-relaxed whitespace-pre-wrap break-words",
            opNum: `${cell} ${readOnly ? 'bg-slate-100' : 'bg-slate-50'} sticky left-0 z-[5] w-24 min-w-[96px]`,
            opName: `${cell} ${readOnly ? 'bg-slate-100' : 'bg-slate-50'} sticky left-[96px] z-[5] w-48 min-w-[192px] border-r-2 border-r-slate-300`,
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

    /** Broken PFD link badge for operation cells */
    const BrokenPfdBadge = useCallback(({ opId }: { opId: string }) => {
        if (!brokenLinkOpIds?.has(opId)) return null;
        return (
            <span className="inline-flex items-center gap-0.5 bg-orange-100 text-orange-700 border border-orange-300 text-[9px] font-bold px-1 py-0.5 rounded mt-0.5" title="Vínculo PFD roto: el paso vinculado no existe">
                <AlertTriangle size={9} />PFD
            </span>
        );
    }, [brokenLinkOpIds]);

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
    const [ctxMenu, setCtxMenu] = useState<CtxTarget | null>(null);

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

    /**
     * Render AP cell — barra lateral 1px de color + texto humano (Alta/Media/Baja).
     *
     * Rediseno UI 2026-04-26: AP deja de ser pill agresivo. Ahora es ancla de
     * prioridad — debe leerse rapido sin gritar. La barra se rendera en la celda
     * padre con position: relative (renderAPBadge se llama dentro de un <td>).
     */
    const renderAPBadge = (ap: string) => (
        <div className="relative pl-2 py-0.5">
            <span
                className={`absolute left-0 top-0 bottom-0 w-1 rounded-sm ${getApBarColor(ap)}`}
                aria-hidden="true"
            />
            <span className={`text-[11px] ${getApColor(ap)}`} title={`AP=${ap || '?'}`}>
                {ap ? getApLabel(ap) : '—'}
            </span>
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

    // Cache inferOperationCategory per operation name to avoid regex per cause cell
    const opCategoryMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const op of operations) {
            const opName = op.name ?? '';
            if (opName && !map.has(opName)) {
                map.set(opName, inferOperationCategory(opName) ?? '');
            }
        }
        return map;
    }, [operations]);

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
            existingValues: existingValues ? [...existingValues].sort() : undefined,
            functionDescription: func.description,
            functionRequirements: func.requirements || undefined,
            severity: sev || undefined,
            occurrence: cause ? (Number(cause.occurrence) || undefined) : undefined,
            detection: cause ? (Number(cause.detection) || undefined) : undefined,
            causeText: cause?.cause || undefined,
            effectsContext: effectsSummary || undefined,
            operationCategory: opCategoryMap.get(op.name) ?? inferOperationCategory(op.name),
        };
    };

    /** Render the effects cell with tab-based UI (Local/Cliente/Usuario) */
    const renderEffectsCell = (op: AmfeOperation, we: AmfeWorkElement, func: AmfeFunction, fail: AmfeFailure, rowSpan: number) => {
        const sL = Number(fail.severityLocal) || 0;
        const sN = Number(fail.severityNextLevel) || 0;
        const sE = Number(fail.severityEndUser) || 0;
        const maxS = Math.max(sL, sN, sE);
        const tab = getEffectTab(fail.id);

        // Class maps defined as module-level constants (TAB_*_CLASSES)

        const tabs = [
            { label: 'Local', sev: sL, value: fail.effectLocal, sevField: 'severityLocal' as const, field: 'effectLocal' as const, sugField: 'effectLocal' as const, placeholder: 'Efecto en planta propia', existing: func.failures.map(f => f.effectLocal).filter(Boolean) },
            { label: 'Cliente', sev: sN, value: fail.effectNextLevel, sevField: 'severityNextLevel' as const, field: 'effectNextLevel' as const, sugField: 'effectNextLevel' as const, placeholder: 'Efecto en planta cliente', existing: func.failures.map(f => f.effectNextLevel).filter(Boolean) },
            { label: 'Usuario', sev: sE, value: fail.effectEndUser, sevField: 'severityEndUser' as const, field: 'effectEndUser' as const, sugField: 'effectEndUser' as const, placeholder: 'Efecto en usuario final', existing: func.failures.map(f => f.effectEndUser).filter(Boolean) },
        ];
        const active = tabs[tab];

        // VIEW MODE: stacked display instead of tabs
        if (readOnly) {
            return (
                <td className={cellClass} rowSpan={rowSpan} data-field="failureEffect">
                    <div className="flex flex-col gap-1">
                        {tabs.map((t, i) => {
                            const text = String(t.value || '').trim();
                            if (!text && t.sev === 0) return null;
                            return (
                                <div key={i} className={`border-l-2 ${TAB_BORDER_CLASSES[i]} pl-1.5`}>
                                    <div className="flex items-center gap-1 mb-0.5">
                                        <span className={`text-[9px] font-semibold ${TAB_LABEL_CLASSES[i]}`}>{t.label}</span>
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
            <td className={cellClass} rowSpan={rowSpan} data-field="failureEffect">
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
                                    isActive ? TAB_ACTIVE_CLASSES[i] : 'border-transparent text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                {hasFill && <span className={`inline-block w-1.5 h-1.5 rounded-full ${TAB_DOT_CLASSES[i]}`} />}
                                {t.label}
                                {t.sev > 0 && <span className="text-[8px] ml-0.5 opacity-60">{t.sev}</span>}
                            </button>
                        );
                    })}
                </div>
                {/* Active tab content */}
                <div className={`border-l-2 ${TAB_BORDER_CLASSES[tab]} pl-1.5`}>
                    <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[10px] font-semibold ${TAB_LABEL_CLASSES[tab]} leading-tight`}>{EFFECT_LABELS[active.field]}</span>
                        <input
                            type="number" min={1} max={10} step={1}
                            value={fail[active.sevField] ?? ''}
                            onChange={e => handleSubSeverityChange(op.id, we.id, func.id, fail.id, active.sevField, e.target.value)}
                            className={`w-8 text-center outline-none text-[10px] p-0.5 rounded border ${active.sev > 0 && active.sev === maxS ? TAB_SEV_HIGH_CLASSES[tab] : 'border-gray-200 bg-gray-50'}`}
                            aria-label={`Severidad ${active.label} (S) 1-10`}
                            placeholder="S"
                        />
                    </div>
                    <SuggestableTextarea value={active.value} onChange={e => amfe.updateFailure(op.id, we.id, func.id, fail.id, active.field, e.target.value)} onValueChange={v => amfe.updateFailure(op.id, we.id, func.id, fail.id, active.field, v)} suggestionIndex={sIdx} suggestionField={active.sugField} suggestionContext={buildSugCtx(op, we, func, fail, undefined, active.existing)} className={textAreaClass} placeholder={active.placeholder} aria-label={`Efecto ${active.label} — ${op.opNumber}`} />
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
    const renderCauseCells = (op: AmfeOperation, we: AmfeWorkElement, func: AmfeFunction, fail: AmfeFailure, cause: AmfeCause, validation: CauseValidationState | null | undefined, isFirstCause: boolean, failRows: number) => (
        <>
            {/* Step 4: FC (Failure Cause) — per-row, VDA standard */}
            {v.step4 && <td className={`${cellClass} bg-orange-50/5`} data-field="cause">
                <div className="flex justify-between group/cause">
                    {renderText(cause.cause, <SuggestableTextarea value={cause.cause} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'cause', e.target.value)} onValueChange={v => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'cause', v)} suggestionIndex={sIdx} suggestionField="cause" suggestionContext={buildSugCtx(op, we, func, fail, undefined, fail.causes.map(c => c.cause).filter(Boolean))} className={`${textAreaClass} text-orange-900 bg-orange-50/30`} placeholder="Por que fallo? (ej: Sensor descalibrado)" aria-label={`Causa (FC) — ${op.opNumber}`} />)}
                    {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/cause:opacity-100">
                        <button onClick={() => amfe.duplicateCause(op.id, we.id, func.id, fail.id, cause.id)} className="text-gray-300 hover:text-blue-500 hover:bg-blue-50 p-0.5 rounded transition" title="Duplicar causa" aria-label="Duplicar causa"><Copy size={10} /></button>
                        <button onClick={() => confirmDeleteCause(op.id, we.id, func.id, fail.id, cause.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition" title="Eliminar causa" aria-label="Eliminar causa"><Trash2 size={10} /></button>
                    </div>}
                </div>
            </td>}
            {/* Step 5: S (rowSpan per failure), PC, O, DC, D, AP, Car.Especiales */}
            {v.step5 && <>
                {isFirstCause && (
                    <td className={`${cellClass} bg-yellow-50/10`} rowSpan={failRows} data-field="severity">
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
                            {getFailureWarnings(fail).length > 0 && (
                                <div className="mt-0.5" title={getFailureWarnings(fail).join('\n')}>
                                    <AlertTriangle size={10} className="text-amber-500 mx-auto" />
                                </div>
                            )}
                        </>)}
                    </td>
                )}
                <td className={`${cellClass} bg-yellow-50/10`} data-field="preventionControl">
                    {renderText(cause.preventionControl, <SuggestableTextarea value={cause.preventionControl} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'preventionControl', e.target.value)} onValueChange={v => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'preventionControl', v)} suggestionIndex={sIdx} suggestionField="preventionControl" suggestionContext={buildSugCtx(op, we, func, fail, cause, fail.causes.map(c => c.preventionControl).filter(Boolean))} className={textAreaClass} placeholder="Control preventivo (ej: Calibración semanal)" aria-label={`Control Preventivo (PC) — ${op.opNumber}`} />)}
                </td>
                <td className={`${cellClass} bg-yellow-50/10`} data-field="occurrence">{renderSODBadge(cause.occurrence, renderCauseSODInput(op.id, we.id, func.id, fail.id, cause.id, 'occurrence', cause.occurrence, 'Ocurrencia (O) 1-10'))}</td>
                <td className={`${cellClass} bg-yellow-50/10`} data-field="detectionControl">
                    {renderText(cause.detectionControl, <SuggestableTextarea value={cause.detectionControl} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'detectionControl', e.target.value)} onValueChange={v => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'detectionControl', v)} suggestionIndex={sIdx} suggestionField="detectionControl" suggestionContext={buildSugCtx(op, we, func, fail, cause, fail.causes.map(c => c.detectionControl).filter(Boolean))} className={textAreaClass} placeholder="Control detección (ej: Inspección visual 100%)" aria-label={`Control Detección (DC) — ${op.opNumber}`} />)}
                </td>
                <td className={`${cellClass} bg-yellow-50/10`} data-field="detection">{renderSODBadge(cause.detection, renderCauseSODInput(op.id, we.id, func.id, fail.id, cause.id, 'detection', cause.detection, 'Detección (D) 1-10'))}</td>
                <td className={`${cellClass} text-center align-middle`} data-field="ap">
                    <div className="flex items-center justify-center gap-0.5">
                        {renderAPBadge(cause.ap as string)}
                        {validation && <CauseValidationIcon validation={validation} />}
                    </div>
                </td>
                <td className={`${cellClass} bg-yellow-50/10`} data-field="specialChar">
                    {readOnly
                        ? <span className={`text-[10px] text-center block font-bold ${cause.specialChar === 'CC' ? 'text-red-600' : cause.specialChar === 'SC' ? 'text-orange-600' : ''}`}>{cause.specialChar || '—'}</span>
                        : <>
                            <input value={cause.specialChar} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'specialChar', e.target.value)} className="w-full text-center outline-none bg-transparent text-[10px]" placeholder="-" aria-label="Característica especial (CC/SC)" />
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
                            {cause.characteristicNumber && <span className="text-[8px] text-gray-400 block text-center mt-0.5">#{cause.characteristicNumber}</span>}
                        </>
                    }
                </td>
            </>}
            {/* Step 6: Optimization */}
            {v.step6 && (() => {
                return <>
                    <td className={`${cellClass} bg-blue-50/10`} data-field="preventionAction">{renderText(cause.preventionAction, <AutoResizeTextarea value={cause.preventionAction} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'preventionAction', e.target.value)} className={textAreaClass} placeholder="Acción Preventiva" aria-label={`Acción Preventiva — ${op.opNumber}`} />)}</td>
                    <td className={`${cellClass} bg-blue-50/10`} data-field="detectionAction">{renderText(cause.detectionAction, <AutoResizeTextarea value={cause.detectionAction} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'detectionAction', e.target.value)} className={textAreaClass} placeholder="Acción Detectiva" aria-label={`Acción Detectiva — ${op.opNumber}`} />)}</td>
                    <td className={`${cellClass} bg-blue-50/10`} data-field="responsible">{renderText(cause.responsible, <AutoResizeTextarea value={cause.responsible} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'responsible', e.target.value)} className={textAreaClass} placeholder="Responsable" aria-label={`Responsable — ${op.opNumber}`} />)}</td>
                    <td className={`${cellClass} bg-blue-50/10`} data-field="targetDate">{readOnly ? <span className="text-[10px] text-center block">{cause.targetDate || '—'}</span> : <input type="date" value={cause.targetDate} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'targetDate', e.target.value)} className="w-full text-center outline-none bg-transparent text-[10px]" aria-label="Fecha objetivo" />}</td>
                    <td className={`${cellClass} bg-blue-50/10`} data-field="status">
                        {readOnly
                            ? <span className="text-[10px] text-center block">{cause.status || '—'}</span>
                            : <select value={cause.status} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'status', e.target.value)} className="w-full text-center outline-none bg-transparent text-[10px] cursor-pointer" aria-label="Estado de la acción">
                                <option value="">-</option>
                                {AMFE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        }
                    </td>
                    <td className={`${cellClass} bg-blue-50/10`} data-field="actionTaken">{renderText(cause.actionTaken, <AutoResizeTextarea value={cause.actionTaken} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'actionTaken', e.target.value)} className={textAreaClass} placeholder="Acción tomada y evidencia" aria-label={`Acción Tomada — ${op.opNumber}`} />)}</td>
                    <td className={`${cellClass} bg-blue-50/10`} data-field="completionDate">{readOnly ? <span className="text-[10px] text-center block">{cause.completionDate || '—'}</span> : <input type="date" value={cause.completionDate} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'completionDate', e.target.value)} className="w-full text-center outline-none bg-transparent text-[10px]" aria-label="Fecha de completado" />}</td>
                    <td className={`${cellClass} bg-blue-50/10`} data-field="severityNew">{renderSODBadge(cause.severityNew, renderCauseSODInput(op.id, we.id, func.id, fail.id, cause.id, 'severityNew', cause.severityNew, 'Severidad nueva (S) 1-10'))}</td>
                    <td className={`${cellClass} bg-blue-50/10`} data-field="occurrenceNew">{renderSODBadge(cause.occurrenceNew, renderCauseSODInput(op.id, we.id, func.id, fail.id, cause.id, 'occurrenceNew', cause.occurrenceNew, 'Ocurrencia nueva (O) 1-10'))}</td>
                    <td className={`${cellClass} bg-blue-50/10`} data-field="detectionNew">{renderSODBadge(cause.detectionNew, renderCauseSODInput(op.id, we.id, func.id, fail.id, cause.id, 'detectionNew', cause.detectionNew, 'Detección nueva (D) 1-10'))}</td>
                    <td className={`${cellClass} bg-blue-50/10 text-center align-middle`} data-field="apNew">{renderAPBadge(cause.apNew as string)}</td>
                </>;
            })()}
            {/* Observations */}
            {v.obs && <td className={`${cellClass} bg-gray-50/30`} data-field="observations">{renderText(cause.observations, <AutoResizeTextarea value={cause.observations} onChange={e => amfe.updateCause(op.id, we.id, func.id, fail.id, cause.id, 'observations', e.target.value)} className={textAreaClass} placeholder={(cause.ap === 'L' || !cause.ap) ? "Si no se requiere acción: 'Análisis concluido, controles actuales aceptables'" : "Observaciones"} />)}</td>}
        </>
    );

    /** Render empty cause-level columns (when failure has 0 causes) */
    const renderEmptyCauseCells = (op: AmfeOperation, we: AmfeWorkElement, func: AmfeFunction, fail: AmfeFailure, failRows: number) => (
        <>
            {v.step4 && <td className={`${cellClass} bg-orange-50/5`}>
                {readOnly
                    ? <span className="text-[10px] text-gray-300 italic">Sin causas</span>
                    : <button onClick={() => amfe.addCause(op.id, we.id, func.id, fail.id)} className="text-[10px] text-orange-600 hover:underline font-bold">+ Agregar Causa</button>
                }
            </td>}
            {v.step5 && <>
                <td className={`${cellClass} bg-yellow-50/10`} rowSpan={failRows}>
                    {renderSODBadge(fail.severity, <>
                        <input
                            type="number" min={1} max={10} step={1}
                            value={fail.severity}
                            onChange={e => handleSeverityChange(op.id, we.id, func.id, fail.id, e.target.value)}
                            readOnly={hasSubSeverities(fail)}
                            className={`w-full text-center outline-none text-xs p-0.5 rounded ${getSODColor(fail.severity)} ${hasSubSeverities(fail) ? 'bg-blue-50/50 cursor-not-allowed' : ''}`}
                            aria-label="Severidad (S) 1-10"
                        />
                    </>)}
                </td>
                <td className={`${cellClass} bg-yellow-50/10`} colSpan={6}></td>
            </>}
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
                    const { totalWE, totalFails, totalCauses, highAP } = computeOpSummary(op);

                    return (
                        <tr key={op.id} className={`hover:bg-gray-50 bg-slate-50/80 cursor-pointer${opSeparator}`} onClick={() => onToggleCollapse?.(op.id)} onContextMenu={readOnly ? undefined : e => openCtx(e, { opId: op.id })} data-amfe-row="operation" data-op={op.opNumber} data-op-id={op.id}>
                            <td className={opNumCellClass} data-field="opNumber">
                                <div className="flex items-center gap-1">
                                    <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                                    <span className="text-xs font-bold text-slate-700">{op.opNumber || '?'}</span>
                                    {brokenLinkOpIds?.has(op.id) && <span title="Vínculo PFD roto"><AlertTriangle size={11} className="text-orange-500 flex-shrink-0" /></span>}
                                </div>
                            </td>
                            <td className={opNameCellClass} style={opNameShadow} data-field="opName">
                                <span className="text-xs font-semibold text-slate-700">{op.name || '(sin nombre)'}</span>
                            </td>
                            <td className={cellClass} colSpan={restColSpan}>
                                <div className="flex items-center gap-3 text-[10px] text-gray-500 py-0.5">
                                    <span>{totalWE} elem.</span>
                                    <span>{totalFails} fallas</span>
                                    <span>{totalCauses} causas</span>
                                    {highAP > 0 && <span className="bg-red-100 text-red-700 px-1.5 rounded font-bold whitespace-nowrap">{highAP} AP=H</span>}
                                </div>
                            </td>
                        </tr>
                    );
                }

                // If Op has no children, render a blank row with 6M selector
                if (op.workElements.length === 0) {
                    return (
                        <tr key={op.id} className={`hover:bg-gray-50${opSeparator}`} onContextMenu={readOnly ? undefined : e => openCtx(e, { opId: op.id })} data-amfe-row="operation" data-op={op.opNumber} data-op-id={op.id}>
                            <td className={opNumCellClass} data-field="opNumber">
                                <div className="flex justify-between items-start group/op">
                                    {renderText(op.opNumber, <AutoResizeTextarea value={op.opNumber} onChange={e => amfe.updateOp(op.id, 'opNumber', e.target.value)} className={textAreaClass} placeholder="Op #" />)}
                                    {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/op:opacity-100">
                                        <button onClick={() => amfe.duplicateOperation(op.id)} className="text-gray-300 hover:text-blue-500 hover:bg-blue-50 p-0.5 rounded transition" title="Duplicar Operación" aria-label="Duplicar Operación"><Copy size={12} /></button>
                                        <button onClick={() => confirmDeleteOp(op.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition" title="Eliminar" aria-label="Eliminar"><Trash2 size={12} /></button>
                                    </div>}
                                </div>
                                <BrokenPfdBadge opId={op.id} />
                                {inheritanceStatusMap?.items.get(op.id) && (
                                    <InheritanceBadge status={inheritanceStatusMap.items.get(op.id)!} compact className="mt-0.5" />
                                )}
                            </td>
                            <td className={opNameCellClass} style={opNameShadow} data-field="opName">
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
                            <tr key={we.id} className={`hover:bg-gray-50${rowSep}`} onContextMenu={readOnly ? undefined : e => openCtx(e, { opId: op.id, weId: we.id })} data-amfe-row="workElement" data-op={op.opNumber} data-we-type={we.type}>
                                {isFirstWE && (
                                    <>
                                        <td rowSpan={opRows} className={opNumCellClass} data-field="opNumber">
                                            {onToggleCollapse && <button onClick={() => onToggleCollapse(op.id)} className="text-gray-400 hover:text-gray-600 mb-0.5 block" title="Colapsar operación" aria-label="Colapsar operación"><ChevronDown size={12} /></button>}
                                            <div className="flex justify-between items-start group/op">
                                                {renderText(op.opNumber, <AutoResizeTextarea value={op.opNumber} onChange={e => amfe.updateOp(op.id, 'opNumber', e.target.value)} className={textAreaClass} placeholder="Op #" />)}
                                                {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/op:opacity-100">
                                                    <button onClick={() => amfe.duplicateOperation(op.id)} className="text-gray-300 hover:text-blue-500 hover:bg-blue-50 p-0.5 rounded transition" title="Duplicar Operación" aria-label="Duplicar Operación"><Copy size={12} /></button>
                                                    <button onClick={() => confirmDeleteOp(op.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition" title="Eliminar" aria-label="Eliminar"><Trash2 size={12} /></button>
                                                </div>}
                                            </div>
                                            <BrokenPfdBadge opId={op.id} />
                                            {inheritanceStatusMap?.items.get(op.id) && (
                                                <InheritanceBadge status={inheritanceStatusMap.items.get(op.id)!} compact className="mt-0.5" />
                                            )}
                                        </td>
                                        <td rowSpan={opRows} className={opNameCellClass} style={opNameShadow} data-field="opName">
                                            {renderText(op.name, <AutoResizeTextarea value={op.name} onChange={e => amfe.updateOp(op.id, 'name', e.target.value)} className={textAreaClass} placeholder="Nombre Operación" />)}
                                        </td>
                                    </>
                                )}
                                <td className={cellClass} data-field="workElementName">
                                    <div className="flex gap-1 justify-between group/we">
                                        <div className="flex gap-1 flex-1">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase p-0.5">{(we.type || '').substring(0, 3)}</span>
                                            {renderText(we.name, <AutoResizeTextarea value={we.name} onChange={e => amfe.updateWorkElement(op.id, we.id, 'name', e.target.value)} className={textAreaClass} placeholder="Nombre Elemento" />)}
                                        </div>
                                        {!readOnly && <button onClick={() => confirmDeleteWE(op.id, we.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition opacity-0 group-hover/we:opacity-100" title="Eliminar" aria-label="Eliminar"><Trash2 size={12} /></button>}
                                    </div>
                                </td>
                                {v.step3 && <>
                                    {isFirstWE && <>
                                        <td rowSpan={opRows} className={cellClass}>
                                            {renderText(op.focusElementFunction || '', <AutoResizeTextarea value={op.focusElementFunction || ''} onChange={e => amfe.updateOp(op.id, 'focusElementFunction', e.target.value)} className={textAreaClass} placeholder="Función del Item" />)}
                                        </td>
                                        <td rowSpan={opRows} className={cellClass}>
                                            {renderText(op.operationFunction || '', <AutoResizeTextarea value={op.operationFunction || ''} onChange={e => amfe.updateOp(op.id, 'operationFunction', e.target.value)} className={textAreaClass} placeholder="Función del Paso" />)}
                                        </td>
                                    </>}
                                    <td className={cellClass}></td>
                                </>}
                                {v.step4 && <td colSpan={3} className={cellClass}></td>}
                                {v.step5 && <td colSpan={7} className={cellClass}></td>}
                                {v.step6 && <td colSpan={11} className={cellClass}></td>}
                                {v.obs && <td className={cellClass}></td>}
                            </tr>
                        );
                        // Ghost row: "Agregar Función" even when WE has no functions yet
                        if (!readOnly) {
                            opResult.push(
                                <tr key={`${we.id}-ghost-func`} data-testid={`ghost-add-func-${we.id}`} data-amfe-row="ghost" data-op={op.opNumber}>
                                    {v.step3 && <td className={ghostCellClass}>
                                        <button
                                            onClick={() => amfe.addFunction(op.id, we.id)}
                                            className="w-full text-left text-xs text-gray-400 hover:text-green-600 hover:bg-green-50/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                                            aria-label="Agregar función al elemento de trabajo"
                                        >
                                            <Plus size={12} className="text-green-400" />
                                            <span>Agregar Función</span>
                                        </button>
                                    </td>}
                                    {v.step4 && <td colSpan={3} className={ghostEmptyCell} />}
                                    {v.step5 && <td colSpan={7} className={ghostEmptyCell} />}
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
                                <tr key={func.id} className={`hover:bg-gray-50${rowSep}`} onContextMenu={readOnly ? undefined : e => openCtx(e, { opId: op.id, weId: we.id, funcId: func.id })} data-amfe-row="function" data-op={op.opNumber} data-we-type={we.type} data-func-index={funcIndex}>
                                    {isFirstWE && isFirstFunc && (
                                        <>
                                            <td rowSpan={opRows} className={opNumCellClass} data-field="opNumber">
                                                {onToggleCollapse && <button onClick={() => onToggleCollapse(op.id)} className="text-gray-400 hover:text-gray-600 mb-0.5 block" title="Colapsar operación" aria-label="Colapsar operación"><ChevronDown size={12} /></button>}
                                                <div className="flex justify-between items-start group/op">
                                                    {renderText(op.opNumber, <AutoResizeTextarea value={op.opNumber} onChange={e => amfe.updateOp(op.id, 'opNumber', e.target.value)} className={textAreaClass} placeholder="Op #" />)}
                                                    {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/op:opacity-100">
                                                        <button onClick={() => amfe.duplicateOperation(op.id)} className="text-gray-300 hover:text-blue-500 hover:bg-blue-50 p-0.5 rounded transition" title="Duplicar Operación" aria-label="Duplicar Operación"><Copy size={12} /></button>
                                                        <button onClick={() => confirmDeleteOp(op.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition" title="Eliminar" aria-label="Eliminar"><Trash2 size={12} /></button>
                                                    </div>}
                                                </div>
                                                <BrokenPfdBadge opId={op.id} />
                                                {inheritanceStatusMap?.items.get(op.id) && (
                                                    <InheritanceBadge status={inheritanceStatusMap.items.get(op.id)!} compact className="mt-0.5" />
                                                )}
                                            </td>
                                            <td rowSpan={opRows} className={opNameCellClass} style={opNameShadow} data-field="opName">
                                                {renderText(op.name, <AutoResizeTextarea value={op.name} onChange={e => amfe.updateOp(op.id, 'name', e.target.value)} className={textAreaClass} placeholder="Nombre Operación" />)}
                                            </td>
                                        </>
                                    )}
                                    {isFirstFunc && (
                                        <td rowSpan={weRows} className={cellClass} data-field="workElementName">
                                            <div className="flex gap-1 justify-between group/we">
                                                <div className="flex gap-1 flex-1">
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase p-0.5">{(we.type || '').substring(0, 3)}</span>
                                                    {renderText(we.name, <AutoResizeTextarea value={we.name} onChange={e => amfe.updateWorkElement(op.id, we.id, 'name', e.target.value)} className={textAreaClass} placeholder="Nombre Elemento" />)}
                                                </div>
                                                {!readOnly && <button onClick={() => confirmDeleteWE(op.id, we.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition opacity-0 group-hover/we:opacity-100" title="Eliminar" aria-label="Eliminar"><Trash2 size={12} /></button>}
                                            </div>
                                        </td>
                                    )}
                                    {v.step3 && <>
                                        {isFirstWE && isFirstFunc && <>
                                            <td rowSpan={opRows} className={cellClass}>
                                                {renderText(op.focusElementFunction || '', <AutoResizeTextarea value={op.focusElementFunction || ''} onChange={e => amfe.updateOp(op.id, 'focusElementFunction', e.target.value)} className={textAreaClass} placeholder="Función del Item" />)}
                                            </td>
                                            <td rowSpan={opRows} className={cellClass}>
                                                {renderText(op.operationFunction || '', <AutoResizeTextarea value={op.operationFunction || ''} onChange={e => amfe.updateOp(op.id, 'operationFunction', e.target.value)} className={textAreaClass} placeholder="Función del Paso" />)}
                                            </td>
                                        </>}
                                        <td rowSpan={funcRows} className={cellClass} data-field="functionDescription">
                                            <div className="flex justify-between group/func">
                                                {renderText(func.description, <AutoResizeTextarea value={func.description} onChange={e => amfe.updateFunction(op.id, we.id, func.id, 'description', e.target.value)} className={textAreaClass} placeholder="Función del Elem. Trabajo" />)}
                                                {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/func:opacity-100">
                                                    <button onClick={() => amfe.duplicateFunction(op.id, we.id, func.id)} className="text-gray-300 hover:text-blue-500 hover:bg-blue-50 p-0.5 rounded transition" title="Duplicar" aria-label="Duplicar"><Copy size={12} /></button>
                                                    <button onClick={() => confirmDeleteFunc(op.id, we.id, func.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition" title="Eliminar" aria-label="Eliminar"><Trash2 size={12} /></button>
                                                </div>}
                                            </div>
                                        </td>
                                    </>}
                                    {v.step4 && <td colSpan={3} className={cellClass}></td>}
                                    {v.step5 && <td colSpan={7} className={cellClass}></td>}
                                    {v.step6 && <td colSpan={11} className={cellClass}></td>}
                                    {v.obs && <td className={cellClass}></td>}
                                </tr>
                            );
                            // Ghost row: "Agregar Modo de Falla" when function has no failures
                            if (!readOnly) {
                                opResult.push(
                                    <tr key={`${func.id}-ghost-fail`} data-testid={`ghost-add-fail-${func.id}`} data-amfe-row="ghost" data-op={op.opNumber}>
                                        {v.step4 && <td className={ghostCellClass}>
                                            <button
                                                onClick={() => amfe.addFailure(op.id, we.id, func.id)}
                                                className="w-full text-left text-xs text-gray-400 hover:text-red-600 hover:bg-red-50/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                                                aria-label="Agregar modo de falla a la función"
                                            >
                                                <Plus size={12} className="text-red-400" />
                                                <span>Agregar Modo de Falla</span>
                                            </button>
                                        </td>}
                                        {v.step4 && <td colSpan={2} className={ghostEmptyCell} />}
                                        {v.step5 && <td colSpan={7} className={ghostEmptyCell} />}
                                        {v.step6 && <td colSpan={11} className={ghostEmptyCell} />}
                                        {v.obs && <td className={ghostEmptyCell} />}
                                    </tr>
                                );
                            }
                            return;
                        }

                        // --- Render failures with nested causes ---
                        let isFirstFailInFunc = true;

                        for (let failIdx = 0; failIdx < func.failures.length; failIdx++) {
                            const fail = func.failures[failIdx];
                            const failRows = getFailureRowCount(fail);
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
                                    <tr key={cause ? cause.id : `${fail.id}-empty`} className={`hover:bg-gray-50 group ${causeRowBorder}${rowSep}${zebraClass}`} onContextMenu={readOnly ? undefined : e => openCtx(e, { opId: op.id, weId: we.id, funcId: func.id, failId: fail.id, causeId: cause?.id })} data-amfe-row="cause" data-op={op.opNumber} data-we-type={we.type} data-fail-index={failIdx} data-cause-index={causeIndex}>
                                        {/* OPERATION COLUMNS */}
                                        {isFirstWE && isFirstFunc && isFirstFailRow && (
                                            <>
                                                <td rowSpan={opRows} className={opNumCellClass} data-field="opNumber">
                                                    {onToggleCollapse && <button onClick={() => onToggleCollapse(op.id)} className="text-gray-400 hover:text-gray-600 mb-0.5 block" title="Colapsar operación" aria-label="Colapsar operación"><ChevronDown size={12} /></button>}
                                                    <div className="flex justify-between items-start group/op">
                                                        {renderText(op.opNumber, <AutoResizeTextarea value={op.opNumber} onChange={e => amfe.updateOp(op.id, 'opNumber', e.target.value)} className={textAreaClass} placeholder="Op #" />)}
                                                        {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/op:opacity-100">
                                                            <button onClick={() => amfe.duplicateOperation(op.id)} className="text-gray-300 hover:text-blue-500 hover:bg-blue-50 p-0.5 rounded transition" title="Duplicar Operación" aria-label="Duplicar Operación"><Copy size={12} /></button>
                                                            <button onClick={() => confirmDeleteOp(op.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition" title="Eliminar" aria-label="Eliminar"><Trash2 size={12} /></button>
                                                        </div>}
                                                    </div>
                                                    <BrokenPfdBadge opId={op.id} />
                                                    {inheritanceStatusMap?.items.get(op.id) && (
                                                        <InheritanceBadge status={inheritanceStatusMap.items.get(op.id)!} compact className="mt-0.5" />
                                                    )}
                                                </td>
                                                <td rowSpan={opRows} className={opNameCellClass} style={opNameShadow} data-field="opName">
                                                    {renderText(op.name, <AutoResizeTextarea value={op.name} onChange={e => amfe.updateOp(op.id, 'name', e.target.value)} className={textAreaClass} placeholder="Nombre Operación" />)}
                                                </td>
                                            </>
                                        )}

                                        {/* WORK ELEMENT COLUMN */}
                                        {isFirstFunc && isFirstFailRow && (
                                            <td rowSpan={weRows} className={`${cellClass} ${readOnly ? 'bg-slate-50/60 min-w-[140px] border-l border-l-slate-200' : ''}`} data-field="workElementName">
                                                <div className="flex gap-1 justify-between group/we">
                                                    <div className="flex gap-1 flex-1 items-start">
                                                        <span className={`text-[9px] font-bold uppercase shrink-0 ${readOnly ? 'bg-slate-200 text-slate-600 px-1 py-0.5 rounded' : 'text-gray-400 p-0.5'}`}>{(we.type || '').substring(0, 3)}</span>
                                                        {renderText(we.name, <AutoResizeTextarea value={we.name} onChange={e => amfe.updateWorkElement(op.id, we.id, 'name', e.target.value)} className={textAreaClass} placeholder="Nombre Elemento" />)}
                                                    </div>
                                                    {!readOnly && <button onClick={() => confirmDeleteWE(op.id, we.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition opacity-0 group-hover/we:opacity-100" title="Eliminar" aria-label="Eliminar"><Trash2 size={12} /></button>}
                                                </div>
                                            </td>
                                        )}

                                        {/* STEP 3: FUNCTION COLUMNS (3 cols per VDA) */}
                                        {v.step3 && <>
                                            {/* Func Item + Func Paso: rowSpan per operation */}
                                            {isFirstWE && isFirstFunc && isFirstFailRow && <>
                                                <td rowSpan={opRows} className={cellClass}>
                                                    {renderText(op.focusElementFunction || '', <AutoResizeTextarea value={op.focusElementFunction || ''} onChange={e => amfe.updateOp(op.id, 'focusElementFunction', e.target.value)} className={textAreaClass} placeholder="Función del Item (ej: Asegurar integridad del producto)" />)}
                                                </td>
                                                <td rowSpan={opRows} className={cellClass}>
                                                    {renderText(op.operationFunction || '', <AutoResizeTextarea value={op.operationFunction || ''} onChange={e => amfe.updateOp(op.id, 'operationFunction', e.target.value)} className={textAreaClass} placeholder="Función del Paso y Car. Producto" />)}
                                                </td>
                                            </>}
                                            {/* Func Elem. Trabajo: rowSpan per function */}
                                            {isFirstFailRow && (
                                                <td rowSpan={funcRows} className={cellClass} data-field="functionDescription">
                                                    <div className="flex justify-between group/func">
                                                        {renderText(func.description, <AutoResizeTextarea value={func.description} onChange={e => amfe.updateFunction(op.id, we.id, func.id, 'description', e.target.value)} className={textAreaClass} placeholder="Función del Elem. Trabajo y Car. Proceso" />)}
                                                        {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/func:opacity-100">
                                                            <button onClick={() => amfe.duplicateFunction(op.id, we.id, func.id)} className="text-gray-300 hover:text-blue-500 hover:bg-blue-50 p-0.5 rounded transition" title="Duplicar" aria-label="Duplicar"><Copy size={12} /></button>
                                                            <button onClick={() => confirmDeleteFunc(op.id, we.id, func.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition" title="Eliminar" aria-label="Eliminar"><Trash2 size={12} /></button>
                                                        </div>}
                                                    </div>
                                                </td>
                                            )}
                                        </>}

                                        {/* STEP 4: FAILURE-LEVEL COLUMNS (FE, FM) — only on first cause row */}
                                        {isFirstCause && v.step4 && (
                                            <>
                                                {/* EFFECTS (merged single column with 3 labeled textareas) */}
                                                {renderEffectsCell(op, we, func, fail, failRows)}

                                                {/* FAILURE MODE (FM) */}
                                                <td className={cellClass} rowSpan={failRows} data-field="failureMode">
                                                    <div className="flex justify-between group/fail">
                                                        {renderText(fail.description, <SuggestableTextarea value={fail.description} onChange={e => amfe.updateFailure(op.id, we.id, func.id, fail.id, 'description', e.target.value)} onValueChange={v => amfe.updateFailure(op.id, we.id, func.id, fail.id, 'description', v)} suggestionIndex={sIdx} suggestionField="failureDescription" suggestionContext={buildSugCtx(op, we, func, undefined, undefined, func.failures.map(f => f.description).filter(Boolean))} className={`${textAreaClass} font-bold text-red-900 bg-red-50/30`} placeholder="Negativo de la función (ej: No mantiene temp)" aria-label={`Modo de Falla (FM) — ${op.opNumber}`} />)}
                                                        {!readOnly && <div className="flex flex-col gap-1 opacity-0 group-hover/fail:opacity-100">
                                                            <button onClick={() => amfe.duplicateFailure(op.id, we.id, func.id, fail.id)} className="text-gray-300 hover:text-blue-500 hover:bg-blue-50 p-0.5 rounded transition" title="Duplicar" aria-label="Duplicar"><Copy size={12} /></button>
                                                            <button onClick={() => confirmDeleteFailure(op.id, we.id, func.id, fail.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-0.5 rounded transition" title="Eliminar" aria-label="Eliminar"><Trash2 size={12} /></button>
                                                        </div>}
                                                    </div>
                                                </td>
                                            </>
                                        )}

                                        {/* CAUSE-LEVEL COLUMNS: FC (Step 4), S+PC+O+DC+D+AP+Car.Esp (Step 5), Step 6, Obs */}
                                        {cause ? renderCauseCells(op, we, func, fail, cause, causeValidation, isFirstCause, failRows) : renderEmptyCauseCells(op, we, func, fail, failRows)}
                                    </tr>
                                );
                            });

                            // 2A. Ghost row: "Agregar Causa" after each failure's causes
                            // Note: FE, FM (Step 4) and S (Step 5) cells are covered by rowSpan from above
                            if (!readOnly) {
                                opResult.push(
                                    <tr key={`${fail.id}-ghost-cause`} data-testid={`ghost-add-cause-${fail.id}`} data-amfe-row="ghost" data-op={op.opNumber}>
                                        {v.step4 && (
                                            <td className={ghostCellClass}>
                                                <button
                                                    onClick={() => amfe.addCause(op.id, we.id, func.id, fail.id)}
                                                    className="w-full text-left text-xs text-gray-400 hover:text-orange-600 hover:bg-orange-50/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                                                    aria-label="Agregar causa a la falla"
                                                >
                                                    <Plus size={12} className="text-orange-400" />
                                                    <span>Agregar Causa</span>
                                                </button>
                                            </td>
                                        )}
                                        {v.step5 && <td colSpan={6} className={ghostEmptyCell} />}
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
                                <tr key={`${func.id}-ghost-fail`} data-testid={`ghost-add-fail-${func.id}`} data-amfe-row="ghost" data-op={op.opNumber}>
                                    {v.step4 && <td colSpan={3} className={ghostCellClass}>
                                        <button
                                            onClick={() => amfe.addFailure(op.id, we.id, func.id)}
                                            className="w-full text-left text-xs text-gray-400 hover:text-red-600 hover:bg-red-50/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                                            aria-label="Agregar modo de falla a la función"
                                        >
                                            <Plus size={12} className="text-red-400" />
                                            <span>Agregar Modo de Falla</span>
                                        </button>
                                    </td>}
                                    {v.step5 && <td colSpan={7} className={ghostEmptyCell} />}
                                    {v.step6 && <td colSpan={11} className={ghostEmptyCell} />}
                                    {v.obs && <td className={ghostEmptyCell} />}
                                </tr>
                            );
                        }
                    });

                    // 2C. Ghost row: "Agregar Función" after each WE's functions
                    if (!readOnly && we.functions.length > 0) {
                        opResult.push(
                            <tr key={`${we.id}-ghost-func`} data-testid={`ghost-add-func-${we.id}`} data-amfe-row="ghost" data-op={op.opNumber}>
                                {v.step3 && <td className={ghostCellClass}>
                                    <button
                                        onClick={() => amfe.addFunction(op.id, we.id)}
                                        className="w-full text-left text-xs text-gray-400 hover:text-green-600 hover:bg-green-50/50 px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                                        aria-label="Agregar función al elemento de trabajo"
                                    >
                                        <Plus size={12} className="text-green-400" />
                                        <span>Agregar Función</span>
                                    </button>
                                </td>}
                                {v.step4 && <td colSpan={3} className={ghostEmptyCell} />}
                                {v.step5 && <td colSpan={7} className={ghostEmptyCell} />}
                                {v.step6 && <td colSpan={11} className={ghostEmptyCell} />}
                                {v.obs && <td className={ghostEmptyCell} />}
                            </tr>
                        );
                    }
                });

                // 2D. Ghost row: "Agregar 6M" after all WEs of this operation
                if (!readOnly) {
                    const ghostWeCols = 1 + (v.step3 ? 1 : 0) + (v.step4 ? 3 : 0) + (v.step5 ? 7 : 0) + (v.step6 ? 11 : 0) + (v.obs ? 1 : 0);
                    opResult.push(
                        <tr key={`${op.id}-ghost-we`} data-testid={`ghost-add-we-${op.id}`} data-amfe-row="ghost" data-op={op.opNumber}>
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
                <tr key="ghost-add-operation" data-testid="ghost-add-operation" data-amfe-row="ghost">
                    <td colSpan={2} className={`${ghostCellClass} sticky left-0 z-[5] bg-blue-50/30`}>
                        <button
                            onClick={amfe.addOperation}
                            className="w-full text-left text-sm text-blue-500 hover:text-blue-700 hover:bg-blue-100/50 px-3 py-2 rounded transition-colors flex items-center gap-2 font-semibold"
                            aria-label="Agregar nueva operación"
                        >
                            <Plus size={16} className="text-blue-400" />
                            <span>Agregar Nueva Operación</span>
                        </button>
                    </td>
                    <td colSpan={restColSpan} className="border-b border-dashed border-gray-200 bg-blue-50/10" />
                </tr>
            )}

            {/* Right-click context menu (disabled in view mode) */}
            {!readOnly && ctxMenu && (
                <AmfeContextMenu
                    ctxMenu={ctxMenu}
                    onClose={() => setCtxMenu(null)}
                    amfe={amfe}
                    confirmDeleteOp={confirmDeleteOp}
                    confirmDeleteWE={confirmDeleteWE}
                    confirmDeleteFunc={confirmDeleteFunc}
                    confirmDeleteFailure={confirmDeleteFailure}
                    confirmDeleteCause={confirmDeleteCause}
                    restColSpan={restColSpan}
                />
            )}
        </tbody>
    );
};

export default memo(AmfeTableBody);
