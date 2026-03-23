/**
 * CpTemplateModal - Template selector modal for Control Plan
 *
 * Extracted from ControlPlanApp.tsx to reduce component size.
 * Displays available CP templates and allows applying them.
 */

import React, { useEffect } from 'react';
import { CP_TEMPLATES } from './controlPlanTemplates';
import { LayoutTemplate, Plus, X as XIcon } from 'lucide-react';

interface CpTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyTemplate: (templateId: string) => void;
}

const CpTemplateModal: React.FC<CpTemplateModalProps> = ({ isOpen, onClose, onApplyTemplate }) => {
    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="presentation" onClick={onClose}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-150" />
            <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b bg-gradient-to-r from-purple-50 to-violet-50">
                    <div className="flex items-center gap-2">
                        <LayoutTemplate size={18} className="text-purple-600" />
                        <div>
                            <h3 className="text-sm font-bold text-gray-800">Templates de Plan de Control</h3>
                            <p className="text-[10px] text-gray-500">Items predefinidos por proceso</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100" title="Cerrar templates" aria-label="Cerrar templates">
                        <XIcon size={18} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid gap-3">
                        {CP_TEMPLATES.map(t => (
                            <button key={t.id} onClick={() => onApplyTemplate(t.id)}
                                className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 transition text-left group">
                                <span className="text-2xl flex-shrink-0">{t.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-gray-800 group-hover:text-purple-700">{t.name}</h4>
                                    <p className="text-[11px] text-gray-500 mt-0.5">{t.description}</p>
                                    <p className="text-[10px] text-purple-500 mt-1">{t.create().length} items</p>
                                </div>
                                <Plus size={16} className="text-gray-300 group-hover:text-purple-500 flex-shrink-0 mt-1" />
                            </button>
                        ))}
                    </div>
                </div>
                <div className="px-5 py-3 border-t bg-gray-50 text-[10px] text-gray-500">
                    Los ítems se agregan al final del plan actual. Puede editarlos después.
                </div>
            </div>
        </div>
    );
};

export default CpTemplateModal;
