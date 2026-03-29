/**
 * InfoTooltip - V4.8 UX Redesign
 * 
 * Progressive disclosure tooltip for technical terms.
 * Shows term name with hover explanation and optional formula.
 * 
 * Levels:
 * 1. Default: Term + Value
 * 2. Hover: Simple explanation in Spanish
 * 3. Click/Expand: Full mathematical formula
 */
import React, { useState } from 'react';
import { Info, Calculator, ChevronDown, ChevronUp } from 'lucide-react';

interface InfoTooltipProps {
    /** Technical term (e.g., "Takt Time") */
    term: string;
    /** Simple explanation in Spanish */
    simple: string;
    /** Mathematical formula (optional) */
    formula?: string;
    /** Current calculated value */
    value?: string | number;
    /** Unit of measurement */
    unit?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Show value inline with term */
    inline?: boolean;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
    term,
    simple,
    formula,
    value,
    unit = '',
    size = 'md',
    inline = true
}) => {
    const [showFormula, setShowFormula] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const sizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    };

    const iconSizes = {
        sm: 10,
        md: 12,
        lg: 14
    };

    return (
        <span className="inline-flex items-center gap-1 group relative">
            {/* Term + Value */}
            <span className={`font-medium ${sizeClasses[size]}`}>
                {term}
                {inline && value !== undefined && (
                    <span className="ml-1 font-bold">
                        {typeof value === 'number' ? value.toFixed(1) : value}{unit}
                    </span>
                )}
            </span>

            {/* Info Icon - Now keyboard accessible */}
            <span
                tabIndex={0}
                role="button"
                aria-label={`Información sobre ${term}`}
                aria-expanded={isVisible}
                onFocus={() => setIsVisible(true)}
                onBlur={() => setIsVisible(false)}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsVisible(v => !v); }
                    if (e.key === 'Escape') setIsVisible(false);
                }}
                className="cursor-help text-slate-400 hover:text-blue-500 focus:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded transition-colors"
            >
                <Info size={iconSizes[size]} />
            </span>

            {/* Tooltip Popup - Now controlled by state */}
            <span className={`
                absolute bottom-full left-0 mb-2 
                px-3 py-2 min-w-[200px] max-w-[300px]
                bg-slate-800 text-white text-xs rounded-lg 
                transition-all duration-200 
                z-50 shadow-xl
                ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
            `}>
                {/* Simple Explanation */}
                <p className="mb-1">{simple}</p>

                {/* Value Display (if not inline) */}
                {!inline && value !== undefined && (
                    <p className="text-emerald-400 font-bold mt-1">
                        = {typeof value === 'number' ? value.toFixed(2) : value}{unit}
                    </p>
                )}

                {/* Formula Toggle */}
                {formula && (
                    <div className="mt-2 border-t border-slate-700 pt-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowFormula(!showFormula);
                            }}
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-[10px]"
                        >
                            <Calculator size={10} />
                            {showFormula ? 'Ocultar fórmula' : 'Ver fórmula'}
                            {showFormula ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>

                        {showFormula && (
                            <div className="mt-1 p-2 bg-slate-900 rounded font-mono text-[10px] text-slate-300">
                                {formula}
                            </div>
                        )}
                    </div>
                )}

                {/* Arrow */}
                <span className="absolute bottom-[-4px] left-4 w-2 h-2 bg-slate-800 rotate-45" />
            </span>
        </span>
    );
};

/**
 * Compact version for table headers - keyboard accessible
 */
const InfoTooltipCompact: React.FC<{
    term: string;
    simple: string;
}> = ({ term, simple }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <span className="inline-flex items-center gap-0.5 relative">
            <span className="text-xs font-medium">{term}</span>
            <span
                tabIndex={0}
                role="button"
                aria-label={`Información sobre ${term}`}
                aria-expanded={isVisible}
                onFocus={() => setIsVisible(true)}
                onBlur={() => setIsVisible(false)}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsVisible(v => !v); }
                    if (e.key === 'Escape') setIsVisible(false);
                }}
                className="cursor-help text-slate-400 hover:text-blue-500 focus:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded"
            >
                <Info size={10} />
            </span>
            <span className={`
                absolute bottom-full left-0 mb-1 
                px-2 py-1 w-max max-w-[180px]
                bg-slate-800 text-white text-[10px] rounded 
                z-50 shadow-lg transition-opacity duration-150
                ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
            `}>
                {simple}
            </span>
        </span>
    );
};

/**
 * Predefined tooltips for common Lean terms
 */
export const LEAN_TOOLTIPS = {
    taktTime: {
        term: 'Takt Time',
        simple: '🎯 El ritmo que pide tu cliente. Cada cuántos segundos necesita 1 pieza.',
        formula: 'Takt = Tiempo Disponible / Demanda'
    },
    cycleTime: {
        term: 'Cycle Time',
        simple: '⏱️ Cuánto tarda tu línea en producir 1 pieza realmente.',
        formula: 'CT = Σ Tiempos de Tareas / Estaciones'
    },
    saturation: {
        term: 'Saturación',
        simple: '📊 Porcentaje del Takt nominal utilizado. Una línea bien balanceada con OBE 85% muestra ~85%, dejando visible el margen para pérdidas reales.',
        formula: 'Saturación = (Tiempo Trabajo / (Uds × Takt Nominal)) × 100%'
    },
    heijunka: {
        term: 'Heijunka',
        simple: '📦 Nivelar la producción: en vez de AAAA-BBBB, hacer A-B-A-B.',
        formula: undefined
    },
    pitch: {
        term: 'Pitch',
        simple: '🚚 Cada cuántos minutos pasa el carretillero a recoger piezas.',
        formula: 'Pitch = Takt × Cantidad por Caja'
    },
    yamazumi: {
        term: 'Yamazumi',
        simple: '📊 Gráfico de barras que muestra la carga de cada estación.',
        formula: undefined
    },
    oee: {
        term: 'OEE',
        simple: '🏭 Eficiencia Global del Equipo: disponibilidad × rendimiento.',
        formula: 'OEE = A × P'
    }
} as const;
