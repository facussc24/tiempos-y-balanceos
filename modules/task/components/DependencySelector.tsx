import React, { useState, useEffect, useRef } from 'react';
import { Task } from '../../../types';
import { MoreHorizontal } from 'lucide-react';
import { Tooltip } from '../../../components/ui/Tooltip';

interface Props {
    currentTaskId: string;
    allTasks: Task[];
    predecessors: string[];
    onChange: (preds: string[]) => void;
}

export const DependencySelector: React.FC<Props> = ({ currentTaskId, allTasks, predecessors, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Optimized Click Outside Handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const togglePred = (id: string) => {
        if (predecessors.includes(id)) {
            onChange(predecessors.filter(p => p !== id));
        } else {
            onChange([...predecessors, id]);
        }
    };

    const availableTasks = allTasks.filter(t => t.id !== currentTaskId);

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="flex items-center gap-1 mb-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Precedencia</span>
                <Tooltip content="Campo que define qué tareas deben realizarse obligatoriamente antes que la actual (Secuencia lógica)." />
            </div>
            <div
                className="min-h-[38px] w-full border border-slate-300 bg-slate-50 rounded-lg p-1.5 flex flex-wrap gap-1 cursor-pointer hover:bg-white hover:border-blue-400 transition-all shadow-sm"
                onClick={() => setIsOpen(!isOpen)}
            >
                {predecessors.length === 0 && <span className="text-xs text-slate-400 p-1 flex items-center gap-1"><MoreHorizontal size={14} /> Seleccionar...</span>}
                {predecessors.map(p => (
                    <span key={p} className="text-[10px] bg-white text-slate-700 px-2 py-0.5 rounded-md font-bold border border-slate-200 shadow-sm">
                        {p}
                    </span>
                ))}
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 shadow-xl rounded-xl z-50 max-h-60 overflow-y-auto p-2 animate-in fade-in zoom-in duration-200">
                    <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase px-2">Depende de:</p>
                    {availableTasks.length === 0 && <p className="text-xs text-slate-400 italic p-2">No hay otras tareas disponibles.</p>}
                    {availableTasks.map(t => (
                        <div
                            key={t.id}
                            onClick={() => togglePred(t.id)}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs mb-1 transition-colors ${predecessors.includes(t.id) ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'hover:bg-slate-50 text-slate-600 border border-transparent'}`}
                        >
                            <div className="w-4 h-4 rounded border flex items-center justify-center transition-all bg-white border-slate-300">
                                {predecessors.includes(t.id) && <span className="text-blue-600 text-[10px] font-bold">✓</span>}
                            </div>
                            <span className="font-bold font-mono bg-slate-100 px-1 rounded">{t.id}</span>
                            <span className="truncate flex-1">{t.description}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
