import React, { lazy, Suspense, useEffect } from 'react';
import { X, Save, Wifi, WifiOff, AlertTriangle, XCircle } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { PromptModal } from '../../components/modals/PromptModal';
import PdfPreviewModal from '../../components/modals/PdfPreviewModal';
import { ModuleErrorBoundary } from '../../components/ui/ModuleErrorBoundary';
import type { AmfeDocument } from './amfeTypes';
import type { AmfeConfirmState } from './useAmfeConfirm';
import type { PdfTemplate } from './amfePdfExport';

const AmfeHelpPanel = lazy(() => import('./AmfeHelpPanel'));

interface AmfeModalsProps {
    // Confirm modal
    confirmState: AmfeConfirmState;
    onConfirm: () => void;
    onCancel: () => void;
    // Help
    showHelp: boolean;
    setShowHelp: (v: boolean) => void;
    // Prompt modal (legacy)
    promptState: {
        isOpen: boolean;
        onClose: () => void;
        onSubmit: (value: string) => void;
        title: string;
        message: string;
        defaultValue: string;
    };
    // SaveAs modal
    saveAsState: {
        isOpen: boolean;
        onClose: () => void;
        onSubmit: (client: string, project: string, name: string) => void;
        defaultClient: string;
        defaultProject: string;
        defaultName: string;
        existingClients: string[];
    };
    // PDF preview
    pdfPreview: { html: string; template: PdfTemplate } | null;
    isExportingPdf: boolean;
    onPdfExport: () => void;
    onClearPdfPreview: () => void;
    // Toasts
    loadError: string | null;
    apHWarning: string | null;
    onClearApHWarning: () => void;
    networkToast: 'lost' | 'recovered' | null;
    onClearNetworkToast: () => void;
    // Data for panels
    data: AmfeDocument;
}

const AmfeModals: React.FC<AmfeModalsProps> = ({
    confirmState, onConfirm, onCancel,
    showHelp, setShowHelp,
    promptState,
    saveAsState,
    pdfPreview, isExportingPdf, onPdfExport, onClearPdfPreview,
    loadError, apHWarning, onClearApHWarning,
    networkToast, onClearNetworkToast,
    data,
}) => {
    const saveAsRef = useFocusTrap(saveAsState.isOpen);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && saveAsState.isOpen) {
                saveAsState.onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [saveAsState.isOpen, saveAsState.onClose]);

    return (
    <>
        {/* PDF Preview Modal */}
        {pdfPreview && (
            <PdfPreviewModal
                html={pdfPreview.html}
                onExport={onPdfExport}
                onClose={onClearPdfPreview}
                isExporting={isExportingPdf}
                title="Vista Previa PDF — AMFE"
                subtitle={pdfPreview.template === 'full' ? 'Tabla VDA Completa' :
                    pdfPreview.template === 'summary' ? 'Resumen AP' : 'Plan de Acciones'}
                maxWidth={pdfPreview.template === 'full' ? '420mm' : '297mm'}
                themeColor="blue"
            />
        )}

        {/* Confirmation Modal */}
        <ConfirmModal
            isOpen={confirmState.isOpen}
            onClose={onCancel}
            onConfirm={onConfirm}
            title={confirmState.title}
            message={confirmState.message}
            variant={confirmState.variant}
            confirmText={confirmState.confirmText}
        />

        {/* Help Panel */}
        {showHelp && (
            <ModuleErrorBoundary moduleName="Referencia Rapida" onNavigateHome={() => setShowHelp(false)}>
                <Suspense fallback={null}>
                    <AmfeHelpPanel onClose={() => setShowHelp(false)} />
                </Suspense>
            </ModuleErrorBoundary>
        )}

        {/* Project Name Prompt Modal (legacy) */}
        <PromptModal
            isOpen={promptState.isOpen}
            onClose={promptState.onClose}
            onSubmit={promptState.onSubmit}
            title={promptState.title}
            message={promptState.message}
            defaultValue={promptState.defaultValue}
            placeholder="Nombre del proyecto"
            required
        />

        {/* SaveAs Modal */}
        {saveAsState.isOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center" role="presentation" onClick={saveAsState.onClose}>
                <div className="absolute inset-0 bg-black/30" />
                <div
                    ref={saveAsRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="amfe-saveas-modal-title"
                    className="relative bg-white rounded-xl shadow-2xl w-[420px] max-w-[95vw] p-6 animate-in zoom-in-95"
                    onClick={e => e.stopPropagation()}
                >
                    <button onClick={saveAsState.onClose} aria-label="Cerrar" className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                    <h3 id="amfe-saveas-modal-title" className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
                        <Save size={18} className="text-green-600" />
                        Guardar AMFE
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">Selecciona la ubicacion en el servidor</p>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const client = (form.elements.namedItem('saveAsClient') as HTMLInputElement).value.trim();
                        const project = (form.elements.namedItem('saveAsProject') as HTMLInputElement).value.trim();
                        const name = (form.elements.namedItem('saveAsName') as HTMLInputElement).value.trim();
                        if (client && project && name) {
                            saveAsState.onSubmit(client, project, name);
                        }
                    }}>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
                                <input
                                    name="saveAsClient"
                                    type="text"
                                    list="saveAsClients"
                                    defaultValue={saveAsState.defaultClient}
                                    required
                                    autoFocus
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ej: VWA, TOYOTA..."
                                />
                                <datalist id="saveAsClients">
                                    {saveAsState.existingClients.map(c => <option key={c} value={c} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Proyecto</label>
                                <input
                                    name="saveAsProject"
                                    type="text"
                                    defaultValue={saveAsState.defaultProject}
                                    required
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ej: PATAGONIA, HILUX..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del AMFE</label>
                                <input
                                    name="saveAsName"
                                    type="text"
                                    defaultValue={saveAsState.defaultName}
                                    required
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Ej: AMFE TOP ROLL"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-5">
                            <button type="button" onClick={saveAsState.onClose}
                                className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                                Cancelar
                            </button>
                            <button type="submit"
                                className="px-4 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-500 rounded-lg transition shadow-sm">
                                Guardar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Load Error Toast */}
        {loadError && (
            <div className="fixed bottom-4 left-4 z-50 bg-red-50 border border-red-300 rounded-lg shadow-lg p-3 max-w-sm animate-in slide-in-from-bottom-4">
                <div className="flex items-start gap-2">
                    <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{loadError}</p>
                </div>
            </div>
        )}

        {/* AP=H Compliance Warning Toast */}
        {apHWarning && (
            <div className="fixed bottom-4 right-4 z-50 bg-amber-50 border border-amber-300 rounded-lg shadow-lg p-3 max-w-sm animate-in slide-in-from-bottom-4">
                <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-bold text-amber-800">Advertencia AIAG-VDA</p>
                        <p className="text-[11px] text-amber-700 mt-0.5">{apHWarning}</p>
                    </div>
                    <button onClick={onClearApHWarning} className="text-amber-400 hover:text-amber-600 ml-2">
                        <XCircle size={14} />
                    </button>
                </div>
            </div>
        )}

        {/* Network Transition Toast */}
        {networkToast === 'lost' && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-300 rounded-lg shadow-lg p-3 max-w-sm">
                <div className="flex items-center gap-2">
                    <WifiOff size={16} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-700">Red no disponible — los borradores se guardan localmente</p>
                    <button onClick={onClearNetworkToast} className="text-red-400 hover:text-red-600 ml-1">
                        <X size={14} />
                    </button>
                </div>
            </div>
        )}
        {networkToast === 'recovered' && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-green-50 border border-green-300 rounded-lg shadow-lg p-3 max-w-sm">
                <div className="flex items-center gap-2">
                    <Wifi size={16} className="text-green-500 flex-shrink-0" />
                    <p className="text-xs text-green-700">Red disponible</p>
                </div>
            </div>
        )}
    </>
    );
};

export default AmfeModals;
