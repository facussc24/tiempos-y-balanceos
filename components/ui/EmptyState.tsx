/**
 * EmptyState - Smart Empty States Component
 * 
 * Displays informative empty states with suggested actions.
 * Used when a module has no data yet.
 * 
 * @module EmptyState
 * @version 1.0.0
 */

import React from 'react';
import { LucideIcon, Lightbulb, ArrowRight } from 'lucide-react';

export interface EmptyStateAction {
    /** Button label */
    label: string;
    /** Click handler */
    onClick: () => void;
    /** Button variant */
    variant?: 'primary' | 'secondary' | 'ghost';
    /** Optional icon */
    icon?: LucideIcon;
}

interface EmptyStateProps {
    /** Main icon for the empty state */
    icon: LucideIcon;
    /** Title text */
    title: string;
    /** Description text */
    description: string;
    /** Optional actions/buttons */
    actions?: EmptyStateAction[];
    /** Optional tip/hint text */
    tip?: string;
    /** Optional className for container */
    className?: string;
    /** Size variant */
    size?: 'default' | 'compact';
}

/**
 * EmptyState Component
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    actions = [],
    tip,
    className = '',
    size = 'default'
}) => {
    const isCompact = size === 'compact';

    return (
        <div className={`flex flex-col items-center justify-center text-center animate-in fade-in-50 duration-300 ${className}`}>
            {/* Icon Container */}
            <div className={`
                ${isCompact ? 'w-14 h-14 mb-3' : 'w-20 h-20 mb-5'} 
                rounded-2xl bg-gradient-to-br from-blue-100 via-slate-100 to-purple-100 
                flex items-center justify-center shadow-inner
                animate-in zoom-in-75 duration-500
            `}>
                <Icon
                    size={isCompact ? 28 : 40}
                    className="text-blue-500/70"
                    strokeWidth={1.5}
                />
            </div>

            {/* Title */}
            <h3 className={`
                ${isCompact ? 'text-lg' : 'text-xl'} 
                font-bold text-slate-700 mb-2
            `}>
                {title}
            </h3>

            {/* Description */}
            <p className={`
                ${isCompact ? 'text-sm max-w-xs' : 'text-base max-w-md'} 
                text-slate-500 mb-5 leading-relaxed
            `}>
                {description}
            </p>

            {/* Actions */}
            {actions.length > 0 && (
                <div className={`
                    flex flex-wrap items-center justify-center gap-3 
                    ${isCompact ? 'mb-3' : 'mb-5'}
                `}>
                    {actions.map((action, index) => {
                        const ActionIcon = action.icon;
                        const isPrimary = action.variant === 'primary' || (index === 0 && !action.variant);
                        const isGhost = action.variant === 'ghost';

                        return (
                            <button
                                key={index}
                                onClick={action.onClick}
                                className={`
                                    inline-flex items-center gap-2 px-4 py-2.5 rounded-xl 
                                    font-medium text-sm transition-all duration-200
                                    active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400
                                    ${isPrimary
                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5'
                                        : isGhost
                                            ? 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                                    }
                                `}
                            >
                                {ActionIcon && <ActionIcon size={16} />}
                                {action.label}
                                {isPrimary && <ArrowRight size={14} className="opacity-70" />}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Tip */}
            {tip && (
                <div className={`
                    flex items-start gap-2 
                    ${isCompact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'} 
                    bg-amber-50 border border-amber-200 rounded-xl max-w-md
                `}>
                    <Lightbulb
                        size={isCompact ? 14 : 16}
                        className="text-amber-500 flex-shrink-0 mt-0.5"
                    />
                    <span className="text-amber-700 text-left">{tip}</span>
                </div>
            )}
        </div>
    );
};

/**
 * Preset configurations for common empty states
 */
export const EMPTY_STATE_PRESETS = {
    noTasks: {
        title: 'Sin Tareas Configuradas',
        description: 'Agrega operaciones para comenzar el análisis de tiempos y balanceo de línea.',
        tip: 'Puedes importar tareas desde Excel o crearlas manualmente una por una.'
    },
    noBalance: {
        title: 'Sin Asignaciones de Balanceo',
        description: 'Las tareas aún no han sido asignadas a estaciones de trabajo.',
        tip: 'Usa el optimizador automático para una distribución inicial rápida.'
    },
    noVSM: {
        title: 'VSM No Configurado',
        description: 'Configura el mapa de flujo de valor para visualizar tu proceso completo.',
        tip: 'El asistente Lean te guiará paso a paso en la configuración.'
    },
    noSimulation: {
        title: 'Sin Simulaciones Ejecutadas',
        description: 'Ejecuta una simulación Monte Carlo para analizar la variabilidad y riesgos.',
        tip: 'La simulación utiliza los tiempos y desviaciones de tus tareas.'
    },
    noProducts: {
        title: 'Sin Productos Seleccionados',
        description: 'Selecciona productos desde el Dashboard para crear un análisis Mix.',
        tip: 'Puedes seleccionar múltiples productos y definir la demanda de cada uno.'
    }
};

export default EmptyState;
