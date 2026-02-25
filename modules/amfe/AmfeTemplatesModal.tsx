import React from 'react';
import { Layers, X } from 'lucide-react';
import { AMFE_TEMPLATES, TEMPLATE_CATEGORY_LABELS, AmfeTemplate } from './amfeTemplates';

interface AmfeTemplatesModalProps {
    onApplyTemplate: (template: AmfeTemplate) => void;
    onClose: () => void;
}

const CATEGORIES = ['fabrication', 'assembly', 'finishing', 'inspection'] as const;

const AmfeTemplatesModal: React.FC<AmfeTemplatesModalProps> = ({ onApplyTemplate, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
        <div
            className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
        >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
                <div className="flex items-center gap-2">
                    <Layers size={20} className="text-purple-600" />
                    <div>
                        <h3 className="text-sm font-bold text-gray-800">Templates de Operacion</h3>
                        <p className="text-[10px] text-gray-500">Selecciona un proceso para agregar una operacion pre-armada con 6M, funciones, fallas y causas</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition">
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

                {/* Info note */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 text-[10px] text-blue-700">
                    <strong>Nota:</strong> Los templates agregan una operacion pre-armada con elementos 6M, funciones, modos de falla y causas tipicas.
                    Podes editar todos los campos despues de insertar. Los valores S, O, D quedan vacios para que los completes segun tu proceso.
                </div>
            </div>
        </div>
    </div>
);

export default AmfeTemplatesModal;
