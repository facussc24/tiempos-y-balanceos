/**
 * MixProductGrid - Selección simple de productos con checkbox
 * 
 * Reemplaza el flujo de 4 pasos (Cliente→Proyecto→Pieza→Demanda)
 * por una grilla de selección directa donde todos los productos
 * están visibles y se pueden seleccionar con un click.
 * 
 * @module MixProductGrid
 * @version 2.0.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { Package, Loader2, Search, CheckCircle2, Circle } from 'lucide-react';
import { MixSelectableProduct } from '../../types';
import { listClients, listProjects, listParts, buildMasterJsonPath } from '../../utils/pathManager';
import { readTextFile } from '../../utils/tauri_fs';
import { isTauri } from '../../utils/unified_fs';
import { toast } from '../../components/ui/Toast';
import { logger } from '../../utils/logger';

interface MixProductGridProps {
    onSelectionChange: (selected: MixSelectableProduct[]) => void;
    initialSelection?: MixSelectableProduct[];
}

export const MixProductGrid: React.FC<MixProductGridProps> = ({
    onSelectionChange,
    initialSelection = []
}) => {
    const [products, setProducts] = useState<MixSelectableProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);
    // UX Mejora #1: Progress feedback during loading
    const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number; currentClient: string } | null>(null);
    // UX Mejora #2: Temporary demand values during editing (allows empty field)
    const [editingDemand, setEditingDemand] = useState<Map<number, string>>(new Map());



    // Ref para evitar re-aplicar selección inicial múltiples veces
    const initialSelectionApplied = useRef(false);

    // Ref estable para callback (evita dependency issues en useEffect)
    const onSelectionChangeRef = useRef(onSelectionChange);
    onSelectionChangeRef.current = onSelectionChange;

    // Cargar todos los productos disponibles al montar
    useEffect(() => {
        loadAllProducts();
    }, []);

    // Aplicar selección inicial si existe (incluyendo demanda editada)
    // FIX: Usar ref para evitar bucle de re-renders y dependencias correctas
    useEffect(() => {
        if (initialSelection.length > 0 && products.length > 0 && !initialSelectionApplied.current) {
            initialSelectionApplied.current = true;
            const updated = products.map(p => {
                const initialProduct = initialSelection.find(ip => ip.path === p.path);
                return {
                    ...p,
                    isSelected: !!initialProduct,
                    // Aplicar demanda editada si existe en initialSelection
                    dailyDemand: initialProduct?.dailyDemand ?? p.dailyDemand
                };
            });
            setProducts(updated);
            // Notificar al padre de la selección restaurada
            onSelectionChangeRef.current(updated.filter(p => p.isSelected));
        }
    }, [initialSelection, products]);

    // Reset tracking si initialSelection se vacía (ej: usuario hace reset)
    useEffect(() => {
        if (initialSelection.length === 0) {
            initialSelectionApplied.current = false;
        }
    }, [initialSelection]);

    /**
     * Carga todos los productos de la jerarquía Cliente/Proyecto/Pieza
     */
    const loadAllProducts = async () => {
        if (!isTauri()) {
            setError('Esta función solo está disponible en modo escritorio.');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const clients = await listClients();
            const allProducts: MixSelectableProduct[] = [];

            // UX Mejora #1: Report progress per client
            setLoadingProgress({ current: 0, total: clients.length, currentClient: '' });

            for (let i = 0; i < clients.length; i++) {
                const client = clients[i];
                setLoadingProgress({ current: i + 1, total: clients.length, currentClient: client });

                const projects = await listProjects(client);
                for (const project of projects) {
                    const parts = await listParts(client, project);
                    for (const part of parts) {
                        // Extraer demanda del master.json
                        const { demand, isDefault } = await extractDemand(client, project, part);
                        const path = buildMasterJsonPath(client, project, part);

                        allProducts.push({
                            path,
                            displayName: part,
                            client,
                            project,
                            part,
                            dailyDemand: demand,
                            isSelected: false,
                            isDefaultDemand: isDefault
                        });
                    }
                }
            }

            setProducts(allProducts);

            if (allProducts.length === 0) {
                setError('No se encontraron productos. Crea estudios primero desde el Dashboard.');
            }
        } catch (e) {
            logger.error('MixProductGrid', 'Error loading products', {}, e instanceof Error ? e : undefined);
            setError('Error al cargar productos. Verifica la conexión.');
        } finally {
            setIsLoading(false);
            setLoadingProgress(null);
        }
    };

    /**
     * Extrae la demanda diaria del archivo master.json
     * V5.3: Retorna flag indicando si es valor por defecto
     */
    const extractDemand = async (client: string, project: string, part: string): Promise<{ demand: number; isDefault: boolean }> => {
        try {
            const path = buildMasterJsonPath(client, project, part);
            const content = await readTextFile(path);
            if (content) {
                const data = JSON.parse(content);
                const demand = data.meta?.dailyDemand;
                if (typeof demand === 'number' && demand > 0) {
                    return { demand, isDefault: false };
                }
            }
        } catch {
            // Silenciar error, usar default
        }
        return { demand: 100, isDefault: true };
    };

    /**
     * Toggle selección de un producto
     */
    const toggleProduct = (index: number) => {
        const updated = [...products];
        updated[index].isSelected = !updated[index].isSelected;
        setProducts(updated);
        onSelectionChange(updated.filter(p => p.isSelected));
    };

    /**
     * UX Mejora #2: Actualiza solo el valor temporal durante edición
     * Permite campo vacío sin afectar el state principal
     */
    const handleDemandChange = (index: number, value: string) => {
        setEditingDemand(prev => new Map(prev).set(index, value));
    };

    /**
     * UX Mejora #2: Valida y propaga el valor al perder foco
     * Si es inválido, revierte silenciosamente al valor anterior
     */
    const handleDemandBlur = (index: number) => {
        const tempValue = editingDemand.get(index);

        // Si no hay valor temporal, no hacer nada
        if (tempValue === undefined) return;

        // Limpiar el valor temporal
        setEditingDemand(prev => {
            const next = new Map(prev);
            next.delete(index);
            return next;
        });

        // Validar el valor final
        const numValue = parseInt(tempValue, 10);

        if (tempValue === '' || isNaN(numValue) || numValue <= 0) {
            // Valor inválido: revertir silenciosamente
            return;
        }

        if (numValue > 999999) {
            toast.warning('Límite Excedido', 'La demanda máxima es 999.999 pz/día');
            return;
        }

        // Valor válido: actualizar state y propagar
        const updated = [...products];
        updated[index].dailyDemand = numValue;
        setProducts(updated);
        onSelectionChange(updated.filter(p => p.isSelected));
    };

    /**
     * UX Mejora #3: Permite confirmar demanda con Enter
     */
    const handleDemandKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur(); // Dispara onBlur que ya valida y propaga
        }
    };

    /**
     * Filtrar productos por búsqueda
     */
    const filteredProducts = products.filter(p =>
        p.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.project.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedCount = products.filter(p => p.isSelected).length;
    const totalDemand = products
        .filter(p => p.isSelected)
        .reduce((sum, p) => sum + p.dailyDemand, 0);

    // Loading state with progress feedback
    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center dark:bg-slate-900 dark:border-slate-800 transition-colors">
                <Loader2 size={40} className="mx-auto text-blue-500 animate-spin mb-4" />
                <p className="text-slate-600 font-medium dark:text-slate-300">Cargando productos...</p>
                {loadingProgress ? (
                    <p className="text-slate-400 text-sm mt-1">
                        Escaneando cliente {loadingProgress.current}/{loadingProgress.total}
                        {loadingProgress.currentClient && `: ${loadingProgress.currentClient}`}
                    </p>
                ) : (
                    <p className="text-slate-400 text-sm mt-1">Iniciando escaneo...</p>
                )}
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bg-red-50 rounded-2xl border border-red-200 p-8 text-center dark:bg-red-950/30 dark:border-red-900/50">
                <p className="text-red-700 font-medium dark:text-red-300">{error}</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden dark:bg-slate-900 dark:border-slate-800 transition-colors">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200 dark:from-slate-800 dark:to-slate-900 dark:border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/50">
                            <Package size={20} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">¿Qué productos vas a fabricar?</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Seleccioná los productos que querés incluir en el mix
                            </p>
                        </div>
                    </div>

                    {/* Counter badge */}
                    {selectedCount > 0 && (
                        <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-sm">
                            {selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}
                        </div>
                    )}
                </div>

                {/* Search */}
                <div className="mt-4 relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, cliente o proyecto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:placeholder-slate-500 transition-colors"
                    />
                </div>
            </div>

            {/* Product Grid */}
            <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        No se encontraron productos con ese término
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredProducts.map((product, idx) => {
                            const safeIndex = products.findIndex(p => p.path === product.path);

                            return (
                                <button
                                    key={product.path}
                                    onClick={() => toggleProduct(safeIndex)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left ${product.isSelected
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                                        : product.isDefaultDemand
                                            ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400 dark:border-amber-700 dark:bg-amber-900/10'
                                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    {/* Checkbox */}
                                    <div className="flex-shrink-0">
                                        {product.isSelected ? (
                                            <CheckCircle2 size={24} className="text-blue-600 dark:text-blue-400" />
                                        ) : (
                                            <Circle size={24} className="text-slate-300 dark:text-slate-600" />
                                        )}
                                    </div>

                                    {/* Product Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                                            {product.displayName}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                            {product.client} / {product.project}
                                        </p>
                                    </div>

                                    {/* Demand - Editable */}
                                    <div
                                        className="flex-shrink-0 text-right"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="number"
                                            value={editingDemand.get(safeIndex) ?? product.dailyDemand}
                                            onChange={(e) => handleDemandChange(safeIndex, e.target.value)}
                                            onBlur={() => handleDemandBlur(safeIndex)}
                                            onKeyDown={(e) => handleDemandKeyDown(safeIndex, e)}
                                            min={1}
                                            max={999999}
                                            aria-label={`Demanda diaria para ${product.displayName}`}
                                            className="w-24 px-2 py-1 text-right font-bold text-slate-800 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:border-slate-300 dark:bg-slate-800 dark:border-slate-600 dark:text-white dark:hover:border-slate-500 transition-colors"
                                        />
                                        <div className="flex items-center justify-end gap-1 mt-0.5">
                                            <p className="text-xs text-slate-400">pz/día</p>
                                            {product.isDefaultDemand && (
                                                <span className="ml-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded dark:bg-amber-900/50 dark:text-amber-300" title="Demanda estimada (no encontrada en archivo)">
                                                    ESTIMADO
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer - Summary */}
            {selectedCount > 0 && (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between dark:bg-slate-800 dark:border-slate-700">
                    <div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            <strong>{selectedCount}</strong> producto{selectedCount > 1 ? 's' : ''} seleccionado{selectedCount > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-slate-400">
                            Demanda total: {totalDemand.toLocaleString()} pz/día
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
