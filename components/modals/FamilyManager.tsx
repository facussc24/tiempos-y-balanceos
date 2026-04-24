/**
 * FamilyManager
 *
 * Modal for managing product families (CRUD).
 * Accessed via the "Familias" button in ProductSelector dropdown footer.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { X, Plus, Trash2, Star, Users, Search, Package, AlertCircle, Loader2, FileText, Link2, Unlink, GitBranch, Copy, CheckCircle } from 'lucide-react';
import type { ProductFamily, ProductFamilyMember } from '../../utils/repositories/familyRepository';
import {
    listFamilies,
    createFamily,
    updateFamily,
    deleteFamily,
    getFamilyMembers,
    addFamilyMember,
    removeFamilyMember,
    setFamilyPrimary,
    getFamilyCount,
    getOrphanProducts,
} from '../../utils/repositories/familyRepository';
import { listProducts } from '../../utils/repositories/productRepository';
import type { Product } from '../../utils/repositories/productRepository';
import { useFamilyDocuments } from '../../modules/family/hooks/useFamilyDocuments';
import type { DocumentModule } from '../../modules/family/hooks/useFamilyDocuments';
import { listAmfeDocuments } from '../../utils/repositories/amfeRepository';
import { listCpDocuments } from '../../utils/repositories/cpRepository';
import { listHoDocuments } from '../../utils/repositories/hoRepository';
import { listPfdDocuments } from '../../utils/repositories/pfdRepository';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FamilyManagerProps {
    onClose: () => void;
}

type View = 'list' | 'create' | 'edit';
type EditTab = 'productos' | 'documentos' | 'variantes';

interface DocModuleConfig {
    key: DocumentModule;
    label: string;
    colorText: string;
    colorBg: string;
    getIdentifier: (doc: Record<string, unknown>) => string;
    getPartNumber: (doc: Record<string, unknown>) => string;
    getClient: (doc: Record<string, unknown>) => string;
    listFn: () => Promise<Record<string, unknown>[]>;
}

const DOC_MODULE_CONFIGS: DocModuleConfig[] = [
    {
        key: 'pfd',
        label: 'PFD',
        colorText: 'text-cyan-600',
        colorBg: 'bg-cyan-50',
        getIdentifier: (d) => String(d.documentNumber || d.document_number || '—'),
        getPartNumber: (d) => String(d.partNumber || d.part_number || ''),
        getClient: (d) => String(d.customerName || d.customer_name || d.client || ''),
        listFn: listPfdDocuments as unknown as () => Promise<Record<string, unknown>[]>,
    },
    {
        key: 'amfe',
        label: 'AMFE',
        colorText: 'text-amber-600',
        colorBg: 'bg-amber-50',
        getIdentifier: (d) => String(d.amfeNumber || d.amfe_number || '—'),
        getPartNumber: (d) => String(d.partNumber || d.part_number || ''),
        getClient: (d) => String(d.client || ''),
        listFn: listAmfeDocuments as unknown as () => Promise<Record<string, unknown>[]>,
    },
    {
        key: 'cp',
        label: 'Plan de Control',
        colorText: 'text-emerald-600',
        colorBg: 'bg-emerald-50',
        getIdentifier: (d) => String(d.controlPlanNumber || d.control_plan_number || '—'),
        getPartNumber: (d) => String(d.partNumber || d.part_number || ''),
        getClient: (d) => String(d.client || ''),
        listFn: listCpDocuments as unknown as () => Promise<Record<string, unknown>[]>,
    },
    {
        key: 'ho',
        label: 'Hoja de Operaciones',
        colorText: 'text-blue-600',
        colorBg: 'bg-blue-50',
        getIdentifier: (d) => String(d.formNumber || d.form_number || '—'),
        getPartNumber: (d) => String(d.partNumber || d.part_number || ''),
        getClient: (d) => String(d.client || ''),
        listFn: listHoDocuments as unknown as () => Promise<Record<string, unknown>[]>,
    },
];

/** Result type for document cloning (mirrors core/inheritance/documentInheritance) */
interface CloneResult {
    success: boolean;
    newDocumentId: string | null;
    familyDocId: number | null;
    error?: string;
}

/** Module color config lookup for variant badges */
const MODULE_BADGE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
    pfd: { text: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
    amfe: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    cp: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    ho: { text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const FamilyManager: React.FC<FamilyManagerProps> = ({ onClose }) => {
    const [view, setView] = useState<View>('list');
    const [families, setFamilies] = useState<ProductFamily[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({ familyCount: 0, orphanCount: 0 });
    const [selectedFamily, setSelectedFamily] = useState<ProductFamily | null>(null);
    const [members, setMembers] = useState<ProductFamilyMember[]>([]);
    const [deletePending, setDeletePending] = useState<ProductFamily | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');

    // Product picker state
    const [productSearch, setProductSearch] = useState('');
    const [productResults, setProductResults] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    // Edit tab state
    const [editTab, setEditTab] = useState<EditTab>('productos');

    // Document picker state
    const [openPicker, setOpenPicker] = useState<DocumentModule | null>(null);
    const [pickerDocs, setPickerDocs] = useState<Record<string, unknown>[]>([]);
    const [pickerLoading, setPickerLoading] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');

    // Family documents hook
    const {
        masterDocs,
        variantDocs,
        loading: docsLoading,
        error: docsError,
        linkMaster,
        unlinkMaster,
        refresh: refreshDocs,
    } = useFamilyDocuments(selectedFamily?.id ?? null);

    // Variant creation state
    const [variantLabel, setVariantLabel] = useState('');
    const [selectedModules, setSelectedModules] = useState<Set<DocumentModule>>(new Set());
    const [isCloning, setIsCloning] = useState(false);

    // Refs for mutex and stale-state prevention
    const addingRef = useRef(false);
    const membersRef = useRef<ProductFamilyMember[]>([]);

    // ---------------------------------------------------------------------------
    // Data loading
    // ---------------------------------------------------------------------------

    const loadFamilies = useCallback(async () => {
        try {
            const [fams, count, orphans] = await Promise.all([
                listFamilies({ search: searchQuery || undefined }),
                getFamilyCount(),
                getOrphanProducts({ limit: 1 }),
            ]);
            setFamilies(fams);
            setStats({ familyCount: count, orphanCount: orphans.length > 0 ? -1 : 0 }); // -1 = "hay huérfanos"

            // Get real orphan count in background (can be slow)
            getOrphanProducts().then(all => {
                setStats(prev => ({ ...prev, orphanCount: all.length }));
            }).catch(() => {});
        } catch {
            setError('Error al cargar familias');
        }
    }, [searchQuery]);

    useEffect(() => {
        loadFamilies();
    }, [loadFamilies]);

    const loadMembers = useCallback(async (familyId: number) => {
        try {
            const m = await getFamilyMembers(familyId);
            setMembers(m);
            membersRef.current = m;
        } catch {
            setError('Error al cargar miembros');
        }
    }, []);

    // Product search for adding members
    useEffect(() => {
        if (productSearch.length < 2) {
            setProductResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        const timer = setTimeout(async () => {
            try {
                const products = await listProducts({ search: productSearch, limit: 15, activeOnly: true });
                // Filter out products already in the family (use ref to avoid stale closure)
                const memberIds = new Set(membersRef.current.map(m => m.productId));
                setProductResults(products.filter(p => !memberIds.has(p.id)));
            } catch {
                setProductResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [productSearch]);

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------

    const handleCreate = useCallback(async () => {
        if (!formName.trim()) {
            setError('El nombre es obligatorio');
            return;
        }
        try {
            const trimmedName = formName.trim();
            const trimmedDesc = formDescription.trim();
            const id = await createFamily({
                name: trimmedName,
                description: trimmedDesc,
            });
            // Switch to edit view to add members (keep formName/formDescription for edit inputs)
            setFormName(trimmedName);
            setFormDescription(trimmedDesc);
            const family = { id, name: trimmedName, description: trimmedDesc, lineaCode: '', lineaName: '', active: true, createdAt: '', updatedAt: '', memberCount: 0 };
            setSelectedFamily(family);
            setMembers([]);
            setView('edit');
            loadFamilies();
        } catch (err) {
            setError(err instanceof Error && err.message.includes('UNIQUE') ? 'Ya existe una familia con ese nombre' : 'Error al crear familia');
        }
    }, [formName, formDescription, loadFamilies]);

    const handleDelete = useCallback((family: ProductFamily) => {
        setDeletePending(family);
    }, []);

    const handleDeleteConfirm = useCallback(async () => {
        const family = deletePending;
        if (!family) return;
        setDeletePending(null);
        // was: if (!confirm(`¿Eliminar la familia "${family.name}" y todas sus asignaciones?`)) return;
        try {
            await deleteFamily(family.id);
            loadFamilies();
            if (selectedFamily?.id === family.id) {
                setSelectedFamily(null);
                setView('list');
            }
        } catch {
            setError('Error al eliminar familia');
        }
    }, [deletePending, loadFamilies, selectedFamily]);

    const handleEditFamily = useCallback(async (family: ProductFamily) => {
        setError(null);
        try {
            setSelectedFamily(family);
            setFormName(family.name);
            setFormDescription(family.description);
            await loadMembers(family.id);
            setView('edit');
        } catch {
            setError('Error al cargar miembros de la familia');
        }
    }, [loadMembers]);

    const handleUpdateFamily = useCallback(async () => {
        if (!selectedFamily || !formName.trim()) return;
        try {
            await updateFamily(selectedFamily.id, {
                name: formName.trim(),
                description: formDescription.trim(),
            });
            loadFamilies();
            setError(null);
        } catch (err) {
            setError(err instanceof Error && err.message.includes('UNIQUE') ? 'Ya existe una familia con ese nombre' : 'Error al actualizar');
        }
    }, [selectedFamily, formName, formDescription, loadFamilies]);

    const handleAddMember = useCallback(async (product: Product) => {
        if (!selectedFamily || addingRef.current) return;
        addingRef.current = true;
        setIsAdding(true);
        try {
            const isFirst = membersRef.current.length === 0;
            await addFamilyMember(selectedFamily.id, product.id, isFirst);
            await loadMembers(selectedFamily.id);
            setProductSearch('');
            setProductResults([]);
            loadFamilies();
        } catch {
            setError('Error al agregar producto');
        } finally {
            addingRef.current = false;
            setIsAdding(false);
        }
    }, [selectedFamily, loadMembers, loadFamilies]);

    const handleRemoveMember = useCallback(async (member: ProductFamilyMember) => {
        if (!selectedFamily) return;
        try {
            await removeFamilyMember(selectedFamily.id, member.productId);
            await loadMembers(selectedFamily.id);
            loadFamilies();
        } catch {
            setError('Error al quitar producto');
        }
    }, [selectedFamily, loadMembers, loadFamilies]);

    const handleSetPrimary = useCallback(async (member: ProductFamilyMember) => {
        if (!selectedFamily) return;
        try {
            await setFamilyPrimary(selectedFamily.id, member.productId);
            await loadMembers(selectedFamily.id);
        } catch {
            setError('Error al establecer primario');
        }
    }, [selectedFamily, loadMembers]);

    // Document picker handlers
    const handleOpenPicker = useCallback(async (config: DocModuleConfig) => {
        if (openPicker === config.key) {
            setOpenPicker(null);
            setPickerDocs([]);
            setPickerSearch('');
            return;
        }
        setOpenPicker(config.key);
        setPickerSearch('');
        setPickerLoading(true);
        try {
            const docs = await config.listFn();
            setPickerDocs(docs);
        } catch {
            setPickerDocs([]);
        } finally {
            setPickerLoading(false);
        }
    }, [openPicker]);

    const handleLinkDocument = useCallback(async (module: DocumentModule, documentId: string) => {
        await linkMaster(module, documentId);
        setOpenPicker(null);
        setPickerDocs([]);
        setPickerSearch('');
    }, [linkMaster]);

    const handleUnlinkDocument = useCallback(async (familyDocId: number) => {
        await unlinkMaster(familyDocId);
    }, [unlinkMaster]);

    // Variant module checkbox toggle
    const handleToggleModule = useCallback((mod: DocumentModule) => {
        setSelectedModules(prev => {
            const next = new Set(prev);
            if (next.has(mod)) {
                next.delete(mod);
            } else {
                next.add(mod);
            }
            return next;
        });
    }, []);

    // Create variant handler
    const handleCreateVariant = useCallback(async () => {
        if (!selectedFamily || !variantLabel.trim() || selectedModules.size === 0) return;
        setIsCloning(true);
        try {
            const mod = await import('../../core/inheritance/documentInheritance') as {
                cloneDocumentForVariant: (params: {
                    familyId: number;
                    module: DocumentModule;
                    masterDocumentId: string;
                    masterFamilyDocId: number;
                    variantLabel: string;
                }) => Promise<CloneResult>;
            };

            const errors: string[] = [];
            for (const modKey of selectedModules) {
                const master = masterDocs[modKey];
                if (!master) continue;
                const result = await mod.cloneDocumentForVariant({
                    familyId: selectedFamily.id,
                    module: modKey,
                    masterDocumentId: master.documentId,
                    masterFamilyDocId: master.id,
                    variantLabel: variantLabel.trim(),
                });
                if (!result.success) {
                    errors.push(`${modKey.toUpperCase()}: ${result.error}`);
                }
            }

            if (errors.length > 0) {
                setError(`Errores al clonar: ${errors.join(', ')}`);
            }

            // Refresh document lists
            await refreshDocs();
            setVariantLabel('');
            setSelectedModules(new Set());
        } catch (err) {
            logger.error('FamilyManager', 'Error creating variant', { error: String(err) });
            setError('Error al crear variante');
        } finally {
            setIsCloning(false);
        }
    }, [selectedFamily, variantLabel, selectedModules, masterDocs, refreshDocs]);

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <div className="fixed inset-0 z-modal-backdrop flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users size={18} className="text-purple-600" />
                        <h2 className="text-sm font-semibold text-purple-900">Familias de Productos</h2>
                        <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">
                            {stats.familyCount} familia{stats.familyCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors" title="Cerrar">
                        <X size={16} />
                    </button>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2">
                        <AlertCircle size={14} className="text-red-500 shrink-0" />
                        <span className="text-[11px] text-red-700">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600" title="Cerrar error">
                            <X size={12} />
                        </button>
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {view === 'list' && (
                        <div>
                            {/* Search + Create */}
                            <div className="px-4 py-2 flex items-center gap-2 border-b border-gray-100">
                                <div className="relative flex-1">
                                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Buscar familia..."
                                        className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-gray-200 rounded-lg focus:ring-1 focus:ring-purple-300 focus:border-purple-400"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        setFormName('');
                                        setFormDescription('');
                                        setView('create');
                                        setError(null);
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 text-white text-[11px] font-medium rounded-lg hover:bg-purple-700 transition-colors"
                                >
                                    <Plus size={12} />
                                    Nueva
                                </button>
                            </div>

                            {/* Family list */}
                            {families.length === 0 ? (
                                <div className="px-4 py-8 text-center">
                                    <Users size={32} className="text-gray-300 mx-auto mb-2" />
                                    <p className="text-[11px] text-gray-500">No hay familias creadas.</p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Las familias agrupan productos que comparten el mismo proceso de manufactura.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {families.map(family => (
                                        <div
                                            key={family.id}
                                            className="px-4 py-2 hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-3"
                                            onClick={() => handleEditFamily(family)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-medium text-gray-800 truncate" title={family.name}>{family.name}</div>
                                                {family.description && (
                                                    <div className="text-[10px] text-gray-400 truncate" title={family.description}>{family.description}</div>
                                                )}
                                            </div>
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">
                                                {family.memberCount ?? 0} prod.
                                            </span>
                                            <button
                                                onClick={e => { e.stopPropagation(); handleDelete(family); }}
                                                className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                                                title="Eliminar familia"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Stats footer */}
                            {stats.orphanCount > 0 && (
                                <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 text-[10px] text-amber-700">
                                    {stats.orphanCount} producto{stats.orphanCount !== 1 ? 's' : ''} sin familia asignada
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'create' && (
                        <div className="p-4 space-y-3">
                            <h3 className="text-[12px] font-semibold text-gray-700">Nueva Familia</h3>
                            <div>
                                <label htmlFor="family-create-name" className="block text-[10px] font-medium text-gray-500 mb-1">Nombre *</label>
                                <input
                                    id="family-create-name"
                                    type="text"
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    placeholder="Ej: Espejos Exteriores LEQUIPE"
                                    className="w-full px-3 py-2 text-[11px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-100 focus:border-purple-400"
                                    maxLength={100}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label htmlFor="family-create-description" className="block text-[10px] font-medium text-gray-500 mb-1">Descripción</label>
                                <textarea
                                    id="family-create-description"
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    placeholder="Descripción opcional del proceso compartido..."
                                    className="w-full px-3 py-2 text-[11px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-100 focus:border-purple-400 resize-none"
                                    rows={2}
                                    maxLength={500}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => setView('list')}
                                    className="px-3 py-1.5 text-[11px] text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreate}
                                    disabled={!formName.trim()}
                                    className="px-3 py-1.5 text-[11px] text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Crear y agregar productos
                                </button>
                            </div>
                        </div>
                    )}

                    {view === 'edit' && selectedFamily && (
                        <div className="flex flex-col">
                            {/* Family name + description */}
                            <div className="p-4 space-y-2">
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 space-y-2">
                                        <div>
                                            <label htmlFor="family-edit-name" className="block text-[10px] font-medium text-gray-500 mb-1">Nombre</label>
                                            <input
                                                id="family-edit-name"
                                                type="text"
                                                value={formName}
                                                onChange={e => setFormName(e.target.value)}
                                                onBlur={handleUpdateFamily}
                                                className="w-full px-2 py-1.5 text-[11px] border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-300"
                                                maxLength={100}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="family-edit-description" className="block text-[10px] font-medium text-gray-500 mb-1">Descripción</label>
                                            <input
                                                id="family-edit-description"
                                                type="text"
                                                value={formDescription}
                                                onChange={e => setFormDescription(e.target.value)}
                                                onBlur={handleUpdateFamily}
                                                placeholder="Descripción opcional..."
                                                className="w-full px-2 py-1.5 text-[11px] border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-300"
                                                maxLength={500}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tab bar */}
                            <div className="flex border-b border-gray-200 px-4">
                                <button
                                    onClick={() => setEditTab('productos')}
                                    className={`px-3 py-2 text-[11px] font-medium transition-colors relative ${
                                        editTab === 'productos'
                                            ? 'text-purple-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <Package size={12} />
                                        {`Productos (${members.length})`}
                                    </div>
                                    {editTab === 'productos' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-600 rounded-t" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setEditTab('documentos')}
                                    className={`px-3 py-2 text-[11px] font-medium transition-colors relative ${
                                        editTab === 'documentos'
                                            ? 'text-purple-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <FileText size={12} />
                                        Documentos Maestros
                                    </div>
                                    {editTab === 'documentos' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-600 rounded-t" />
                                    )}
                                </button>
                                <button
                                    onClick={() => setEditTab('variantes')}
                                    className={`px-3 py-2 text-[11px] font-medium transition-colors relative ${
                                        editTab === 'variantes'
                                            ? 'text-purple-600'
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <GitBranch size={12} />
                                        {`Variantes (${variantDocs.length})`}
                                    </div>
                                    {editTab === 'variantes' && (
                                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-600 rounded-t" />
                                    )}
                                </button>
                            </div>

                            {/* Tab content */}
                            <div className="p-4 space-y-3">
                                {/* ===== PRODUCTOS TAB ===== */}
                                {editTab === 'productos' && (
                                    <>
                                        {/* Members list */}
                                        <div>
                                            {members.length === 0 ? (
                                                <div className="px-3 py-4 text-center bg-gray-50 rounded-lg">
                                                    <Package size={20} className="text-gray-300 mx-auto mb-1" />
                                                    <p className="text-[10px] text-gray-400">Sin productos. Use el buscador de abajo para agregar.</p>
                                                </div>
                                            ) : (
                                                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[200px] overflow-y-auto">
                                                    {members.map(member => (
                                                        <div key={member.id} className="px-2.5 py-1.5 flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleSetPrimary(member)}
                                                                className={`p-0.5 transition-colors ${
                                                                    member.isPrimary ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'
                                                                }`}
                                                                title={member.isPrimary ? 'Producto primario' : 'Establecer como primario'}
                                                            >
                                                                <Star size={12} fill={member.isPrimary ? 'currentColor' : 'none'} />
                                                            </button>
                                                            <span className="text-[10px] font-mono font-semibold text-blue-700 shrink-0">
                                                                {member.codigo || `ID:${member.productId}`}
                                                            </span>
                                                            <span className="text-[10px] text-gray-500 truncate flex-1" title={member.descripcion || '(sin descripción)'}>
                                                                {member.descripcion || '(sin descripción)'}
                                                            </span>
                                                            <span className="text-[9px] text-gray-400 shrink-0">
                                                                {member.lineaName || ''}
                                                            </span>
                                                            <button
                                                                onClick={() => handleRemoveMember(member)}
                                                                className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                                                                title="Quitar de la familia"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Add product search */}
                                        <div>
                                            <label htmlFor="family-product-search" className="block text-[10px] font-medium text-gray-500 mb-1">Agregar producto</label>
                                            <div className="relative">
                                                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    id="family-product-search"
                                                    type="text"
                                                    value={productSearch}
                                                    onChange={e => setProductSearch(e.target.value)}
                                                    placeholder="Buscar por código o descripción..."
                                                    className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-300"
                                                />
                                            </div>
                                            {isAdding && (
                                                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-purple-500 justify-center">
                                                    <Loader2 size={12} className="animate-spin" />
                                                    Agregando...
                                                </div>
                                            )}
                                            {productResults.length > 0 && !isAdding && (
                                                <div className="mt-1 border border-gray-200 rounded-lg max-h-[150px] overflow-y-auto">
                                                    {productResults.map(product => (
                                                        <div
                                                            key={product.id}
                                                            onClick={() => handleAddMember(product)}
                                                            className="px-2.5 py-1.5 cursor-pointer hover:bg-purple-50 transition-colors border-b border-gray-50 last:border-b-0"
                                                        >
                                                            <div className="flex items-baseline gap-2">
                                                                <Plus size={10} className="text-purple-400 shrink-0" />
                                                                <span className="text-[10px] font-mono font-semibold text-blue-700">{product.codigo}</span>
                                                                <span className="text-[9px] text-gray-500 truncate" title={product.descripcion}>{product.descripcion}</span>
                                                            </div>
                                                            <div className="text-[8px] text-gray-400 ml-5">{product.lineaName}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {isSearching && (
                                                <div className="text-[10px] text-gray-400 mt-1 text-center">Buscando...</div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* ===== DOCUMENTOS MAESTROS TAB ===== */}
                                {editTab === 'documentos' && (
                                    <>
                                        {docsError && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 rounded-lg">
                                                <AlertCircle size={12} className="text-red-500 shrink-0" />
                                                <span className="text-[10px] text-red-700">{docsError}</span>
                                            </div>
                                        )}

                                        {docsLoading ? (
                                            <div className="flex items-center justify-center py-6">
                                                <Loader2 size={16} className="animate-spin text-blue-400" />
                                                <span className="text-[10px] text-gray-400 ml-2">Cargando documentos...</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {DOC_MODULE_CONFIGS.map(config => {
                                                    const linked = masterDocs[config.key];
                                                    const isPickerOpen = openPicker === config.key;

                                                    return (
                                                        <div key={config.key} className="border border-gray-200 rounded-lg overflow-hidden">
                                                            {/* Slot header */}
                                                            <div className={`px-3 py-2 flex items-center gap-2.5 ${config.colorBg}`}>
                                                                <FileText size={14} className={config.colorText} />
                                                                <span className={`text-[11px] font-semibold ${config.colorText}`}>
                                                                    {config.label}
                                                                </span>
                                                                <div className="flex-1" />
                                                                {linked ? (
                                                                    <button
                                                                        onClick={() => handleUnlinkDocument(linked.id)}
                                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                                                    >
                                                                        <Unlink size={10} />
                                                                        Desvincular
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleOpenPicker(config)}
                                                                        className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg transition-colors ${
                                                                            isPickerOpen
                                                                                ? 'text-purple-700 bg-purple-100 border border-purple-300'
                                                                                : 'text-purple-600 bg-white border border-purple-200 hover:bg-purple-50'
                                                                        }`}
                                                                    >
                                                                        <Link2 size={10} />
                                                                        Vincular
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {/* Linked document info */}
                                                            {linked && (
                                                                <div className="px-3 py-2 bg-white border-t border-gray-100">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[11px] font-mono font-semibold text-gray-800">
                                                                            {linked.documentId}
                                                                        </span>
                                                                    </div>
                                                                    {linked.productId && (
                                                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                                                            Producto: {linked.productId}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* No document placeholder */}
                                                            {!linked && !isPickerOpen && (
                                                                <div className="px-3 py-2 bg-white border-t border-gray-100">
                                                                    <span className="text-[10px] text-gray-400 italic">Sin documento maestro</span>
                                                                </div>
                                                            )}

                                                            {/* Inline document picker */}
                                                            {isPickerOpen && (
                                                                <div className="border-t border-gray-200 bg-gray-50">
                                                                    <div className="p-2">
                                                                        <div className="relative">
                                                                            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                                                            <input
                                                                                type="text"
                                                                                value={pickerSearch}
                                                                                onChange={e => setPickerSearch(e.target.value)}
                                                                                placeholder="Filtrar documentos..."
                                                                                className="w-full pl-7 pr-2 py-1.5 text-[10px] border border-gray-200 rounded-lg focus:ring-1 focus:ring-purple-300 focus:border-purple-400"
                                                                                autoFocus
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    {pickerLoading ? (
                                                                        <div className="flex items-center justify-center py-3">
                                                                            <Loader2 size={12} className="animate-spin text-gray-400" />
                                                                            <span className="text-[10px] text-gray-400 ml-1.5">Cargando...</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="max-h-[140px] overflow-y-auto">
                                                                            {(() => {
                                                                                const searchLower = pickerSearch.toLowerCase();
                                                                                const filtered = pickerDocs.filter(d => {
                                                                                    if (!searchLower) return true;
                                                                                    const ident = config.getIdentifier(d).toLowerCase();
                                                                                    const pn = config.getPartNumber(d).toLowerCase();
                                                                                    const cl = config.getClient(d).toLowerCase();
                                                                                    return ident.includes(searchLower) || pn.includes(searchLower) || cl.includes(searchLower);
                                                                                });
                                                                                if (filtered.length === 0) {
                                                                                    return (
                                                                                        <div className="px-3 py-3 text-center">
                                                                                            <span className="text-[10px] text-gray-400">
                                                                                                {pickerDocs.length === 0
                                                                                                    ? 'No hay documentos de este tipo'
                                                                                                    : 'Sin resultados para el filtro'}
                                                                                            </span>
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                return filtered.map(doc => (
                                                                                    <div
                                                                                        key={String(doc.id)}
                                                                                        onClick={() => handleLinkDocument(config.key, String(doc.id))}
                                                                                        className="px-3 py-1.5 cursor-pointer hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0"
                                                                                    >
                                                                                        <div className="flex items-center gap-2">
                                                                                            <Link2 size={10} className="text-purple-400 shrink-0" />
                                                                                            <span className="text-[10px] font-mono font-semibold text-gray-800">
                                                                                                {config.getIdentifier(doc)}
                                                                                            </span>
                                                                                            {config.getPartNumber(doc) && (
                                                                                                <span className="text-[9px] text-gray-500">
                                                                                                    {config.getPartNumber(doc)}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        {config.getClient(doc) && (
                                                                                            <div className="text-[9px] text-gray-400 ml-5">
                                                                                                {config.getClient(doc)}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ));
                                                                            })()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* ===== VARIANTES TAB ===== */}
                                {editTab === 'variantes' && (
                                    <>
                                        {/* Create variant section */}
                                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                                            <div className="px-3 py-2 bg-purple-50 border-b border-purple-100">
                                                <span className="text-[11px] font-semibold text-purple-700">Crear nueva variante</span>
                                            </div>
                                            <div className="p-3 space-y-3">
                                                <div>
                                                    <label htmlFor="family-variant-label" className="block text-[10px] font-medium text-gray-500 mb-1">Label de variante</label>
                                                    <input
                                                        id="family-variant-label"
                                                        type="text"
                                                        value={variantLabel}
                                                        onChange={e => setVariantLabel(e.target.value)}
                                                        placeholder="Ej: L0, L1, Izquierdo, Derecho..."
                                                        className="w-full px-2 py-1.5 text-[11px] border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-300 focus:border-purple-400"
                                                        maxLength={50}
                                                        disabled={isCloning}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-medium text-gray-500 mb-1">Clonar documentos</label>
                                                    <div className="space-y-1.5">
                                                        {DOC_MODULE_CONFIGS.map(config => {
                                                            const hasMaster = masterDocs[config.key] !== null;
                                                            const isSelected = selectedModules.has(config.key);
                                                            return (
                                                                <label
                                                                    key={config.key}
                                                                    className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
                                                                        hasMaster
                                                                            ? 'cursor-pointer hover:bg-gray-50'
                                                                            : 'opacity-50 cursor-not-allowed'
                                                                    }`}
                                                                    title={hasMaster ? `Clonar ${config.label}` : `Sin maestro vinculado para ${config.label}`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isSelected}
                                                                        onChange={() => handleToggleModule(config.key)}
                                                                        disabled={!hasMaster || isCloning}
                                                                        className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-300"
                                                                    />
                                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${config.colorBg} ${config.colorText}`}>
                                                                        {config.label}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-400">
                                                                        {hasMaster ? '(vinculado)' : '(sin maestro)'}
                                                                    </span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="flex justify-end pt-1">
                                                    <button
                                                        onClick={handleCreateVariant}
                                                        disabled={!variantLabel.trim() || selectedModules.size === 0 || isCloning}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-[11px] font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isCloning ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <Copy size={12} />
                                                        )}
                                                        {isCloning ? 'Clonando...' : 'Crear variante'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Existing variants section */}
                                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                                                <span className="text-[11px] font-semibold text-gray-600">Variantes existentes</span>
                                            </div>
                                            {variantDocs.length === 0 ? (
                                                <div className="px-3 py-6 text-center">
                                                    <GitBranch size={24} className="text-gray-300 mx-auto mb-1.5" />
                                                    <p className="text-[10px] text-gray-400">
                                                        No hay variantes creadas para esta familia.
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                                        Use el formulario de arriba para clonar documentos maestros.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-gray-100 max-h-[200px] overflow-y-auto">
                                                    {variantDocs.map(vDoc => {
                                                        const colors = MODULE_BADGE_COLORS[vDoc.module] ?? { text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };
                                                        return (
                                                            <div key={vDoc.id} className="px-3 py-1.5 flex items-center gap-2">
                                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${colors.bg} ${colors.text} ${colors.border}`}>
                                                                    {vDoc.module.toUpperCase()}
                                                                </span>
                                                                <span className="text-[10px] font-mono text-gray-700 truncate flex-1" title={vDoc.documentId}>
                                                                    {vDoc.documentId}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    <CheckCircle size={9} />
                                                                    Sincronizado
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Back button */}
                                <div className="flex justify-start pt-2">
                                    <button
                                        onClick={() => {
                                            setView('list');
                                            setSelectedFamily(null);
                                            setProductSearch('');
                                            setProductResults([]);
                                            setEditTab('productos');
                                            setOpenPicker(null);
                                            setPickerDocs([]);
                                            setPickerSearch('');
                                            setVariantLabel('');
                                            setSelectedModules(new Set());
                                        }}
                                        className="px-3 py-1.5 text-[11px] text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        ← Volver a la lista
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Delete Family Confirmation Modal */}
            <ConfirmModal
                isOpen={deletePending !== null}
                onClose={() => setDeletePending(null)}
                onConfirm={handleDeleteConfirm}
                title="Eliminar Familia"
                message={`¿Eliminar la familia "${deletePending?.name ?? ""}" y todas sus asignaciones? Esta accion no se puede deshacer.`}
                confirmText="Eliminar"
                variant="danger"
            />
        </div>
    );
};

export default FamilyManager;
