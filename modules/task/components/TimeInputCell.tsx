import React, { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { parseTaskTime } from '../../../utils/validation';

interface Props {
    value: number | null;
    onChange: (val: string) => void;
    isIgnored: boolean;
    isOutlier: boolean;
    onToggleIgnore?: () => void;
    disabled?: boolean;
}

export const TimeInputCell: React.FC<Props> = ({ value, onChange, isIgnored, isOutlier, onToggleIgnore, disabled }) => {
    // Initialize local state directly from props
    const [localValue, setLocalValue] = useState(value === null ? "" : value.toString().replace('.', ','));

    // Sync local state when prop changes (external update) — using "set state during render"
    // pattern to avoid setState-in-effect cascading renders.
    const [prevValue, setPrevValue] = useState(value);
    if (value !== prevValue) {
        setPrevValue(value);
        const currentParsed = parseTaskTime(localValue, 0);
        if (value !== currentParsed && !(value === null && localValue === "")) {
            setLocalValue(value === null ? "" : value.toString().replace('.', ','));
        }
    }

    const handleBlur = () => {
        // Only trigger change if value actually changed
        const currentParsed = parseTaskTime(localValue, 0);
        if (value !== currentParsed && !(value === null && localValue === "")) {
            onChange(localValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
    };

    return (
        <div className="relative group/time">
            <input
                type="text"
                disabled={disabled}
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={`w-20 h-8 border text-center text-sm rounded-md outline-none font-mono transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 z-10 relative ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-transparent' :
                    isIgnored && isOutlier ? 'bg-amber-50/50 text-amber-400 line-through border-amber-300 border-dashed' :
                    isIgnored ? 'bg-slate-100 text-slate-300 line-through border-slate-200' :
                        isOutlier ? 'border-amber-300 bg-amber-50 text-amber-700 font-bold' :
                            value !== null ? 'border-slate-200 bg-white text-slate-800 font-bold hover:border-slate-300' : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                placeholder="-"
                title={isOutlier && isIgnored ? "Outlier excluido del cálculo. Usá el botón ↩ para restaurarlo." : isOutlier ? "Posible outlier. Usá el botón ❌ para excluirlo del cálculo." : ""}
            />
            {/* Botón para ignorar outliers (solo visible cuando es outlier y no está ignorado) */}
            {!disabled && isOutlier && !isIgnored && onToggleIgnore && (
                <button
                    onClick={onToggleIgnore}
                    className="absolute -top-2 -right-2 bg-amber-100 rounded-full p-0.5 text-amber-600 hover:text-red-600 hover:bg-red-100 border border-amber-300 z-20 shadow-sm transition-colors"
                    title="Ignorar outlier"
                >
                    <X size={10} />
                </button>
            )}
            {/* Botón para restaurar tiempos ignorados */}
            {!disabled && isIgnored && onToggleIgnore && (
                <button
                    onClick={onToggleIgnore}
                    className="absolute -top-2 -right-2 bg-white rounded-full p-0.5 text-slate-400 hover:text-blue-600 border border-slate-200 z-20 shadow-sm"
                    title="Restaurar valor"
                >
                    <RotateCcw size={10} />
                </button>
            )}
        </div>
    );
};
