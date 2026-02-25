/**
 * Sheet Navigator — Sidebar listing all operation sheets.
 * Click to switch active sheet. Shows completion status.
 */

import React, { useState } from 'react';
import { HojaOperacion } from './hojaOperacionesTypes';
import { Search, FileText, CheckCircle2, Circle } from 'lucide-react';

interface Props {
    sheets: HojaOperacion[];
    activeSheetId: string | null;
    onSelect: (sheetId: string) => void;
}

function isSheetComplete(sheet: HojaOperacion): boolean {
    return (
        sheet.steps.length > 0 &&
        sheet.safetyElements.length > 0 &&
        sheet.preparedBy.trim() !== '' &&
        sheet.approvedBy.trim() !== ''
    );
}

const HoSheetNavigator: React.FC<Props> = ({ sheets, activeSheetId, onSelect }) => {
    const [search, setSearch] = useState('');

    const filtered = sheets.filter(s => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
            s.operationNumber.toLowerCase().includes(q) ||
            s.operationName.toLowerCase().includes(q) ||
            s.hoNumber.toLowerCase().includes(q)
        );
    });

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
                        placeholder="Buscar operacion..."
                        className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Sheet list */}
            <div className="flex-1 overflow-y-auto">
                {filtered.map(sheet => {
                    const isActive = sheet.id === activeSheetId;
                    const complete = isSheetComplete(sheet);
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
                            {complete ? (
                                <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                            ) : (
                                <Circle size={14} className="text-gray-300 flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                                <div className={`font-medium truncate ${isActive ? 'text-blue-800' : 'text-gray-700'}`}>
                                    Op {sheet.operationNumber}
                                </div>
                                <div className="text-[10px] text-gray-400 truncate">
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
                    <p className="text-xs text-gray-400 italic px-3 py-4 text-center">
                        {search ? 'Sin resultados' : 'Sin hojas generadas'}
                    </p>
                )}
            </div>

            {/* Footer */}
            <div className="p-2 border-t border-gray-100 text-[10px] text-gray-400 text-center">
                {sheets.length} hoja(s) &middot; {sheets.filter(isSheetComplete).length} completa(s)
            </div>
        </div>
    );
};

export default HoSheetNavigator;
