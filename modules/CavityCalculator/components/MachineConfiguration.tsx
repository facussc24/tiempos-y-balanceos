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
}

export const MachineConfiguration: React.FC<Props> = ({
    isOpen, onToggle, puInyTimeStr, setPuInyTimeStr, puCurTimeStr, setPuCurTimeStr, nStar, errors
}) => {
    const getError = (field: string) => errors.find(e => e.field === field);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full bg-slate-50 p-3 flex items-center justify-between hover:bg-slate-100 transition-colors"
            >
                <div className="flex items-center gap-2 font-bold text-teal-700 text-xs uppercase tracking-wide">
                    <FlaskConical size={14} /> Parámetros de Máquina (PU)
                </div>
                {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {isOpen && (
                <div className="p-4 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Inyección (s)</label>
                            <input
                                type="text"
                                data-testid="input-injection-time"
                                placeholder="Total"
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
                                placeholder="Total"
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

                    <div className="flex items-center justify-between text-[10px] bg-slate-50 p-2 rounded border border-slate-100 text-slate-500">
                        <span>Punto de Saturación (N*):</span>
                        <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{nStar} Moldes</span>
                    </div>
                </div>
            )}
        </div>
    );
};
