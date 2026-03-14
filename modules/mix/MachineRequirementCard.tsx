import React, { useState } from 'react';
import { MachineRequirement } from '../../types';
import { ProductStackedBar } from './ProductStackedBar';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Wrench } from 'lucide-react';

interface MachineRequirementCardProps {
    machine: MachineRequirement;
    defaultExpanded?: boolean;
}

/**
 * MachineRequirementCard - Shows machine requirement with product breakdown
 * "Máquina Recta: 9/12 ✅" expandable to show product contribution
 */
export const MachineRequirementCard: React.FC<MachineRequirementCardProps> = ({
    machine,
    defaultExpanded = false
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const hasDeficit = machine.hasDeficit;
    const saturationColor = machine.saturationPerUnit < 85
        ? 'text-green-600'
        : machine.saturationPerUnit < 95
            ? 'text-amber-600'
            : 'text-red-600';

    return (
        <div className={`border rounded-lg overflow-hidden transition-all ${hasDeficit ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
            }`}>
            {/* Header - Always visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {isExpanded ? (
                        <ChevronDown size={16} className="text-slate-400" />
                    ) : (
                        <ChevronRight size={16} className="text-slate-400" />
                    )}
                    <Wrench size={16} className="text-indigo-500" />
                    <span className="font-medium text-slate-800">{machine.machineName}</span>
                </div>

                <div className="flex items-center gap-4">
                    {/* Units indicator */}
                    <div className="flex items-center gap-2">
                        <span className={`font-bold ${hasDeficit ? 'text-red-600' : 'text-slate-700'}`}>
                            {machine.unitsRequired}
                        </span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-500">{machine.unitsAvailable}</span>

                        {hasDeficit ? (
                            <div className="flex items-center gap-1 text-red-600">
                                <AlertTriangle size={14} />
                                <span className="text-xs font-medium">-{machine.unitsRequired - machine.unitsAvailable}</span>
                            </div>
                        ) : (
                            <CheckCircle size={14} className="text-green-500" />
                        )}
                    </div>

                    {/* Saturation badge */}
                    <span className={`text-sm font-medium ${saturationColor}`}>
                        {machine.saturationPerUnit.toFixed(0)}%
                    </span>
                </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
                <div className="p-3 pt-0 space-y-3 border-t border-slate-100">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-slate-50 rounded p-2 text-center">
                            <div className="text-slate-500">Tiempo Total</div>
                            <div className="font-mono font-bold text-slate-700">
                                {machine.totalWeightedTime.toFixed(1)}s
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded p-2 text-center">
                            <div className="text-slate-500">Por Unidad</div>
                            <div className="font-mono font-bold text-slate-700">
                                {(machine.unitsRequired > 0 ? machine.totalWeightedTime / machine.unitsRequired : 0).toFixed(1)}s
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded p-2 text-center">
                            <div className="text-slate-500">Saturación</div>
                            <div className={`font-bold ${saturationColor}`}>
                                {machine.saturationPerUnit.toFixed(0)}%
                            </div>
                        </div>
                    </div>

                    {/* Product breakdown */}
                    {machine.productBreakdown.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                                Contribución por Producto
                            </div>
                            <ProductStackedBar products={machine.productBreakdown} height={20} />
                        </div>
                    )}

                    {/* Tasks */}
                    {machine.taskDescriptions.length > 0 && (
                        <div className="text-xs text-slate-500">
                            <span className="font-medium">Tareas: </span>
                            {machine.taskDescriptions.slice(0, 3).join(', ')}
                            {machine.taskDescriptions.length > 3 && ` (+${machine.taskDescriptions.length - 3} más)`}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
