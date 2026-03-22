/**
 * AMFE Library Panel
 *
 * Side panel showing the global operations library. Users can:
 * - Search across all library content (names, failures, causes, controls)
 * - Filter by category (chips)
 * - Expand operations to preview their full tree (WE > Func > Fail > Cause)
 * - Import a base operation into the current AMFE (linked)
 * - Save the current operation to the library
 * - Sync linked operations with library updates
 * - See impact analysis and selectively propagate library changes
 */

import React, { useState, useRef, useEffect } from 'react';
import { AmfeOperation } from './amfeTypes';
import { AmfeLibraryOperation, LIBRARY_CATEGORIES } from './amfeLibraryTypes';
import { ImpactScanResult } from './amfeImpactAnalysis';
import {
    Library, Plus, Trash2, Download, RefreshCw, Link2, X,
    ChevronRight, ChevronDown, WifiOff, Package, UploadCloud,
    Search, Tag, Layers, AlertTriangle, Zap, Loader2, ArrowLeft, Check
} from 'lucide-react';

interface Props {
    libraryOps: AmfeLibraryOperation[];
    filteredOps: AmfeLibraryOperation[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    categoryFilter: string;
    onCategoryChange: (category: string) => void;
    isLoaded: boolean;
    networkAvailable: boolean;
    currentOperations: AmfeOperation[];
    onImportFromLibrary: (libOpId: string) => void;
    onSaveToLibrary: (op: AmfeOperation, description?: string, category?: string, tags?: string[]) => void;
    onUpdateInLibrary: (libOpId: string, op: AmfeOperation) => void;
    onRemoveFromLibrary: (libOpId: string) => void;
    onSyncOperation: (opId: string) => void;
    onScanImpact: (libOpId: string) => Promise<ImpactScanResult | null>;
    onBatchSync: (libOpId: string, projectNames: string[]) => Promise<string>;
    isScanning: boolean;
    isSyncing: boolean;
    onRefresh: () => void;
    onClose: () => void;
}

const AmfeLibraryPanel: React.FC<Props> = ({
    libraryOps,
    filteredOps,
    searchQuery,
    onSearchChange,
    categoryFilter,
    onCategoryChange,
    isLoaded,
    networkAvailable,
    currentOperations,
    onImportFromLibrary,
    onSaveToLibrary,
    onUpdateInLibrary,
    onRemoveFromLibrary,
    onSyncOperation,
    onScanImpact,
    onBatchSync,
    isScanning,
    isSyncing,
    onRefresh,
    onClose,
}) => {
    const [activeTab, setActiveTab] = useState<'browse' | 'save'>('browse');
    // Impact panel state
    const [impactResult, setImpactResult] = useState<ImpactScanResult | null>(null);
    const [selectedForSync, setSelectedForSync] = useState<Set<string>>(new Set());
    const [syncMessage, setSyncMessage] = useState<string | null>(null);
    const syncMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => { if (syncMsgTimerRef.current) clearTimeout(syncMsgTimerRef.current); };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const linkedOps = currentOperations.filter(op => op.linkedLibraryOpId);

    // Count distinct categories present in library
    const categoryCounts = libraryOps.reduce<Record<string, number>>((acc, op) => {
        const cat = op.category || 'otro';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {});

    /** Handle library update: save first, then scan for impact */
    const handleUpdateWithImpact = async (libOpId: string, op: AmfeOperation) => {
        // 1. Update the library
        await onUpdateInLibrary(libOpId, op);

        // 2. Scan for impacted AMFEs
        const result = await onScanImpact(libOpId);
        if (result && result.totalLinked > 0) {
            setImpactResult(result);
            setSelectedForSync(new Set(result.linkedAmfes.map(a => a.registryEntry.projectName)));
            setSyncMessage(null);
        } else {
            // No linked AMFEs, just show a brief confirmation
            setSyncMessage('Biblioteca actualizada. No hay AMFEs vinculados a esta operación.');
            if (syncMsgTimerRef.current) clearTimeout(syncMsgTimerRef.current);
            syncMsgTimerRef.current = setTimeout(() => setSyncMessage(null), 3000);
        }
    };

    /** Toggle selection for a project in the impact panel */
    const toggleSelection = (projectName: string) => {
        setSelectedForSync(prev => {
            const next = new Set(prev);
            if (next.has(projectName)) next.delete(projectName);
            else next.add(projectName);
            return next;
        });
    };

    /** Execute batch sync for selected AMFEs */
    const handleBatchSync = async () => {
        if (!impactResult || selectedForSync.size === 0) return;
        const message = await onBatchSync(impactResult.libraryOpId, [...selectedForSync]);
        setSyncMessage(message);
        setImpactResult(null);
    };

    // If showing impact panel, render that instead of normal content
    if (impactResult) {
        return (
            <div className="fixed inset-0 z-50 flex">
                <div className="flex-1 bg-black/30 animate-in fade-in duration-150" role="presentation" onClick={() => setImpactResult(null)} />
                <div className="w-[460px] bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right">
                    {/* Impact Panel Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-amber-50">
                        <div className="flex items-center gap-2">
                            <Zap size={20} className="text-amber-600" />
                            <h2 className="font-bold text-sm text-gray-800">Analisis de Impacto</h2>
                        </div>
                        <button onClick={() => setImpactResult(null)}
                            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition" title="Cerrar impacto" aria-label="Cerrar impacto">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Impact info */}
                    <div className="p-4 border-b border-gray-200 bg-amber-50/50">
                        <p className="text-xs text-gray-700">
                            La operacion <strong>{impactResult.libraryOpName}</strong> fue actualizada en la biblioteca.
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                            <strong>{impactResult.totalLinked}</strong> AMFE(s) estan vinculados a esta operacion.
                            Selecciona cuales sincronizar:
                        </p>
                    </div>

                    {/* Linked AMFEs list with checkboxes */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {impactResult.linkedAmfes.map(info => {
                            const isSelected = selectedForSync.has(info.registryEntry.projectName);
                            return (
                                <button
                                    key={info.registryEntry.id}
                                    onClick={() => toggleSelection(info.registryEntry.projectName)}
                                    className={`w-full text-left p-3 rounded-lg border transition ${
                                        isSelected
                                            ? 'border-amber-400 bg-amber-50'
                                            : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-start gap-2">
                                        <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                                            isSelected ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
                                        }`}>
                                            {isSelected && <Check size={10} className="text-white" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    {info.registryEntry.amfeNumber}
                                                </span>
                                                <span className="text-xs font-medium text-gray-800 truncate" title={info.registryEntry.projectName}>
                                                    {info.registryEntry.projectName}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-0.5">
                                                {info.registryEntry.subject || 'Sin asunto'}
                                                {info.registryEntry.client && ` — ${info.registryEntry.client}`}
                                            </p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                {info.linkedOperationCount} operación(es) vinculada(s):
                                                {' '}{info.linkedOperationNames.join(', ')}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Action buttons */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                            <button
                                onClick={() => {
                                    if (selectedForSync.size === impactResult.linkedAmfes.length) {
                                        setSelectedForSync(new Set());
                                    } else {
                                        setSelectedForSync(new Set(impactResult.linkedAmfes.map(a => a.registryEntry.projectName)));
                                    }
                                }}
                                className="hover:text-gray-700 underline"
                            >
                                {selectedForSync.size === impactResult.linkedAmfes.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                            </button>
                            <span>{selectedForSync.size} de {impactResult.totalLinked} seleccionados</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setImpactResult(null)}
                                className="flex-1 text-xs text-gray-600 hover:text-gray-800 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
                            >
                                Omitir
                            </button>
                            <button
                                onClick={handleBatchSync}
                                disabled={selectedForSync.size === 0 || isSyncing}
                                className="flex-1 flex items-center justify-center gap-1.5 text-xs text-white bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition font-medium"
                            >
                                {isSyncing ? (
                                    <><Loader2 size={12} className="animate-spin" /> Sincronizando...</>
                                ) : (
                                    <><RefreshCw size={12} /> Sincronizar ({selectedForSync.size})</>
                                )}
                            </button>
                        </div>
                        <p className="text-[9px] text-gray-400 text-center">
                            Se generara una entrada de revision automatica en cada AMFE sincronizado (IATF 16949)
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="flex-1 bg-black/30 animate-in fade-in duration-150" role="presentation" onClick={onClose} />

            {/* Side Panel */}
            <div className="w-[460px] bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-2">
                        <Library size={20} className="text-purple-600" />
                        <h2 className="font-bold text-sm text-gray-800">Biblioteca de Operaciones</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onRefresh}
                            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition"
                            title="Actualizar">
                            <RefreshCw size={14} />
                        </button>
                        <button onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition" title="Cerrar biblioteca" aria-label="Cerrar biblioteca">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Network warning */}
                {!networkAvailable && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs">
                        <WifiOff size={14} />
                        Red no disponible - biblioteca en modo lectura
                    </div>
                )}

                {/* Sync message toast */}
                {syncMessage && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border-b border-green-200 text-green-700 text-xs">
                        <Check size={14} />
                        {syncMessage}
                        <button onClick={() => setSyncMessage(null)} className="ml-auto text-green-600 hover:text-green-800" title="Cerrar mensaje">
                            <X size={12} />
                        </button>
                    </div>
                )}

                {/* Scanning overlay */}
                {isScanning && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-700 text-xs">
                        <Loader2 size={14} className="animate-spin" />
                        Escaneando AMFEs vinculados...
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-gray-200 text-xs">
                    <button
                        onClick={() => setActiveTab('browse')}
                        className={`flex-1 px-4 py-2.5 font-medium transition ${activeTab === 'browse'
                            ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50/50'
                            : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Disponibles ({libraryOps.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('save')}
                        className={`flex-1 px-4 py-2.5 font-medium transition ${activeTab === 'save'
                            ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50/50'
                            : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Guardar en Biblioteca
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'browse' && (
                        <div className="flex flex-col h-full">
                            {/* Search bar */}
                            <div className="p-3 pb-0">
                                <div className="relative">
                                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => onSearchChange(e.target.value)}
                                        placeholder="Buscar por nombre, fallas, causas, controles..."
                                        className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200 bg-gray-50 placeholder:text-gray-400"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => onSearchChange('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Category filter chips */}
                            {Object.keys(categoryCounts).length > 1 && (
                                <div className="px-3 pt-2 flex flex-wrap gap-1">
                                    <button
                                        onClick={() => onCategoryChange('')}
                                        className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                                            !categoryFilter
                                                ? 'bg-purple-100 border-purple-300 text-purple-700 font-medium'
                                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                        }`}
                                    >
                                        Todas
                                    </button>
                                    {LIBRARY_CATEGORIES.filter(c => categoryCounts[c.value]).map(cat => (
                                        <button
                                            key={cat.value}
                                            onClick={() => onCategoryChange(categoryFilter === cat.value ? '' : cat.value)}
                                            className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                                                categoryFilter === cat.value
                                                    ? 'bg-purple-100 border-purple-300 text-purple-700 font-medium'
                                                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                            }`}
                                        >
                                            {cat.label} ({categoryCounts[cat.value]})
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Results */}
                            <div className="p-3 space-y-2 flex-1 overflow-y-auto">
                                {!isLoaded ? (
                                    <div className="text-center py-8 text-gray-400">
                                        <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                                        <p className="text-xs">Cargando biblioteca...</p>
                                    </div>
                                ) : libraryOps.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">
                                        <Package size={28} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-xs">La biblioteca esta vacia.</p>
                                        <p className="text-[10px] mt-1">Guarda operaciones desde tu AMFE para reutilizarlas.</p>
                                    </div>
                                ) : filteredOps.length === 0 ? (
                                    <div className="text-center py-6 text-gray-400">
                                        <Search size={20} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-xs">Sin resultados para esta busqueda.</p>
                                        <p className="text-[10px] mt-1">Intenta con otros terminos o quita el filtro de categoria.</p>
                                    </div>
                                ) : (
                                    <>
                                        {(searchQuery || categoryFilter) && (
                                            <p className="text-[10px] text-gray-400">
                                                {filteredOps.length} de {libraryOps.length} operaciones
                                            </p>
                                        )}
                                        {filteredOps.map(libOp => (
                                            <LibraryOpCard
                                                key={libOp.id}
                                                libOp={libOp}
                                                isLinked={currentOperations.some(op => op.linkedLibraryOpId === libOp.id)}
                                                onImport={() => onImportFromLibrary(libOp.id)}
                                                onRemove={() => onRemoveFromLibrary(libOp.id)}
                                            />
                                        ))}
                                    </>
                                )}

                                {/* Linked operations section */}
                                {linkedOps.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                            Operaciones Vinculadas en este AMFE
                                        </h3>
                                        {linkedOps.map(op => (
                                            <div key={op.id} className="flex items-center justify-between p-2 bg-purple-50 rounded border border-purple-200 mb-1.5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Link2 size={12} className="text-purple-500 flex-shrink-0" />
                                                    <span className="text-xs font-medium text-gray-800 truncate" title={`${op.opNumber} - ${op.name}`}>{op.opNumber} - {op.name}</span>
                                                </div>
                                                <button
                                                    onClick={() => onSyncOperation(op.id)}
                                                    className="flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-800 px-2 py-1 rounded hover:bg-purple-100 transition flex-shrink-0"
                                                    title="Sincronizar con la base"
                                                >
                                                    <RefreshCw size={10} /> Sync
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'save' && (
                        <div className="p-3 space-y-2">
                            {currentOperations.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <p className="text-xs">No hay operaciones en el AMFE actual.</p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-[10px] text-gray-400 mb-2">
                                        Selecciona una operacion para guardarla como template reutilizable.
                                    </p>
                                    {currentOperations.map(op => {
                                        const isLinked = !!op.linkedLibraryOpId;
                                        const linkedLib = isLinked
                                            ? libraryOps.find(l => l.id === op.linkedLibraryOpId)
                                            : null;
                                        return (
                                            <SaveOpCard
                                                key={op.id}
                                                op={op}
                                                isLinked={isLinked}
                                                linkedLib={linkedLib}
                                                onSave={onSaveToLibrary}
                                                onUpdate={handleUpdateWithImpact}
                                                isScanning={isScanning}
                                            />
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Sub-components ---

/** Expandable card for a library operation with tree preview */
const LibraryOpCard: React.FC<{
    libOp: AmfeLibraryOperation;
    isLinked: boolean;
    onImport: () => void;
    onRemove: () => void;
}> = ({ libOp, isLinked, onImport, onRemove }) => {
    const [expanded, setExpanded] = useState(false);

    const totalFailures = libOp.workElements.reduce(
        (sum, we) => sum + we.functions.reduce((s2, f) => s2 + f.failures.length, 0), 0
    );
    const totalCauses = libOp.workElements.reduce(
        (sum, we) => sum + we.functions.reduce((s2, f) =>
            s2 + f.failures.reduce((s3, fl) => s3 + fl.causes.length, 0), 0), 0
    );

    const categoryLabel = libOp.category
        ? LIBRARY_CATEGORIES.find(c => c.value === libOp.category)?.label || libOp.category
        : null;

    return (
        <div className={`rounded-lg border transition ${isLinked
            ? 'border-purple-300 bg-purple-50/50'
            : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            {/* Expand toggle */}
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className="text-gray-400 hover:text-gray-600 p-0.5 -ml-0.5 flex-shrink-0"
                                title={expanded ? 'Colapsar' : 'Ver arbol completo'}
                            >
                                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                            <span className="text-xs font-bold text-gray-800">
                                {libOp.opNumber || '?'} - {libOp.name}
                            </span>
                            {isLinked && (
                                <span className="text-[9px] bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                                    vinculada
                                </span>
                            )}
                        </div>
                        {libOp.description && (
                            <p className="text-[10px] text-gray-400 mt-0.5 ml-5">{libOp.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 ml-5 flex-wrap">
                            {categoryLabel && (
                                <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Tag size={8} /> {categoryLabel}
                                </span>
                            )}
                            <span className="text-[10px] text-gray-400">{libOp.workElements.length} WE</span>
                            <span className="text-[10px] text-gray-400">{totalFailures} fallas</span>
                            <span className="text-[10px] text-gray-400">{totalCauses} causas</span>
                            <span className="text-[10px] text-gray-400">v{libOp.version}</span>
                        </div>
                        {libOp.tags && libOp.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 ml-5">
                                {libOp.tags.map((tag, i) => (
                                    <span key={i} className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {!isLinked && (
                            <button
                                onClick={onImport}
                                className="flex items-center gap-1 text-[10px] text-green-600 hover:text-green-800 px-2 py-1.5 rounded hover:bg-green-50 transition font-medium"
                                title="Importar al AMFE actual"
                            >
                                <Download size={12} /> Importar
                            </button>
                        )}
                        <button
                            onClick={onRemove}
                            className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition"
                            title="Eliminar de biblioteca"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Expandable tree preview */}
            {expanded && (
                <div className="border-t border-gray-100 px-3 py-2 bg-gray-50/50 text-[10px] max-h-[300px] overflow-y-auto">
                    {libOp.workElements.length === 0 ? (
                        <p className="text-gray-400 italic">Sin elementos de trabajo</p>
                    ) : (
                        libOp.workElements.map((we, weIdx) => (
                            <div key={weIdx} className="mb-2 last:mb-0">
                                <div className="flex items-center gap-1 text-gray-700 font-medium">
                                    <Layers size={10} className="text-blue-500 flex-shrink-0" />
                                    <span className="text-[9px] text-gray-400">[{we.type}]</span>
                                    <span>{we.name || '(sin nombre)'}</span>
                                </div>
                                {we.functions.map((func, fIdx) => (
                                    <div key={fIdx} className="ml-4 mt-0.5">
                                        <div className="text-gray-600">
                                            <span className="text-gray-400">F:</span> {func.description || '(sin descripción)'}
                                        </div>
                                        {func.failures.map((fail, flIdx) => (
                                            <div key={flIdx} className="ml-3 mt-0.5">
                                                <div className="text-red-600/80 flex items-center gap-1">
                                                    <AlertTriangle size={8} className="flex-shrink-0" />
                                                    {fail.description || '(sin modo de falla)'}
                                                    {fail.severity && (
                                                        <span className={`text-[8px] px-1 py-0 rounded ${
                                                            Number(fail.severity) >= 9 ? 'bg-red-100 text-red-700' :
                                                            Number(fail.severity) >= 7 ? 'bg-orange-100 text-orange-700' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>
                                                            S={fail.severity}
                                                        </span>
                                                    )}
                                                </div>
                                                {fail.causes.map((cause, cIdx) => (
                                                    <div key={cIdx} className="ml-3 mt-0.5 text-gray-500">
                                                        <span className="text-gray-400">C:</span> {cause.cause || '(sin causa)'}
                                                        {cause.ap && (
                                                            <span className={`ml-1 text-[8px] px-1 py-0 rounded ${
                                                                cause.ap === 'H' ? 'bg-red-100 text-red-700' :
                                                                cause.ap === 'M' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-green-100 text-green-700'
                                                            }`}>
                                                                AP={cause.ap}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

/** Save tab card with category selector and impact-aware update */
const SaveOpCard: React.FC<{
    op: AmfeOperation;
    isLinked: boolean;
    linkedLib: AmfeLibraryOperation | null | undefined;
    onSave: (op: AmfeOperation, description?: string, category?: string, tags?: string[]) => void;
    onUpdate: (libOpId: string, op: AmfeOperation) => Promise<void>;
    isScanning: boolean;
}> = ({ op, isLinked, linkedLib, onSave, onUpdate, isScanning }) => {
    const [showSaveForm, setShowSaveForm] = useState(false);
    const [category, setCategory] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    const handleSave = () => {
        const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
        onSave(op, '', category, tags);
        setShowSaveForm(false);
        setCategory('');
        setTagsInput('');
    };

    const handleUpdate = async () => {
        setIsUpdating(true);
        await onUpdate(op.linkedLibraryOpId!, op);
        setIsUpdating(false);
    };

    return (
        <div className="p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition">
            <div className="flex items-center justify-between">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        {isLinked && <Link2 size={11} className="text-purple-500" />}
                        <span className="text-xs font-bold text-gray-800 truncate" title={`${op.opNumber || '?'} - ${op.name || '(sin nombre)'}`}>
                            {op.opNumber || '?'} - {op.name || '(sin nombre)'}
                        </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                        {op.workElements.length} elementos,{' '}
                        {op.workElements.reduce((sum, we) =>
                            sum + we.functions.reduce((s2, f) => s2 + f.failures.length, 0), 0
                        )} fallas
                    </p>
                </div>
                <div className="flex gap-1">
                    {isLinked && linkedLib ? (
                        <button
                            onClick={handleUpdate}
                            disabled={isUpdating || isScanning}
                            className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 disabled:text-gray-400 px-2 py-1.5 rounded hover:bg-blue-50 disabled:hover:bg-transparent transition"
                            title="Actualizar la version en biblioteca y analizar impacto"
                        >
                            {isUpdating || isScanning ? (
                                <><Loader2 size={12} className="animate-spin" /> Analizando...</>
                            ) : (
                                <><UploadCloud size={12} /> Actualizar</>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={() => setShowSaveForm(!showSaveForm)}
                            className="flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-800 px-2 py-1.5 rounded hover:bg-purple-50 transition"
                        >
                            <Plus size={12} /> Guardar
                        </button>
                    )}
                </div>
            </div>

            {/* Inline save form with category + tags */}
            {showSaveForm && (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                    <div>
                        <label className="text-[10px] text-gray-500 font-medium">Categoria</label>
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            className="w-full mt-0.5 text-[10px] px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-purple-400 bg-white"
                        >
                            <option value="">Sin categoria</option>
                            {LIBRARY_CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500 font-medium">Tags (separados por coma)</label>
                        <input
                            type="text"
                            value={tagsInput}
                            onChange={e => setTagsInput(e.target.value)}
                            placeholder="ej: CNC, laser, 6mm"
                            className="w-full mt-0.5 text-[10px] px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-purple-400 placeholder:text-gray-300"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setShowSaveForm(false)}
                            className="text-[10px] text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="text-[10px] text-white bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded transition font-medium"
                        >
                            Guardar en Biblioteca
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AmfeLibraryPanel;
