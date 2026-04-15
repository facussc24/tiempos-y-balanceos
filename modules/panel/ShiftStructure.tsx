import React from 'react';
import { Card } from '../../components/ui/Card';
import { formatNumber } from '../../utils';
import { calculateShiftNetMinutes, calculateSectorTaktTime, calculateTaktTime } from '../../core/balancing/simulation';
import { Shift, ShiftBreak, Sector } from '../../types';
import { Plus, Trash2, X } from 'lucide-react';
import { parsePositiveInt } from '../../utils/validation';

interface Props {
    shifts: Shift[];
    activeShifts: number;
    totalAvailableMinutes: number;
    // Handlers from useShiftManager
    onShiftChange: (id: number, field: string, value: string) => void;
    onAddBreak: (shiftId: number) => void;
    onRemoveBreak: (shiftId: number, breakId: string) => void;
    onUpdateBreak: (shiftId: number, breakId: string, field: keyof ShiftBreak, value: ShiftBreak[keyof ShiftBreak]) => void;
    // Editing State
    editingBreaksShiftId: number | null;
    setEditingBreaksShiftId: (id: number | null) => void;
    // Per-sector shift summary (optional)
    sectors?: Sector[];
    dailyDemand?: number;
    globalOee?: number;
    setupLossPercent?: number;
    onSectorShiftChange?: (sectorId: string, activeShifts: number | null) => void;
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
    setEditingBreaksShiftId,
    sectors,
    dailyDemand,
    globalOee,
    setupLossPercent = 0,
    onSectorShiftChange
}) => {
    const activeShiftToEdit = shifts.find(s => s.id === editingBreaksShiftId);

    return (
        <div className="relative">
            {/* Break Editor Modal */}
            {editingBreaksShiftId !== null && activeShiftToEdit && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-md shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">Descansos - {activeShiftToEdit.name}</h3>
                            <button onClick={() => setEditingBreaksShiftId(null)} className="text-slate-400 hover:text-slate-700" title="Cancelar edición">
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
                                        <button onClick={() => onRemoveBreak(activeShiftToEdit.id, b.id)} className="text-slate-400 hover:text-red-600 p-1" title="Eliminar descanso">
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
                                            {!isActive && <span className="text-xs text-slate-400">(Inactivo)</span>}
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
                                <td colSpan={3} className="pt-3 text-right text-sm text-slate-500 font-medium">Total Disponible (Neto):</td>
                                <td className="pt-3 text-right font-bold text-blue-600 text-lg">{formatNumber(totalAvailableMinutes)} min</td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Per-sector Takt section — shows ALL sectors, not just overrides */}
                    {(() => {
                        const allSectors = sectors || [];
                        if (allSectors.length === 0 || !dailyDemand || dailyDemand <= 0) return null;

                        const projectTakt = calculateTaktTime(shifts, activeShifts, dailyDemand, globalOee ?? 0.85, setupLossPercent);
                        return (
                            <div className="mt-4 pt-3 border-t border-slate-200">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Turnos y Takt por Sector</h4>
                                <table className="min-w-full text-xs">
                                    <thead>
                                        <tr className="text-slate-400">
                                            <th className="text-left py-1 px-2">Sector</th>
                                            <th className="text-center py-1 px-2">Turnos</th>
                                            <th className="text-right py-1 px-2">Takt</th>
                                            <th className="text-right py-1 px-2">vs Proyecto</th>
                                            {onSectorShiftChange && <th className="px-2"></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allSectors.map(s => {
                                            const hasOverride = !!s.shiftOverride;
                                            const oee = s.targetOee ?? globalOee ?? 0.85;
                                            const sectorTakt = calculateSectorTaktTime(s, shifts, activeShifts, dailyDemand, oee, setupLossPercent);
                                            const diff = sectorTakt.nominalSeconds - projectTakt.nominalSeconds;
                                            return (
                                                <tr key={s.id} className="border-t border-slate-100">
                                                    <td className="py-1.5 px-2 flex items-center gap-2">
                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                                                        <span className="font-medium text-slate-700">{s.name}</span>
                                                    </td>
                                                    <td className="py-1.5 px-2 text-center">
                                                        {hasOverride ? (
                                                            onSectorShiftChange ? (
                                                                <select
                                                                    className="text-xs border border-indigo-200 rounded px-1.5 py-0.5 bg-white text-indigo-700 font-bold"
                                                                    value={s.shiftOverride!.activeShifts}
                                                                    onChange={e => onSectorShiftChange(s.id, parseInt(e.target.value))}
                                                                >
                                                                    <option value={1}>1T</option>
                                                                    <option value={2}>2T</option>
                                                                    <option value={3}>3T</option>
                                                                </select>
                                                            ) : (
                                                                <span className="bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded">
                                                                    {s.shiftOverride!.activeShifts}T
                                                                </span>
                                                            )
                                                        ) : (
                                                            onSectorShiftChange ? (
                                                                <button
                                                                    onClick={() => onSectorShiftChange(s.id, activeShifts)}
                                                                    className="text-xs text-slate-400 hover:text-indigo-600 px-1.5 py-0.5 rounded hover:bg-indigo-50 transition-all"
                                                                    title="Click para asignar turnos propios"
                                                                >
                                                                    {activeShifts}T
                                                                </button>
                                                            ) : (
                                                                <span className="text-slate-400">{activeShifts}T</span>
                                                            )
                                                        )}
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-700">
                                                        {formatNumber(sectorTakt.nominalSeconds, 1)}s
                                                    </td>
                                                    <td className="py-1.5 px-2 text-right">
                                                        {Math.abs(diff) > 0.1 ? (
                                                            <span className={`font-bold ${diff > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                {diff > 0 ? '+' : ''}{formatNumber(diff, 1)}s
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">=</span>
                                                        )}
                                                    </td>
                                                    {onSectorShiftChange && (
                                                        <td className="py-1.5 px-1">
                                                            {hasOverride ? (
                                                                <button
                                                                    onClick={() => onSectorShiftChange(s.id, null)}
                                                                    className="text-slate-300 hover:text-red-500 transition-all text-xs"
                                                                    title="Quitar turnos propios (usar proyecto)"
                                                                >
                                                                    ✕
                                                                </button>
                                                            ) : (
                                                                <span className="w-4"></span>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
                </div>
            </Card>
        </div>
    );
};
