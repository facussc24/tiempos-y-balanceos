import React, { useRef, useState, useEffect } from 'react';
import { BookOpen, X, Video, FileVideo, Upload, Save } from 'lucide-react';
import { ProjectData, Task } from '../../../types';
import { saveTaskMediaWeb, loadTaskMediaWeb } from '../../../utils/webFsHelpers';
import { isTauri } from '../../../utils/unified_fs';
import { saveMedia, loadMedia } from '../../../utils/mediaManager';
import { toast } from '../../../components/ui/Toast';
import { logger } from '../../../utils/logger';

interface Props {
    task: Task | null;
    onClose: () => void;
    data: ProjectData;
    updateData: (data: ProjectData) => void;
    rootHandle: FileSystemDirectoryHandle | string | null | undefined;
}

export const DocumentationModal: React.FC<Props> = ({ task, onClose, data, updateData, rootHandle }) => {
    const [docTask, setDocTask] = useState<Task | null>(task);
    const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
    const docFileInputRef = useRef<HTMLInputElement>(null);
    const pendingFileRef = useRef<File | null>(null);

    // Sync state when prop task changes
    React.useEffect(() => {
        setDocTask(task);
    }, [task]);

    // Cleanup URLs
    useEffect(() => {
        return () => {
            if (mediaPreviewUrl && mediaPreviewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(mediaPreviewUrl);
            }
        };
    }, [mediaPreviewUrl]);

    // Close on Escape key
    useEffect(() => {
        if (!task) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [task, onClose]);

    // Load media on open
    useEffect(() => {
        const loadMediaPreview = async () => {
            setMediaPreviewUrl(null);
            if (task && task.mediaRef) {
                try {
                    if (isTauri() && data.id) {
                        const url = await loadMedia(String(data.id), task.mediaRef);
                        setMediaPreviewUrl(url);
                    } else if (rootHandle && typeof rootHandle !== 'string') {
                        const url = await loadTaskMediaWeb(rootHandle, task.mediaRef);
                        setMediaPreviewUrl(url);
                    }
                } catch (e) {
                    logger.error('DocumentationModal', 'Error loading media', {}, e instanceof Error ? e : undefined);
                }
            }
        };
        loadMediaPreview();
    }, [task, rootHandle, data.id]);


    if (!task || !docTask) return null;

    const handleDocChange = (field: string, value: string) => {
        setDocTask({ ...docTask, [field]: value });
    };

    const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Cleanup old URL before creating new one
            if (mediaPreviewUrl && mediaPreviewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(mediaPreviewUrl);
            }

            const url = URL.createObjectURL(file);
            setMediaPreviewUrl(url);
            pendingFileRef.current = file;
        }
    };

    const handleSaveDoc = async () => {
        let newMediaRef = docTask.mediaRef;
        if (pendingFileRef.current) {
            try {
                if (isTauri() && data.id) {
                    const result = await saveMedia(
                        String(data.id), docTask.id, pendingFileRef.current,
                        { client: data.meta.client, project: data.meta.project, name: data.meta.name }
                    );
                    if (result) newMediaRef = result.localRef;
                } else if (rootHandle && typeof rootHandle !== 'string') {
                    newMediaRef = await saveTaskMediaWeb(rootHandle, pendingFileRef.current, docTask.id);
                }
            } catch (e) {
                toast.error('Error de Archivo', `No se pudo guardar el archivo multimedia: ${e}`);
            }
        }
        const updatedTasks = data.tasks.map(t => t.id === docTask.id ? {
            ...t, methodDescription: docTask.methodDescription, startCondition: docTask.startCondition, endCondition: docTask.endCondition, mediaRef: newMediaRef
        } : t);
        updateData({ ...data, tasks: updatedTasks });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-modal-backdrop flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl border border-slate-200 flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                <div className="bg-white px-8 py-6 border-b border-slate-100 flex justify-between items-center rounded-t-xl flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <BookOpen className="text-blue-600" size={28} />
                        </div>
                        <div>
                            <h3 className="font-bold text-xl text-slate-900">Estándar de Trabajo</h3>
                            <p className="text-sm text-slate-500">Documentación de Método para Tarea: <span className="font-mono font-bold text-blue-600 bg-blue-50 px-1 rounded">{docTask.id}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-50 p-2 rounded-full transition-colors" title="Cerrar" aria-label="Cerrar documentación">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-8 space-y-8 bg-slate-50/30 overflow-y-auto flex-1">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Video size={18} className="text-indigo-500" /> Evidencia Visual (Foto/Video)
                        </h4>
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 h-64 flex items-center justify-center relative group">
                                {mediaPreviewUrl ? (
                                    <>
                                        {docTask.mediaRef?.match(/\.(mp4|webm|mov)$/i) ? (
                                            <video src={mediaPreviewUrl} controls className="h-full w-full object-contain" />
                                        ) : (
                                            <img src={mediaPreviewUrl} alt="Evidencia" className="h-full w-full object-contain" />
                                        )}
                                        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded font-mono backdrop-blur-sm">
                                            {docTask.mediaRef}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center text-slate-400">
                                        <FileVideo size={48} className="mx-auto mb-2 opacity-50" />
                                        <span className="text-sm">Sin evidencia cargada</span>
                                    </div>
                                )}
                            </div>
                            <div className="w-full md:w-48 flex flex-col justify-center gap-3">
                                <button
                                    onClick={() => docFileInputRef.current?.click()}
                                    className="w-full py-3 bg-white border-2 border-dashed border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 hover:border-indigo-400 transition-all font-medium text-sm flex flex-col items-center gap-2"
                                >
                                    <Upload size={20} />
                                    {docTask.mediaRef ? "Reemplazar Archivo" : "Subir Archivo"}
                                </button>
                                <input ref={docFileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} />
                                {!rootHandle && (
                                    <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 text-center">
                                        ⚠️ Modo Local.<br />Vincule servidor para guardar archivos.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Descripción del Método (Paso a Paso)</label>
                            <textarea
                                className="w-full border border-slate-300 rounded-lg p-4 text-sm h-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm text-slate-800 placeholder-slate-400 bg-white"
                                placeholder="1. Tomar la pieza con mano izquierda..."
                                value={docTask.methodDescription || ""}
                                onChange={e => handleDocChange('methodDescription', e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Inicio de Tarea (Start)</label>
                                <input
                                    className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-800 bg-white"
                                    placeholder="Ej: Cuando la mano toca la herramienta"
                                    value={docTask.startCondition || ""}
                                    onChange={e => handleDocChange('startCondition', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Fin de Tarea (End)</label>
                                <input
                                    className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-800 bg-white"
                                    placeholder="Ej: Cuando suelta la pieza en la caja"
                                    value={docTask.endCondition || ""}
                                    onChange={e => handleDocChange('endCondition', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white px-8 py-6 border-t border-slate-100 flex justify-between items-center rounded-b-xl flex-shrink-0">
                    <div className="text-xs text-slate-400 italic">
                        Los cambios se guardan localmente al confirmar.
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors">
                            Cancelar
                        </button>
                        <button type="button" onClick={handleSaveDoc} className="px-8 py-2.5 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 hover:shadow-xl text-sm font-bold flex items-center gap-2 transition-all transform active:scale-95">
                            <Save size={18} /> Guardar Documentación
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
