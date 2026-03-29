/**
 * PFD Symbol Legend — Reference panel showing all 7 ASME/AIAG symbols
 *
 * Displayed below the table. Collapsible.
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PfdSymbol } from './PfdSymbols';
import { PFD_STEP_TYPES } from './pfdTypes';

const STORAGE_KEY = 'pfd_legend_expanded';

const PfdSymbolLegend: React.FC = () => {
    // C4-V2: Persist collapse state in localStorage
    const [expanded, setExpanded] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored !== null ? stored === 'true' : true; // Default expanded for first visit
        } catch { return true; }
    });

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, String(expanded)); } catch { /* localStorage unavailable */ }
    }, [expanded]);

    return (
        <div className="mt-3 bg-white border border-gray-200 rounded-lg shadow-sm">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-50 transition"
            >
                {expanded ? <ChevronDown size={14} className="text-cyan-600" /> : <ChevronRight size={14} className="text-cyan-600" />}
                <span className="text-xs font-semibold text-cyan-700 uppercase tracking-wider">Leyenda de Símbolos</span>
            </button>
            {expanded && (
                <div className="px-4 pb-3">
                    <div className="flex flex-wrap gap-4">
                        {PFD_STEP_TYPES.map(st => (
                            <div key={st.value} className="flex items-center gap-2">
                                <PfdSymbol type={st.value} size={20} />
                                <span className="text-xs text-gray-600">{st.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PfdSymbolLegend;
