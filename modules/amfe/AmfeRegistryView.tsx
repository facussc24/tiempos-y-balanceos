/**
 * AMFE Registry View
 *
 * Centralized registry panel showing all AMFE documents with metadata,
 * lifecycle status, summary stats, and quick actions.
 *
 * Required by IATF 16949 for traceability and audit compliance.
 */

import React, { useMemo } from 'react';
import {
    AmfeRegistryEntry,
    AmfeLifecycleStatus,
    LIFECYCLE_STATUS_LABELS,
    LIFECYCLE_STATUS_COLORS,
} from './amfeRegistryTypes';
import {
    useAmfeRegistry,
    RegistrySortField,
    EMPTY_REGISTRY_FILTERS,
} from './useAmfeRegistry';
import {
    Search, RefreshCw, ArrowUpDown, ChevronUp, ChevronDown,
    FileJson, Calendar, User, ShieldCheck, AlertTriangle,
    FolderOpen, X, Filter, Hash,
} from 'lucide-react';

interface Props {
    onOpenProject: (projectName: string) => void;
    onClose: () => void;
}

const STATUS_ORDER: AmfeLifecycleStatus[] = ['draft', 'inReview', 'approved', 'archived'];

const AmfeRegistryView: React.FC<Props> = ({ onOpenProject, onClose }) => {
    const reg = useAmfeRegistry();
    const entries = reg.filteredEntries();
    const clients = useMemo(() => reg.uniqueClients(), [reg.uniqueClients]);
    const responsibles = useMemo(() => reg.uniqueResponsibles(), [reg.uniqueResponsibles]);

    const hasFilters = reg.filters.search !== '' || reg.filters.status !== 'all' || reg.filters.client !== '' || reg.filters.responsible !== '';

    // Summary stats
    const totalEntries = reg.registry.entries.length;
    const totalDraft = reg.registry.entries.filter(e => e.status === 'draft').length;
    const totalReview = reg.registry.entries.filter(e => e.status === 'inReview').length;
    const totalApproved = reg.registry.entries.filter(e => e.status === 'approved').length;
    const totalApH = reg.registry.entries.reduce((sum, e) => sum + e.apHCount, 0);

    const SortHeader: React.FC<{ field: RegistrySortField; label: string; className?: string }> = ({ field, label, className = '' }) => (
        <th
            className={`px-3 py-2 text-left cursor-pointer hover:bg-gray-100 transition select-none ${className}`}
            onClick={() => reg.toggleSort(field)}
        >
            <div className="flex items-center gap-1">
                <span>{label}</span>
                {reg.sortField === field ? (
                    reg.sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                ) : (
                    <ArrowUpDown size={10} className="text-gray-300" />
                )}
            </div>
        </th>
    );

    const StatusBadge: React.FC<{ status: AmfeLifecycleStatus }> = ({ status }) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${LIFECYCLE_STATUS_COLORS[status]}`}>
            {LIFECYCLE_STATUS_LABELS[status]}
        </span>
    );

    const ApBar: React.FC<{ entry: AmfeRegistryEntry }> = ({ entry }) => {
        const total = entry.apHCount + entry.apMCount;
        if (total === 0 && entry.causeCount === 0) return <span className="text-gray-300 text-[10px]">-</span>;

        const hPct = total > 0 ? (entry.apHCount / total) * 100 : 0;
        const mPct = total > 0 ? (entry.apMCount / total) * 100 : 0;

        return (
            <div className="flex items-center gap-1.5">
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex" style={{ minWidth: 60 }}>
                    {hPct > 0 && <div className="bg-red-500 h-full" style={{ width: `${hPct}%` }} />}
                    {mPct > 0 && <div className="bg-yellow-400 h-full" style={{ width: `${mPct}%` }} />}
                    {(100 - hPct - mPct) > 0 && <div className="bg-green-400 h-full" style={{ width: `${100 - hPct - mPct}%` }} />}
                </div>
                <span className="text-[10px] text-gray-500 w-12 text-right">
                    {entry.apHCount > 0 && <span className="text-red-600 font-bold">{entry.apHCount}H</span>}
                    {entry.apHCount > 0 && entry.apMCount > 0 && ' '}
                    {entry.apMCount > 0 && <span className="text-yellow-600">{entry.apMCount}M</span>}
                    {entry.apHCount === 0 && entry.apMCount === 0 && <span className="text-green-600">OK</span>}
                </span>
            </div>
        );
    };

    const CoverageBar: React.FC<{ percent: number }> = ({ percent }) => (
        <div className="flex items-center gap-1.5">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden" style={{ minWidth: 40 }}>
                <div
                    className={`h-full rounded-full transition-all ${percent === 100 ? 'bg-green-500' : percent >= 70 ? 'bg-blue-500' : 'bg-orange-400'}`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span className={`text-[10px] font-bold w-8 text-right ${percent === 100 ? 'text-green-600' : 'text-gray-500'}`}>
                {percent}%
            </span>
        </div>
    );

    return (
        <div className="bg-white border-b border-gray-300 shadow-lg animate-in">
            <div className="p-4 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 text-white p-1.5 rounded">
                            <Hash size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-800">Registro AMFE</h2>
                            <p className="text-[10px] text-gray-400">IATF 16949 - Indice centralizado de documentos AMFE</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={reg.syncFromDisk}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition"
                            disabled={reg.loading}
                            title="Sincronizar con archivos en disco"
                        >
                            <RefreshCw size={12} className={reg.loading ? 'animate-spin' : ''} />
                            Sincronizar
                        </button>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" title="Cerrar registro" aria-label="Cerrar registro">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-5 gap-3 mb-4">
                    <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                        <p className="text-[10px] text-gray-500 font-medium">Total AMFEs</p>
                        <p className="text-lg font-bold text-gray-800">{totalEntries}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                        <p className="text-[10px] text-gray-500 font-medium">Borradores</p>
                        <p className="text-lg font-bold text-gray-600">{totalDraft}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-200">
                        <p className="text-[10px] text-blue-500 font-medium">En Revision</p>
                        <p className="text-lg font-bold text-blue-700">{totalReview}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2.5 border border-green-200">
                        <p className="text-[10px] text-green-500 font-medium">Aprobados</p>
                        <p className="text-lg font-bold text-green-700">{totalApproved}</p>
                    </div>
                    <div className={`rounded-lg p-2.5 border ${totalApH > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                        <p className={`text-[10px] font-medium ${totalApH > 0 ? 'text-red-500' : 'text-green-500'}`}>AP=H Abiertos</p>
                        <p className={`text-lg font-bold ${totalApH > 0 ? 'text-red-700' : 'text-green-700'}`}>{totalApH}</p>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={reg.filters.search}
                            onChange={(e) => reg.setFilters({ ...reg.filters, search: e.target.value })}
                            placeholder="Buscar AMFE, tema, cliente..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                        />
                    </div>
                    <select
                        value={reg.filters.status}
                        onChange={(e) => reg.setFilters({ ...reg.filters, status: e.target.value as AmfeLifecycleStatus | 'all' })}
                        className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
                    >
                        <option value="all">Todos los estados</option>
                        {STATUS_ORDER.map(s => (
                            <option key={s} value={s}>{LIFECYCLE_STATUS_LABELS[s]}</option>
                        ))}
                    </select>
                    {clients.length > 0 && (
                        <select
                            value={reg.filters.client}
                            onChange={(e) => reg.setFilters({ ...reg.filters, client: e.target.value })}
                            className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
                        >
                            <option value="">Todos los clientes</option>
                            {clients.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    )}
                    {responsibles.length > 0 && (
                        <select
                            value={reg.filters.responsible}
                            onChange={(e) => reg.setFilters({ ...reg.filters, responsible: e.target.value })}
                            className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
                        >
                            <option value="">Todos los responsables</option>
                            {responsibles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    )}
                    {hasFilters && (
                        <button
                            onClick={() => reg.setFilters(EMPTY_REGISTRY_FILTERS)}
                            className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1"
                        >
                            <X size={12} /> Limpiar
                        </button>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto">
                        {entries.length} de {totalEntries} registros
                    </span>
                </div>

                {/* Table */}
                {reg.loading ? (
                    <div className="py-12 text-center text-gray-400">
                        <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
                        <p className="text-sm">Cargando registro...</p>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">
                        <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{hasFilters ? 'No se encontraron AMFEs con esos filtros.' : 'No hay AMFEs registrados todavia.'}</p>
                        {!hasFilters && <p className="text-xs mt-1">Los AMFEs se registran automaticamente al guardar.</p>}
                    </div>
                ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr className="border-b border-gray-200 text-gray-600">
                                        <SortHeader field="amfeNumber" label="AMFE #" className="w-24" />
                                        <SortHeader field="subject" label="Tema / Proyecto" className="min-w-[200px]" />
                                        <SortHeader field="client" label="Cliente" className="w-32" />
                                        <SortHeader field="status" label="Estado" className="w-28" />
                                        <th className="px-3 py-2 text-left w-20">Resp.</th>
                                        <th className="px-3 py-2 text-left w-16">Ops</th>
                                        <th className="px-3 py-2 text-left w-16">Causas</th>
                                        <SortHeader field="apHCount" label="AP" className="w-36" />
                                        <SortHeader field="coveragePercent" label="Cobertura" className="w-28" />
                                        <th className="px-3 py-2 text-left w-20">Rev.</th>
                                        <SortHeader field="updatedAt" label="Actualizado" className="w-24" />
                                        <th className="px-3 py-2 w-16"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => (
                                        <tr
                                            key={entry.id}
                                            className="border-b border-gray-100 hover:bg-indigo-50/30 cursor-pointer transition"
                                            onClick={() => onOpenProject(entry.projectName)}
                                        >
                                            <td className="px-3 py-2">
                                                <span className="font-mono font-bold text-indigo-600">{entry.amfeNumber}</span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <div>
                                                    <span className="font-medium text-gray-800">{entry.subject || entry.projectName}</span>
                                                    {entry.partNumber && (
                                                        <span className="text-[10px] text-gray-400 ml-2">PN: {entry.partNumber}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-gray-600">{entry.client || '-'}</td>
                                            <td className="px-3 py-2">
                                                <StatusBadge status={entry.status} />
                                            </td>
                                            <td className="px-3 py-2 text-gray-600">{entry.responsible || '-'}</td>
                                            <td className="px-3 py-2 text-gray-600 text-center">{entry.operationCount}</td>
                                            <td className="px-3 py-2 text-gray-600 text-center">{entry.causeCount}</td>
                                            <td className="px-3 py-2">
                                                <ApBar entry={entry} />
                                            </td>
                                            <td className="px-3 py-2">
                                                <CoverageBar percent={entry.coveragePercent} />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {entry.revisions.length > 0 ? (
                                                    <span className="text-indigo-600 font-bold">{entry.revisions.length}</span>
                                                ) : (
                                                    <span className="text-gray-300">0</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-[10px]">
                                                <div className="text-gray-400">
                                                    {entry.updatedAt && !isNaN(new Date(entry.updatedAt).getTime()) ? new Date(entry.updatedAt).toLocaleDateString('es-AR') : '-'}
                                                </div>
                                                {entry.updatedBy && (
                                                    <div className="text-gray-300 truncate max-w-[80px]" title={entry.updatedBy}>
                                                        {entry.updatedBy.split('@')[0]}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onOpenProject(entry.projectName); }}
                                                    className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                                                >
                                                    Abrir
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Error message */}
                {reg.error && (
                    <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 flex items-center gap-2">
                        <AlertTriangle size={14} />
                        {reg.error}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AmfeRegistryView;
