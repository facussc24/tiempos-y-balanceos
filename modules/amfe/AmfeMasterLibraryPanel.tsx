/**
 * AMFE Master Library Panel
 *
 * Side drawer panel that lists product families and their master AMFE documents.
 * Per AIAG-VDA 2019, splits into two sections:
 *   1. Foundation FMEAs (base processes, no products linked)
 *   2. Family FMEAs (product families with members)
 *
 * Shows which modules (AMFE, CP, HO, PFD) have master documents assigned per family.
 * Allows quick loading of a family's master AMFE document.
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, FolderOpen, Loader2, FileText, Crown, Layers, Wrench } from 'lucide-react';
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
    /** Which module to load when clicking a card. Defaults to 'amfe'. */
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

                        const masters = {
                            amfe: amfeMaster,
                            cp: cpMaster,
                            ho: hoMaster,
                            pfd: pfdMaster,
                        };
                        const hasAnyMaster = Object.values(masters).some((m) => m !== null);

                        return {
                            family,
                            masters,
                            hasAnyMaster,
                        };
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

        return () => {
            cancelled = true;
        };
    }, []);

    // -----------------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------------

    const handleCardClick = (info: FamilyMasterInfo) => {
        const master = info.masters[module];
        if (!master) return;
        onLoadDocument(master.documentId);
    };

    // -----------------------------------------------------------------------
    // Split: Foundation (no products) vs Family (has products)
    // -----------------------------------------------------------------------

    const foundationMasters = familyInfos.filter(
        (i) => i.hasAnyMaster && (i.family.memberCount === undefined || i.family.memberCount === 0)
    );

    const familyMasters = familyInfos.filter(
        (i) => i.hasAnyMaster && i.family.memberCount !== undefined && i.family.memberCount > 0
    );

    // -----------------------------------------------------------------------
    // Render card
    // -----------------------------------------------------------------------

    const renderCard = (info: FamilyMasterInfo, accent: 'teal' | 'blue') => {
        const hasModuleMaster = info.masters[module] !== null;
        const isActive = hasModuleMaster && currentDocumentId === info.masters[module]?.documentId;

        const clr =
            accent === 'teal'
                ? {
                      activeBorder: 'border-teal-400 bg-teal-50/50',
                      hover: 'hover:border-teal-300',
                      icon: 'text-teal-600',
                      badge: 'bg-teal-500',
                  }
                : {
                      activeBorder: 'border-blue-400 bg-blue-50/50',
                      hover: 'hover:border-blue-300',
                      icon: 'text-blue-600',
                      badge: 'bg-blue-500',
                  };

        let cardClass: string;
        if (!hasModuleMaster) {
            cardClass = 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-70';
        } else if (isActive) {
            cardClass = `${clr.activeBorder} cursor-pointer hover:shadow-sm`;
        } else {
            cardClass = `border-gray-200 ${clr.hover} hover:shadow-sm cursor-pointer bg-white`;
        }

        const lineaBadgeClass =
            info.family.lineaCode === 'VWA'
                ? 'bg-blue-100 text-blue-700'
                : info.family.lineaCode === 'PWA'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600';

        return (
            <div
                key={info.family.id}
                onClick={() => handleCardClick(info)}
                className={`border rounded-lg p-3 transition ${cardClass}`}
            >
                {/* Row 1: Icon + Name + Linea badge + Active badge */}
                <div className="flex items-center gap-2 mb-1.5">
                    {hasModuleMaster ? (
                        <Crown size={14} className={`${clr.icon} flex-shrink-0`} />
                    ) : (
                        <FileText size={14} className="text-gray-400 flex-shrink-0" />
                    )}
                    <span
                        className="font-medium text-sm text-gray-800 truncate"
                        title={info.family.name}
                    >
                        {info.family.name}
                    </span>
                    {info.family.lineaCode && (
                        <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${lineaBadgeClass}`}
                        >
                            {info.family.lineaCode}
                        </span>
                    )}
                    {isActive && (
                        <span
                            className={`text-[10px] ${clr.badge} text-white px-1.5 py-0.5 rounded-full flex-shrink-0`}
                        >
                            activo
                        </span>
                    )}
                </div>

                {/* Row 2: Module badges (AMFE / CP / HO / PFD) */}
                <div className="flex items-center gap-1.5 ml-5">
                    {MODULE_KEYS.map((mod) => {
                        const hasMaster = info.masters[mod] !== null;
                        const badgeClass = hasMaster
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                            : 'bg-white text-gray-400 border border-gray-200';
                        const title = hasMaster
                            ? `Maestro ${MODULE_LABELS[mod]} asignado`
                            : `Sin maestro ${MODULE_LABELS[mod]}`;
                        return (
                            <span
                                key={mod}
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeClass}`}
                                title={title}
                            >
                                {MODULE_LABELS[mod]}
                            </span>
                        );
                    })}
                </div>

                {/* Row 3: Description (foundation/teal) or member count (family/blue) */}
                {accent === 'teal' && info.family.description && (
                    <div
                        className="text-[10px] text-gray-500 ml-5 mt-1 truncate"
                        title={info.family.description}
                    >
                        {info.family.description}
                    </div>
                )}
                {info.family.memberCount !== undefined && info.family.memberCount > 0 && (
                    <div className="text-[10px] text-gray-400 ml-5 mt-1">
                        {info.family.memberCount}{' '}
                        {info.family.memberCount === 1 ? 'producto' : 'productos'}
                    </div>
                )}
            </div>
        );
    };

    // -----------------------------------------------------------------------
    // Main render
    // -----------------------------------------------------------------------

    return (
        <div className="p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    Libreria de {MODULE_LABELS[module]}s Maestros
                </h2>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-6 text-gray-400">
                    <Loader2 size={18} className="animate-spin mr-2" />
                    <span className="text-xs">Cargando familias...</span>
                </div>
            )}

            {/* Global empty state */}
            {!loading && foundationMasters.length === 0 && familyMasters.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                    <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sin {MODULE_LABELS[module]}s maestros registrados</p>
                    <p className="text-[10px] mt-1">
                        Abre un {MODULE_LABELS[module]} y designalo como maestro para comenzar.
                    </p>
                </div>
            )}

            {!loading && (foundationMasters.length > 0 || familyMasters.length > 0) && (
                <div className="space-y-5">
                    {/* Section 1: Foundation FMEAs (base processes) */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Wrench size={13} className="text-teal-600" />
                            <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wide">
                                {MODULE_LABELS[module]}s de Fundacion (Procesos Base)
                            </span>
                        </div>
                        {foundationMasters.length === 0 ? (
                            <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                <p className="text-[11px] text-gray-400">
                                    Sin procesos maestros definidos
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                    Ej: Inyeccion Plastica, Costura, Tapizado
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {foundationMasters.map((info) => renderCard(info, 'teal'))}
                            </div>
                        )}
                    </div>

                    {/* Section 2: Family FMEAs (products) */}
                    {familyMasters.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Layers size={13} className="text-blue-600" />
                                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">
                                    {MODULE_LABELS[module]}s de Familia (Productos)
                                </span>
                            </div>
                            <div className="grid gap-2">
                                {familyMasters.map((info) => renderCard(info, 'blue'))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AmfeMasterLibraryPanel;
