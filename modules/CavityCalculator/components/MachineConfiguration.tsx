import { Tooltip } from '../../../components/ui/Tooltip';
import { FlaskConical, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import { ValidationError } from '../../validation/injectionValidation';

interface Props {
    isOpen: boolean;
    onToggle: () => void;
    puInyTimeStr: string;
    setPuInyTimeStr: (val: string) => void;
    puCurTimeStr: string;
    setPuCurTimeStr: (val: string) => void;
    nStar: number;
    errors: ValidationError[];
    injectionMode: 'batch' | 'carousel';
    setInjectionMode: (val: 'batch' | 'carousel') => void;
    indexTimeStr: string;
    setIndexTimeStr: (val: string) => void;
    setupLossPercent: number;
    setSetupLossPercent: (val: number) => void;
}

export const MachineConfiguration: React.FC<Props> = ({
    isOpen, onToggle, puInyTimeStr, setPuInyTimeStr, puCurTimeStr, setPuCurTimeStr, nStar, errors,
    injectionMode, setInjectionMode, indexTimeStr, setIndexTimeStr, setupLossPercent, setSetupLossPercent
}) => {
    const getError = (field: string) => errors.find(e => e.field === field);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full bg-slate-50 p-3 flex items-center justify-between hover:bg-slate-100 transition-colors"
            >
                <div className="flex items-center gap-2 font-bold text-teal-700 text-xs uppercase tracking-wide">
                    <FlaskConical size={14} /> Parámetros de Máquina
                </div>
                {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {isOpen && (
                <div className="p-4 animate-in slide-in-from-top-2">
                    <div className="mb-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Modo de Inyección</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setInjectionMode('batch')}
                                className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-colors border ${injectionMode === 'batch' ? 'bg-teal-600 border-teal-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                            >
                                ESTÁNDAR (Prensa)
                            </button>
                            <button
                                onClick={() => setInjectionMode('carousel')}
                                className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-colors border ${injectionMode === 'carousel' ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                            >
                                CARRUSEL (Rotativa)
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tiempo Inyección (s)</label>
                            <input
                                type="text"
                                data-testid="input-injection-time"
                                placeholder="Ej: 12,5"
                                inputMode="decimal"
                                aria-label="Tiempo de inyección en segundos"
                                className={`w-full border bg-white text-slate-900 rounded p-2 text-sm font-bold text-right outline-none focus:ring-2 ${getError('puInyTime') ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-teal-300 focus:ring-teal-500'}`}
                                value={puInyTimeStr}
                                onChange={e => setPuInyTimeStr(e.target.value)}
                            />
                            {getError('puInyTime') && (
                                <div className="text-[10px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                                    <AlertCircle size={10} /> {getError('puInyTime')?.message}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                Curado (s)
                                <Tooltip content="Tiempo que el plástico tarda en solidificarse dentro del molde cerrado. Durante este tiempo el operario está en ocio forzoso (interno)." />
                            </label>
                            <input
                                type="text"
                                data-testid="input-curing-time"
                                placeholder="Ej: 45"
                                aria-label="Tiempo de curado en segundos"
                                className={`w-full border bg-white text-slate-900 rounded p-2 text-sm font-bold text-right outline-none focus:ring-2 ${getError('puCurTime') ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-teal-300 focus:ring-teal-500'}`}
                                value={puCurTimeStr}
                                onChange={e => setPuCurTimeStr(e.target.value)}
                            />
                            {getError('puCurTime') && (
                                <div className="text-[10px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                                    <AlertCircle size={10} /> {getError('puCurTime')?.message}
                                </div>
                            )}
                        </div>
                    </div>

                    {injectionMode === 'carousel' && (
                        <div className="mb-4">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tiempo de Indice / Giro (s)</label>
                            <input
                                type="text"
                                placeholder="Ej: 5"
                                className="w-full border border-indigo-300 bg-white text-slate-900 rounded p-2 text-sm font-bold text-right outline-none focus:ring-2 focus:ring-indigo-500"
                                value={indexTimeStr}
                                onChange={e => setIndexTimeStr(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Pérdida por Setup (%)</label>
                            <span className="text-[10px] font-black text-slate-800">{setupLossPercent}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="30"
                            step="1"
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                            value={setupLossPercent}
                            onChange={e => setSetupLossPercent(parseInt(e.target.value))}
                        />
                    </div>

                    <div className="flex items-center justify-between text-[10px] bg-slate-50 p-2 rounded border border-slate-100 text-slate-500">
                        <span>Punto de Saturación (N*):</span>
                        <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{nStar} Cavidades</span>
                    </div>
                </div>
            )}
        </div>
    );
};
