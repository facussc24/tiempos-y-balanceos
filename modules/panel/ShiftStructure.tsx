import React from 'react';
import { Card } from '../../components/ui/Card';
import { formatNumber } from '../../utils';
import { calculateShiftNetMinutes } from '../../core/balancing/simulation';
import { Shift, ShiftBreak } from '../../types';
import { Plus, Trash2, X } from 'lucide-react';
import { parsePositiveInt } from '../../utils/validation';

interface Props {
    shifts: Shift[];
    activeShifts: number;
    totalAvailableMinutes: number;
    // Handlers from useShiftManager
    onShiftChange: (id: number, field: string, value: any) => void;
    onAddBreak: (shiftId: number) => void;
    onRemoveBreak: (shiftId: number, breakId: string) => void;
    onUpdateBreak: (shiftId: number, breakId: string, field: keyof ShiftBreak, value: any) => void;
    // Editing State
    editingBreaksShiftId: number | null;
    setEditingBreaksShiftId: (id: number | null) => void;
}

export const ShiftStructure: React.FC<Props> = ({
    shifts,
    activeShifts,
    totalAvailableMinutes,
    onShiftChange,
    onAddBreak,
    onRemoveBreak,
    onUpdateBreak,
    editingBreaksShiftId,
    setEditingBreaksShiftId
}) => {
    const activeShiftToEdit = shifts.find(s => s.id === editingBreaksShiftId);

    return (
        <div className="relative">
            {/* Break Editor Modal */}
            {editingBreaksShiftId !== null && activeShiftToEdit && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">Descansos - {activeShiftToEdit.name}</h3>
                            <button onClick={() => setEditingBreaksShiftId(null)} className="text-slate-400 hover:text-slate-700">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            <div className="space-y-3">
                                {activeShiftToEdit.breaks.map(b => (
                                    <div key={b.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-200">
                                        <input
                                            type="time"
                                            className="bg-white border border-slate-300 rounded px-2 py-1 text-sm w-24 text-slate-900"
                                            value={b.startTime}
                                            onChange={(e) => onUpdateBreak(activeShiftToEdit.id, b.id, 'startTime', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            className="bg-white border border-slate-300 rounded px-2 py-1 text-sm flex-1 min-w-0 text-slate-900"
                                            value={b.name}
                                            onChange={(e) => onUpdateBreak(activeShiftToEdit.id, b.id, 'name', e.target.value)}
                                        />
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="bg-white border border-slate-300 rounded px-2 py-1 text-sm w-16 text-right pr-1 text-slate-900"
                                                value={b.duration}
                                                onChange={(e) => {
                                                    onUpdateBreak(activeShiftToEdit.id, b.id, 'duration', parsePositiveInt(e.target.value, 0));
                                                }}
                                            />
                                            <span className="absolute right-6 top-1.5 text-xs text-slate-400 pointer-events-none">m</span>
                                        </div>
                                        <button onClick={() => onRemoveBreak(activeShiftToEdit.id, b.id)} className="text-slate-400 hover:text-red-600 p-1">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => onAddBreak(activeShiftToEdit.id)} className="mt-4 w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 hover:border-blue-500 hover:text-blue-600 flex items-center justify-center gap-2 text-sm font-medium">
                                <Plus size={16} /> Agregar Descanso
                            </button>
                        </div>
                        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center">
                            <div className="text-sm text-slate-600">Total: <span className="font-bold text-slate-900">{activeShiftToEdit.breaks.reduce((acc, val) => acc + (val.duration || 0), 0)} min</span></div>
                            <button onClick={() => setEditingBreaksShiftId(null)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 shadow-sm">Listo</button>
                        </div>
                    </div>
                </div>
            )}

            <Card title="Estructura de Turnos" className="lg:col-span-3">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead>
                            <tr>
                                <th className="px-4 py-2 text-left">Turno</th>
                                <th className="px-4 py-2">Horario</th>
                                <th className="px-4 py-2">Descansos</th>
                                <th className="px-4 py-2 text-right">Tiempo Neto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {shifts.map((shift) => {
                                const totalBreaks = shift.breaks.reduce((acc, val) => acc + (val.duration || 0), 0);
                                const isActive = shift.id <= activeShifts;
                                return (
                                    <tr key={shift.id} className={!isActive ? "opacity-40 bg-slate-50" : "bg-white"}>
                                        <td className="px-4 py-2 font-medium">
                                            <span className="block">{shift.name}</span>
                                            {!isActive && <span className="text-[10px] text-slate-400">(Inactivo)</span>}
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="flex items-center gap-2 justify-center">
                                                <input type="time" className="w-20 text-sm border rounded bg-white text-slate-900 px-1" value={shift.startTime} onChange={(e) => onShiftChange(shift.id, 'startTime', e.target.value)} disabled={!isActive} />
                                                <span className="text-slate-400">-</span>
                                                <input type="time" className="w-20 text-sm border rounded bg-white text-slate-900 px-1" value={shift.endTime} onChange={(e) => onShiftChange(shift.id, 'endTime', e.target.value)} disabled={!isActive} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => setEditingBreaksShiftId(shift.id)} disabled={!isActive} className="bg-slate-100 px-3 py-1 rounded text-xs hover:bg-slate-200 border border-slate-200 text-slate-600 font-medium">
                                                {totalBreaks} min
                                            </button>
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono font-bold text-slate-700">{formatNumber(calculateShiftNetMinutes(shift), 0)} min</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3} className="pt-3 text-right text-sm text-slate-500 font-medium">Total Disponible (1 Estación):</td>
                                <td className="pt-3 text-right font-bold text-blue-600 text-lg">{formatNumber(totalAvailableMinutes)} min</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </Card>
        </div>
    );
};
