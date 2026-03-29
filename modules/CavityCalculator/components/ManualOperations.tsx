import React from 'react';
import { MousePointer2, ChevronUp, ChevronDown, Eye } from 'lucide-react';
import { ManualOperation } from '../../../types';
import { formatNumber } from '../../../utils';

interface Props {
    isOpen: boolean;
    onToggle: () => void;
    manualOps: ManualOperation[];
    addManualOp: (op: ManualOperation) => void;
    removeManualOp: (id: string) => void;
    toggleOpType: (id: string) => void;
    manualTimeOverrideStr: string | null;
    setManualTimeOverrideStr: (val: string | null) => void;
    isUsingDefaultManual: boolean;
    currentEffectiveManualTime: number;
    calculatedManualTime: number;
    onShowGuide: () => void;
}

// READ ONLY VERSION - LINKED TO MAIN TASK LIST
export const ManualOperations: React.FC<Props> = ({
    isOpen, onToggle, manualOps, currentEffectiveManualTime
}) => {
    // Calculate Breakdown for UI Clarity (Audit Phase 11)
    const internalSum = manualOps.filter(op => op.type === 'internal').reduce((acc, op) => acc + op.time, 0);
    const externalSum = manualOps.filter(op => op.type === 'external').reduce((acc, op) => acc + op.time, 0);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full bg-slate-50 p-3 flex items-center justify-between hover:bg-slate-100 transition-colors"
            >
                <div className="flex items-center gap-2 font-bold text-indigo-700 text-xs uppercase tracking-wide">
                    <MousePointer2 size={14} /> Tareas Vinculadas al Ciclo
                </div>
                {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {isOpen && (
                <div className="p-4 animate-in slide-in-from-top-2">
                    {manualOps.length > 0 && (
                        <div className="bg-blue-50 border border-blue-100 p-2 rounded-lg mb-4 text-[10px] text-blue-800 flex items-start gap-2">
                            <div className="bg-blue-100 p-1 rounded-full"><Eye size={10} /></div>
                            <div>
                                <strong>Gestión Centralizada:</strong> Estas tareas se administran desde el &ldquo;Listado de Tareas&rdquo; principal.
                                <br />
                                <span className="opacity-80">Para agregar más, cree una nueva tarea y asígnela a este ciclo (Concurrent With).</span>
                            </div>
                        </div>
                    )}

                    <div className="space-y-1 mb-3 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {manualOps.map(op => (
                            <div key={op.id} className="flex justify-between items-center bg-slate-50 p-1.5 rounded text-xs border border-slate-100 group">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <div className={`w-1.5 h-1.5 rounded-full ${op.type === 'internal' ? 'bg-purple-500' : 'bg-red-500'}`}></div>
                                    <span className="text-slate-700 font-medium pl-1 truncate max-w-[150px]" title={op.description}>{op.description}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] px-1.5 rounded border font-bold select-none ${op.type === 'external' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-purple-50 text-purple-600 border-purple-200'}`} title={op.type === 'external' ? "Externa: Detiene la máquina, siempre suma al ciclo" : "Interna: Se hace durante el ciclo de máquina (absorbida si no satura)"}>
                                        {op.type === 'external' ? 'Externa' : 'Interna'}
                                    </span>
                                    <span className="font-mono font-bold text-slate-900 w-12 text-right">{formatNumber(op.time)}s</span>
                                </div>
                            </div>
                        ))}
                        {manualOps.length === 0 && (
                            <>
                                <div className="text-[10px] text-slate-400 italic text-center py-4 border-2 border-dashed border-slate-100 rounded-lg">
                                    No hay tareas vinculadas a esta máquina.<br />
                                    <span className="text-[9px]">Asigne tareas usando &ldquo;Ejecutar durante...&rdquo; en la lista principal.</span>
                                </div>
                                <details className="mt-3">
                                    <summary className="text-[10px] font-bold text-amber-700 cursor-pointer hover:text-amber-800 select-none">
                                        Tiempos típicos PU (referencia)
                                    </summary>
                                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-[10px] text-amber-800 space-y-1.5">
                                        <div className="flex justify-between"><span>Desmoldeo (ext)</span><span className="font-mono font-bold">15-30 s</span></div>
                                        <div className="flex justify-between"><span>Prep molde / release agent (int)</span><span className="font-mono font-bold">20-45 s</span></div>
                                        <div className="flex justify-between"><span>Colocación insertos (int)</span><span className="font-mono font-bold">10-60 s</span></div>
                                        <div className="flex justify-between"><span>Post-curado / crush (ext)</span><span className="font-mono font-bold">15-120 s</span></div>
                                        <p className="text-[9px] text-amber-600 italic pt-1 border-t border-amber-200">Valores orientativos. Configurar desde lista de tareas principal.</p>
                                    </div>
                                </details>
                            </>
                        )}
                    </div>

                    <div className="border-t border-slate-100 pt-2 space-y-1">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-700">Carga Operador (Total):</span>
                            <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                {formatNumber(currentEffectiveManualTime)} s
                            </span>
                        </div>
                        {/* Breakdown for Clarity (Option C) */}
                        <div className="flex justify-end items-center gap-2 text-[10px] text-slate-500">
                            <span title="Interno: Absorbido por la máquina (costo 0 si no satura el ciclo)">
                                (Interno: <span className="font-semibold text-purple-600">{formatNumber(internalSum)}s</span>
                            </span>
                            <span className="text-slate-300">|</span>
                            <span title="Externo: Se suma al ciclo (siempre agrega tiempo)">
                                Externo: <span className="font-bold text-red-600">{formatNumber(externalSum)}s</span>)
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
