/**
 * ImportPreviewModal
 *
 * Shows a summary of what will be imported before applying changes.
 * If there are no conflicts, the user can import directly.
 * If there ARE conflicts, transitions to ImportConflictModal.
 */
import React from 'react';
import { Download, FileText, AlertTriangle, CheckCircle, X, Loader2 } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useModalTransition } from '../../hooks/useModalTransition';
import type { MergeResult } from '../../utils/mergeEngine';
import { TABLE_LABELS } from '../../utils/mergeEngine';

export interface ImportPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called when user wants to import without conflicts */
    onImportDirect: () => void;
    /** Called when user wants to review conflicts */
    onReviewConflicts: () => void;
    analysis: MergeResult | null;
    sourceDevice?: string;
    isImporting?: boolean;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
    isOpen, onClose, onImportDirect, onReviewConflicts,
    analysis, sourceDevice, isImporting = false,
}) => {
    const { shouldRender, isClosing } = useModalTransition(isOpen, 200);
    const modalRef = useFocusTrap(isOpen);

    if (!shouldRender || !analysis) return null;

    const hasConflicts = analysis.conflicts.length > 0;
    const hasChanges = analysis.added.length > 0 || analysis.updated.length > 0 || hasConflicts;

    // Group added/updated by table for display
    const tableStats = new Map<string, { added: number; updated: number }>();
    for (const a of analysis.added) {
        const s = tableStats.get(a.table) ?? { added: 0, updated: 0 };
        s.added++;
        tableStats.set(a.table, s);
    }
    for (const u of analysis.updated) {
        const s = tableStats.get(u.table) ?? { added: 0, updated: 0 };
        s.updated++;
        tableStats.set(u.table, s);
    }

    return (
        <div className={`fixed inset-0 z-modal-backdrop flex items-center justify-center ${isClosing ? 'pointer-events-none' : ''}`}>
            <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={!isImporting ? onClose : undefined}
            />

            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                className={`relative bg-slate-800 text-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'animate-scale-in'}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <Download size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Importar Datos</h2>
                            {sourceDevice && (
                                <p className="text-sm text-slate-400">Desde: {sourceDevice}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isImporting}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    {!hasChanges ? (
                        <div className="text-center py-8">
                            <CheckCircle size={48} className="mx-auto text-emerald-400 mb-3" />
                            <p className="text-lg font-medium">Todo está actualizado</p>
                            <p className="text-slate-400 text-sm mt-1">No hay datos nuevos para importar</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary */}
                            <p className="text-slate-300 text-sm">{analysis.summary}</p>

                            {/* Table breakdown */}
                            <div className="space-y-2">
                                {Array.from(tableStats.entries()).map(([table, stats]) => (
                                    <div key={table} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <FileText size={16} className="text-slate-400" />
                                            <span className="text-sm">{TABLE_LABELS[table] ?? table}</span>
                                        </div>
                                        <div className="flex gap-3 text-xs">
                                            {stats.added > 0 && (
                                                <span className="text-emerald-400">+{stats.added} nuevos</span>
                                            )}
                                            {stats.updated > 0 && (
                                                <span className="text-blue-400">{stats.updated} actualizados</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Conflict warning */}
                            {hasConflicts && (
                                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                                    <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-amber-200 font-medium text-sm">
                                            {analysis.conflicts.length} conflicto{analysis.conflicts.length !== 1 ? 's' : ''} encontrado{analysis.conflicts.length !== 1 ? 's' : ''}
                                        </p>
                                        <p className="text-amber-200/70 text-xs mt-1">
                                            Hay documentos que fueron modificados tanto en tu computadora como en el archivo importado. Necesitás elegir cuál versión conservar.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 p-5 border-t border-slate-700">
                    <button
                        onClick={onClose}
                        disabled={isImporting}
                        className="flex-1 px-4 py-2.5 bg-slate-700 text-slate-300 font-medium rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>

                    {hasChanges && (
                        hasConflicts ? (
                            <button
                                onClick={onReviewConflicts}
                                disabled={isImporting}
                                className="flex-1 px-4 py-2.5 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isImporting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <AlertTriangle size={16} />
                                        Revisar Conflictos
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={onImportDirect}
                                disabled={isImporting}
                                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isImporting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Importando...
                                    </>
                                ) : (
                                    <>
                                        <Download size={16} />
                                        Importar Todo
                                    </>
                                )}
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportPreviewModal;
