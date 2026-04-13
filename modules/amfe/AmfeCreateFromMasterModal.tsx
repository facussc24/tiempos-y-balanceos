/**
 * AmfeCreateFromMasterModal
 *
 * Modal that lets users create a new AMFE variant from an existing master.
 * Fetches families with master AMFEs, lets the user pick one, fill in
 * variant label + part number, then clones via documentInheritance.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, GitBranch, Loader2, ShieldCheck, Copy } from 'lucide-react';

import { listFamilies } from '../../utils/repositories/familyRepository';
import { getFamilyMasterDocument } from '../../utils/repositories/familyDocumentRepository';
import { loadAmfeDocument } from '../../utils/repositories/amfeRepository';
import { cloneDocumentForVariant } from '../../core/inheritance/documentInheritance';
import { toast } from '../../components/ui/Toast';
import { logger } from '../../utils/logger';

import type { ProductFamily } from '../../utils/repositories/familyRepository';
import type { FamilyDocument } from '../../utils/repositories/familyDocumentRepository';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AmfeCreateFromMasterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onVariantCreated: (documentId: string) => void;
}

interface FamilyWithMaster {
    family: ProductFamily;
    masterDoc: FamilyDocument;
}

interface MasterPreview {
    subject: string;
    partNumber: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AmfeCreateFromMasterModal({
    isOpen,
    onClose,
    onVariantCreated,
}: AmfeCreateFromMasterModalProps) {
    // --- State ---------------------------------------------------------------

    const [familiesWithMaster, setFamiliesWithMaster] = useState<FamilyWithMaster[]>([]);
    const [loadingFamilies, setLoadingFamilies] = useState(false);

    const [selectedFamily, setSelectedFamily] = useState<FamilyWithMaster | null>(null);
    const [masterPreview, setMasterPreview] = useState<MasterPreview | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    const [variantLabel, setVariantLabel] = useState('');
    const [partNumber, setPartNumber] = useState('');
    const [creating, setCreating] = useState(false);

    // --- Fetch families with AMFE masters ------------------------------------

    const fetchFamilies = useCallback(async () => {
        setLoadingFamilies(true);
        try {
            const families = await listFamilies();
            const results: FamilyWithMaster[] = [];

            for (const family of families) {
                const master = await getFamilyMasterDocument(family.id, 'amfe');
                if (master) {
                    results.push({ family, masterDoc: master });
                }
            }

            setFamiliesWithMaster(results);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('AmfeCreateFromMasterModal', 'Error al cargar familias', { error: message });
            toast.error('Error al cargar familias', message);
        } finally {
            setLoadingFamilies(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            // Reset state on open
            setSelectedFamily(null);
            setMasterPreview(null);
            setVariantLabel('');
            setPartNumber('');
            setCreating(false);
            fetchFamilies();
        }
    }, [isOpen, fetchFamilies]);

    // --- Load master preview when family selected ----------------------------

    useEffect(() => {
        if (!selectedFamily) {
            setMasterPreview(null);
            return;
        }

        let cancelled = false;

        async function loadPreview() {
            if (!selectedFamily) return;
            setLoadingPreview(true);
            try {
                const loaded = await loadAmfeDocument(selectedFamily.masterDoc.documentId);
                if (cancelled) return;
                if (loaded) {
                    setMasterPreview({
                        subject: loaded.doc.header.subject || '(sin asunto)',
                        partNumber: loaded.doc.header.partNumber || '(sin part number)',
                    });
                } else {
                    setMasterPreview(null);
                    toast.warning('No se pudo cargar el AMFE maestro');
                }
            } catch (err) {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : String(err);
                logger.error('AmfeCreateFromMasterModal', 'Error al cargar preview del maestro', { error: message });
                toast.error('Error al cargar AMFE maestro', message);
            } finally {
                if (!cancelled) setLoadingPreview(false);
            }
        }

        loadPreview();
        return () => { cancelled = true; };
    }, [selectedFamily]);

    // --- Create variant ------------------------------------------------------

    const handleCreate = useCallback(async () => {
        if (!selectedFamily || !variantLabel.trim()) return;

        setCreating(true);
        try {
            const result = await cloneDocumentForVariant({
                familyId: selectedFamily.family.id,
                module: 'amfe',
                masterDocumentId: selectedFamily.masterDoc.documentId,
                masterFamilyDocId: selectedFamily.masterDoc.id,
                variantLabel: variantLabel.trim(),
                productId: undefined,
            });

            if (result.success && result.newDocumentId) {
                toast.success(
                    'Variante creada',
                    `Se creó la variante "${variantLabel.trim()}" correctamente.`,
                );
                onVariantCreated(result.newDocumentId);
                onClose();
            } else {
                toast.error('Error al crear variante', result.error ?? 'Error desconocido');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('AmfeCreateFromMasterModal', 'Error al clonar documento', { error: message });
            toast.error('Error al crear variante', message);
        } finally {
            setCreating(false);
        }
    }, [selectedFamily, variantLabel, onVariantCreated, onClose]);

    // --- Render --------------------------------------------------------------

    if (!isOpen) return null;

    const canCreate = selectedFamily && variantLabel.trim().length > 0 && !creating;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div className="flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-semibold text-gray-900">
                            Crear variante desde maestro
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-4 space-y-5">
                    {/* Family selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Familia con AMFE maestro
                        </label>
                        {loadingFamilies ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Cargando familias...
                            </div>
                        ) : familiesWithMaster.length === 0 ? (
                            <p className="text-sm text-gray-500 py-2">
                                No se encontraron familias con AMFE maestro.
                            </p>
                        ) : (
                            <select
                                value={selectedFamily?.family.id ?? ''}
                                onChange={(e) => {
                                    const id = Number(e.target.value);
                                    const found = familiesWithMaster.find(f => f.family.id === id) ?? null;
                                    setSelectedFamily(found);
                                }}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Seleccionar familia...</option>
                                {familiesWithMaster.map(({ family }) => (
                                    <option key={family.id} value={family.id}>
                                        {family.name}
                                        {family.lineaName ? ` (${family.lineaName})` : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Master preview */}
                    {selectedFamily && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">
                                    AMFE Maestro
                                </span>
                            </div>
                            {loadingPreview ? (
                                <div className="flex items-center gap-2 text-sm text-blue-600">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Cargando detalles...
                                </div>
                            ) : masterPreview ? (
                                <div className="text-sm text-blue-700 space-y-1">
                                    <p>
                                        <span className="font-medium">Asunto:</span>{' '}
                                        {masterPreview.subject}
                                    </p>
                                    <p>
                                        <span className="font-medium">Part Number:</span>{' '}
                                        {masterPreview.partNumber}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-sm text-blue-600">
                                    No se pudo cargar la información del maestro.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Variant label */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Etiqueta de variante
                        </label>
                        <input
                            type="text"
                            value={variantLabel}
                            onChange={(e) => setVariantLabel(e.target.value)}
                            placeholder='Ej: "L3", "Color X"'
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Se agregará entre corchetes al nombre del documento clonado.
                        </p>
                    </div>

                    {/* Part number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Part number
                        </label>
                        <input
                            type="text"
                            value={partNumber}
                            onChange={(e) => setPartNumber(e.target.value)}
                            placeholder="Ej: 2HC.858.417.B"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
                    <button
                        onClick={onClose}
                        disabled={creating}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!canCreate}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {creating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                        Crear Variante
                    </button>
                </div>
            </div>
        </div>
    );
}
