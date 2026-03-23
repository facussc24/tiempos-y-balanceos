/**
 * APQP Dashboard — Consolidated risk and document status across all products
 *
 * Shows KPI cards, AP distribution chart, AP by product table,
 * and document completeness matrix using real Supabase data.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
    Layers,
    FileText,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Loader2,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Breadcrumb } from '../../components/navigation/Breadcrumb';
import type { AmfeRegistryEntry } from '../amfe/amfeRegistryTypes';
import type { CpDocumentListItem } from '../../utils/repositories/cpRepository';
import type { HoDocumentListItem } from '../../utils/repositories/hoRepository';
import type { ProductFamily } from '../../utils/repositories/familyRepository';
import type { FamilyDocument } from '../../utils/repositories/familyDocumentRepository';
import { logger } from '../../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PfdListItem {
    id: string;
    part_number: string;
    part_name: string;
    document_number: string;
    revision_level: string;
    revision_date: string;
    customer_name: string;
    client: string;
    step_count: number;
    updated_at: string;
}

interface DashboardData {
    amfeDocs: AmfeRegistryEntry[];
    cpDocs: CpDocumentListItem[];
    pfdDocs: PfdListItem[];
    hoDocs: HoDocumentListItem[];
    families: ProductFamily[];
    familyDocsMap: Map<number, FamilyDocument[]>;
}

// ---------------------------------------------------------------------------
// Data Hook
// ---------------------------------------------------------------------------

function useApqpDashboardData() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [amfeMod, cpMod, pfdMod, hoMod, familyMod, familyDocMod] = await Promise.all([
                    import('../../utils/repositories/amfeRepository'),
                    import('../../utils/repositories/cpRepository'),
                    import('../../utils/repositories/pfdRepository'),
                    import('../../utils/repositories/hoRepository'),
                    import('../../utils/repositories/familyRepository'),
                    import('../../utils/repositories/familyDocumentRepository'),
                ]);

                const [amfeDocs, cpDocs, pfdDocs, hoDocs, families] = await Promise.all([
                    amfeMod.listAmfeDocuments(),
                    cpMod.listCpDocuments(),
                    pfdMod.listPfdDocuments(),
                    hoMod.listHoDocuments(),
                    familyMod.listFamilies(),
                ]);

                // Get family documents for each family
                const familyDocsMap = new Map<number, FamilyDocument[]>();
                await Promise.all(
                    families.map(async (f) => {
                        const docs = await familyDocMod.listFamilyDocuments(f.id);
                        familyDocsMap.set(f.id, docs);
                    })
                );

                if (!cancelled) {
                    setData({ amfeDocs, cpDocs, pfdDocs, hoDocs, families, familyDocsMap });
                    setLoading(false);
                }
            } catch (err) {
                logger.error('ApqpDashboard', 'Failed to load dashboard data', {}, err instanceof Error ? err : undefined);
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return { data, loading };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    colorClass: string;
    subtitle?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon, colorClass, subtitle }) => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/60 p-5">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
                <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
                {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            <div className={`p-2.5 rounded-lg ${colorClass.includes('red') ? 'bg-red-50' : colorClass.includes('emerald') ? 'bg-emerald-50' : colorClass.includes('blue') ? 'bg-blue-50' : 'bg-slate-50'}`}>
                {icon}
            </div>
        </div>
    </div>
);

const AP_COLORS: Record<string, string> = { H: '#EF4444', M: '#F59E0B', L: '#10B981' };

interface ApChartTooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; payload: { color: string } }>;
}

const ApChartTooltip: React.FC<ApChartTooltipProps> = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const item = payload[0];
        return (
            <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs">
                <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.payload.color }} />
                    <span className="font-medium text-slate-700">{item.name}</span>
                </div>
                <p className="font-bold text-slate-800 mt-1">{item.value} causas</p>
            </div>
        );
    }
    return null;
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface ApqpDashboardProps {
    onBackToLanding: () => void;
}

const ApqpDashboard: React.FC<ApqpDashboardProps> = ({ onBackToLanding }) => {
    const { data, loading } = useApqpDashboardData();

    // Compute derived metrics
    const metrics = useMemo(() => {
        if (!data) return null;

        const totalFamilies = data.families.length;
        const totalDocs = data.amfeDocs.length + data.cpDocs.length + data.pfdDocs.length + data.hoDocs.length;

        // AP counts from AMFE docs
        let totalApH = 0;
        let totalApM = 0;
        let totalCauses = 0;
        for (const doc of data.amfeDocs) {
            totalApH += doc.apHCount;
            totalApM += doc.apMCount;
            totalCauses += doc.causeCount;
        }
        const totalApL = totalCauses - totalApH - totalApM;

        // Document completeness per family
        const familyCompleteness: Array<{
            familyId: number;
            familyName: string;
            hasPfd: boolean;
            hasAmfe: boolean;
            hasCp: boolean;
            hasHo: boolean;
        }> = [];

        for (const family of data.families) {
            const docs = data.familyDocsMap.get(family.id) || [];
            const modules = new Set(docs.map((d) => d.module));
            familyCompleteness.push({
                familyId: family.id,
                familyName: family.name,
                hasPfd: modules.has('pfd'),
                hasAmfe: modules.has('amfe'),
                hasCp: modules.has('cp'),
                hasHo: modules.has('ho'),
            });
        }

        const completeFamilies = familyCompleteness.filter(
            (f) => f.hasPfd && f.hasAmfe && f.hasCp && f.hasHo
        ).length;
        const completenessPercent = totalFamilies > 0 ? Math.round((completeFamilies / totalFamilies) * 100) : 0;

        return {
            totalFamilies,
            totalDocs,
            totalApH,
            totalApM,
            totalApL: Math.max(0, totalApL),
            totalCauses,
            completenessPercent,
            familyCompleteness,
        };
    }, [data]);

    const breadcrumbItems = useMemo(
        () => [
            { label: 'Inicio', onClick: onBackToLanding },
            { label: 'Dashboard APQP', isActive: true },
        ],
        [onBackToLanding]
    );

    if (loading) {
        return (
            <div className="min-h-full bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size={36} className="text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 text-sm">Cargando dashboard...</p>
                </div>
            </div>
        );
    }

    if (!data || !metrics) {
        return (
            <div className="min-h-full bg-slate-50 flex items-center justify-center">
                <p className="text-slate-500 text-sm">No se pudieron cargar los datos.</p>
            </div>
        );
    }

    const apData = [
        { name: 'Alta (H)', value: metrics.totalApH, color: AP_COLORS.H },
        { name: 'Media (M)', value: metrics.totalApM, color: AP_COLORS.M },
        { name: 'Baja (L)', value: metrics.totalApL, color: AP_COLORS.L },
    ];
    const totalApForPercent = metrics.totalApH + metrics.totalApM + metrics.totalApL;

    return (
        <div className="min-h-full bg-slate-50">
            {/* Breadcrumb */}
            <div className="bg-white border-b border-slate-200 px-6 py-3">
                <Breadcrumb items={breadcrumbItems} />
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {/* Page Header */}
                <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">Dashboard APQP</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Vista consolidada de riesgo y estado documental
                    </p>
                </div>

                {/* Section 1: KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                        title="Total Familias"
                        value={metrics.totalFamilies}
                        icon={<Layers size={20} className="text-blue-500" />}
                        colorClass="text-blue-700"
                    />
                    <KpiCard
                        title="Total Documentos APQP"
                        value={metrics.totalDocs}
                        icon={<FileText size={20} className="text-slate-500" />}
                        colorClass="text-slate-700"
                        subtitle={`${data.pfdDocs.length} PFD / ${data.amfeDocs.length} AMFE / ${data.cpDocs.length} CP / ${data.hoDocs.length} HO`}
                    />
                    <KpiCard
                        title="AP=H Sin Resolver"
                        value={metrics.totalApH}
                        icon={<AlertTriangle size={20} className={metrics.totalApH > 0 ? 'text-red-500' : 'text-emerald-500'} />}
                        colorClass={metrics.totalApH > 0 ? 'text-red-600' : 'text-emerald-600'}
                    />
                    <KpiCard
                        title="Completitud Documental"
                        value={`${metrics.completenessPercent}%`}
                        icon={<CheckCircle size={20} className={metrics.completenessPercent === 100 ? 'text-emerald-500' : 'text-amber-500'} />}
                        colorClass={metrics.completenessPercent === 100 ? 'text-emerald-600' : 'text-amber-600'}
                        subtitle={`${metrics.familyCompleteness.filter((f) => f.hasPfd && f.hasAmfe && f.hasCp && f.hasHo).length} de ${metrics.totalFamilies} familias completas`}
                    />
                </div>

                {/* Section 2: AP Distribution */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200/60">
                    <div className="px-6 py-5 border-b border-slate-100">
                        <h2 className="text-base font-bold text-slate-800 tracking-tight">
                            Distribucion de Action Priority (AP)
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">AIAG-VDA 2019 — Todas las causas AMFE</p>
                    </div>
                    <div className="p-6">
                        {totalApForPercent === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-8">
                                No hay causas registradas en los documentos AMFE.
                            </p>
                        ) : (
                            <div className="flex items-center gap-8 flex-wrap">
                                {/* Donut Chart */}
                                <div className="w-52 h-52 flex-shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={apData}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={2}
                                            >
                                                {apData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<ApChartTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Legend */}
                                <div className="flex-1 min-w-[200px] space-y-3">
                                    {apData.map((item) => {
                                        const pct = totalApForPercent > 0 ? Math.round((item.value / totalApForPercent) * 100) : 0;
                                        return (
                                            <div key={item.name} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: item.color }}
                                                        aria-hidden="true"
                                                    />
                                                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-bold text-slate-800">{item.value}</span>
                                                    <span className="text-xs text-slate-400 w-10 text-right">{pct}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-500">Total causas</span>
                                        <span className="text-sm font-bold text-slate-800">{totalApForPercent}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Section 3: AP por Producto */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200/60">
                    <div className="px-6 py-5 border-b border-slate-100">
                        <h2 className="text-base font-bold text-slate-800 tracking-tight">
                            AP por Producto (AMFE)
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Producto
                                    </th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        AP=H
                                    </th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        AP=M
                                    </th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        AP=L
                                    </th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Total Causas
                                    </th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Cobertura S/O/D
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.amfeDocs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-slate-400 text-sm">
                                            No hay documentos AMFE registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    data.amfeDocs.map((doc) => {
                                        const apL = Math.max(0, doc.causeCount - doc.apHCount - doc.apMCount);
                                        return (
                                            <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="font-medium text-slate-800">
                                                        {doc.projectName || doc.subject || '(Sin nombre)'}
                                                    </div>
                                                    {doc.partNumber && (
                                                        <div className="text-xs text-slate-400 mt-0.5">
                                                            {doc.partNumber}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-center px-4 py-3">
                                                    <span
                                                        className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-xs font-bold border ${
                                                            doc.apHCount > 0
                                                                ? 'bg-red-100 text-red-700 border-red-200'
                                                                : 'bg-green-100 text-green-700 border-green-200'
                                                        }`}
                                                    >
                                                        {doc.apHCount}
                                                    </span>
                                                </td>
                                                <td className="text-center px-4 py-3">
                                                    <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                                        {doc.apMCount}
                                                    </span>
                                                </td>
                                                <td className="text-center px-4 py-3">
                                                    <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                                        {apL}
                                                    </span>
                                                </td>
                                                <td className="text-center px-4 py-3 font-medium text-slate-700">
                                                    {doc.causeCount}
                                                </td>
                                                <td className="text-center px-4 py-3">
                                                    <span
                                                        className={`text-xs font-bold ${
                                                            doc.coveragePercent === 100
                                                                ? 'text-emerald-600'
                                                                : doc.coveragePercent >= 80
                                                                ? 'text-amber-600'
                                                                : 'text-red-600'
                                                        }`}
                                                    >
                                                        {doc.coveragePercent}%
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Section 4: Completitud Documental */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200/60">
                    <div className="px-6 py-5 border-b border-slate-100">
                        <h2 className="text-base font-bold text-slate-800 tracking-tight">
                            Completitud Documental por Familia
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Familia
                                    </th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        PFD
                                    </th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        AMFE
                                    </th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        CP
                                    </th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        HO
                                    </th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                        Estado
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {metrics.familyCompleteness.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-slate-400 text-sm">
                                            No hay familias de producto registradas.
                                        </td>
                                    </tr>
                                ) : (
                                    metrics.familyCompleteness.map((fc) => {
                                        const isComplete = fc.hasPfd && fc.hasAmfe && fc.hasCp && fc.hasHo;
                                        return (
                                            <tr key={fc.familyId} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-3 font-medium text-slate-800">
                                                    {fc.familyName}
                                                </td>
                                                <td className="text-center px-4 py-3">
                                                    {fc.hasPfd ? (
                                                        <span title="PFD presente"><CheckCircle size={18} className="text-emerald-500 mx-auto" aria-hidden="true" /><span className="sr-only">Presente</span></span>
                                                    ) : (
                                                        <span title="PFD faltante"><XCircle size={18} className="text-red-400 mx-auto" aria-hidden="true" /><span className="sr-only">Faltante</span></span>
                                                    )}
                                                </td>
                                                <td className="text-center px-4 py-3">
                                                    {fc.hasAmfe ? (
                                                        <span title="AMFE presente"><CheckCircle size={18} className="text-emerald-500 mx-auto" aria-hidden="true" /><span className="sr-only">Presente</span></span>
                                                    ) : (
                                                        <span title="AMFE faltante"><XCircle size={18} className="text-red-400 mx-auto" aria-hidden="true" /><span className="sr-only">Faltante</span></span>
                                                    )}
                                                </td>
                                                <td className="text-center px-4 py-3">
                                                    {fc.hasCp ? (
                                                        <span title="CP presente"><CheckCircle size={18} className="text-emerald-500 mx-auto" aria-hidden="true" /><span className="sr-only">Presente</span></span>
                                                    ) : (
                                                        <span title="CP faltante"><XCircle size={18} className="text-red-400 mx-auto" aria-hidden="true" /><span className="sr-only">Faltante</span></span>
                                                    )}
                                                </td>
                                                <td className="text-center px-4 py-3">
                                                    {fc.hasHo ? (
                                                        <span title="HO presente"><CheckCircle size={18} className="text-emerald-500 mx-auto" aria-hidden="true" /><span className="sr-only">Presente</span></span>
                                                    ) : (
                                                        <span title="HO faltante"><XCircle size={18} className="text-red-400 mx-auto" aria-hidden="true" /><span className="sr-only">Faltante</span></span>
                                                    )}
                                                </td>
                                                <td className="text-center px-4 py-3">
                                                    <span
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
                                                            isComplete
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}
                                                    >
                                                        {isComplete ? 'Completo' : 'Incompleto'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApqpDashboard;
