/**
 * Sheet Navigator — Sidebar listing all operation sheets.
 * Click to switch active sheet. Shows completion status with percentage.
 */

import React, { useState, useMemo } from 'react';
import { HojaOperacion } from './hojaOperacionesTypes';
import { Search, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
    sheets: HojaOperacion[];
    activeSheetId: string | null;
    onSelect: (sheetId: string) => void;
}

interface SheetScore {
    percent: number;
    warnings: string[];
}

function getSheetCompletionScore(sheet: HojaOperacion): SheetScore {
    const checks = [
        { done: sheet.steps.length > 0, label: 'Pasos' },
        { done: sheet.qualityChecks.length > 0, label: 'Controles' },
        { done: sheet.safetyElements.length > 0, label: 'EPP' },
        { done: sheet.preparedBy.trim() !== '', label: 'Realizó' },
        { done: sheet.approvedBy.trim() !== '', label: 'Aprobó' },
        { done: sheet.visualAids.length > 0, label: 'Ayudas visuales' },
        { done: sheet.reactionContact.trim() !== '', label: 'Contacto reacción' },
    ];
    const done = checks.filter(c => c.done).length;
    const percent = Math.round((done / checks.length) * 100);
    const warnings = checks.filter(c => !c.done).map(c => c.label);
    return { percent, warnings };
}

const HoSheetNavigator: React.FC<Props> = ({ sheets, activeSheetId, onSelect }) => {
    const [search, setSearch] = useState('');

    const filtered = sheets.filter(s => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            (s.operationNumber || '').toLowerCase().includes(q) ||
            (s.operationName || '').toLowerCase().includes(q) ||
            (s.hoNumber || '').toLowerCase().includes(q)
        );
    });

    const avgPercent = useMemo(() => {
        if (sheets.length === 0) return 0;
        const total = sheets.reduce((sum, s) => sum + getSheetCompletionScore(s).percent, 0);
        return Math.round(total / sheets.length);
    }, [sheets]);

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200">
            {/* Search */}
            <div className="p-2 border-b border-gray-100">
                <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar operación..."
                        aria-label="Buscar hojas de operaciones"
                        className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Sheet list */}
            <div className="flex-1 overflow-y-auto">
                {filtered.map((sheet, idx) => {
                    const isActive = sheet.id === activeSheetId;
                    const { percent, warnings } = getSheetCompletionScore(sheet);
                    return (
                        <button
                            key={sheet.id}
                            onClick={() => onSelect(sheet.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-gray-50 transition text-xs ${
                                isActive
                                    ? 'bg-blue-50 border-l-2 border-l-blue-700'
                                    : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                            }`}
                        >
                            {percent === 100 ? (
                                <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                            ) : percent >= 50 ? (
                                <div className="relative flex-shrink-0" title={`Falta: ${warnings.join(', ')}`}>
                                    <div className="w-[18px] h-[18px] rounded-full border-2 border-amber-400 flex items-center justify-center">
                                        <span className="text-[7px] font-bold text-amber-600">{percent}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative flex-shrink-0" title={`Falta: ${warnings.join(', ')}`}>
                                    <AlertTriangle size={14} className="text-red-400" />
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className={`font-medium truncate ${isActive ? 'text-blue-800' : 'text-gray-700'}`}>
                                    Op {sheet.operationNumber || `#${idx + 1}`}
                                </div>
                                <div className="text-[10px] text-gray-400 truncate" title={sheet.operationName}>
                                    {sheet.operationName}
                                </div>
                            </div>
                            <span className="text-[10px] text-gray-300 flex-shrink-0">
                                {sheet.hoNumber}
                            </span>
                        </button>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="text-center px-3 py-6">
                        <FileText className="mx-auto mb-2 text-gray-300" size={28} />
                        <p className="text-xs text-gray-500 font-medium mb-1">
                            {search ? 'Sin resultados' : 'Sin hojas de operaciones'}
                        </p>
                        {!search && (
                            <p className="text-[10px] text-gray-400 leading-relaxed">
                                Se generan desde el AMFE y el Plan de Control.
                                Volvé a la pestaña AMFE y usá "Generar Hojas de Operaciones".
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-gray-100 text-[10px] text-gray-400 text-center">
                {sheets.length} hoja(s) &middot; Completitud: {avgPercent}%
            </div>
        </div>
    );
};

export default HoSheetNavigator;
