/**
 * ImportConflictModal
 *
 * Shows a list of conflicting records and lets the user choose
 * how to resolve each one: keep local, use imported, or keep both.
 */
import React, { useState, useMemo } from 'react';
import { GitMerge, Monitor, Download, Copy, CheckCircle2, X, Loader2 } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useModalTransition } from '../../hooks/useModalTransition';
import type { MergeConflict, ConflictResolution, ResolvedConflict } from '../../utils/mergeEngine';
import { TABLE_LABELS } from '../../utils/mergeEngine';

export interface ImportConflictModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (resolutions: ResolvedConflict[]) => void;
    conflicts: MergeConflict[];
    /** Number of non-conflict changes that will also be applied */
    autoApplyCount: number;
    isApplying?: boolean;
}

const RESOLUTION_OPTIONS: { value: ConflictResolution; label: string; icon: React.ElementType; color: string }[] = [
    { value: 'keepLocal', label: 'Mantener mio', icon: Monitor, color: 'text-blue-400' },
    { value: 'keepRemote', label: 'Usar importado', icon: Download, color: 'text-emerald-400' },
    { value: 'keepBoth', label: 'Guardar ambos', icon: Copy, color: 'text-violet-400' },
];

export const ImportConflictModal: React.FC<ImportConflictModalProps> = ({
    isOpen, onClose, onApply, conflicts, autoApplyCount, isApplying = false,
}) => {
    const { shouldRender, isClosing } = useModalTransition(isOpen, 200);
    const modalRef = useFocusTrap(isOpen);

    // Track resolution per conflict
    const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(new Map());

    const conflictKey = (c: MergeConflict) => `${c.table}:${c.id}`;

    const allResolved = useMemo(
        () => conflicts.every(c => resolutions.has(conflictKey(c))),
        [conflicts, resolutions],
    );

    const setResolution = (conflict: MergeConflict, resolution: ConflictResolution) => {
        setResolutions(prev => {
            const next = new Map(prev);
            next.set(conflictKey(conflict), resolution);
            return next;
        });
    };

    const setAllResolution = (resolution: ConflictResolution) => {
        setResolutions(new Map(conflicts.map(c => [conflictKey(c), resolution])));
    };

    const handleApply = () => {
        const resolved: ResolvedConflict[] = conflicts.map(c => ({
            table: c.table,
            id: c.id,
            resolution: resolutions.get(conflictKey(c)) ?? 'keepLocal',
        }));
        onApply(resolved);
    };

    const formatDate = (ts: string | undefined) => {
        if (!ts) return '-';
        try {
            return new Date(ts).toLocaleString('es-AR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
            });
        } catch {
            return ts;
        }
    };

    if (!shouldRender) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${isClosing ? 'pointer-events-none' : ''}`}>
            <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={!isApplying ? onClose : undefined}
            />

            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                className={`relative bg-slate-800 text-white rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'animate-scale-in'}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                            <GitMerge size={20} className="text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Resolver Conflictos</h2>
                            <p className="text-sm text-slate-400">
                                {conflicts.length} conflicto{conflicts.length !== 1 ? 's' : ''}
                                {autoApplyCount > 0 && ` + ${autoApplyCount} cambios automaticos`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isApplying}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Bulk actions */}
                <div className="flex gap-2 px-5 pt-4">
                    <span className="text-xs text-slate-400 mr-2 self-center">Resolver todos:</span>
                    {RESOLUTION_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setAllResolution(opt.value)}
                            className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded-md transition-colors flex items-center gap-1.5"
                        >
                            <opt.icon size={12} className={opt.color} />
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Conflict list */}
                <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
                    {conflicts.map(conflict => {
                        const key = conflictKey(conflict);
                        const current = resolutions.get(key);

                        return (
                            <div key={key} className="bg-slate-700/50 rounded-lg p-4 space-y-3">
                                {/* Conflict header */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-xs text-slate-400">
                                            {TABLE_LABELS[conflict.table] ?? conflict.table}
                                        </span>
                                        <p className="font-medium text-sm">{conflict.label}</p>
                                    </div>
                                    {current && (
                                        <CheckCircle2 size={16} className="text-emerald-400" />
                                    )}
                                </div>

                                {/* Date comparison */}
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="bg-slate-800/50 rounded px-3 py-2">
                                        <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                                            <Monitor size={12} />
                                            <span>Tu version</span>
                                        </div>
                                        <span className="text-slate-300">
                                            {formatDate(conflict.localRecord.updated_at as string)}
                                        </span>
                                    </div>
                                    <div className="bg-slate-800/50 rounded px-3 py-2">
                                        <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
                                            <Download size={12} />
                                            <span>Version importada</span>
                                        </div>
                                        <span className="text-slate-300">
                                            {formatDate(conflict.remoteRecord.updated_at as string)}
                                        </span>
                                    </div>
                                </div>

                                {/* Resolution buttons */}
                                <div className="flex gap-2">
                                    {RESOLUTION_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setResolution(conflict, opt.value)}
                                            className={`flex-1 px-3 py-2 text-xs rounded-md transition-all flex items-center justify-center gap-1.5 ${
                                                current === opt.value
                                                    ? 'bg-slate-600 ring-2 ring-blue-500 text-white'
                                                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                            }`}
                                        >
                                            <opt.icon size={14} className={opt.color} />
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Actions */}
                <div className="flex gap-3 p-5 border-t border-slate-700">
                    <button
                        onClick={onClose}
                        disabled={isApplying}
                        className="flex-1 px-4 py-2.5 bg-slate-700 text-slate-300 font-medium rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!allResolved || isApplying}
                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isApplying ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Aplicando...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={16} />
                                Aplicar ({allResolved ? conflicts.length : `${resolutions.size}/${conflicts.length}`})
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportConflictModal;
