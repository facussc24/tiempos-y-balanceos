/**
 * ApqpExportDialog — Modal for configuring and triggering APQP package export.
 *
 * Shows checkboxes for each section, a revision field, and an export button.
 * Loads the actual documents from Supabase when opened.
 *
 * Follows DESIGN_SYSTEM.md modal patterns.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, Download, Loader2, FileSpreadsheet,
    GitBranch, ShieldAlert, ClipboardCheck, Info,
    CheckSquare, Square,
} from 'lucide-react';
import { useModalTransition } from '../../hooks/useModalTransition';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { listFamilyDocuments } from '../../utils/repositories/familyDocumentRepository';
import { loadPfdDocument } from '../../utils/repositories/pfdRepository';
import { loadAmfeDocument } from '../../utils/repositories/amfeRepository';
import { loadCpDocument } from '../../utils/repositories/cpRepository';
import { getFamilyMembers } from '../../utils/repositories/familyRepository';
import { exportApqpPackage } from './apqpPackageExport';
import type { ApqpPackageData, ApqpExportOptions } from './apqpPackageExport';
import type { ProductFamily } from '../../utils/repositories/familyRepository';
import type { PfdDocument } from '../pfd/pfdTypes';
import type { AmfeDocument } from '../amfe/amfeTypes';
import type { ControlPlanDocument } from '../controlPlan/controlPlanTypes';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApqpExportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    family: ProductFamily;
}

type DocumentModule = 'pfd' | 'amfe' | 'cp';

interface LoadedDocs {
    pfd: PfdDocument | null;
    amfe: AmfeDocument | null;
    cp: ControlPlanDocument | null;
}

// ---------------------------------------------------------------------------
// Section config
// ---------------------------------------------------------------------------

const SECTIONS = [
    { key: 'includePortada' as const, label: 'Portada', icon: FileSpreadsheet, color: 'text-slate-500', always: true },
    { key: 'includeFlujograma' as const, label: 'Flujograma (PFD)', icon: GitBranch, color: 'text-cyan-500', docKey: 'pfd' as DocumentModule },
    { key: 'includeAmfe' as const, label: 'AMFE VDA', icon: ShieldAlert, color: 'text-blue-500', docKey: 'amfe' as DocumentModule },
    { key: 'includeCp' as const, label: 'Plan de Control', icon: ClipboardCheck, color: 'text-teal-500', docKey: 'cp' as DocumentModule },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ApqpExportDialog: React.FC<ApqpExportDialogProps> = ({
    isOpen,
    onClose,
    family,
}) => {
    const { shouldRender, isClosing } = useModalTransition(isOpen, 200);
    const modalRef = useFocusTrap(isOpen);
    const cancelRef = useRef<HTMLButtonElement>(null);

    // State
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [docs, setDocs] = useState<LoadedDocs>({ pfd: null, amfe: null, cp: null });
    const [partNumbers, setPartNumbers] = useState<string[]>([]);
    const [revision, setRevision] = useState('A');
    const [options, setOptions] = useState<ApqpExportOptions>({
        includePortada: true,
        includeFlujograma: true,
        includeAmfe: true,
        includeCp: true,
        revision: 'A',
    });

    // Load documents when dialog opens
    const loadDocuments = useCallback(async () => {
        if (!family?.id) return;
        setLoading(true);
        setError(null);

        try {
            const familyDocs = await listFamilyDocuments(family.id);
            const masters = familyDocs.filter(d => d.isMaster);

            const loaded: LoadedDocs = { pfd: null, amfe: null, cp: null };

            // Load each master document in parallel
            const promises: Promise<void>[] = [];

            for (const doc of masters) {
                const mod = doc.module as DocumentModule;
                if (mod === 'pfd') {
                    promises.push(
                        loadPfdDocument(doc.documentId).then(result => {
                            if (result) loaded.pfd = result;
                        })
                    );
                } else if (mod === 'amfe') {
                    promises.push(
                        loadAmfeDocument(doc.documentId).then(result => {
                            if (result) loaded.amfe = result.doc;
                        })
                    );
                } else if (mod === 'cp') {
                    promises.push(
                        loadCpDocument(doc.documentId).then(result => {
                            if (result) loaded.cp = result;
                        })
                    );
                }
            }

            // Load family members for part numbers
            promises.push(
                getFamilyMembers(family.id).then(members => {
                    setPartNumbers(members.map(m => m.codigo || '').filter(Boolean));
                })
            );

            await Promise.all(promises);
            setDocs(loaded);

            // Auto-disable sections without documents
            setOptions(prev => ({
                ...prev,
                includeFlujograma: prev.includeFlujograma && loaded.pfd !== null,
                includeAmfe: prev.includeAmfe && loaded.amfe !== null,
                includeCp: prev.includeCp && loaded.cp !== null,
            }));
        } catch (err) {
            logger.error('ApqpExport', 'Error loading documents', {}, err instanceof Error ? err : undefined);
            setError('Error al cargar documentos');
        } finally {
            setLoading(false);
        }
    }, [family?.id]);

    useEffect(() => {
        if (isOpen) {
            loadDocuments();
            // Reset state
            setRevision('A');
            setOptions({
                includePortada: true,
                includeFlujograma: true,
                includeAmfe: true,
                includeCp: true,
                revision: 'A',
            });
        }
    }, [isOpen, loadDocuments]);

    // Auto-focus cancel
    useEffect(() => {
        if (isOpen && !loading) {
            const timer = setTimeout(() => cancelRef.current?.focus(), 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen, loading]);

    // Escape to close
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !exporting) onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, exporting, onClose]);

    const toggleOption = (key: keyof ApqpExportOptions) => {
        if (key === 'revision') return;
        setOptions(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleExport = async () => {
        setExporting(true);
        setError(null);
        try {
            const client = family.lineaName || '';
            const team = docs.amfe?.header?.team || docs.cp?.header?.coreTeam || '';

            const data: ApqpPackageData = {
                familyName: family.name,
                partNumbers,
                client,
                revision,
                team,
                date: new Date().toISOString().split('T')[0],
                pfd: docs.pfd,
                amfe: docs.amfe,
                cp: docs.cp,
            };

            const exportOptions: ApqpExportOptions = {
                ...options,
                revision,
            };

            await exportApqpPackage(data, exportOptions);
            onClose();
        } catch (err) {
            logger.error('ApqpExport', 'Export error', {}, err instanceof Error ? err : undefined);
            setError('Error al exportar paquete');
        } finally {
            setExporting(false);
        }
    };

    const hasAnySection = options.includePortada || options.includeFlujograma ||
        options.includeAmfe || options.includeCp;

    if (!shouldRender) return null;

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${isClosing ? 'pointer-events-none' : ''}`}>
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in duration-200'}`}
                onClick={!exporting ? onClose : undefined}
            />

            {/* Modal */}
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="apqp-export-title"
                className={`relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden outline-none transition-all duration-200 ${isClosing ? 'scale-95 opacity-0' : 'animate-scale-in'}`}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    disabled={exporting}
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                    aria-label="Cerrar"
                >
                    <X size={20} />
                </button>

                <div className="p-6">
                    {/* Icon */}
                    <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileSpreadsheet size={28} className="text-blue-600" />
                    </div>

                    {/* Title */}
                    <h2 id="apqp-export-title" className="text-xl font-bold text-slate-800 text-center mb-1">
                        Exportar Paquete APQP
                    </h2>
                    <p className="text-sm text-slate-500 text-center mb-5">
                        {family.name}
                    </p>

                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
                            <Loader2 size={20} className="animate-spin" />
                            <span className="text-sm">Cargando documentos...</span>
                        </div>
                    ) : (
                        <>
                            {/* Section checkboxes */}
                            <div className="space-y-2 mb-3">
                                {SECTIONS.map(section => {
                                    const docAvailable = section.always || (section.docKey && docs[section.docKey] !== null);
                                    const isChecked = options[section.key];
                                    const Icon = section.icon;
                                    const CheckIcon = isChecked ? CheckSquare : Square;

                                    return (
                                        <button
                                            key={section.key}
                                            onClick={() => docAvailable && toggleOption(section.key)}
                                            disabled={!docAvailable}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                                                docAvailable
                                                    ? 'hover:bg-slate-50 cursor-pointer'
                                                    : 'opacity-40 cursor-not-allowed'
                                            }`}
                                        >
                                            <CheckIcon
                                                size={18}
                                                className={isChecked && docAvailable ? 'text-blue-600' : 'text-slate-300'}
                                            />
                                            <Icon size={16} className={section.color} />
                                            <span className="text-sm font-medium text-slate-700 flex-grow">
                                                {section.label}
                                            </span>
                                            {!docAvailable && !section.always && (
                                                <span className="text-xs text-slate-400 italic">Sin documento</span>
                                            )}
                                                        </button>
                                    );
                                })}
                            </div>

                            {/* HO info note */}
                            <div className="flex items-start gap-2 px-3 py-2 mb-5 bg-slate-50 border border-slate-200 rounded-lg">
                                <Info size={14} className="text-slate-400 mt-0.5 shrink-0" />
                                <span className="text-xs text-slate-500">
                                    Las Hojas de Operaciones se exportan individualmente desde el módulo HO (requieren imágenes no soportadas por este formato).
                                </span>
                            </div>

                            {/* Revision field */}
                            <div className="mb-5">
                                <label htmlFor="apqp-revision" className="block text-sm font-medium text-slate-700 mb-1">
                                    Revisión
                                </label>
                                <input
                                    id="apqp-revision"
                                    type="text"
                                    value={revision}
                                    onChange={e => setRevision(e.target.value)}
                                    placeholder="A"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                                               focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500
                                               transition-colors"
                                />
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                    {error}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    ref={cancelRef}
                                    onClick={onClose}
                                    disabled={exporting}
                                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg
                                               hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                                               focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 outline-none"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleExport}
                                    disabled={exporting || !hasAnySection}
                                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg
                                               hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed
                                               flex items-center justify-center gap-2
                                               focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 outline-none"
                                >
                                    {exporting ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            <span>Exportando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={18} />
                                            <span>Exportar</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ApqpExportDialog;
