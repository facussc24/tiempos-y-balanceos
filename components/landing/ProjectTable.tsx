/**
 * ProjectTable — Compact, high-performance table for "Mis Proyectos".
 *
 * Columns:
 * 1. Health indicator (colored dot)
 * 2. Producto (name + client)
 * 3. Nº de Parte
 * 4. Fase (Pre-lanzamiento / Producción badge)
 * 5. Tipo (Maestro / Variante)
 * 6. AP=H (red count or green check)
 * 7. Acciones (Abrir →)
 *
 * Features:
 * - Search bar to filter by product name or client
 * - Click any row to open project
 * - REQUIERE ATENCIÓN sorted to top
 */

import React, { useMemo, useState } from 'react';
import {
    Search, ArrowRight, Check, GitMerge, Rocket, Factory, FileSpreadsheet,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import type { ProjectEntry, ProjectHealth } from '../../hooks/useProjectHub';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectTableProps {
    projects: ProjectEntry[];
    onSelectProject: (familyId: number) => void;
    onExportApqp?: (familyId: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CLIENT_DISPLAY_NAMES: Record<string, string> = {
    'VOLKSWAGEN': 'Volkswagen Argentina',
    'VWA': 'Volkswagen Argentina',
    'TOYOTA': 'Toyota Argentina',
    'PWA': 'Toyota Argentina',
};

function normalizeClientName(raw: string): string {
    if (!raw) return '';
    const stripped = raw.replace(/^\d+\s+/, '').trim();
    const upper = stripped.toUpperCase();
    if (CLIENT_DISPLAY_NAMES[upper]) return CLIENT_DISPLAY_NAMES[upper];
    if (stripped !== upper) return stripped;
    return stripped.split(' ').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ');
}

function getPrimaryMember(entry: ProjectEntry) {
    return entry.members.find(m => m.isPrimary) ?? entry.members[0] ?? null;
}

// ---------------------------------------------------------------------------
// Health dot
// ---------------------------------------------------------------------------

const HEALTH_DOT: Record<ProjectHealth, { color: string; ring: string; label: string; tooltip: string }> = {
    red: {
        color: 'bg-red-500',
        ring: 'ring-red-500/30',
        label: 'Requiere atención',
        tooltip: 'AP=H sin acciones o propuestas de cambio pendientes',
    },
    yellow: {
        color: 'bg-amber-400',
        ring: 'ring-amber-400/30',
        label: 'Incompleto',
        tooltip: 'Faltan documentos APQP en algún módulo',
    },
    green: {
        color: 'bg-emerald-500',
        ring: 'ring-emerald-500/30',
        label: 'Completo',
        tooltip: 'Todos los documentos presentes, sin pendientes',
    },
};

// ---------------------------------------------------------------------------
// Phase config
// ---------------------------------------------------------------------------

const PHASE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
    preLaunch: { label: 'Pre-lanzamiento', icon: Rocket, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border border-blue-200' },
    safeLaunch: { label: 'Safe Launch', icon: Rocket, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border border-blue-200' },
    production: { label: 'Producción', icon: Factory, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border border-emerald-200' },
    prototype: { label: 'Prototipo', icon: Rocket, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border border-purple-200' },
};

// ---------------------------------------------------------------------------
// Sort: red on top, then yellow, then green. Secondary: alphabetical.
// ---------------------------------------------------------------------------

const HEALTH_ORDER: Record<ProjectHealth, number> = { red: 0, yellow: 1, green: 2 };

function sortProjects(projects: ProjectEntry[]): ProjectEntry[] {
    return [...projects].sort((a, b) => {
        const ha = HEALTH_ORDER[a.health];
        const hb = HEALTH_ORDER[b.health];
        if (ha !== hb) return ha - hb;
        return a.family.name.localeCompare(b.family.name);
    });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ProjectTable: React.FC<ProjectTableProps> = ({ projects, onSelectProject, onExportApqp }) => {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        const sorted = sortProjects(projects);
        if (!search.trim()) return sorted;
        const q = search.trim().toLowerCase();
        return sorted.filter(entry => {
            const primary = getPrimaryMember(entry);
            const rawClient = entry.family.lineaName || primary?.lineaName || primary?.lineaCode || '';
            const client = normalizeClientName(rawClient);
            return (
                entry.family.name.toLowerCase().includes(q) ||
                client.toLowerCase().includes(q) ||
                (primary?.codigo || '').toLowerCase().includes(q)
            );
        });
    }, [projects, search]);

    return (
        <div>
            {/* Search bar */}
            <div className="relative mb-4 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar producto o cliente..."
                    aria-label="Buscar proyectos"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400
                               focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-colors"
                />
            </div>

            {/* Table */}
            <div className="bg-white shadow-sm border border-slate-200/60 rounded-xl overflow-hidden">
                <table className="w-full text-left" role="grid" aria-label="Tabla de proyectos">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-8" aria-label="Estado" />
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Producto</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Nº de Parte</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Fase</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Tipo</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center w-16">AP=H</th>
                            <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-24">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filtered.map(entry => {
                            const primary = getPrimaryMember(entry);
                            const rawClient = entry.family.lineaName || primary?.lineaName || primary?.lineaCode || '';
                            const clientName = normalizeClientName(rawClient);
                            const partNumber = entry.partNumber || primary?.codigo || '';
                            const healthCfg = HEALTH_DOT[entry.health];
                            const phaseCfg = entry.phase ? PHASE_CONFIG[entry.phase] : null;
                            const apH = entry.kpis.apHUnmitigated;

                            return (
                                <tr
                                    key={entry.family.id}
                                    onClick={() => onSelectProject(entry.family.id)}
                                    tabIndex={0}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectProject(entry.family.id); } }}
                                    role="row"
                                    aria-label={`Abrir proyecto ${entry.family.name}`}
                                    className="group cursor-pointer hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none transition-colors"
                                >
                                    {/* Health dot */}
                                    <td className="px-4 py-3">
                                        <Tooltip content={healthCfg.tooltip}>
                                            <span
                                                className={`inline-block w-2.5 h-2.5 rounded-full ${healthCfg.color} ring-2 ${healthCfg.ring}`}
                                                role="status"
                                                aria-label={healthCfg.label}
                                            />
                                        </Tooltip>
                                    </td>

                                    {/* Producto */}
                                    <td className="px-4 py-3 min-w-0">
                                        <div className="text-sm font-medium text-slate-800 truncate max-w-[260px]" title={entry.family.name}>
                                            {entry.family.name}
                                        </div>
                                        {clientName && (
                                            <div className="text-xs text-slate-500 truncate max-w-[260px]" title={clientName}>
                                                {clientName}
                                            </div>
                                        )}
                                    </td>

                                    {/* Nº de Parte */}
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        <span className="text-xs text-slate-500 font-mono">
                                            {partNumber || '\u2014'}
                                        </span>
                                    </td>

                                    {/* Fase */}
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        {phaseCfg ? (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${phaseCfg.color} ${phaseCfg.bg} ${phaseCfg.border}`}>
                                                <phaseCfg.icon size={10} />
                                                {phaseCfg.label}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-600">{'\u2014'}</span>
                                        )}
                                    </td>

                                    {/* Tipo */}
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        {entry.hasMaster ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200">
                                                <GitMerge size={10} />
                                                Maestro{entry.variantCount > 0 ? ` +${entry.variantCount}v` : ''}
                                            </span>
                                        ) : entry.variantCount > 0 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200">
                                                <GitMerge size={10} />
                                                Variante
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-600">{'\u2014'}</span>
                                        )}
                                    </td>

                                    {/* AP=H */}
                                    <td className="px-4 py-3 text-center">
                                        {apH > 0 ? (
                                            <Tooltip content="Action Priority = High (Prioridad de Acción Alta)">
                                                <span className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-md text-xs font-bold text-red-600 bg-red-50 border border-red-200">
                                                    {apH}
                                                </span>
                                            </Tooltip>
                                        ) : (
                                            <Tooltip content="Sin prioridades altas pendientes">
                                                <Check size={14} className="mx-auto text-emerald-500" />
                                            </Tooltip>
                                        )}
                                    </td>

                                    {/* Acciones */}
                                    <td className="px-4 py-3 text-right">
                                        <span className="inline-flex items-center gap-2">
                                            {onExportApqp && (
                                                <Tooltip content="Exportar Paquete APQP">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); onExportApqp(entry.family.id); }}
                                                        className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all"
                                                        aria-label={`Exportar APQP de ${entry.family.name}`}
                                                    >
                                                        <FileSpreadsheet size={14} />
                                                    </button>
                                                </Tooltip>
                                            )}
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 opacity-50 group-hover:opacity-100 transition-opacity">
                                                Abrir <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                                            </span>
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Empty filtered state */}
                {filtered.length === 0 && search.trim() && (
                    <div className="px-6 py-8 text-center">
                        <p className="text-sm text-slate-500">No se encontraron proyectos para "{search.trim()}"</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export { ProjectTable };
export type { ProjectTableProps };
