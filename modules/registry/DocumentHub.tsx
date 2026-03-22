/**
 * Document Hub — Unified document listing
 *
 * Filterable, sortable table that lists all documents from
 * AMFE, CP, PFD, and HO repositories.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useDocumentRegistry } from './useDocumentRegistry';
import {
    DocumentType,
    DocumentRegistryEntry,
    DOCUMENT_TYPE_CONFIG,
} from './documentRegistryTypes';
import DocumentListFilters from '../../components/ui/DocumentListFilters';
import {
    ArrowLeft, RefreshCcw, GitBranch, ShieldAlert,
    ClipboardCheck, FileText, FolderOpen, Link2, ExternalLink,
    ChevronUp, ChevronDown, Loader2, User,
} from 'lucide-react';
import { Breadcrumb } from '../../components/navigation/Breadcrumb';

interface DocumentHubProps {
    onBackToLanding: () => void;
    onOpenDocument: (type: DocumentType, id: string) => void;
}

type SortField = 'name' | 'type' | 'partNumber' | 'client' | 'itemCount' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const TYPE_ICONS: Record<DocumentType, React.ReactNode> = {
    pfd: <GitBranch size={14} className="text-cyan-500" />,
    amfe: <ShieldAlert size={14} className="text-orange-500" />,
    controlPlan: <ClipboardCheck size={14} className="text-green-500" />,
    hojaOperaciones: <FileText size={14} className="text-indigo-500" />,
};

const DocumentHub: React.FC<DocumentHubProps> = ({ onBackToLanding, onOpenDocument }) => {
    const { entries, loading, error, refresh } = useDocumentRegistry();
    const [filterType, setFilterType] = useState<DocumentType | ''>('');
    const [detailFiltered, setDetailFiltered] = useState<DocumentRegistryEntry[]>([]);
    const [sortField, setSortField] = useState<SortField>('updatedAt');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // Type-filtered entries (input to DocumentListFilters)
    const typeFiltered = useMemo(() => {
        if (!filterType) return entries;
        return entries.filter(e => e.type === filterType);
    }, [entries, filterType]);

    // Callback for DocumentListFilters
    const handleDetailFilteredChange = useCallback((result: DocumentRegistryEntry[]) => {
        setDetailFiltered(result);
    }, []);

    // Sort the detail-filtered results
    const filtered = useMemo(() => {
        return [...detailFiltered].sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case 'name': cmp = a.name.localeCompare(b.name); break;
                case 'type': cmp = a.type.localeCompare(b.type); break;
                case 'partNumber': cmp = a.partNumber.localeCompare(b.partNumber); break;
                case 'client': cmp = a.client.localeCompare(b.client); break;
                case 'itemCount': cmp = a.itemCount - b.itemCount; break;
                case 'updatedAt': cmp = (a.updatedAt || '0').localeCompare(b.updatedAt || '0'); break;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [detailFiltered, sortField, sortDir]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir(field === 'updatedAt' ? 'desc' : 'asc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <span className="text-gray-300 ml-1">⇅</span>;
        return sortDir === 'asc'
            ? <ChevronUp size={12} className="text-blue-500 ml-0.5 inline" />
            : <ChevronDown size={12} className="text-blue-500 ml-0.5 inline" />;
    };

    // Counts per type
    const typeCounts = useMemo(() => {
        const counts: Record<string, number> = { '': entries.length };
        for (const e of entries) {
            counts[e.type] = (counts[e.type] || 0) + 1;
        }
        return counts;
    }, [entries]);

    const formatDate = (iso: string) => {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch {
            return iso.split('T')[0] || iso;
        }
    };

    return (
        <div className="min-h-full bg-gray-50 flex flex-col font-sans text-sm">
            {/* Header */}
            <header className="bg-white text-slate-800 border-b border-gray-300 p-3 sticky top-0 z-50">
                <div className="flex items-center justify-between max-w-[1400px] mx-auto">
                    <div className="flex items-center gap-3">
                        <button onClick={onBackToLanding}
                            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded hover:bg-slate-100 transition text-xs">
                            <ArrowLeft size={16} />
                            <span>Inicio</span>
                        </button>
                        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                            <div className="bg-blue-600 text-white p-1.5 rounded">
                                <FolderOpen size={18} />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-slate-800 leading-tight">Hub de Documentos</h1>
                                <p className="text-slate-400 text-[10px]">Todos los documentos APQP</p>
                            </div>
                        </div>
                        <span className="text-xs text-gray-400 ml-3">
                            <strong className="text-blue-600">{entries.length}</strong> documentos
                            {entries.length > 0 && (
                                <span className="ml-2 text-gray-300">
                                    ({typeCounts['pfd'] || 0} PFD · {typeCounts['amfe'] || 0} AMFE · {typeCounts['controlPlan'] || 0} CP · {typeCounts['hojaOperaciones'] || 0} HO)
                                </span>
                            )}
                        </span>
                    </div>
                    <button onClick={refresh} disabled={loading}
                        className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-1.5 rounded transition text-slate-600 disabled:opacity-50">
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                </div>
            </header>

            <Breadcrumb
                items={[
                    { label: 'Inicio', onClick: onBackToLanding },
                    { label: 'Hub de Documentos', isActive: true },
                ]}
                className="bg-white border-b border-gray-100 px-4 py-1"
            />

            {/* Type filter pills */}
            <div className="bg-white border-b border-gray-200 px-4 py-2">
                <div className="max-w-[1400px] mx-auto flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500 font-bold mr-1">Tipo:</span>
                        <button onClick={() => setFilterType('')}
                            className={`text-[10px] px-2.5 py-0.5 rounded-full border transition font-medium ${
                                filterType === '' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                            }`}>
                            Todos ({typeCounts[''] || 0})
                        </button>
                        {(['pfd', 'amfe', 'controlPlan', 'hojaOperaciones'] as DocumentType[]).map(type => {
                            const cfg = DOCUMENT_TYPE_CONFIG[type];
                            return (
                                <button key={type} onClick={() => setFilterType(type)}
                                    className={`text-[10px] px-2.5 py-0.5 rounded-full border transition font-medium flex items-center gap-1 ${
                                        filterType === type ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color}` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                    }`}>
                                    {cfg.shortLabel} ({typeCounts[type] || 0})
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Client / Project / Search filters */}
            <DocumentListFilters
                documents={typeFiltered}
                onFilteredChange={handleDetailFilteredChange}
                moduleType={filterType || undefined}
            />

            {/* Main content */}
            <div className="flex-grow p-4">
                <div className="max-w-[1400px] mx-auto">
                    {loading && (
                        <div className="text-center py-16 text-gray-400">
                            <Loader2 size={32} className="mx-auto mb-3 animate-spin text-blue-400" />
                            <p className="text-sm">Cargando documentos...</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                            <p className="text-sm text-red-700">{error}</p>
                            <button onClick={refresh} className="mt-2 text-xs text-red-600 underline">Reintentar</button>
                        </div>
                    )}

                    {!loading && !error && filtered.length === 0 && (
                        <div className="text-center py-16 text-gray-400">
                            <FolderOpen size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">
                                {entries.length === 0 ? 'No hay documentos guardados.' : 'Sin resultados para el filtro actual.'}
                            </p>
                            {entries.length === 0 && (
                                <p className="text-xs mt-1">Cree un AMFE, Plan de Control, Diagrama de Flujo u Hoja de Operaciones para comenzar.</p>
                            )}
                        </div>
                    )}

                    {!loading && filtered.length > 0 && (
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[80px]">
                                            <button onClick={() => handleSort('type')} className="hover:text-gray-800 transition">
                                                Tipo <SortIcon field="type" />
                                            </button>
                                        </th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                            <button onClick={() => handleSort('name')} className="hover:text-gray-800 transition">
                                                Nombre <SortIcon field="name" />
                                            </button>
                                        </th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[120px]">
                                            <button onClick={() => handleSort('partNumber')} className="hover:text-gray-800 transition">
                                                Nro. Pieza <SortIcon field="partNumber" />
                                            </button>
                                        </th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[150px]">
                                            <button onClick={() => handleSort('client')} className="hover:text-gray-800 transition">
                                                Cliente <SortIcon field="client" />
                                            </button>
                                        </th>
                                        <th className="text-center px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[80px]">
                                            <button onClick={() => handleSort('itemCount')} className="hover:text-gray-800 transition">
                                                Items <SortIcon field="itemCount" />
                                            </button>
                                        </th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[100px]">Vinculado</th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[100px]">
                                            <button onClick={() => handleSort('updatedAt')} className="hover:text-gray-800 transition">
                                                Fecha <SortIcon field="updatedAt" />
                                            </button>
                                        </th>
                                        <th className="text-left px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[140px]">Autor</th>
                                        <th className="w-[80px]"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(entry => (
                                        <DocumentRow
                                            key={`${entry.type}-${entry.id}`}
                                            entry={entry}
                                            onOpen={() => onOpenDocument(entry.type, entry.id)}
                                            formatDate={formatDate}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="bg-white/95 backdrop-blur-sm border-t p-2 text-center text-xs text-gray-500">
                Hub de Documentos · Barack Mercosul · Ingenieria de Calidad Automotriz
            </div>
        </div>
    );
};

/** Individual document row */
const DocumentRow: React.FC<{
    entry: DocumentRegistryEntry;
    onOpen: () => void;
    formatDate: (iso: string) => string;
}> = React.memo(({ entry, onOpen, formatDate }) => {
    const cfg = DOCUMENT_TYPE_CONFIG[entry.type];

    return (
        <tr className="border-b border-gray-100 hover:bg-gray-50/50 transition cursor-pointer group"
            onClick={onOpen}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') onOpen(); }}
        >
            {/* Type badge */}
            <td className="px-3 py-2.5">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bgColor} ${cfg.color} ${cfg.borderColor} border`}>
                    {TYPE_ICONS[entry.type]}
                    {cfg.shortLabel}
                </span>
            </td>

            {/* Name */}
            <td className="px-3 py-2.5">
                <div className="font-medium text-slate-800 text-xs truncate max-w-[300px]" title={entry.name}>{entry.name}</div>
                {entry.partName && entry.partName !== entry.name && (
                    <div className="text-[10px] text-gray-400 truncate max-w-[300px]" title={entry.partName}>{entry.partName}</div>
                )}
            </td>

            {/* Part number */}
            <td className="px-3 py-2.5 text-xs text-gray-600">
                {entry.partNumber || <span className="text-gray-300">—</span>}
            </td>

            {/* Client */}
            <td className="px-3 py-2.5 text-xs text-gray-600 truncate max-w-[150px]" title={entry.client || ''}>
                {entry.client || <span className="text-gray-300">—</span>}
            </td>

            {/* Item count */}
            <td className="px-3 py-2.5 text-center">
                <span className="text-xs font-medium text-gray-600">{entry.itemCount}</span>
            </td>

            {/* Linked AMFE */}
            <td className="px-3 py-2.5">
                {entry.linkedAmfeProject ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full truncate max-w-[90px]">
                        <Link2 size={9} />
                        AMFE
                    </span>
                ) : (
                    <span className="text-gray-300 text-xs">—</span>
                )}
            </td>

            {/* Updated at */}
            <td className="px-3 py-2.5 text-xs text-gray-500">
                {formatDate(entry.updatedAt)}
            </td>

            {/* Author info */}
            <td className="px-3 py-2.5">
                {(entry.createdBy || entry.updatedBy) ? (
                    <div className="text-[10px] text-gray-400 leading-relaxed">
                        {entry.createdBy && (
                            <div className="flex items-center gap-1" title={entry.createdBy}>
                                <User size={9} className="text-gray-300 shrink-0" />
                                <span className="truncate max-w-[110px]">{entry.createdBy.split('@')[0]}</span>
                            </div>
                        )}
                        {entry.updatedBy && entry.updatedBy !== entry.createdBy && (
                            <div className="text-gray-300 truncate max-w-[120px]" title={`Modificado por ${entry.updatedBy}`}>
                                mod: {entry.updatedBy.split('@')[0]}
                            </div>
                        )}
                    </div>
                ) : (
                    <span className="text-gray-300 text-xs">—</span>
                )}
            </td>

            {/* Action */}
            <td className="px-3 py-2.5 text-right">
                <button
                    onClick={(e) => { e.stopPropagation(); onOpen(); }}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-medium opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5 ml-auto"
                >
                    Abrir <ExternalLink size={10} />
                </button>
            </td>
        </tr>
    );
});

export default DocumentHub;
