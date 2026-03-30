/**
 * HeijunkaTaskList - V4.8 UX Redesign
 * 
 * Simplified operator view for Heijunka (Mission List).
 * Per expert recommendation: "No muestres la matriz compleja.
 * Muestra una Lista de Misiones que se actualiza en tiempo real."
 * 
 * Features:
 * - Shows current time slot's tasks
 * - Simple action items (what to pick, how many)
 * - Mark as completed
 * - Next slot preview
 */
import React, { useState, useMemo } from 'react';
import {
    Package,
    CheckCircle,
    Truck,
} from 'lucide-react';

interface ProductMission {
    productId: string;
    productName: string;
    color: string;
    quantity: number;
}

interface TimeSlot {
    startTime: string;  // "08:00"
    endTime: string;    // "08:20"
    missions: ProductMission[];
    isCompleted?: boolean;
}

interface HeijunkaTaskListProps {
    slots: TimeSlot[];
    currentTime?: string;  // Current time for highlighting
    onSlotComplete?: (slotIndex: number) => void;
    operatorName?: string;
}

const HeijunkaTaskList: React.FC<HeijunkaTaskListProps> = ({
    slots,
    currentTime,
    onSlotComplete,
    operatorName = 'Operario'
}) => {
    const [completedSlots, setCompletedSlots] = useState<Set<number>>(new Set());

    // Find current/next slot based on time
    const { currentSlotIndex, nextSlotIndex } = useMemo(() => {
        if (!currentTime || slots.length === 0) {
            return { currentSlotIndex: 0, nextSlotIndex: 1 };
        }

        const now = currentTime;
        let current = 0;

        for (let i = 0; i < slots.length; i++) {
            if (now >= slots[i].startTime && now < slots[i].endTime) {
                current = i;
                break;
            }
            if (now < slots[i].startTime) {
                current = Math.max(0, i - 1);
                break;
            }
            current = i;
        }

        return {
            currentSlotIndex: current,
            nextSlotIndex: Math.min(current + 1, slots.length - 1)
        };
    }, [slots, currentTime]);

    const handleComplete = (index: number) => {
        setCompletedSlots(prev => new Set([...prev, index]));
        onSlotComplete?.(index);
    };

    const isCompleted = (index: number) => completedSlots.has(index);

    if (slots.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <Truck size={40} className="text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No hay misiones programadas</p>
            </div>
        );
    }

    const currentSlot = slots[currentSlotIndex];
    const nextSlot = slots[nextSlotIndex];

    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-blue-600 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-indigo-200 text-sm">Hola, {operatorName}</p>
                        <h2 className="text-white text-xl font-bold">Tu Lista de Misiones</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-indigo-200 text-xs">Hora actual</p>
                        <p className="text-white text-2xl font-mono font-bold">
                            {currentTime || '--:--'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Current Mission */}
            <div className="p-6">
                <div className="mb-2 flex items-center gap-2">
                    <span className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                        AHORA
                    </span>
                    <span className="text-slate-400 text-sm">
                        {currentSlot.startTime} - {currentSlot.endTime}
                    </span>
                </div>

                {isCompleted(currentSlotIndex) ? (
                    <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-6 text-center">
                        <CheckCircle size={40} className="text-emerald-400 mx-auto mb-2" />
                        <p className="text-emerald-400 font-medium">¡Misión Completada!</p>
                    </div>
                ) : (
                    <div className="bg-slate-800 rounded-xl p-4 space-y-3">
                        {currentSlot.missions.map((mission, idx) => (
                            <div
                                key={idx}
                                className="flex items-center gap-4 bg-slate-700/50 rounded-lg p-4"
                            >
                                <div
                                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                                    style={{ backgroundColor: mission.color }}
                                >
                                    {mission.quantity}
                                </div>
                                <div className="flex-1">
                                    <p className="text-white font-medium">
                                        {mission.quantity} {mission.quantity === 1 ? 'caja' : 'cajas'} de
                                    </p>
                                    <p className="text-lg text-white font-bold">
                                        {mission.productName}
                                    </p>
                                </div>
                                <Package size={24} className="text-slate-500" />
                            </div>
                        ))}

                        <button
                            onClick={() => handleComplete(currentSlotIndex)}
                            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={20} />
                            Marcar como Entregado
                        </button>
                    </div>
                )}
            </div>

            {/* Next Mission Preview */}
            {nextSlotIndex !== currentSlotIndex && (
                <div className="px-6 pb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded">
                            SIGUIENTE
                        </span>
                        <span className="text-slate-400 text-sm">
                            {nextSlot.startTime} - {nextSlot.endTime}
                        </span>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4">
                        <div className="flex items-center gap-3 text-slate-300">
                            {nextSlot.missions.map((mission, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2"
                                >
                                    <div
                                        className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                                        style={{ backgroundColor: mission.color }}
                                    >
                                        {mission.quantity}
                                    </div>
                                    <span className="text-sm">{mission.productName}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Progress Footer */}
            <div className="bg-slate-800 px-6 py-4 border-t border-slate-700">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                        Misiones completadas: {completedSlots.size} / {slots.length}
                    </span>
                    <div className="flex gap-1">
                        {slots.map((_, idx) => (
                            <div
                                key={idx}
                                className={`w-2 h-2 rounded-full ${isCompleted(idx)
                                        ? 'bg-emerald-500'
                                        : idx === currentSlotIndex
                                            ? 'bg-indigo-500'
                                            : 'bg-slate-600'
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Helper to convert HeijunkaBox data to TaskList format
 */
function convertToTaskList(
    heijunkaSlots: Array<{ time: string; products: Array<{ name: string; qty: number; color: string }> }>,
    pitchMinutes: number
): TimeSlot[] {
    return heijunkaSlots.map((slot) => {
        const startHour = parseInt(slot.time.split(':')[0]) || 0;
        const startMin = parseInt(slot.time.split(':')[1]) || 0;
        const endMin = startMin + pitchMinutes;
        const endHour = (startHour + Math.floor(endMin / 60)) % 24;
        const endMinNorm = endMin % 60;

        return {
            startTime: slot.time,
            endTime: `${endHour.toString().padStart(2, '0')}:${endMinNorm.toString().padStart(2, '0')}`,
            missions: slot.products.map(p => ({
                productId: p.name.toLowerCase().replace(/\s/g, '_'),
                productName: p.name,
                color: p.color,
                quantity: p.qty
            }))
        };
    });
}
