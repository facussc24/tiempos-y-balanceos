/**
 * MachineSelector - V4.8 Phase 27 (MDM de Máquinas)
 * 
 * Dropdown selector that ensures machine names match
 * exactly between process sheets and plant inventory.
 * Eliminates text-free issues like "Overlock 5h" vs "Overlock Industrial"
 */
import React from 'react';
import { Wrench, ChevronDown, AlertCircle } from 'lucide-react';
import { usePlantAssets } from '../hooks/usePlantAssets';

interface MachineSelectorProps {
    value: string;
    onChange: (machineId: string, machineName: string) => void;
    category?: 'costura' | 'ensamble' | 'inyeccion' | 'all';
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    error?: string;
}

export const MachineSelector: React.FC<MachineSelectorProps> = ({
    value,
    onChange,
    category = 'all',
    placeholder = 'Seleccionar máquina...',
    disabled = false,
    required = false,
    error
}) => {
    // Get machines from global plant assets
    const { machines } = usePlantAssets();

    // Filter by category if specified
    const filteredMachines = category === 'all'
        ? machines
        : machines.filter(m => m.category === category);

    // Find current selection
    const selectedMachine = machines.find(m => m.id === value || m.name === value);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selected = machines.find(m => m.id === e.target.value);
        if (selected) {
            onChange(selected.id, selected.name);
        } else {
            onChange('', '');
        }
    };

    // If no machines configured, show warning
    if (machines.length === 0) {
        return (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
                <AlertCircle size={16} />
                <span>Configure máquinas en la Planta primero</span>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Wrench size={16} />
            </div>
            <select
                value={value}
                onChange={handleChange}
                disabled={disabled}
                className={`
                    w-full pl-10 pr-8 py-2 
                    border rounded-lg 
                    appearance-none cursor-pointer
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    disabled:bg-slate-100 disabled:cursor-not-allowed
                    ${error ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}
                    ${!value && 'text-slate-400'}
                `}
            >
                <option value="">{placeholder}</option>
                {filteredMachines.map(machine => (
                    <option key={machine.id} value={machine.id}>
                        {machine.name} ({machine.availableUnits} disp.)
                    </option>
                ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <ChevronDown size={16} />
            </div>

            {/* Error message */}
            {error && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {error}
                </p>
            )}

            {/* Currently selected info */}
            {selectedMachine && (
                <p className="mt-1 text-xs text-slate-500">
                    Categoría: {selectedMachine.category} •
                    Disponibles: {selectedMachine.availableUnits}
                </p>
            )}
        </div>
    );
};

/**
 * Compact inline version for tables
 */
export const MachineSelectorInline: React.FC<MachineSelectorProps> = ({
    value,
    onChange,
    category = 'all',
    disabled = false
}) => {
    const { machines } = usePlantAssets();
    const filteredMachines = category === 'all'
        ? machines
        : machines.filter(m => m.category === category);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selected = machines.find(m => m.id === e.target.value);
        if (selected) {
            onChange(selected.id, selected.name);
        }
    };

    return (
        <select
            value={value}
            onChange={handleChange}
            disabled={disabled || machines.length === 0}
            className="text-xs px-2 py-1 border border-slate-200 rounded bg-white"
        >
            <option value="">Sin máquina</option>
            {filteredMachines.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
            ))}
        </select>
    );
};
