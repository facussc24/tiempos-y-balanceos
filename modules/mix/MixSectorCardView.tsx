/**
 * MixSectorCardView - Tarjeta visual de sector con recursos
 * 
 * Muestra los recursos necesarios por sector de forma clara y simple.
 * Incluye iconos de máquinas, operarios, y alertas en lenguaje simple.
 * 
 * @module MixSectorCardView
 * @version 2.0.0
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Users, Cog, Lightbulb } from 'lucide-react';
import { MixSectorCard, MixMachineCard } from '../../types';

interface MixSectorCardViewProps {
    sector: MixSectorCard;
    isExpanded?: boolean;
}

export const MixSectorCardView: React.FC<MixSectorCardViewProps> = ({
    sector,
    isExpanded: initialExpanded = true
}) => {
    const [isExpanded, setIsExpanded] = useState(initialExpanded);

    const hasDeficit = sector.machines.some(m => m.hasDeficit);
    const totalMachines = sector.machines.reduce((sum, m) => sum + m.unitsRequired, 0);

    return (
        <div className={`rounded-md border overflow-hidden transition-all duration-300 ${hasDeficit
            ? 'border-red-300 bg-status-crit-bg'
            : 'border-slate-200 bg-white'
            }`}>
            {/* Header - Always Visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
            >
                <div className="flex items-center gap-4">
                    {/* Color indicator */}
                    <div
                        className="w-4 h-12 rounded-md"
                        style={{ backgroundColor: sector.sectorColor }}
                    />

                    <div className="text-left">
                        <h3 className="font-bold text-lg text-slate-800">
                            {sector.sectorName}
                        </h3>
                        <p className="text-sm text-slate-500">
                            {totalMachines} máquina{totalMachines !== 1 ? 's' : ''} • {sector.operatorsRequired} operario{sector.operatorsRequired !== 1 ? 's' : ''}
                        </p>
                    </div>

                    {/* Status badge */}
                    {hasDeficit ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-md text-xs font-medium">
                            <AlertTriangle size={14} />
                            Faltan recursos
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-md text-xs font-medium">
                            <CheckCircle size={14} />
                            OK
                        </div>
                    )}

                    {/* Shared badge */}
                    {sector.isShared && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                            <Lightbulb size={14} />
                            Compartido
                        </div>
                    )}
                </div>

                {isExpanded ? (
                    <ChevronUp size={20} className="text-slate-400" />
                ) : (
                    <ChevronDown size={20} className="text-slate-400" />
                )}
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-100">
                    {/* Machines Grid */}
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {sector.machines.map((machine) => (
                            <MachineCard key={machine.machineId} machine={machine} />
                        ))}

                        {/* Operators Card */}
                        <div className="p-4 rounded-md border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center transition-colors">
                            <Users size={28} className="text-slate-600 mb-2" />
                            <p className="font-bold text-2xl text-slate-800">
                                {sector.operatorsRequired}
                            </p>
                            <p className="text-xs text-slate-500">
                                Operario{sector.operatorsRequired !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>

                    {/* Alerts */}
                    {sector.alerts.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {sector.alerts.map((alert, idx) => (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-md text-sm ${alert.startsWith('⚠️')
                                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                        : 'bg-blue-50 text-blue-800 border border-blue-200'
                                        }`}
                                >
                                    {alert}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Shared Products Info */}
                    {sector.isShared && sector.sharedProducts.length > 1 && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                            <p className="text-sm text-blue-800">
                                <strong>💡 Recurso compartido:</strong> Los productos{' '}
                                <strong>{sector.sharedProducts.join(', ')}</strong> comparten este sector.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/**
 * MachineCard - Subcomponente para mostrar una máquina
 */
const MachineCard: React.FC<{ machine: MixMachineCard }> = ({ machine }) => {
    return (
        <div className={`p-4 rounded-md border flex flex-col items-center justify-center text-center transition-all ${machine.hasDeficit
            ? 'border-red-300 bg-red-50'
            : 'border-slate-200 bg-white'
            }`}>
            <Cog size={28} className={machine.hasDeficit ? 'text-red-500' : 'text-blue-500'} />

            <p className={`font-bold text-2xl mt-2 ${machine.hasDeficit ? 'text-red-600' : 'text-slate-800'
                }`}>
                {machine.unitsRequired}
                {machine.unitsAvailable < 999 && (
                    <span className="text-base font-normal text-slate-400">
                        /{machine.unitsAvailable}
                    </span>
                )}
            </p>

            <p className="text-xs text-slate-500 mt-1 truncate w-full" title={machine.machineName}>
                {machine.machineName}
            </p>

            {machine.hasDeficit && machine.deficitMessage && (
                <p className="text-xs text-red-600 mt-1">
                    {machine.deficitMessage}
                </p>
            )}
        </div>
    );
};
