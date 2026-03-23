import React, { useEffect } from 'react';
import { Layers, X, BookOpen } from 'lucide-react';
import { AMFE_TEMPLATES, TEMPLATE_CATEGORY_LABELS, AmfeTemplate } from './amfeTemplates';

interface AmfeTemplatesModalProps {
    onApplyTemplate: (template: AmfeTemplate) => void;
    onLoadFullExample?: () => void;
    onLoadPatagoniaExample?: () => void;
    onClose: () => void;
}

const CATEGORIES = ['fabrication', 'assembly', 'finishing', 'inspection'] as const;

const AmfeTemplatesModal: React.FC<AmfeTemplatesModalProps> = ({ onApplyTemplate, onLoadFullExample, onLoadPatagoniaExample, onClose }) => {
    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-150" role="presentation" onClick={onClose}>
        <div
            className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
        >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
                <div className="flex items-center gap-2">
                    <Layers size={20} className="text-purple-600" />
                    <div>
                        <h3 className="text-sm font-bold text-gray-800">Templates de Operación</h3>
                        <p className="text-xs text-gray-500">Seleccioná un proceso para agregar una operación pre-armada con 6M, funciones, fallas y causas</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition" title="Cerrar templates" aria-label="Cerrar templates">
                    <X size={18} />
                </button>
            </div>

            {/* Template Cards Grid */}
            <div className="p-5 overflow-y-auto max-h-[60vh]">
                {CATEGORIES.map(cat => {
                    const catTemplates = AMFE_TEMPLATES.filter(t => t.category === cat);
                    if (catTemplates.length === 0) return null;
                    return (
                        <div key={cat} className="mb-4 last:mb-0">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                {TEMPLATE_CATEGORY_LABELS[cat] || cat}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {catTemplates.map(template => (
                                    <button
                                        key={template.id}
                                        onClick={() => onApplyTemplate(template)}
                                        className="text-left p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 transition group"
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <span className="text-xl mt-0.5 flex-shrink-0">{template.icon}</span>
                                            <div className="min-w-0">
                                                <span className="text-sm font-bold text-gray-800 group-hover:text-purple-700 transition block">
                                                    {template.name}
                                                </span>
                                                <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                                                    {template.description}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {/* Full Example buttons */}
                {(onLoadFullExample || onLoadPatagoniaExample) && (
                    <div className="mt-4 space-y-3">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Ejemplos Completos
                        </h4>

                        {onLoadPatagoniaExample && (
                            <div className="p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-200">
                                <div className="flex items-start gap-3">
                                    <div className="bg-cyan-100 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                                        🪑
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-cyan-800 mb-0.5">INSERTO PATAGONIA — VWA</h4>
                                        <p className="text-[10px] text-cyan-700 leading-tight mb-2">
                                            AMFE completo del proceso de tapizado automotriz del inserto Patagonia para VWA:
                                            22 operaciones desde Recepción de MP hasta Embalaje (Corte, Costura CNC, Troquelado, Inyección, Prearmado, Adhesivado, Tapizado, Control Final y más).
                                            Con S/O/D, AP calculado, CC/SC y observaciones PRELIMINAR/TBD.
                                        </p>
                                        <button
                                            onClick={onLoadPatagoniaExample}
                                            className="text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 px-4 py-1.5 rounded-lg transition shadow-sm"
                                        >
                                            Cargar INSERTO PATAGONIA
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {onLoadFullExample && (
                            <div className="p-4 bg-gradient-to-r from-emerald-50 to-cyan-50 rounded-lg border border-emerald-200">
                                <div className="flex items-start gap-3">
                                    <div className="bg-emerald-100 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <BookOpen size={20} className="text-emerald-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-emerald-800 mb-0.5">Subchasis Soldado (Ejemplo)</h4>
                                        <p className="text-[10px] text-emerald-700 leading-tight mb-2">
                                            AMFE de ejemplo: 3 operaciones (Soldadura MIG, Inspección, E-coat).
                                            Ideal para ver cómo se ve un AMFE terminado.
                                        </p>
                                        <button
                                            onClick={onLoadFullExample}
                                            className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 rounded-lg transition shadow-sm"
                                        >
                                            Cargar Ejemplo Soldadura
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Info note */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 text-[10px] text-blue-700">
                    <strong>Nota:</strong> Los templates agregan una operación pre-armada con elementos 6M, funciones, modos de falla y causas típicas.
                    Podés editar todos los campos después de insertar. Los valores S, O, D quedan vacíos para que los completes según tu proceso.
                </div>
            </div>
        </div>
    </div>
    );
};

export default AmfeTemplatesModal;
