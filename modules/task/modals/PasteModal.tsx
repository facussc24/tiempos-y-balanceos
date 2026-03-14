import React, { useState, useEffect } from 'react';
import { ClipboardPaste, X, Zap } from 'lucide-react';
import { ProjectData, Task } from '../../../types';
import { calculateTaskWeights } from '../../../utils';
import { parseTaskTime } from '../../../utils/validation';
import { toast } from '../../../components/ui/Toast';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    targetTaskId: string | null;
    data: ProjectData;
    updateData: (data: ProjectData) => void;
}

export const PasteModal: React.FC<Props> = ({ isOpen, onClose, targetTaskId, data, updateData }) => {
    const [pasteContent, setPasteContent] = useState("");

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen || !targetTaskId) return null;

    const processPaste = () => {
        if (!targetTaskId) return;
        const matches = pasteContent.match(/[\d.,]+/g);
        if (!matches) {
            toast.warning('Sin datos', 'No se encontraron valores numéricos en el texto pegado');
            return;
        }
        const values = matches
            .map(s => parseTaskTime(s, 0))
            .filter((n): n is number => n !== null && n > 0);
        if (values.length === 0) {
            toast.warning('Sin valores válidos', 'Ningún valor pegado pudo interpretarse como tiempo válido');
            return;
        }
        const invalidCount = matches.length - values.length;
        if (invalidCount > 0) {
            toast.info('Valores descartados', `${invalidCount} de ${matches.length} valores no eran tiempos válidos`);
        }
        const newTasks = data.tasks.map(t => t.id === targetTaskId ? { ...t, times: values } : t);
        updateData({ ...data, tasks: calculateTaskWeights(newTasks, data.meta.activeModels || [], data.meta.fatigueCompensation) });
        onClose();
        setPasteContent("");
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[80vh]">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <ClipboardPaste className="text-blue-600" size={24} />
                        <div>
                            <h3 className="font-bold text-slate-800">Carga Rápida / Pegado Masivo</h3>
                            <p className="text-xs text-slate-500">Tarea: <span className="font-bold">{targetTaskId}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded hover:bg-slate-100 transition" title="Cerrar" aria-label="Cerrar pegado masivo">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                    <p className="text-sm text-slate-600 mb-2">Copie su columna de datos desde Excel o Cronómetro y péguela aquí.</p>
                    <textarea
                        className="w-full flex-1 border border-slate-300 rounded p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 bg-white"
                        placeholder={"20.5\n21.0\n19.8\n..."}
                        value={pasteContent}
                        onChange={e => setPasteContent(e.target.value)}
                        autoFocus
                    ></textarea>
                </div>
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm font-medium">Cancelar</button>
                    <button type="button" onClick={processPaste} className="px-6 py-2 bg-blue-600 text-white rounded shadow-sm hover:bg-blue-700 text-sm font-bold flex items-center gap-2">
                        <Zap size={16} /> Procesar y Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};
