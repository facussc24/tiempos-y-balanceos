/**
 * FamilyManager
 *
 * Modal for managing product families (CRUD).
 * Accessed via the "Familias" button in ProductSelector dropdown footer.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Trash2, Star, Users, Search, Package, AlertCircle, Loader2 } from 'lucide-react';
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FamilyManagerProps {
    onClose: () => void;
}

type View = 'list' | 'create' | 'edit';

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
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');

    // Product picker state
    const [productSearch, setProductSearch] = useState('');
    const [productResults, setProductResults] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

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

    const handleDelete = useCallback(async (family: ProductFamily) => {
        if (!confirm(`¿Eliminar la familia "${family.name}" y todas sus asignaciones?`)) return;
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
    }, [loadFamilies, selectedFamily]);

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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
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
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2">
                        <AlertCircle size={14} className="text-red-500 shrink-0" />
                        <span className="text-[11px] text-red-700">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
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
                                                <div className="text-[11px] font-medium text-gray-800 truncate">{family.name}</div>
                                                {family.description && (
                                                    <div className="text-[10px] text-gray-400 truncate">{family.description}</div>
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
                                <label className="block text-[10px] font-medium text-gray-500 mb-1">Nombre *</label>
                                <input
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
                                <label className="block text-[10px] font-medium text-gray-500 mb-1">Descripción</label>
                                <textarea
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
                        <div className="p-4 space-y-3">
                            {/* Family name + description */}
                            <div className="flex items-start gap-3">
                                <div className="flex-1 space-y-2">
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-500 mb-1">Nombre</label>
                                        <input
                                            type="text"
                                            value={formName}
                                            onChange={e => setFormName(e.target.value)}
                                            onBlur={handleUpdateFamily}
                                            className="w-full px-2 py-1.5 text-[11px] border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-300"
                                            maxLength={100}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-medium text-gray-500 mb-1">Descripción</label>
                                        <input
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

                            {/* Members list */}
                            <div>
                                <h4 className="text-[10px] font-semibold text-gray-500 mb-1.5">
                                    Productos ({members.length})
                                </h4>
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
                                                <span className="text-[10px] text-gray-500 truncate flex-1">
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
                                <label className="block text-[10px] font-medium text-gray-500 mb-1">Agregar producto</label>
                                <div className="relative">
                                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
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
                                                    <span className="text-[9px] text-gray-500 truncate">{product.descripcion}</span>
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

                            {/* Back button */}
                            <div className="flex justify-start pt-2">
                                <button
                                    onClick={() => {
                                        setView('list');
                                        setSelectedFamily(null);
                                        setProductSearch('');
                                        setProductResults([]);
                                    }}
                                    className="px-3 py-1.5 text-[11px] text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    ← Volver a la lista
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FamilyManager;
