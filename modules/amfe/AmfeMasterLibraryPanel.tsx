/**
 * AMFE Master Library Panel
 *
 * Compact sidebar panel listing product families and their master documents.
 * Collapsible sections: Foundation (base processes) and Family (products).
 * Compact row layout (~36px per item) for scanning 12-15 items without scrolling.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, FolderOpen, Loader2, Layers, Wrench, Search, X, ChevronDown, ChevronRight } from 'lucide-react';
import { listFamilies } from '../../utils/repositories/familyRepository';
import type { ProductFamily } from '../../utils/repositories/familyRepository';
import { getFamilyMasterDocument } from '../../utils/repositories/familyDocumentRepository';
import type { FamilyDocument } from '../../utils/repositories/familyDocumentRepository';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AmfeMasterLibraryPanelProps {
    onLoadDocument: (docId: string) => void;
    onClose: () => void;
    currentDocumentId?: string | null;
    /** Which module to load when clicking a row. Defaults to 'amfe'. */
    module?: ModuleKey;
}

type ModuleKey = 'amfe' | 'cp' | 'ho' | 'pfd';

const MODULE_KEYS: ModuleKey[] = ['amfe', 'cp', 'ho', 'pfd'];

const MODULE_LABELS: Record<ModuleKey, string> = {
    amfe: 'AMFE',
    cp: 'CP',
    ho: 'HO',
    pfd: 'PFD',
};

interface FamilyMasterInfo {
    family: ProductFamily;
    masters: Record<ModuleKey, FamilyDocument | null>;
    hasAnyMaster: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AmfeMasterLibraryPanel: React.FC<AmfeMasterLibraryPanelProps> = ({
    onLoadDocument,
    onClose,
    currentDocumentId,
    module = 'amfe',
}) => {
    const [familyInfos, setFamilyInfos] = useState<FamilyMasterInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [lineaFilter, setLineaFilter] = useState<'all' | 'VWA' | 'PWA'>('all');
    const [foundationExpanded, setFoundationExpanded] = useState(true);
    const [familyExpanded, setFamilyExpanded] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function loadData() {
            setLoading(true);
            try {
                const families = await listFamilies();

                const infos: FamilyMasterInfo[] = await Promise.all(
                    families.map(async (family) => {
                        const [amfeMaster, cpMaster, hoMaster, pfdMaster] = await Promise.all([
                            getFamilyMasterDocument(family.id, 'amfe'),
                            getFamilyMasterDocument(family.id, 'cp'),
                            getFamilyMasterDocument(family.id, 'ho'),
                            getFamilyMasterDocument(family.id, 'pfd'),
                        ]);

                        const masters = { amfe: amfeMaster, cp: cpMaster, ho: hoMaster, pfd: pfdMaster };
                        const hasAnyMaster = Object.values(masters).some((m) => m !== null);

                        return { family, masters, hasAnyMaster };
                    })
                );

                if (!cancelled) {
                    setFamilyInfos(infos);
                }
            } catch (err) {
                logger.error(
                    'MasterLibraryPanel',
                    'Error al cargar familias y maestros',
                    {},
                    err instanceof Error ? err : undefined
                );
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadData();
        return () => { cancelled = true; };
    }, []);

    // -----------------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------------

    const handleRowClick = (info: FamilyMasterInfo) => {
        const master = info.masters[module];
        if (!master) return;
        onLoadDocument(master.documentId);
    };

    // -----------------------------------------------------------------------
    // Filter + Split
    // -----------------------------------------------------------------------

    const filteredInfos = useMemo(() => {
        let items = familyInfos.filter((i) => i.hasAnyMaster);

        if (searchText.trim()) {
            const q = searchText.trim().toLowerCase();
            items = items.filter(
                (i) =>
                    i.family.name.toLowerCase().includes(q) ||
                    (i.family.description && i.family.description.toLowerCase().includes(q))
            );
        }

        if (lineaFilter !== 'all') {
            items = items.filter((i) => i.family.lineaCode === lineaFilter);
        }

        return items;
    }, [familyInfos, searchText, lineaFilter]);

    const foundationMasters = filteredInfos.filter(
        (i) => i.family.memberCount === undefined || i.family.memberCount === 0
    );

    const familyMasters = filteredInfos.filter(
        (i) => i.family.memberCount !== undefined && i.family.memberCount > 0
    );

    const availableLineas = useMemo(() => {
        const codes = new Set(familyInfos.filter((i) => i.hasAnyMaster && i.family.lineaCode).map((i) => i.family.lineaCode));
        return codes;
    }, [familyInfos]);

    // -----------------------------------------------------------------------
    // Compact row renderer
    // -----------------------------------------------------------------------

    const renderRow = (info: FamilyMasterInfo, accent: 'teal' | 'blue') => {
        const hasModuleMaster = info.masters[module] !== null;
        const isActive = hasModuleMaster && currentDocumentId === info.masters[module]?.documentId;

        return (
            <div
                key={info.family.id}
                onClick={() => handleRowClick(info)}
                className={`flex items-center gap-2 px-2 py-1.5 transition-colors ${
                    !hasModuleMaster
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer hover:bg-slate-50'
                } ${
                    isActive
                        ? accent === 'teal'
                            ? 'bg-teal-50 border-l-2 border-l-teal-500'
                            : 'bg-blue-50 border-l-2 border-l-blue-500'
                        : 'border-l-2 border-l-transparent'
                }`}
            >
                {/* Name */}
                <span
                    className="flex-1 text-xs font-medium text-gray-800 truncate min-w-0"
                    title={info.family.name}
                >
                    {info.family.name}
                </span>

                {/* Linea badge */}
                {info.family.lineaCode && (
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0 leading-none ${
                        info.family.lineaCode === 'VWA'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                    }`}>
                        {info.family.lineaCode}
                    </span>
                )}

                {/* Module dots */}
                <div className="flex items-center gap-0.5 flex-shrink-0" title={
                    MODULE_KEYS.map(m => `${MODULE_LABELS[m]}: ${info.masters[m] ? 'Si' : 'No'}`).join('\n')
                }>
                    {MODULE_KEYS.map((mod) => (
                        <span
                            key={mod}
                            className={`w-1.5 h-1.5 rounded-full ${
                                info.masters[mod] ? 'bg-emerald-500' : 'bg-gray-300'
                            }`}
                            title={`${MODULE_LABELS[mod]}: ${info.masters[mod] ? 'Maestro asignado' : 'Sin maestro'}`}
                        />
                    ))}
                </div>

                {/* Member count */}
                {info.family.memberCount !== undefined && info.family.memberCount > 0 && (
                    <span className="text-[10px] text-gray-400 flex-shrink-0 w-12 text-right tabular-nums">
                        {info.family.memberCount} prod.
                    </span>
                )}

                {/* Active dot */}
                {isActive && (
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        accent === 'teal' ? 'bg-teal-500' : 'bg-blue-500'
                    } animate-pulse`} />
                )}
            </div>
        );
    };

    // -----------------------------------------------------------------------
    // Section header renderer
    // -----------------------------------------------------------------------

    const renderSection = (
        label: string,
        items: FamilyMasterInfo[],
        accent: 'teal' | 'blue',
        icon: React.ReactNode,
        expanded: boolean,
        setExpanded: (v: boolean) => void,
        emptyMessage?: string,
    ) => (
        <div>
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-gray-50 rounded transition-colors"
            >
                {expanded
                    ? <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
                    : <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                }
                {icon}
                <span className={`text-[10px] font-bold uppercase tracking-wide flex-1 ${
                    accent === 'teal' ? 'text-teal-700' : 'text-blue-700'
                }`}>
                    {label}
                </span>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 rounded-full">
                    {items.length}
                </span>
            </button>
            {expanded && (
                <div className="divide-y divide-gray-100">
                    {items.length === 0 && emptyMessage ? (
                        <div className="px-2 py-3 text-[10px] text-gray-400 text-center">
                            {emptyMessage}
                        </div>
                    ) : (
                        items.map((info) => renderRow(info, accent))
                    )}
                </div>
            )}
        </div>
    );

    // -----------------------------------------------------------------------
    // Main render
    // -----------------------------------------------------------------------

    return (
        <div className="p-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    {MODULE_LABELS[module]}s Maestros
                </h2>
            </div>

            {/* Search & Filter */}
            {!loading && familyInfos.some((i) => i.hasAnyMaster) && (
                <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Buscar familia..."
                            className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400"
                        />
                        {searchText && (
                            <button
                                onClick={() => setSearchText('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                    {availableLineas.size > 1 && (
                        <select
                            value={lineaFilter}
                            onChange={(e) => setLineaFilter(e.target.value as 'all' | 'VWA' | 'PWA')}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white"
                        >
                            <option value="all">Todas</option>
                            {availableLineas.has('VWA') && <option value="VWA">VWA</option>}
                            {availableLineas.has('PWA') && <option value="PWA">PWA</option>}
                        </select>
                    )}
                </div>
            )}

            {/* No results from filter */}
            {!loading && familyInfos.some((i) => i.hasAnyMaster) && foundationMasters.length === 0 && familyMasters.length === 0 && (searchText || lineaFilter !== 'all') && (
                <div className="text-center py-4 text-gray-400">
                    <Search size={20} className="mx-auto mb-1.5 opacity-40" />
                    <p className="text-xs">Sin resultados</p>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-6 text-gray-400">
                    <Loader2 size={16} className="animate-spin mr-2" />
                    <span className="text-xs">Cargando...</span>
                </div>
            )}

            {/* Empty state */}
            {!loading && !familyInfos.some((i) => i.hasAnyMaster) && (
                <div className="text-center py-6 text-gray-400">
                    <FolderOpen size={28} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Sin {MODULE_LABELS[module]}s maestros</p>
                </div>
            )}

            {/* Sections */}
            {!loading && (foundationMasters.length > 0 || familyMasters.length > 0) && (
                <div className="space-y-1">
                    {renderSection(
                        'Procesos Base',
                        foundationMasters,
                        'teal',
                        <Wrench size={11} className="text-teal-600 flex-shrink-0" />,
                        foundationExpanded,
                        setFoundationExpanded,
                        'Sin procesos maestros definidos',
                    )}
                    {familyMasters.length > 0 && renderSection(
                        'Familias de Producto',
                        familyMasters,
                        'blue',
                        <Layers size={11} className="text-blue-600 flex-shrink-0" />,
                        familyExpanded,
                        setFamilyExpanded,
                    )}
                </div>
            )}
        </div>
    );
};

export default AmfeMasterLibraryPanel;
