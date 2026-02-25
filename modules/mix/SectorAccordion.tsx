import React, { useState } from 'react';
import { SectorRequirement } from '../../types';
import { MachineRequirementCard } from './MachineRequirementCard';
import { ChevronDown, ChevronRight, Users, AlertTriangle } from 'lucide-react';

interface SectorAccordionProps {
    sector: SectorRequirement;
    defaultExpanded?: boolean;
}

/**
 * SectorAccordion - Expandable sector with machine list
 * "🔧 COSTURA (18 puestos)" -> expands to show machines
 */
export const SectorAccordion: React.FC<SectorAccordionProps> = ({
    sector,
    defaultExpanded = true
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const hasDeficit = sector.machines.some(m => m.hasDeficit);

    // Sector icon based on name
    const getSectorIcon = (name: string) => {
        const lower = name.toLowerCase();
        if (lower.includes('costura')) return '🧵';
        if (lower.includes('inyec')) return '💉';
        if (lower.includes('embal') || lower.includes('empa')) return '📦';
        if (lower.includes('tapiz')) return '🪑';
        return '🏭';
    };

    return (
        <div className={`rounded-xl border-2 overflow-hidden transition-all ${hasDeficit
                ? 'border-red-300 bg-red-50/50'
                : 'border-slate-200 bg-white'
            }`}>
            {/* Sector Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {isExpanded ? (
                        <ChevronDown size={20} className="text-slate-400" />
                    ) : (
                        <ChevronRight size={20} className="text-slate-400" />
                    )}
                    <span className="text-xl">{getSectorIcon(sector.sectorName)}</span>
                    <div>
                        <h3 className="font-bold text-slate-800 text-left">
                            {sector.sectorName.toUpperCase()}
                        </h3>
                        <p className="text-xs text-slate-500 text-left">
                            {sector.machines.length} tipo(s) de máquina
                            {sector.manualOperators > 0 && ` + ${sector.manualOperators} manual`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {hasDeficit && (
                        <div className="flex items-center gap-1 text-red-600 text-sm">
                            <AlertTriangle size={16} />
                            <span className="font-medium">Déficit</span>
                        </div>
                    )}
                    <div
                        className="px-3 py-1.5 rounded-full font-bold text-white"
                        style={{ backgroundColor: sector.sectorColor }}
                    >
                        {sector.totalPuestos} puestos
                    </div>
                </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-4 pt-0 space-y-3">
                    {/* Machines */}
                    {sector.machines.map((machine) => (
                        <MachineRequirementCard
                            key={machine.machineId}
                            machine={machine}
                            defaultExpanded={sector.machines.length === 1}
                        />
                    ))}

                    {/* Manual operators */}
                    {sector.manualOperators > 0 && (
                        <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Users size={16} className="text-slate-500" />
                                <span className="font-medium text-slate-700">Operaciones Manuales</span>
                            </div>
                            <span className="font-bold text-slate-700">
                                {sector.manualOperators} operario(s)
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
