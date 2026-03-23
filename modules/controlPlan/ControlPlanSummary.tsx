/**
 * Control Plan Summary Dashboard
 *
 * Collapsible panel showing AP distribution, completion status, and critical items
 * for the current Control Plan document.
 *
 * Adapted from AmfeSummary.tsx with CP-specific KPIs.
 */

import React, { useMemo } from 'react';
import { ControlPlanDocument, ControlPlanItem, CP_COLUMNS } from './controlPlanTypes';
import { AlertTriangle, BarChart3, CheckCircle, ShieldAlert } from 'lucide-react';

interface Props {
    data: ControlPlanDocument;
    /** When provided, stats reflect only the filtered subset (shown as "Filtrado: X de Y") */
    filteredItems?: ControlPlanItem[];
}

export interface CpSummaryStats {
    totalItems: number;
    apH: number;
    apM: number;
    apL: number;
    apNone: number;
    specialCC: number;
    specialSC: number;
    withControlMethod: number;
    withReactionPlan: number;
    withReactionPlanOwner: number;
    withSpecification: number;
    completionPercent: number;
    criticalItems: { processStep: string; description: string; missing: string[] }[];
}

const REQUIRED_FIELDS: { key: keyof ControlPlanItem; label: string }[] = [
    { key: 'processStepNumber', label: 'Nro. Proceso' },
    { key: 'processDescription', label: 'Descripción' },
    { key: 'productCharacteristic', label: 'Producto' },
    { key: 'sampleSize', label: 'Tam. Muestra' },
    { key: 'controlMethod', label: 'Método Control' },
    { key: 'reactionPlan', label: 'Plan Reacción' },
    { key: 'reactionPlanOwner', label: 'Resp. Reacción' },
];

export function computeCpStats(data: ControlPlanDocument): CpSummaryStats {
    const items = data.items;
    const totalItems = items.length;

    const apH = items.filter(i => i.amfeAp === 'H').length;
    const apM = items.filter(i => i.amfeAp === 'M').length;
    const apL = items.filter(i => i.amfeAp === 'L').length;
    const apNone = totalItems - apH - apM - apL;

    const specialCC = items.filter(i => (i.specialCharClass || '').toUpperCase().trim() === 'CC').length;
    const specialSC = items.filter(i => (i.specialCharClass || '').toUpperCase().trim() === 'SC').length;

    const withControlMethod = items.filter(i => (i.controlMethod || '').trim() !== '').length;
    const withReactionPlan = items.filter(i => (i.reactionPlan || '').trim() !== '').length;
    const withReactionPlanOwner = items.filter(i => (i.reactionPlanOwner || '').trim() !== '').length;
    const withSpecification = items.filter(i => (i.specification || '').trim() !== '').length;

    // Completion: % of required fields filled — context-aware by row type (process vs product)
    const FIELDS_PER_ROW = 7;
    const totalRequired = totalItems * FIELDS_PER_ROW;
    let filledCount = 0;
    if (totalRequired > 0) {
        for (const item of items) {
            const hasProcess = ((item.processCharacteristic as string) || '').trim() !== '';
            const hasProduct = ((item.productCharacteristic as string) || '').trim() !== '';
            const isProcess = hasProcess && !hasProduct;
            const fields: (keyof ControlPlanItem)[] = isProcess
                ? ['processStepNumber', 'processDescription', 'processCharacteristic', 'sampleSize', 'controlMethod', 'reactionPlan', 'reactionPlanOwner']
                : ['processStepNumber', 'processDescription', 'productCharacteristic', 'sampleSize', 'evaluationTechnique', 'reactionPlan', 'reactionPlanOwner'];
            for (const f of fields) {
                if (((item[f] as string) || '').trim() !== '') {
                    filledCount++;
                }
            }
        }
    }
    const completionPercent = totalRequired > 0 ? Math.round((filledCount / totalRequired) * 100) : 0;

    // Critical items: CC/SC items that have missing required fields
    const criticalItems: CpSummaryStats['criticalItems'] = [];
    for (const item of items) {
        const sc = (item.specialCharClass || '').toUpperCase().trim();
        const isSpecial = sc === 'CC' || sc === 'SC';
        const isHighAp = item.amfeAp === 'H';
        if (!isSpecial && !isHighAp) continue;

        const missing: string[] = [];
        const hasProc = ((item.processCharacteristic as string) || '').trim() !== '';
        const hasProd = ((item.productCharacteristic as string) || '').trim() !== '';
        const rowIsProcess = hasProc && !hasProd;
        const rowFields = rowIsProcess
            ? REQUIRED_FIELDS.map(rf => rf.key === 'productCharacteristic' ? { key: 'processCharacteristic' as keyof ControlPlanItem, label: 'Proceso' } : rf)
            : REQUIRED_FIELDS;
        for (const rf of rowFields) {
            if (((item[rf.key] as string) || '').trim() === '') {
                missing.push(rf.label);
            }
        }
        if (missing.length > 0) {
            criticalItems.push({
                processStep: item.processStepNumber || '—',
                description: item.processDescription || item.productCharacteristic || '(sin descripción)',
                missing,
            });
        }
        if (criticalItems.length >= 10) break;
    }

    return {
        totalItems,
        apH, apM, apL, apNone,
        specialCC, specialSC,
        withControlMethod, withReactionPlan, withReactionPlanOwner, withSpecification,
        completionPercent,
        criticalItems,
    };
}

const ControlPlanSummary: React.FC<Props> = ({ data, filteredItems }) => {
    const isFiltered = !!filteredItems && filteredItems.length !== data.items.length;
    const effectiveData = useMemo(() => {
        if (!isFiltered || !filteredItems) return data;
        return { ...data, items: filteredItems };
    }, [data, filteredItems, isFiltered]);
    const stats = useMemo(() => computeCpStats(effectiveData), [effectiveData]);

    // Per-operation breakdown
    const operationBreakdown = useMemo(() => {
        const groups: Record<string, { step: string; desc: string; total: number; complete: number; cc: number; sc: number }> = {};
        for (const item of data.items) {
            const key = item.processStepNumber || '(sin nro)';
            if (!groups[key]) groups[key] = { step: key, desc: item.processDescription, total: 0, complete: 0, cc: 0, sc: 0 };
            groups[key].total++;
            const required = ['processDescription', 'controlMethod', 'reactionPlan', 'reactionPlanOwner'];
            const allFilled = required.every(f => ((item[f as keyof typeof item] as string) || '').trim() !== '');
            if (allFilled) groups[key].complete++;
            const sc = (item.specialCharClass || '').toUpperCase().trim();
            if (sc === 'CC') groups[key].cc++;
            if (sc === 'SC') groups[key].sc++;
        }
        return Object.values(groups);
    }, [data.items]);

    const apTotal = stats.apH + stats.apM + stats.apL;
    const apBarWidth = (count: number) => apTotal > 0 ? `${(count / apTotal) * 100}%` : '0%';

    return (
        <div className="bg-white border-b border-gray-200 shadow-sm">
            <div className="max-w-[1800px] mx-auto p-4">
                <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="text-teal-600" size={16} />
                    <h3 className="text-sm font-bold text-gray-800">Resumen Plan de Control</h3>
                    <span className="text-[10px] text-gray-400">
                        {isFiltered
                            ? <><span className="text-amber-600 font-medium">Filtrado: {stats.totalItems} de {data.items.length}</span> items | {stats.specialCC} CC | {stats.specialSC} SC</>
                            : <>{stats.totalItems} items | {stats.specialCC} CC | {stats.specialSC} SC</>}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* AP Distribution */}
                    <div className="border border-gray-200 rounded-lg p-3">
                        <h4 className="text-xs font-bold text-gray-600 mb-2">Distribución AP (del AMFE)</h4>
                        {apTotal === 0 && stats.totalItems > 0 ? (
                            <p className="text-[10px] text-gray-400 italic">Sin datos AP — genere desde un AMFE con S/O/D</p>
                        ) : (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold w-6 text-center bg-red-500 text-white rounded px-1">H</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                        <div className="bg-red-500 h-full rounded-full transition-all" style={{ width: apBarWidth(stats.apH) }} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 w-8 text-right">{stats.apH}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold w-6 text-center bg-yellow-400 text-black rounded px-1">M</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                        <div className="bg-yellow-400 h-full rounded-full transition-all" style={{ width: apBarWidth(stats.apM) }} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 w-8 text-right">{stats.apM}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold w-6 text-center bg-green-500 text-white rounded px-1">L</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                        <div className="bg-green-500 h-full rounded-full transition-all" style={{ width: apBarWidth(stats.apL) }} />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 w-8 text-right">{stats.apL}</span>
                                </div>
                            </div>
                        )}
                        {stats.apNone > 0 && apTotal > 0 && (
                            <p className="text-[10px] text-gray-400 mt-1">{stats.apNone} sin AP asignado</p>
                        )}
                    </div>

                    {/* Completion Status */}
                    <div className="border border-gray-200 rounded-lg p-3">
                        <h4 className="text-xs font-bold text-gray-600 mb-2">Completitud de Campos</h4>
                        <div className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-gray-500">Campos requeridos</span>
                                <span className={`text-xs font-bold ${stats.completionPercent === 100 ? 'text-teal-600' : stats.completionPercent > 70 ? 'text-teal-500' : 'text-amber-600'}`}>
                                    {stats.completionPercent}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${
                                    stats.completionPercent === 100 ? 'bg-teal-500' :
                                    stats.completionPercent > 70 ? 'bg-teal-400' :
                                    stats.completionPercent > 40 ? 'bg-amber-400' : 'bg-red-400'
                                }`} style={{ width: `${stats.completionPercent}%` }} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">Método Control</span>
                                <span className="font-bold text-gray-700">{stats.withControlMethod}/{stats.totalItems}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">Plan Reacción</span>
                                <span className="font-bold text-gray-700">{stats.withReactionPlan}/{stats.totalItems}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">Resp. Reacción</span>
                                <span className={`font-bold ${stats.withReactionPlanOwner < stats.totalItems ? 'text-red-600' : 'text-gray-700'}`}>
                                    {stats.withReactionPlanOwner}/{stats.totalItems}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500">Especificación</span>
                                <span className="font-bold text-gray-700">{stats.withSpecification}/{stats.totalItems}</span>
                            </div>
                        </div>
                    </div>

                    {/* Critical Items */}
                    <div className="border border-gray-200 rounded-lg p-3">
                        <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1">
                            <AlertTriangle size={12} className="text-red-500" />
                            Ítems Críticos (CC/SC o AP=H incompletos)
                        </h4>
                        {stats.criticalItems.length === 0 ? (
                            stats.totalItems === 0 ? (
                                <p className="text-[10px] text-gray-400 italic">Sin items en el plan</p>
                            ) : (
                                <p className="text-xs text-teal-600 mt-2 flex items-center gap-1">
                                    <CheckCircle size={12} />
                                    Todos los ítems críticos están completos
                                </p>
                            )
                        ) : (
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {stats.criticalItems.map((item, i) => (
                                    <div key={i} className="flex items-start gap-1.5 text-[10px]">
                                        <ShieldAlert size={10} className="text-red-500 flex-shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                            <span className="text-gray-500">{item.processStep}:</span>{' '}
                                            <span className="font-medium text-gray-800 break-words">{item.description}</span>
                                            <span className="text-red-600 ml-1">(falta: {item.missing.join(', ')})</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Per-operation breakdown table */}
                {operationBreakdown.length > 1 && (
                    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[10px] font-semibold text-gray-600 uppercase">
                            Desglose por Operación
                        </div>
                        <table className="w-full text-[10px]">
                            <thead><tr className="bg-gray-50 text-gray-500">
                                <th className="px-2 py-1 text-left font-medium">Op</th>
                                <th className="px-2 py-1 text-left font-medium">Descripción</th>
                                <th className="px-2 py-1 text-center font-medium">Items</th>
                                <th className="px-2 py-1 text-center font-medium">%</th>
                                <th className="px-2 py-1 text-center font-medium">CC</th>
                                <th className="px-2 py-1 text-center font-medium">SC</th>
                            </tr></thead>
                            <tbody>
                                {operationBreakdown.map(op => {
                                    const pct = op.total > 0 ? Math.round((op.complete / op.total) * 100) : 0;
                                    return (
                                        <tr key={op.step} className={pct < 80 ? 'bg-amber-50' : ''}>
                                            <td className="px-2 py-1 font-mono font-bold">{op.step}</td>
                                            <td className="px-2 py-1 truncate max-w-[120px]" title={op.desc}>{op.desc}</td>
                                            <td className="px-2 py-1 text-center">{op.total}</td>
                                            <td className="px-2 py-1 text-center font-medium">{pct}%</td>
                                            <td className="px-2 py-1 text-center">{op.cc > 0 ? <span className="text-red-600 font-bold">{op.cc}</span> : '-'}</td>
                                            <td className="px-2 py-1 text-center">{op.sc > 0 ? <span className="text-amber-600 font-bold">{op.sc}</span> : '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ControlPlanSummary;
