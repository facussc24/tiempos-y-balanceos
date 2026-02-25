/**
 * Control Plan Table Body
 *
 * Inline-editable table rows for Control Plan items.
 * 14 AIAG standard columns + actions. AI-eligible fields use SuggestableTextarea.
 * Supports View/Edit mode with sticky first two columns.
 * Row grouping: consecutive rows with same processStepNumber merge cols 0-1 via rowSpan.
 */

import React, { useCallback, useMemo } from 'react';
import { ControlPlanItem, CP_COLUMNS, CPColumnDef } from './controlPlanTypes';
import { CP_AI_FIELDS, CpSuggestionField } from './cpSuggestionTypes';
import { CpColumnGroupVisibility, CP_COLUMN_TO_GROUP } from './useCpColumnVisibility';
import { SuggestionQueryFn } from '../amfe/SuggestableTextarea';
import SuggestableTextarea from '../amfe/SuggestableTextarea';
import { Trash2, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';

interface Props {
    items: ControlPlanItem[];
    onUpdateItem: (itemId: string, field: keyof ControlPlanItem, value: string) => void;
    onRemoveItem: (itemId: string) => void;
    onMoveItem: (itemId: string, direction: 'up' | 'down') => void;
    aiEnabled?: boolean;
    buildQueryFn?: (item: ControlPlanItem, field: CpSuggestionField) => SuggestionQueryFn;
    readOnly?: boolean;
    columnVisibility?: CpColumnGroupVisibility;
}

/** Get AP badge color */
const getApColor = (ap: string) => {
    switch (ap) {
        case 'H': return 'bg-red-100 text-red-700 border-red-200';
        case 'M': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'L': return 'bg-green-100 text-green-700 border-green-200';
        default: return 'bg-gray-100 text-gray-400 border-gray-200';
    }
};

/** Get special char badge color */
const getSpecialCharColor = (sc: string) => {
    const upper = sc.toUpperCase().trim();
    if (upper === 'CC') return 'bg-red-100 text-red-700 font-bold';
    if (upper === 'SC') return 'bg-orange-100 text-orange-700 font-bold';
    return '';
};

/** Grouping info passed to each row */
interface RowGroupInfo {
    isGroupStart: boolean;
    groupSpan: number;
}

/** Compute row groups: consecutive items with same processStepNumber are merged. */
function computeRowGroups(items: ControlPlanItem[]): RowGroupInfo[] {
    const result: RowGroupInfo[] = new Array(items.length);
    let i = 0;
    while (i < items.length) {
        let j = i + 1;
        while (j < items.length && items[j].processStepNumber === items[i].processStepNumber && items[i].processStepNumber !== '') {
            j++;
        }
        const span = j - i;
        result[i] = { isGroupStart: true, groupSpan: span };
        for (let k = i + 1; k < j; k++) {
            result[k] = { isGroupStart: false, groupSpan: 0 };
        }
        i = j;
    }
    return result;
}

const ControlPlanTable: React.FC<Props> = ({ items, onUpdateItem, onRemoveItem, onMoveItem, aiEnabled = false, buildQueryFn, readOnly = false, columnVisibility }) => {
    const rowGroups = useMemo(() => computeRowGroups(items), [items]);

    if (items.length === 0) {
        return (
            <tbody>
                <tr>
                    <td colSpan={CP_COLUMNS.length + 1} className="text-center py-12 text-gray-400 text-sm">
                        No hay items en el Plan de Control.
                        <br />
                        <span className="text-xs">Genera desde el AMFE o agrega manualmente.</span>
                    </td>
                </tr>
            </tbody>
        );
    }

    return (
        <tbody>
            {items.map((item, idx) => (
                <ControlPlanRow
                    key={item.id}
                    item={item}
                    idx={idx}
                    total={items.length}
                    onUpdateItem={onUpdateItem}
                    onRemoveItem={onRemoveItem}
                    onMoveItem={onMoveItem}
                    aiEnabled={aiEnabled}
                    buildQueryFn={buildQueryFn}
                    readOnly={readOnly}
                    columnVisibility={columnVisibility}
                    groupInfo={rowGroups[idx]}
                />
            ))}
        </tbody>
    );
};

/** Single row — memoized to prevent re-renders of all rows on any change */
const ControlPlanRow: React.FC<{
    item: ControlPlanItem;
    idx: number;
    total: number;
    onUpdateItem: (itemId: string, field: keyof ControlPlanItem, value: string) => void;
    onRemoveItem: (itemId: string) => void;
    onMoveItem: (itemId: string, direction: 'up' | 'down') => void;
    aiEnabled: boolean;
    buildQueryFn?: (item: ControlPlanItem, field: CpSuggestionField) => SuggestionQueryFn;
    readOnly: boolean;
    columnVisibility?: CpColumnGroupVisibility;
    groupInfo: RowGroupInfo;
}> = React.memo(({ item, idx, total, onUpdateItem, onRemoveItem, onMoveItem, aiEnabled, buildQueryFn, readOnly, columnVisibility, groupInfo }) => {

    // Memoize class strings — only recompute when readOnly changes
    // max-w-0 + overflow-hidden on td: classic trick to force table-fixed cells to clip content
    const cls = useMemo(() => ({
        cellBase: readOnly
            ? 'px-2 py-2 border-r border-b border-gray-200 align-top text-xs max-w-0 overflow-hidden'
            : 'border border-gray-200 px-0 align-top max-w-0 overflow-hidden',
        textSpan: 'text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap break-words',
        input: 'w-full px-1.5 py-1.5 text-[10px] bg-transparent border-0 outline-none focus:bg-blue-50 transition truncate',
        stickyStep: `${readOnly ? 'px-2 py-2 border-r border-b border-gray-200 align-middle text-xs' : 'border border-gray-200 px-0 align-top'} ${readOnly ? 'bg-teal-50' : 'bg-white'} sticky left-0 z-[5] max-w-0 overflow-hidden`,
        stickyDesc: `${readOnly ? 'px-2 py-2 border-r border-b border-gray-200 align-middle text-xs' : 'border border-gray-200 px-0 align-top'} ${readOnly ? 'bg-teal-50' : 'bg-white'} sticky left-[80px] z-[5] max-w-0 overflow-hidden`,
    }), [readOnly]);

    const descShadow: React.CSSProperties = { boxShadow: readOnly ? '3px 0 6px rgba(0,0,0,0.08)' : '2px 0 4px rgba(0,0,0,0.04)' };

    /** Render text in view mode or input in edit mode */
    const renderText = useCallback((value: string, editElement: React.ReactNode) => {
        if (readOnly) {
            const text = (value || '').trim();
            return text
                ? <span className={cls.textSpan}>{text}</span>
                : <span className="text-xs text-gray-300 italic">—</span>;
        }
        return editElement;
    }, [readOnly, cls.textSpan]);

    const renderCell = useCallback((col: CPColumnDef, colIdx: number) => {
        // Check column visibility
        if (columnVisibility) {
            const group = CP_COLUMN_TO_GROUP[col.key];
            if (group && !columnVisibility[group]) return null;
        }

        const value = item[col.key] as string || '';
        const isEmpty = !value;
        const isOwnerField = col.key === 'reactionPlanOwner';
        const showCriticalRequired = !readOnly && isOwnerField && isEmpty;
        const showRequiredHint = !readOnly && !isOwnerField && col.required && isEmpty;
        const isAutoFilled = item.autoFilledFields?.includes(col.key) && !!value;
        const isAiField = CP_AI_FIELDS.has(col.key);

        // Sticky columns: processStepNumber (col 0), processDescription (col 1), machineDeviceTool (col 2)
        // Group consecutive rows with same processStepNumber: leader shows content, followers are merged/dimmed
        const isGroupedCol = colIdx <= 2;
        if (isGroupedCol) {
            if (!groupInfo.isGroupStart) {
                // Non-leader: rowSpan in readOnly (hidden), dimmed empty cell in edit mode
                if (readOnly) return null;
                return (
                    <td key={col.key}
                        className={`${colIdx === 0 ? cls.stickyStep : colIdx === 1 ? cls.stickyDesc : cls.cellBase} opacity-0`}
                        style={colIdx === 1 ? descShadow : undefined}
                    >
                        <input type="text" value={value}
                            onChange={e => onUpdateItem(item.id, col.key, e.target.value)}
                            className={`${cls.input} opacity-0 focus:opacity-100`}
                            tabIndex={-1}
                            aria-label={`${col.label} para fila ${idx + 1}`} />
                    </td>
                );
            }
            // Group leader: show content, use rowSpan in readOnly
            const rSpan = readOnly && groupInfo.groupSpan > 1 ? groupInfo.groupSpan : undefined;
            const stickyClass = colIdx === 0 ? cls.stickyStep : colIdx === 1 ? cls.stickyDesc : cls.cellBase;
            const inputClass = colIdx === 0 ? `${cls.input} font-semibold text-teal-700` : `${cls.input} font-medium`;
            return (
                <td key={col.key}
                    className={stickyClass}
                    style={colIdx === 1 ? descShadow : undefined}
                    rowSpan={rSpan}
                >
                    {renderText(value, (
                        <input type="text" value={value}
                            onChange={e => onUpdateItem(item.id, col.key, e.target.value)}
                            className={inputClass}
                            aria-label={`${col.label} para fila ${idx + 1}`} />
                    ))}
                </td>
            );
        }

        // Special char class — show badge in view mode
        if (col.key === 'specialCharClass' && readOnly) {
            const scColor = getSpecialCharColor(value);
            return (
                <td key={col.key} className={cls.cellBase}>
                    {value.trim()
                        ? <span className={`text-[10px] px-1.5 py-0.5 rounded ${scColor}`}>{value.toUpperCase()}</span>
                        : <span className="text-xs text-gray-300 italic">—</span>}
                </td>
            );
        }

        const criticalBorder = showCriticalRequired ? 'border-l-2 border-l-red-500 bg-red-50' : showRequiredHint ? 'border-l-2 border-l-amber-400' : '';
        const cellClass = `${cls.cellBase} ${criticalBorder}`;

        const autoFilledBg = isAutoFilled ? 'bg-purple-50/60' : '';

        // AI-eligible fields: use SuggestableTextarea with Gemini suggestions
        if (isAiField && !readOnly && (aiEnabled || buildQueryFn)) {
            const queryFn = buildQueryFn ? buildQueryFn(item, col.key as CpSuggestionField) : undefined;
            return (
                <td key={col.key} className={`${cellClass} ${autoFilledBg}`}>
                    {isAutoFilled && <Sparkles className="inline-block w-3 h-3 text-purple-400 mr-0.5 -mt-0.5 flex-shrink-0" aria-label="Sugerencia auto-generada" />}
                    <SuggestableTextarea
                        value={value}
                        onValueChange={(newVal) => onUpdateItem(item.id, col.key, newVal)}
                        queryFn={queryFn}
                        aiEnabled={aiEnabled}
                        className={`${cls.input} ${isAutoFilled ? 'text-purple-600/70 italic' : ''}`}
                        aria-label={`${col.label} para fila ${idx + 1}`}
                        title={isAutoFilled ? 'Sugerencia auto-generada — editar para confirmar' : undefined}
                    />
                </td>
            );
        }

        // View mode — render as text
        if (readOnly) {
            return (
                <td key={col.key} className={`${cellClass} ${autoFilledBg}`}>
                    {isAutoFilled && <Sparkles className="inline-block w-3 h-3 text-purple-400 mr-0.5 -mt-0.5" aria-label="Sugerencia auto-generada" />}
                    {renderText(value, null)}
                </td>
            );
        }

        // Edit mode — plain input for non-AI fields
        return (
            <td key={col.key} className={`${cellClass} ${autoFilledBg}`}>
                {isAutoFilled && <Sparkles className="inline-block w-3 h-3 text-purple-400 mr-0.5 -mt-0.5" aria-label="Sugerencia auto-generada" />}
                <input
                    type="text"
                    value={value}
                    onChange={e => onUpdateItem(item.id, col.key, e.target.value)}
                    placeholder={showCriticalRequired ? 'Obligatorio' : ''}
                    className={`${cls.input} ${isAutoFilled ? 'text-purple-600/70 italic' : ''} ${showCriticalRequired ? 'placeholder:text-red-400 placeholder:text-[9px]' : ''}`}
                    aria-label={`${col.label} para fila ${idx + 1}`}
                    title={isAutoFilled ? 'Sugerencia auto-generada — editar para confirmar' : undefined}
                />
            </td>
        );
    }, [item, idx, aiEnabled, buildQueryFn, onUpdateItem, readOnly, cls, descShadow, renderText, columnVisibility, groupInfo]);

    // Row background — subtle AP indicator stripe + zebra striping
    const apStripe = item.amfeAp === 'H' ? 'border-l-2 border-l-red-400'
        : item.amfeAp === 'M' ? 'border-l-2 border-l-amber-400'
        : '';
    const zebraClass = idx % 2 === 1 ? 'bg-gray-50/40' : '';
    // Visual separator at group boundaries
    const groupBorder = groupInfo.isGroupStart && idx > 0 ? 'border-t-2 border-t-teal-200' : '';

    return (
        <tr data-item-id={item.id} className={`${readOnly ? 'hover:bg-gray-50/50' : 'hover:bg-gray-50'} group ${apStripe} ${zebraClass} ${groupBorder}`}>
            {CP_COLUMNS.map((col, colIdx) => renderCell(col, colIdx))}
            {/* Actions — hidden in view mode */}
            <td className="border border-gray-200 px-1 text-center">
                {!readOnly && (
                    <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => onMoveItem(item.id, 'up')} disabled={idx === 0}
                            className="text-gray-300 hover:text-gray-600 disabled:opacity-30 p-0.5" title="Subir" aria-label={`Subir fila ${idx + 1}`}>
                            <ChevronUp size={11} />
                        </button>
                        <button onClick={() => onMoveItem(item.id, 'down')} disabled={idx === total - 1}
                            className="text-gray-300 hover:text-gray-600 disabled:opacity-30 p-0.5" title="Bajar" aria-label={`Bajar fila ${idx + 1}`}>
                            <ChevronDown size={11} />
                        </button>
                        <button onClick={() => onRemoveItem(item.id)}
                            className="text-gray-300 hover:text-red-500 p-0.5" title="Eliminar" aria-label={`Eliminar fila ${idx + 1}`}>
                            <Trash2 size={11} />
                        </button>
                    </div>
                )}
                {readOnly && item.amfeAp && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${getApColor(item.amfeAp)}`}>
                        {item.amfeAp}
                    </span>
                )}
            </td>
        </tr>
    );
});

export default ControlPlanTable;
