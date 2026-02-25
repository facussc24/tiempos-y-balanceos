/**
 * FloatingActionButton - Contextual FAB Component
 * 
 * A floating action button that changes its action based on the current module.
 * Provides quick access to the most common action for each context.
 * 
 * @module FloatingActionButton
 * @version 1.1.0 - Added stagger animation (H-08)
 */

import React, { useState } from 'react';
import { LucideIcon, Plus, Zap, Search, Scale, Play, FileText, ChevronUp } from 'lucide-react';

export interface FABAction {
    /** Button label */
    label: string;
    /** Icon component */
    icon: LucideIcon;
    /** Click handler */
    onClick: () => void;
    /** Color scheme */
    color?: 'blue' | 'emerald' | 'purple' | 'amber' | 'rose';
}

export interface FABConfig {
    /** Primary action */
    primary: FABAction;
    /** Optional secondary actions (expandable menu) */
    secondary?: FABAction[];
}

interface FloatingActionButtonProps {
    /** Configuration for the FAB */
    config: FABConfig | null;
    /** Whether to hide the FAB */
    hidden?: boolean;
}

const colorClasses: Record<string, { bg: string; hover: string; ring: string }> = {
    blue: { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', ring: 'ring-blue-200' },
    emerald: { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', ring: 'ring-emerald-200' },
    purple: { bg: 'bg-purple-600', hover: 'hover:bg-purple-700', ring: 'ring-purple-200' },
    amber: { bg: 'bg-amber-500', hover: 'hover:bg-amber-600', ring: 'ring-amber-200' },
    rose: { bg: 'bg-rose-600', hover: 'hover:bg-rose-700', ring: 'ring-rose-200' },
};

/**
 * FloatingActionButton Component
 */
export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
    config,
    hidden = false
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!config || hidden) return null;

    const { primary, secondary } = config;
    const colors = colorClasses[primary.color || 'blue'];
    const Icon = primary.icon;

    const handlePrimaryClick = () => {
        if (secondary && secondary.length > 0) {
            setIsExpanded(!isExpanded);
        } else {
            primary.onClick();
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 print:hidden">
            {/* Secondary Actions (Expanded Menu) */}
            {isExpanded && secondary && (
                <div className="flex flex-col gap-2 mb-2 animate-in slide-in-from-bottom-4 fade-in duration-200">
                    {secondary.map((action, index) => {
                        const ActionIcon = action.icon;
                        const actionColors = colorClasses[action.color || 'blue'];
                        // Stagger delay: each item appears 50ms after the previous
                        const staggerDelay = index * 50;
                        return (
                            <button
                                key={index}
                                onClick={() => {
                                    action.onClick();
                                    setIsExpanded(false);
                                }}
                                style={{ animationDelay: `${staggerDelay}ms` }}
                                className={`
                                    flex items-center gap-2 px-4 py-2.5 rounded-full
                                    ${actionColors.bg} ${actionColors.hover}
                                    text-white font-medium text-sm shadow-lg
                                    transition-all duration-200 transform hover:scale-105 active:scale-95
                                    animate-in slide-in-from-bottom-2 fade-in fill-mode-backwards
                                `}
                            >
                                <ActionIcon size={18} />
                                <span>{action.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Primary FAB */}
            <button
                onClick={handlePrimaryClick}
                className={`
                    group flex items-center gap-3 
                    ${colors.bg} ${colors.hover}
                    text-white font-bold
                    px-5 py-4 rounded-full
                    shadow-xl hover:shadow-2xl
                    transition-all duration-300 transform hover:scale-105 active:scale-95
                    ring-4 ${colors.ring} ring-opacity-30
                `}
                title={primary.label}
            >
                <Icon
                    size={22}
                    className={`transition-transform duration-200 ${isExpanded ? 'rotate-45' : ''}`}
                />
                <span className="hidden sm:inline pr-1">{primary.label}</span>
                {secondary && secondary.length > 0 && (
                    <ChevronUp
                        size={16}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                )}
            </button>
        </div>
    );
};

/**
 * Preset FAB configurations for different modules
 */
export const FAB_PRESETS = {
    dashboard: (onNewStudy: () => void): FABConfig => ({
        primary: {
            label: 'Nuevo Estudio',
            icon: Plus,
            onClick: onNewStudy,
            color: 'blue'
        }
    }),
    tasks: (onAddTask: () => void): FABConfig => ({
        primary: {
            label: 'Nueva Tarea',
            icon: Plus,
            onClick: onAddTask,
            color: 'emerald'
        }
    }),
    balance: (onOptimize: () => void, onAddStation: () => void): FABConfig => ({
        primary: {
            label: 'Optimizar',
            icon: Zap,
            onClick: onOptimize,
            color: 'purple'
        },
        secondary: [
            {
                label: 'Agregar Estación',
                icon: Plus,
                onClick: onAddStation,
                color: 'blue'
            }
        ]
    }),
    sim: (onRunSimulation: () => void): FABConfig => ({
        primary: {
            label: 'Ejecutar Simulación',
            icon: Play,
            onClick: onRunSimulation,
            color: 'amber'
        }
    }),
    vsm: (onDetectWaste: () => void): FABConfig => ({
        primary: {
            label: 'Detectar Desperdicios',
            icon: Search,
            onClick: onDetectWaste,
            color: 'rose'
        }
    }),
    reports: (onExportPDF: () => void): FABConfig => ({
        primary: {
            label: 'Exportar PDF',
            icon: FileText,
            onClick: onExportPDF,
            color: 'blue'
        }
    })
};

export default FloatingActionButton;
