/**
 * PFD Table Row — Single editable row in the PFD table
 *
 * C3-N1: RejectDisposition dropdown (rework/scrap/sort) replacing checkbox.
 * C3-U1: focus-within ring on row.
 * C3-V2: Subtle tint per step type.
 */

import React from 'react';
import { Trash2, ArrowUp, ArrowDown, Plus, Copy } from 'lucide-react';
import type { PfdStep, PfdStepType, SpecialCharClass, RejectDisposition } from './pfdTypes';
import PfdSymbolPicker from './PfdSymbolPicker';

interface Props {
    step: PfdStep;
    index: number;
    totalSteps: number;
    onUpdate: (stepId: string, field: keyof PfdStep, value: string | boolean) => void;
    /** C5-B1: Batch update multiple fields atomically (single undo entry) */
    onBatchUpdate?: (stepId: string, updates: Partial<PfdStep>) => void;
    onRemove: (stepId: string) => void;
    onMove: (stepId: string, direction: 'up' | 'down') => void;
    onInsertAfter?: (stepId: string) => void;
    onDuplicate?: (stepId: string) => void;
    readOnly?: boolean;
}

const cellClass = "px-2 py-1.5 border-r border-gray-200 text-sm";
const inputClass = "w-full bg-transparent border-0 outline-none text-sm focus:ring-1 focus:ring-cyan-300 rounded px-1";

/** C3-V2: Subtle background tint per step type */
const TYPE_TINTS: Partial<Record<PfdStepType, string>> = {
    transport: 'bg-slate-50/40',
    inspection: 'bg-emerald-50/30',
    storage: 'bg-amber-50/30',
    delay: 'bg-red-50/20',
    decision: 'bg-purple-50/30',
};

/** C3-N1: Disposition labels and styles */
const DISPOSITION_LABELS: Record<Exclude<RejectDisposition, 'none'>, { text: string; bg: string; border: string; textColor: string }> = {
    rework: { text: 'RETRABAJO', bg: 'bg-red-100', border: 'border-red-300', textColor: 'text-red-700' },
    scrap: { text: 'DESCARTE', bg: 'bg-orange-100', border: 'border-orange-300', textColor: 'text-orange-700' },
    sort: { text: 'SELECCIÓN', bg: 'bg-yellow-100', border: 'border-yellow-400', textColor: 'text-yellow-700' },
};

/** Row background for disposition */
const DISPOSITION_BG: Partial<Record<RejectDisposition, string>> = {
    rework: 'bg-red-50',
    scrap: 'bg-orange-50',
    sort: 'bg-yellow-50',
};

function SpecialCharBadge({ value }: { value: SpecialCharClass }) {
    if (value === 'CC') return <span className="inline-block bg-red-100 text-red-700 border border-red-300 text-[10px] font-bold px-1.5 py-0.5 rounded">CC</span>;
    if (value === 'SC') return <span className="inline-block bg-amber-100 text-amber-700 border border-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded">SC</span>;
    return <span className="text-gray-300 text-[10px]">—</span>;
}

const PfdTableRow: React.FC<Props> = ({ step, index, totalSteps, onUpdate, onBatchUpdate, onRemove, onMove, onInsertAfter, onDuplicate, readOnly }) => {
    // C3-N1: disposition-based background > external > type tint > zebra
    const dispositionBg = DISPOSITION_BG[step.rejectDisposition] || '';
    const externalBg = step.isExternalProcess ? 'bg-blue-50' : '';
    const typeTint = !dispositionBg && !externalBg ? (TYPE_TINTS[step.stepType] || '') : '';
    const zebraBg = !dispositionBg && !externalBg && !typeTint && index % 2 === 1 ? 'bg-gray-50/70' : '';
    const rowBg = dispositionBg || externalBg || typeTint || zebraBg;

    // N4: CC/SC visual — borde izquierdo prominente
    const hasCC = step.productSpecialChar === 'CC' || step.processSpecialChar === 'CC';
    const hasSC = !hasCC && (step.productSpecialChar === 'SC' || step.processSpecialChar === 'SC');
    const leftBorder = hasCC ? 'border-l-4 border-l-red-500' : hasSC ? 'border-l-4 border-l-amber-500' : '';

    const handleTextChange = (field: keyof PfdStep) => (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(step.id, field, e.target.value);
    };

    const handleSpecialChar = (field: 'productSpecialChar' | 'processSpecialChar') => (e: React.ChangeEvent<HTMLSelectElement>) => {
        onUpdate(step.id, field, e.target.value);
    };

    /** C5-B1: Atomic disposition change — single undo entry for all field updates */
    const handleDispositionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value as RejectDisposition;
        const updates: Partial<PfdStep> = {
            rejectDisposition: val,
            isRework: val === 'rework',
        };
        if (val !== 'rework') updates.reworkReturnStep = '';
        if (val === 'none') updates.scrapDescription = '';
        if (onBatchUpdate) {
            onBatchUpdate(step.id, updates);
        } else {
            // Fallback: individual updates (backward compat)
            onUpdate(step.id, 'rejectDisposition', val);
            onUpdate(step.id, 'isRework', val === 'rework');
            if (val !== 'rework') onUpdate(step.id, 'reworkReturnStep', '');
            if (val === 'none') onUpdate(step.id, 'scrapDescription', '');
        }
    };

    const dispositionInfo = step.rejectDisposition !== 'none' ? DISPOSITION_LABELS[step.rejectDisposition] : null;

    return (
        <tr
            className={`border-b border-gray-200 hover:bg-cyan-50/50 transition-colors focus-within:ring-2 focus-within:ring-cyan-400 focus-within:ring-inset ${rowBg} ${leftBorder}`}
            data-step-id={step.id}
        >
            {/* Step Number */}
            <td className={`${cellClass} text-center font-mono font-bold`}>
                <input
                    value={step.stepNumber}
                    onChange={handleTextChange('stepNumber')}
                    className={`${inputClass} text-center font-bold`}
                    placeholder="Nº op."
                    disabled={readOnly}
                />
            </td>

            {/* Symbol */}
            <td className={`${cellClass} text-center`}>
                <PfdSymbolPicker
                    value={step.stepType}
                    onChange={(v: PfdStepType) => onUpdate(step.id, 'stepType', v)}
                    disabled={readOnly}
                />
            </td>

            {/* Description */}
            <td className={cellClass}>
                <div className="flex items-center gap-1.5">
                    <input
                        value={step.description}
                        onChange={handleTextChange('description')}
                        className={`${inputClass} flex-1`}
                        placeholder="Descripción de la operación"
                        disabled={readOnly}
                    />
                    {dispositionInfo && (
                        <span className={`inline-block ${dispositionInfo.bg} ${dispositionInfo.textColor} border ${dispositionInfo.border} text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap`}>
                            {dispositionInfo.text}
                        </span>
                    )}
                    {step.isExternalProcess && (
                        <span className="inline-block bg-blue-100 text-blue-700 border border-blue-300 text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">EXTERNO</span>
                    )}
                </div>
                {/* C3-N1: Sub-fields per disposition type */}
                {step.rejectDisposition === 'rework' && (
                    <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] text-red-500 font-medium whitespace-nowrap">Retorno a:</span>
                        <input
                            value={step.reworkReturnStep || ''}
                            onChange={(e) => onUpdate(step.id, 'reworkReturnStep', e.target.value)}
                            className="flex-1 bg-red-50 border border-red-200 text-xs rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-red-300"
                            placeholder="ej: OP 20"
                            disabled={readOnly}
                        />
                    </div>
                )}
                {(step.rejectDisposition === 'scrap' || step.rejectDisposition === 'sort') && (
                    <div className="flex items-center gap-1 mt-1">
                        <span className={`text-[10px] font-medium whitespace-nowrap ${step.rejectDisposition === 'scrap' ? 'text-orange-600' : 'text-yellow-600'}`}>
                            {step.rejectDisposition === 'scrap' ? 'Motivo:' : 'Criterio:'}
                        </span>
                        <input
                            value={step.scrapDescription || ''}
                            onChange={(e) => onUpdate(step.id, 'scrapDescription', e.target.value)}
                            className={`flex-1 border text-xs rounded px-1 py-0.5 outline-none focus:ring-1 ${
                                step.rejectDisposition === 'scrap'
                                    ? 'bg-orange-50 border-orange-200 focus:ring-orange-300'
                                    : 'bg-yellow-50 border-yellow-200 focus:ring-yellow-300'
                            }`}
                            placeholder={step.rejectDisposition === 'scrap' ? 'Motivo del descarte' : 'Criterio de selección'}
                            disabled={readOnly}
                        />
                    </div>
                )}
            </td>

            {/* Machine/Device/Tool */}
            <td className={cellClass}>
                <input
                    value={step.machineDeviceTool}
                    onChange={handleTextChange('machineDeviceTool')}
                    className={inputClass}
                    placeholder="Máquina o herramienta"
                    disabled={readOnly}
                />
            </td>

            {/* Product Characteristic */}
            <td className={cellClass}>
                <input
                    value={step.productCharacteristic}
                    onChange={handleTextChange('productCharacteristic')}
                    className={inputClass}
                    placeholder="Característica"
                    disabled={readOnly}
                />
            </td>

            {/* Product CC/SC */}
            <td className={`${cellClass} text-center`}>
                {readOnly ? (
                    <SpecialCharBadge value={step.productSpecialChar} />
                ) : (
                    <select
                        value={step.productSpecialChar}
                        onChange={handleSpecialChar('productSpecialChar')}
                        className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white focus:ring-1 focus:ring-cyan-300 outline-none"
                    >
                        <option value="none">—</option>
                        <option value="CC">CC</option>
                        <option value="SC">SC</option>
                    </select>
                )}
            </td>

            {/* Process Characteristic */}
            <td className={cellClass}>
                <input
                    value={step.processCharacteristic}
                    onChange={handleTextChange('processCharacteristic')}
                    className={inputClass}
                    placeholder="Variable de proceso"
                    disabled={readOnly}
                />
            </td>

            {/* Process CC/SC */}
            <td className={`${cellClass} text-center`}>
                {readOnly ? (
                    <SpecialCharBadge value={step.processSpecialChar} />
                ) : (
                    <select
                        value={step.processSpecialChar}
                        onChange={handleSpecialChar('processSpecialChar')}
                        className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white focus:ring-1 focus:ring-cyan-300 outline-none"
                    >
                        <option value="none">—</option>
                        <option value="CC">CC</option>
                        <option value="SC">SC</option>
                    </select>
                )}
            </td>

            {/* Reference */}
            <td className={cellClass}>
                <input
                    value={step.reference}
                    onChange={handleTextChange('reference')}
                    className={inputClass}
                    placeholder="Plano / Ref."
                    disabled={readOnly}
                />
            </td>

            {/* Department */}
            <td className={cellClass}>
                <input
                    value={step.department}
                    onChange={handleTextChange('department')}
                    className={inputClass}
                    placeholder="Área"
                    disabled={readOnly}
                />
            </td>

            {/* Notes */}
            <td className={cellClass}>
                <input
                    value={step.notes}
                    onChange={handleTextChange('notes')}
                    className={inputClass}
                    placeholder="Notas"
                    disabled={readOnly}
                />
            </td>

            {/* C3-N1: Disposition dropdown */}
            <td className={`${cellClass} text-center`}>
                {readOnly ? (
                    dispositionInfo ? (
                        <span className={`inline-block ${dispositionInfo.bg} ${dispositionInfo.textColor} border ${dispositionInfo.border} text-[9px] font-bold px-1 py-0.5 rounded`}>
                            {dispositionInfo.text}
                        </span>
                    ) : (
                        <span className="text-gray-300 text-[10px]">—</span>
                    )
                ) : (
                    <select
                        value={step.rejectDisposition}
                        onChange={handleDispositionChange}
                        className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white focus:ring-1 focus:ring-cyan-300 outline-none"
                    >
                        <option value="none">—</option>
                        <option value="rework">Retrabajo</option>
                        <option value="scrap">Descarte</option>
                        <option value="sort">Selección</option>
                    </select>
                )}
            </td>

            {/* External */}
            <td className={`${cellClass} text-center`}>
                <input
                    type="checkbox"
                    checked={step.isExternalProcess}
                    onChange={(e) => onUpdate(step.id, 'isExternalProcess', e.target.checked)}
                    disabled={readOnly}
                    className="w-4 h-4 accent-blue-500"
                    title="Proceso externo"
                />
            </td>

            {/* Actions */}
            {!readOnly && (
                <td className="px-1 py-1 text-center whitespace-nowrap">
                    <div className="flex items-center gap-0.5 justify-center flex-wrap">
                        <button
                            onClick={() => onMove(step.id, 'up')}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-cyan-600 disabled:opacity-30 transition"
                            title="Mover arriba"
                        >
                            <ArrowUp size={14} />
                        </button>
                        <button
                            onClick={() => onMove(step.id, 'down')}
                            disabled={index === totalSteps - 1}
                            className="p-1 text-gray-400 hover:text-cyan-600 disabled:opacity-30 transition"
                            title="Mover abajo"
                        >
                            <ArrowDown size={14} />
                        </button>
                        {onInsertAfter && (
                            <button
                                onClick={() => onInsertAfter(step.id)}
                                className="p-1 text-gray-400 hover:text-green-600 transition"
                                title="Insertar paso debajo"
                            >
                                <Plus size={14} />
                            </button>
                        )}
                        {onDuplicate && (
                            <button
                                onClick={() => onDuplicate(step.id)}
                                className="p-1 text-gray-400 hover:text-blue-600 transition"
                                title="Duplicar paso"
                            >
                                <Copy size={14} />
                            </button>
                        )}
                        <button
                            onClick={() => onRemove(step.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition"
                            title="Eliminar paso"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </td>
            )}
        </tr>
    );
};

export default PfdTableRow;
