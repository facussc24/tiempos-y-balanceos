import React, { useState } from 'react';
import { ArrowRightLeft, X } from 'lucide-react';

interface SelectionActionBarProps {
    count: number;
    stationCount: number;
    onMove: (stationId: number) => void;
    onClear: () => void;
}

/**
 * Floating action bar shown while one or more tasks are selected on the balancing board.
 * Lets the user move the whole selection to a station in a single action (bulk move).
 */
export const SelectionActionBar: React.FC<SelectionActionBarProps> = ({ count, stationCount, onMove, onClear }) => {
    const [targetStation, setTargetStation] = useState(1);
    const stations = Array.from({ length: Math.max(1, stationCount) }, (_, i) => i + 1);

    return (
        <div
            role="region"
            aria-label="Acciones de selección múltiple"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-modal-backdrop bg-slate-800 text-white rounded-full shadow-2xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-200"
        >
            <span className="text-sm font-bold whitespace-nowrap">
                {count} {count === 1 ? 'tarea seleccionada' : 'tareas seleccionadas'}
            </span>
            <div className="flex items-center gap-2">
                <label htmlFor="bulk-move-station" className="text-xs text-slate-300">Mover a</label>
                <select
                    id="bulk-move-station"
                    value={targetStation}
                    onChange={(e) => setTargetStation(Number(e.target.value))}
                    className="bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600 focus:ring-2 focus:ring-blue-400"
                >
                    {stations.map(n => <option key={n} value={n}>Estación {n}</option>)}
                </select>
                <button
                    type="button"
                    onClick={() => onMove(targetStation)}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-3 py-1.5 rounded transition-colors"
                >
                    <ArrowRightLeft size={14} /> Mover
                </button>
            </div>
            <button
                type="button"
                onClick={onClear}
                aria-label="Limpiar selección"
                title="Limpiar selección"
                className="text-slate-300 hover:text-white transition-colors"
            >
                <X size={18} />
            </button>
        </div>
    );
};
