/**
 * Control Plan Table Body
 *
 * Inline-editable table rows for Control Plan items.
 * 14 AIAG standard columns + actions.
 * Supports View/Edit mode with sticky first two columns.
 * Row grouping: consecutive rows with same processStepNumber merge cols 0-1 via rowSpan.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ControlPlanItem, CP_COLUMNS, CPColumnDef } from './controlPlanTypes';
import { CpColumnGroupVisibility, CP_COLUMN_TO_GROUP } from './useCpColumnVisibility';
import AutoResizeTextarea from '../amfe/AutoResizeTextarea';
import { Trash2, ChevronUp, ChevronDown, ChevronRight, Copy, ClipboardList } from 'lucide-react';
import { InheritanceBadge } from '../../components/ui/InheritanceBadge';
import type { InheritanceStatusMap } from '../../hooks/useInheritanceStatus';

/** Columns that should use textarea (multi-line wrap) instead of single-line input */
const TEXTAREA_COLUMNS = new Set<string>([
    'processDescription', 'machineDeviceTool',
    'productCharacteristic', 'processCharacteristic',
    'specification', 'reactionPlanOwner',
]);

interface Props {
    items: ControlPlanItem[];
    onUpdateItem: (itemId: string, field: keyof ControlPlanItem, value: string) => void;
    onRemoveItem: (itemId: string) => void;
    onMoveItem: (itemId: string, direction: 'up' | 'down') => void;
    onDuplicateItem?: (itemId: string) => void;
    readOnly?: boolean;
    columnVisibility?: CpColumnGroupVisibility;
    onBulkFill?: (sourceItemId: string, field: string, value: string) => void;
    /** Inheritance status map for variant documents (null = not a variant) */
    inheritanceStatusMap?: InheritanceStatusMap | null;
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
    if (upper === 'PTC') return 'bg-blue-100 text-blue-700 font-bold';
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

const ControlPlanTable: React.FC<Props> = ({ items, onUpdateItem, onRemoveItem, onMoveItem, onDuplicateItem, readOnly = false, columnVisibility, onBulkFill, inheritanceStatusMap }) => {
    const rowGroups = useMemo(() => computeRowGroups(items), [items]);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [bulkMenu, setBulkMenu] = useState<{x: number; y: number; itemId: string; field: string; value: string; stepNumber: string} | null>(null);

    const toggleGroupCollapse = useCallback((stepNumber: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(stepNumber)) next.delete(stepNumber);
            else next.add(stepNumber);
            return next;
        });
    }, []);

    if (items.length === 0) {
        return (
            <tbody>
                <tr>
                    <td colSpan={CP_COLUMNS.length + 1} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3">
                            <ClipboardList size={40} className="text-teal-200" />
                            <p className="text-sm font-medium text-gray-500">No hay items en el Plan de Control</p>
                            <p className="text-xs text-gray-400">Genera desde el AMFE o agrega items manualmente.</p>
                        </div>
                    </td>
                </tr>
            </tbody>
        );
    }

    return (
        <tbody>
            {items.map((item, idx) => {
                const groupInfo = rowGroups[idx];
                const isCollapsed = collapsedGroups.has(item.processStepNumber);

                // Skip collapsed group rows (except the separator header itself)
                if (isCollapsed && !groupInfo.isGroupStart) return null;

                return (
                    <React.Fragment key={item.id}>
                        {/* Group separator row */}
                        {groupInfo.isGroupStart && idx > 0 && (
                            <tr className="bg-teal-50/50 border-t-2 border-teal-200">
                                <td colSpan={999} className="px-3 py-1.5">
                                    <button onClick={() => toggleGroupCollapse(item.processStepNumber)}
                                        className="flex items-center gap-2 text-xs font-semibold text-teal-700 w-full text-left">
                                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                        <span>OP {item.processStepNumber}</span>
                                        <span className="font-normal text-teal-500">{item.processDescription}</span>
                                        <span className="ml-auto text-[10px] text-teal-400">{groupInfo.groupSpan} items</span>
                                    </button>
                                </td>
                            </tr>
                        )}
                        {/* Skip rendering row content if group is collapsed */}
                        {!isCollapsed && (
                            <ControlPlanRow
                                item={item}
                                idx={idx}
                                total={items.length}
                                onUpdateItem={onUpdateItem}
                                onRemoveItem={onRemoveItem}
                                onMoveItem={onMoveItem}
                                onDuplicateItem={onDuplicateItem}
                                readOnly={readOnly}
                                columnVisibility={columnVisibility}
                                groupInfo={groupInfo}
                                onBulkFill={onBulkFill}
                                setBulkMenu={setBulkMenu}
                                inheritanceStatusMap={inheritanceStatusMap}
                            />
                        )}
                    </React.Fragment>
                );
            })}
            {/* Bulk fill context menu */}
            {bulkMenu && (
                <tr style={{ position: 'absolute', top: 0, left: 0, height: 0, overflow: 'visible' }}>
                    <td colSpan={999} style={{ padding: 0, border: 'none', position: 'relative' }}>
                        <div
                            className="fixed z-[100] bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[200px]"
                            style={{ top: bulkMenu.y, left: bulkMenu.x }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => {
                                    onBulkFill?.(bulkMenu.itemId, bulkMenu.field, bulkMenu.value);
                                    setBulkMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50 text-gray-700"
                            >
                                Aplicar &lsquo;{bulkMenu.value.length > 30 ? bulkMenu.value.slice(0, 30) + '...' : bulkMenu.value}&rsquo; a OP {bulkMenu.stepNumber}
                            </button>
                        </div>
                        <div className="fixed inset-0 z-[99]" onClick={() => setBulkMenu(null)} onKeyDown={(e) => { if (e.key === 'Escape') setBulkMenu(null); }} />
                    </td>
                </tr>
            )}
        </tbody>
    );
};

/** Fields eligible for bulk fill via right-click */
const BULK_FILL_FIELDS = new Set<string>(['sampleSize', 'sampleFrequency', 'controlMethod', 'reactionPlanOwner']);

/** Single row — memoized to prevent re-renders of all rows on any change */
const ControlPlanRow: React.FC<{
    item: ControlPlanItem;
    idx: number;
    total: number;
    onUpdateItem: (itemId: string, field: keyof ControlPlanItem, value: string) => void;
    onRemoveItem: (itemId: string) => void;
    onMoveItem: (itemId: string, direction: 'up' | 'down') => void;
    onDuplicateItem?: (itemId: string) => void;
    readOnly: boolean;
    columnVisibility?: CpColumnGroupVisibility;
    groupInfo: RowGroupInfo;
    onBulkFill?: (sourceItemId: string, field: string, value: string) => void;
    setBulkMenu?: (menu: {x: number; y: number; itemId: string; field: string; value: string; stepNumber: string} | null) => void;
    inheritanceStatusMap?: InheritanceStatusMap | null;
}> = React.memo(({ item, idx, total, onUpdateItem, onRemoveItem, onMoveItem, onDuplicateItem, readOnly, columnVisibility, groupInfo, onBulkFill, setBulkMenu, inheritanceStatusMap }) => {

    // Memoize class strings — only recompute when readOnly changes
    // table-fixed + colgroup controla anchos; break-words fuerza wrap de texto largo
    const cls = useMemo(() => ({
        cellBase: readOnly
            ? 'px-2 py-2 border-r border-b border-gray-200 align-top text-xs break-words'
            : 'border border-gray-200 px-0 align-top break-words',
        textSpan: 'block text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap break-words',
        input: 'w-full px-1.5 py-1.5 text-[10px] bg-transparent border-0 outline-none focus:bg-blue-50 focus:ring-1 focus:ring-inset focus:ring-teal-300 transition',
        stickyStep: `${readOnly ? 'px-2 py-2 border-r border-b border-gray-200 align-middle text-xs' : 'border border-gray-200 px-0 align-top'} ${readOnly ? 'bg-teal-50' : 'bg-white'} sticky left-0 z-[5] break-words`,
        stickyDesc: `${readOnly ? 'px-2 py-2 border-r border-b border-gray-200 align-middle text-xs' : 'border border-gray-200 px-0 align-top'} ${readOnly ? 'bg-teal-50' : 'bg-white'} sticky left-[80px] z-[5] break-words`,
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
        // Determine if this is a product row (has product characteristic but not process-only)
        const hasProduct = ((item.productCharacteristic as string) || '').trim() !== '';
        const hasProcess = ((item.processCharacteristic as string) || '').trim() !== '';
        const isProductRow = hasProduct || !hasProcess;
        // Fields that require red highlight when empty in edit mode
        const isRequiredField = isOwnerField
            || (col.key === 'specification' && isProductRow)
            || (col.key === 'evaluationTechnique' && isProductRow);
        const showCriticalRequired = !readOnly && isRequiredField && isEmpty;
        const showRequiredHint = !readOnly && !isRequiredField && col.required && isEmpty;
        const isAutoFilled = item.autoFilledFields?.includes(col.key) && !!value;

        // Sticky columns: processStepNumber (col 0), processDescription (col 1), machineDeviceTool (col 2)
        // Group consecutive rows with same processStepNumber: leader shows content, followers are merged/dimmed
        const isGroupedCol = colIdx <= 2;
        if (isGroupedCol) {
            if (!groupInfo.isGroupStart) {
                // Non-leader: rowSpan in readOnly (hidden), dimmed but editable in edit mode
                if (readOnly) return null;
                const useTextarea = TEXTAREA_COLUMNS.has(col.key);
                const dimmedInput = `${cls.input} text-gray-400 focus:text-slate-700 focus:bg-blue-50`;
                return (
                    <td key={col.key}
                        data-field={col.key}
                        className={`${colIdx === 0 ? cls.stickyStep : colIdx === 1 ? cls.stickyDesc : cls.cellBase} opacity-50 focus-within:opacity-100 transition-opacity`}
                        style={colIdx === 1 ? descShadow : undefined}
                    >
                        {useTextarea ? (
                            <AutoResizeTextarea value={value}
                                onChange={e => onUpdateItem(item.id, col.key, e.target.value)}
                                className={dimmedInput}
                                aria-label={`${col.label} — ${item.processStepNumber || `fila ${idx + 1}`}`} />
                        ) : (
                            <input type="text" value={value}
                                onChange={e => onUpdateItem(item.id, col.key, e.target.value)}
                                className={dimmedInput}
                                aria-label={`${col.label} — ${item.processStepNumber || `fila ${idx + 1}`}`} />
                        )}
                    </td>
                );
            }
            // Group leader: show content, use rowSpan in readOnly
            const rSpan = readOnly && groupInfo.groupSpan > 1 ? groupInfo.groupSpan : undefined;
            const stickyClass = colIdx === 0 ? cls.stickyStep : colIdx === 1 ? cls.stickyDesc : cls.cellBase;
            const inputClass = colIdx === 0 ? `${cls.input} font-semibold text-teal-700` : `${cls.input} font-medium`;
            const useTextarea = TEXTAREA_COLUMNS.has(col.key);
            return (
                <td key={col.key}
                    data-field={col.key}
                    className={stickyClass}
                    style={colIdx === 1 ? descShadow : undefined}
                    rowSpan={rSpan}
                >
                    {renderText(value, useTextarea ? (
                        <AutoResizeTextarea value={value}
                            onChange={e => onUpdateItem(item.id, col.key, e.target.value)}
                            className={inputClass}
                            aria-label={`${col.label} — ${item.processStepNumber || `fila ${idx + 1}`}`} />
                    ) : (
                        <input type="text" value={value}
                            onChange={e => onUpdateItem(item.id, col.key, e.target.value)}
                            className={inputClass}
                            aria-label={`${col.label} — ${item.processStepNumber || `fila ${idx + 1}`}`} />
                    ))}
                </td>
            );
        }

        // Special char class — show badge in view mode
        if (col.key === 'specialCharClass' && readOnly) {
            const scColor = getSpecialCharColor(value);
            return (
                <td key={col.key} data-field={col.key} className={cls.cellBase}>
                    {value.trim()
                        ? <span className={`text-[10px] px-1.5 py-0.5 rounded ${scColor}`}>{value.toUpperCase()}</span>
                        : <span className="text-xs text-gray-300 italic">—</span>}
                </td>
            );
        }

        const criticalBorder = showCriticalRequired ? 'border-l-2 border-l-red-500 bg-red-50/30' : showRequiredHint ? 'border-l-2 border-l-amber-400' : '';
        const cellClass = `${cls.cellBase} ${criticalBorder}`;

        // Bulk fill context menu handler for eligible fields
        const isBulkEligible = !readOnly && BULK_FILL_FIELDS.has(col.key) && value.trim() !== '' && onBulkFill && setBulkMenu;
        const handleContextMenu = isBulkEligible ? (e: React.MouseEvent) => {
            e.preventDefault();
            setBulkMenu({
                x: e.clientX,
                y: e.clientY,
                itemId: item.id,
                field: col.key,
                value: value,
                stepNumber: item.processStepNumber,
            });
        } : undefined;

        // View mode — render as text
        if (readOnly) {
            return (
                <td key={col.key} data-field={col.key} className={cellClass}>
                    {renderText(value, null)}
                </td>
            );
        }

        // Edit mode — textarea for long-text fields, plain input for short fields
        const useTextarea = TEXTAREA_COLUMNS.has(col.key);
        const placeholder = showCriticalRequired ? 'Ej: Operador de Línea'
            : col.key === 'specification' && isEmpty ? 'Completar del plano'
            : '';
        const editClass = `${cls.input} ${showCriticalRequired ? 'placeholder:text-red-400 placeholder:text-[9px]' : isEmpty && col.key === 'specification' ? 'placeholder:text-gray-300 placeholder:text-[9px] placeholder:italic' : ''}`;
        return (
            <td key={col.key} data-field={col.key} className={cellClass} onContextMenu={handleContextMenu}>
                {useTextarea ? (
                    <AutoResizeTextarea
                        value={value}
                        onChange={e => onUpdateItem(item.id, col.key, e.target.value)}
                        placeholder={placeholder}
                        className={editClass}
                        aria-label={`${col.label} — ${item.processStepNumber || `fila ${idx + 1}`}`}
                        title={isAutoFilled ? 'Derivado del AMFE' : undefined}
                    />
                ) : (
                    <input
                        type="text"
                        value={value}
                        onChange={e => onUpdateItem(item.id, col.key, e.target.value)}
                        placeholder={placeholder}
                        className={editClass}
                        aria-label={`${col.label} — ${item.processStepNumber || `fila ${idx + 1}`}`}
                        title={isAutoFilled ? 'Derivado del AMFE' : undefined}
                    />
                )}
            </td>
        );
    }, [item, idx, onUpdateItem, readOnly, cls, descShadow, renderText, columnVisibility, groupInfo, onBulkFill, setBulkMenu]);

    // Row background — subtle AP indicator stripe + zebra striping
    const apStripe = item.amfeAp === 'H' ? 'border-l-2 border-l-red-400'
        : item.amfeAp === 'M' ? 'border-l-2 border-l-amber-400'
        : '';
    const zebraClass = idx % 2 === 1 ? 'bg-gray-50/40' : '';
    // Visual separator at group boundaries
    const groupBorder = groupInfo.isGroupStart && idx > 0 ? 'border-t-2 border-t-teal-200' : '';

    return (
        <tr data-item-id={item.id} data-step={item.processStepNumber} data-process={item.processDescription?.slice(0, 50)} className={`${readOnly ? 'hover:bg-gray-50/50' : 'hover:bg-gray-50'} group ${apStripe} ${zebraClass} ${groupBorder}`}>
            {CP_COLUMNS.map((col, colIdx) => renderCell(col, colIdx))}
            {/* Actions — hidden in view mode */}
            <td data-field="actions" className="border border-gray-200 px-1 text-center">
                {!readOnly && (
                    <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => onMoveItem(item.id, 'up')} disabled={idx === 0}
                            className="text-gray-300 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed p-0.5" title="Mover arriba" aria-label={`Mover fila ${idx + 1} arriba`}>
                            <ChevronUp size={11} />
                        </button>
                        <button onClick={() => onMoveItem(item.id, 'down')} disabled={idx === total - 1}
                            className="text-gray-300 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed p-0.5" title="Mover abajo" aria-label={`Mover fila ${idx + 1} abajo`}>
                            <ChevronDown size={11} />
                        </button>
                        {onDuplicateItem && (
                            <button onClick={() => onDuplicateItem(item.id)}
                                className="text-gray-300 hover:text-teal-600 p-0.5" title="Duplicar fila" aria-label={`Duplicar fila ${idx + 1}`}>
                                <Copy size={11} />
                            </button>
                        )}
                        <button onClick={() => onRemoveItem(item.id)}
                            className="text-gray-300 hover:text-red-500 p-0.5" title="Eliminar fila del Plan de Control" aria-label={`Eliminar fila ${idx + 1}`}>
                            <Trash2 size={11} />
                        </button>
                    </div>
                )}
                {readOnly && item.amfeAp && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap ${getApColor(item.amfeAp)}`}>
                        {item.amfeAp}
                    </span>
                )}
                {inheritanceStatusMap?.items.get(item.id) && (
                    <InheritanceBadge status={inheritanceStatusMap.items.get(item.id)!} compact className="mt-0.5" />
                )}
            </td>
        </tr>
    );
});

export default React.memo(ControlPlanTable);
